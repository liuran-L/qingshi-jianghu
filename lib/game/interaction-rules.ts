import { getAvailableActions as getLimitedActions, NAME_REFUSED } from './limited-actions.ts';
import { resolveDayOne } from './day-one.ts';
import { resolveDayTwo } from './day-two.ts';
import { resolveEconomy } from './economy.ts';
import { resolveGrowth, hasGrowthNode } from './growth.ts';
import { getTopicStatus } from './npc-memory.ts';
import { resolvePrologue } from './prologue.ts';
import type {
  AIInteractionProposal,
  ClueId,
  GameState,
  InteractionRequest,
  InventoryItemId,
  KnownFactId,
  LocationId,
  NpcRuntimeState,
  PlayerClaim,
  PlayerState,
  WorldEventId,
} from './types.ts';

export interface RuleResolution {
  timeCostMinutes: number;
  dialogue?: string;
  narration?: string;
  discoveredLocationIds?: LocationId[];
  discoveredFactIds?: KnownFactId[];
  discoveredClueIds?: ClueId[];
  discoveredItemIds?: InventoryItemId[];
  removedItemIds?: InventoryItemId[];
  npcLearnedFact?: string;
  knownWorldEventIds?: WorldEventId[];
  learnedNpcName?: string;
  learnedNpcIdentity?: string;
  healthDelta?: number;
  fatigueDelta?: number;
  moneyDelta?: number;
  injuryAfter?: PlayerState['injury'];
  poisonAfter?: PlayerState['poison'];
  gatePhase?: GameState['gatePhase'];
  gateAccess?: boolean;
  npcStatePatch?: Partial<NpcRuntimeState>;
  claim?: Omit<PlayerClaim, 'atMinutes'> & { belief: number };
  lodgingRecord?: boolean;
  dangerLog?: string;
}

const clampText = (text: string | undefined) => text?.trim().slice(0, 800) || undefined;
const fatiguePenalty = (fatigue: number) => (fatigue >= 85 ? 2 : fatigue >= 65 ? 1 : 0);

/**
 * 将表达候选解析为本地规则事务。候选没有任何数值或知识写权限；
 * 只有当前有限选项中实际存在的 actionId 才能进入规则分支。
 */
export function resolveInteraction(
  state: GameState,
  request: InteractionRequest,
  proposal: AIInteractionProposal,
): RuleResolution | null {
  if (!state.player.alive || !request.input.trim()) return null;
  if (request.mode === 'speech' && !request.npcId) return null;
  const allowed = getLimitedActions(state, request.npcId).some((item) => item.id === request.actionId && item.mode === request.mode);
  if (!allowed) return null;
  const dayOne = resolveDayOne(state, request);
  if (dayOne) return dayOne;
  const dayTwo = resolveDayTwo(state, request);
  if (dayTwo) return dayTwo;
  const economy = resolveEconomy(state, request);
  if (economy) return economy;
  const growth = resolveGrowth(state, request);
  if (growth) return growth;
  const prologue = resolvePrologue(state, request);
  if (prologue) return prologue;
  const base: RuleResolution = {
    timeCostMinutes: 5,
    dialogue: request.npcId ? clampText(proposal.dialogue) : undefined,
    narration: clampText(proposal.narration),
  };
  const maState = state.npcStates['ma-sandao'];
  if (request.npcId && getTopicStatus(state, request.npcId, request.actionId) === 'reopened') {
    if (request.actionId === 'ask-name') return { timeCostMinutes: 5, learnedNpcName: request.npcId === 'su-wantang' ? '苏掌柜' : '陆兄', dialogue: request.npcId === 'su-wantang' ? '“先前你没追问，我记着。姓苏，叫苏掌柜便是。”' : '“你还算知趣。姓陆，称一声陆兄就好。”' };
    if (request.actionId === 'ask-news' && state.npcStates[request.npcId].memory.topics['ask-news']?.evidence.includes('nameless-corpse')) base.dialogue = '“你先前问过。到眼下，我还没听到新的可信消息。”';
    else if (request.actionId === 'ask-news' && !state.triggeredWorldEventIds.includes('nameless-corpse')) base.dialogue = '“今日也没听到什么新事，还是那些查路引的议论。”';
  }

  switch (request.actionId) {
    case 'tell-attack': {
      const belief = Math.max(0, Math.min(3, 1 + state.player.abilities.eloquence - fatiguePenalty(state.player.fatigue)));
      return { ...base, timeCostMinutes: 4, gatePhase: 'explaining', claim: { id: `claim-attack-${state.playerClaims.length + 1}`, text: request.input, toldNpcId: 'ma-sandao', belief } };
    }
    case 'tell-pass-lost': {
      const belief = Math.max(0, Math.min(3, state.player.abilities.eloquence - fatiguePenalty(state.player.fatigue)));
      return { ...base, timeCostMinutes: 4, gatePhase: 'explaining', npcStatePatch: { suspicion: maState.suspicion + 1 }, claim: { id: `claim-pass-${state.playerClaims.length + 1}`, text: request.input, toldNpcId: 'ma-sandao', belief } };
    }
    case 'ask-guard-name':
      return { ...base, timeCostMinutes: 5, gatePhase: 'questioning', learnedNpcName: '马三刀', learnedNpcIdentity: '负责城门盘查的巡检差役' };
    case 'stay-silent':
      return { ...base, timeCostMinutes: 6, gatePhase: 'explaining', npcStatePatch: { suspicion: maState.suspicion + 2, attitude: maState.attitude - 1 } };
    case 'ask-lodging':
      return { ...base, discoveredLocationIds: ['inn'] };
    case 'ask-clinic':
      return { ...base, discoveredLocationIds: ['clinic'] };
    case 'mention-ding17':
      return { ...base, timeCostMinutes: 6, discoveredFactIds: ['ma-ding17-reaction'], npcStatePatch: { suspicion: maState.suspicion + 2, informedRiverGang: true }, dangerLog: '守门差役听见“丁字十七”后向城内使了个眼色，用意尚不清楚。' };
    case 'challenge-search':
      return { ...base, timeCostMinutes: 8, discoveredFactIds: ['guard-search-threat'], npcStatePatch: { suspicion: maState.suspicion + 2, hostility: maState.hostility + 1, attitude: maState.attitude - 1 } };
    case 'offer-bribe':
      return { ...base, timeCostMinutes: 7, moneyDelta: -2, gatePhase: 'cleared', gateAccess: true, dialogue: '“两两，换这一次不细查。进城后别说在我这里见过什么。”', narration: '他借着整理登记簿收走碎银，侧身让开。你清楚记得这次通行付出的代价。' };
    case 'present-gate-document':
      return { ...base, timeCostMinutes: 5, gatePhase: 'cleared', gateAccess: true, dialogue: '“文书能对上。登记过便进，出了差错仍要回来问话。”', narration: '差役核过印记和登记，将文书原样交回。' };
    case 'show-gate-fragment':
      return { ...base, timeCostMinutes: 8, gatePhase: 'detained', gateAccess: false, removedItemIds: ['ding17-fragment'], npcStatePatch: { detainedPlayer: true, suspicion: maState.suspicion + 2, informedRiverGang: true }, dialogue: '“残缺公文也得登记来源。东西先扣，人到墙边候复核。”', narration: '差役当面记下残片字样和经手人，将原物封在纸袋里；你被留在城门一侧，仍可申请总捕头复核。', dangerLog: '你主动出示“丁字十七”残片；差役登记并暂扣原物，要求你留候复核。' };
    case 'request-entry':
      if (maState.suspicion >= 3) {
        return { ...base, timeCostMinutes: 4, gatePhase: 'searched', dialogue: '“疑点不少。行囊解开，查清了再谈进城。”', narration: '守门差役横过铁尺，另一名差役堵住了退路。' };
      }
      return { ...base, timeCostMinutes: 4, gatePhase: 'cleared', gateAccess: true, dialogue: '“进去。住哪里、见过谁，日后问起来都要说得清。”', narration: '他终于收回铁尺，让出仅容一人通过的空隙。' };
    case 'submit-search':
      if (state.inventoryItemIds.includes('ding17-fragment')) {
        return { ...base, timeCostMinutes: 10, gatePhase: 'detained', gateAccess: false, removedItemIds: ['ding17-fragment'], npcStatePatch: { searchedPlayer: true, detainedPlayer: true, suspicion: maState.suspicion + 3, informedRiverGang: true }, dialogue: '“这东西哪来的？先在这儿候着，等班房来人。”', narration: '铁尺压住你的手腕，另一名差役夺过残片，将你看在城门一侧。', dangerLog: '差役在搜查中发现“丁字十七”残片，夺走残片并扣留了你。' };
      }
      return { ...base, timeCostMinutes: 8, gatePhase: 'cleared', gateAccess: true, npcStatePatch: { searchedPlayer: true }, dialogue: '“没查出违禁物。进去，别再给自己找事。”', narration: '行囊里的东西被粗粗翻过，湿黏的内衬没有拆开。他最终还是收回了铁尺。' };
    case 'inspect-wound':
      return { ...base, timeCostMinutes: 7, discoveredClueIds: ['abnormal-wound'], narration: hasGrowthNode(state, 'medicine-diagnosis') ? '你辨出创缘受刃时受力一致，伤口周围的淤色并非普通跌撞所致；这只是更准确的观察，不能替代医者验伤。' : undefined };
    case 'inspect-bag':
      return { ...base, timeCostMinutes: 8, discoveredClueIds: ['ding17-fragment'], discoveredItemIds: ['ding17-fragment'], discoveredFactIds: ['baggage-watch-mark'], narration: '你在割开的夹层里摸到一张沾血的公文残片，只辨出“丁字十七”与半枚县衙火漆。更怪的是，行囊外带内侧多了一道新划的短痕，像给认得记号的人辨包用；你只能确认痕迹不旧，尚不知道是谁留下。' };
    case 'inspect-fragment':
      return state.player.fatigue >= 85 ? { ...base, timeCostMinutes: 6 } : { ...base, timeCostMinutes: 6, discoveredClueIds: ['black-scale-wax'] };
    case 'observe-gate':
      return { ...base, timeCostMinutes: 8, discoveredFactIds: ['gate-selective-inspection', 'cart-mark'], narration: '普通商贩被逐个盘问，一辆油布货车却只停了一瞬。守门差役看了看车夫便挥手。你注意到车门铰链黏着鱼鳞形黑蜡，车夫右眉有疤。这些是亲见的特征，尚不能证明他们在运什么。' };
    case 'request-room':
      return { ...base, learnedNpcIdentity: '悦来客栈掌柜' };
    case 'rest-night':
      if (state.economy.innCredit === 2) return { ...base, timeCostMinutes: 12 * 60, fatigueDelta: -75, healthDelta: 4, lodgingRecord: true, narration: '你用工钱牌抵掉一晚普通房钱。房簿仍按你登记的名字留下记录；工钱牌只此一次。' };
      if (state.player.money < 2) return { ...base, timeCostMinutes: 3 };
      return { ...base, timeCostMinutes: 12 * 60, moneyDelta: -2, fatigueDelta: -75, healthDelta: 4, lodgingRecord: true };
    case 'request-treatment':
      if (state.player.money < 3) return { ...base, timeCostMinutes: 5, learnedNpcIdentity: '回春堂坐堂医' };
      return { ...base, timeCostMinutes: 35, discoveredClueIds: ['abnormal-wound'], discoveredFactIds: state.dayOne.cloth === 'keep' ? [] : ['doctor-wound-residue'], narration: state.dayOne.cloth === 'keep' ? '创缘整齐，是刃伤而非枯枝撕裂。布条交你自留，尚未作药性检验。' : '创缘整齐，是刃伤而非枯枝撕裂。留样检验已记录。', learnedNpcName: '沈砚秋', learnedNpcIdentity: '回春堂坐堂医', healthDelta: 15, fatigueDelta: -5, moneyDelta: -3, injuryAfter: '无', poisonAfter: '不明残毒' };
    case 'ask-corpse':
      return { ...base, timeCostMinutes: 8, discoveredFactIds: ['clinic-corpse-details'], knownWorldEventIds: ['nameless-corpse'] };
    case 'compare-corpse-wound':
      return { ...base, timeCostMinutes: 8, discoveredClueIds: ['matching-corpse-wound'], discoveredFactIds: ['corpse-wound-link'] };
    case 'ask-news':
      return state.triggeredWorldEventIds.includes('nameless-corpse')
        ? { ...base, discoveredLocationIds: ['clinic'], discoveredFactIds: ['inn-corpse-rumor'], knownWorldEventIds: ['nameless-corpse'] }
        : base;
    case 'ask-name':
      return request.npcId === 'shen-yanqiu' ? { ...base, learnedNpcName: '沈砚秋', learnedNpcIdentity: '回春堂坐堂医' } : { ...base, npcLearnedFact: NAME_REFUSED };
    case 'observe-inn':
      return state.playerKnownFactIds.includes('inn-arrival-inquiry') ? base : { ...base, discoveredFactIds: ['inn-arrival-inquiry'], narration: '你留意门边湿伞和柜上的水迹。伙计提到天未亮时有人先来问过：今日是否会有一个带伤、背湿行囊的外乡客投店。来人没留姓名，只说午后便换地方。' };
    case 'observe-clinic':
    case 'observe-scene':
    case 'ask-local-news':
    case 'leave-conversation':
      return base;
    default:
      return null;
  }
}
