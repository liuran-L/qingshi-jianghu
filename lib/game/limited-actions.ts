import type { GameState, InteractionMode, LimitedActionId } from './types.ts';
import { getLocation } from './world.ts';
import { isTopicAvailable } from './npc-memory.ts';
import { getPrologueActions } from './prologue.ts';
import { dayOneActions, dayOneAllows, dayOneEntry, presentNpcIds } from './day-one.ts';
import { dayTwoActions, dayTwoEntry } from './day-two.ts';
import { growthActions, growthEntry } from './growth.ts';
import { campaignActive, campaignActions } from './campaign.ts';

export const NAME_REFUSED = '对方已婉拒透露姓名';

export interface LimitedAction {
  id: LimitedActionId;
  label: string;
  input: string;
  mode: InteractionMode;
  /** 关键且不可逆行动的当场取舍；仅供按钮常驻显示。 */
  hint?: string;
  /** 只列会改变本次结算的战况、资源与代价。 */
  details?: string;
  /** 可见但暂不能执行时，必须把具体原因直接告诉玩家。 */
  disabledReason?: string;
}

const action = (id: LimitedActionId, label: string, input: string, mode: InteractionMode, disabledReason?: string): LimitedAction => ({
  id,
  label,
  input,
  mode,
  ...(disabledReason ? { disabledReason } : {}),
});

/** 城门放行必须有玩家已经提出或持有的现实依据，不能只靠重复要求。 */
export function gateEntryBasis(state: GameState): boolean {
  const ma = state.npcStates['ma-sandao'];
  return state.player.hasRoadPass
    || state.inventoryItemIds.includes('temporary-stay-permit')
    || state.dayOne.gateName !== null
    || state.playerClaims.some((claim) => claim.toldNpcId === 'ma-sandao')
    || ma.memory.evidence.length > 0
    || ma.trust >= 2
    || ma.favor >= 2;
}

/** 选项只由规则状态与玩家已知信息生成，不接受 AI 注入新的行为标识。 */
export function getLimitedActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (campaignActive(state)) return campaignActions(state);
  if (!state.player.alive || state.prologueEnding || (npcId && !presentNpcIds(state).includes(npcId))) return [];
  if (state.gatePhase === 'detained' || state.dayOne.menu || state.dayOne.gatePosition === 'aside' || ['questioning', 'answered', 'disputed'].includes(state.dayOne.review)) return dayOneActions(state, npcId);
  if (state.dayTwo.menu) return dayTwoActions(state, npcId);
  if (state.growth.menu) return growthActions(state);
  if (state.locationId === 'yamen') return npcId === 'ning-buping' ? getPrologueActions(state, npcId) : [];
  return [...getPrologueActions(state, npcId), ...buildLimitedActions(state, npcId)].filter((item) => dayOneAllows(state, item.id) && isTopicAvailable(state, npcId, item.id)).slice(0, 6);
}

const phaseOneActionHints: Partial<Record<LimitedActionId, string>> = {
  'show-gate-fragment': '原物会被暂扣，你也须留在城门候复核。',
  'submit-search': '若搜出可疑之物，原物会被扣下，你也可能被留候复核。',
  'register-alias': '这个名字会写进客栈簿，与城门口供并存。',
  'review-deny': '这次改口会与先前口供一并留存。',
  'medical-lie': '这番说法会记入病案，拆布验伤时仍会核对。',
  'offer-bribe': '当场付二两，换这一次不细查；银钱不会退回。',
  'retain-cloth': '布条交医者留样，不再放回你的行囊。',
  'pay-basic': '只缓住一时失血，伤势与药性仍未处理。',
  'medical-credit': '先治伤，三两欠账会留下，日后仍须偿清。',
  'basic-on-credit': '只缓住一时失血，并留下三两欠账。',
  'seal-salt-evidence': '残片与病案交存县衙，原物不再留在背包。',
  'wait-night-ferry': '这一等会到夜里，货船与转运车不会为你停下。',
  'take-night-ferry': '上船便离开青石，也错过这次封验机会。',
  'transfer-fragment': '交出残片便无法再封验；中人只许你从渡口脱身。',
};

/** 提示只由当前规则状态与 actionId 派生，不写回 GameState。 */
export function withActionGuidance(state: GameState, item: LimitedAction): LimitedAction {
  if (item.hint || state.campaign.startedAt !== null || state.campaign.ending) return item;
  const hint = phaseOneActionHints[item.id];
  return hint ? { ...item, hint } : item;
}

export const getAvailableActions = (state: GameState, npcId: string | null): LimitedAction[] => {
  const items = campaignActive(state)
    ? campaignActions(state)
    : [...getLimitedActions(state, npcId), ...dayOneEntry(state, npcId), ...dayTwoEntry(state, npcId), ...growthEntry(state), ...campaignActions(state)];
  return items.map(item => withActionGuidance(state, item));
};

function buildLimitedActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.gatePhase === 'detained') return [];
  if (npcId && !getLocation(state.locationId).npcIds.includes(npcId)) return [];

  if (state.locationId === 'gate') {
    if (state.gatePhase === 'questioning') {
      const openingChoices: LimitedAction[] = [
        ...(!state.cartMarkObserved && state.knownClueIds.includes('abnormal-wound') ? [action('observe-gate', '观察免检货车', '我留意没有接受盘查的货车和赶车人。', 'action')] : []),
        ...(state.player.hasRoadPass || state.inventoryItemIds.includes('temporary-stay-permit') ? [action('present-gate-document', '出示已有路引或临时凭据', '这是我现有的路引或官府凭据，请按文书核验。', 'action')] : []),
        ...(state.inventoryItemIds.includes('ding17-fragment') ? [action('show-gate-fragment', '把行囊里的公文残片交给差役看', '我有一张从行囊夹层找到的公文残片，愿交给差役登记查验。', 'action')] : []),
        action('tell-attack', '照实说出城外遇袭', `我叫${state.player.name}。我在城外遭到袭击，同行者失散，路引也被夺走了。`, 'speech'),
        action('tell-pass-lost', '只说路引在路上遗失', `我叫${state.player.name}。路引在路上遗失了，其他事情与进城无关。`, 'speech'),
        ...(!state.npcKnowledge['ma-sandao'].knownName ? [action('ask-guard-name', '反问差役如何称呼', '敢问差爷如何称呼？', 'speech')] : []),
      ];
      if (!state.knownClueIds.includes('abnormal-wound')) openingChoices.push(action('inspect-wound', '检查左肋伤口', '我低头仔细检查左肋的伤口。', 'action'));
      if (!state.knownClueIds.includes('ding17-fragment')) openingChoices.push(action('inspect-bag', '检查湿透的行囊', '我仔细检查湿透的行囊和被割开的夹层。', 'action'));
      else if (state.inventoryItemIds.includes('ding17-fragment') && !state.knownClueIds.includes('black-scale-wax')) openingChoices.push(action('inspect-fragment', '查看行囊中的残片', '我再次检查行囊里的那张残片。', 'action', state.player.fatigue >= 85 ? '疲劳过重，先休息后再细看。' : undefined));
      return openingChoices;
    }

    if (state.gatePhase === 'searched') {
      return [action('submit-search', '解开行囊，让差役逐件查验', '我解开行囊，让差役逐件查验。', 'action')];
    }

    const choices: LimitedAction[] = [];
    if (!state.gateAccess) {
      if (state.knownClueIds.includes('attack-phrase') && !state.playerKnownFactIds.includes('ma-ding17-reaction')) choices.push(action('mention-ding17', '提起“丁字十七”', '你可曾听过“丁字十七”这几个字？', 'speech'));
      if (state.player.hasRoadPass || state.inventoryItemIds.includes('temporary-stay-permit')) choices.push(action('present-gate-document', '出示已有路引或临时凭据', '这是我现有的路引或官府凭据，请按文书核验。', 'action'));
      if (state.inventoryItemIds.includes('ding17-fragment')) choices.push(action('show-gate-fragment', '把行囊里的公文残片交给差役看', '我有一张从行囊夹层找到的公文残片，愿交给差役登记查验。', 'action'));
      if (gateEntryBasis(state)) choices.push(action('request-entry', '请按无路引规矩登记候验', '来由与现有物件都已说明，请按无路引行旅的规矩登记候验。', 'speech'));
      choices.push(action('challenge-search', '要求写明搜查依据', '若要搜查，请按规矩写明依据、经手人和所扣物件。', 'speech'));
      if (state.playerKnownFactIds.includes('ma-private-bribe-signal') && state.player.money >= 2) choices.push(action('offer-bribe', '递出二两，请他这次不细查', '方才的暗示我明白。这二两银子，请照说好的通融。', 'speech'));
    } else {
      if (!state.knownLocationIds.includes('inn')) choices.push(action('ask-lodging', '获准进城后询问落脚处', '我已经登记放行。城里可有能投宿歇脚的地方？', 'speech'));
      if (state.player.injury !== '无' && !state.knownLocationIds.includes('clinic')) choices.push(action('ask-clinic', '获准进城后询问医馆', '我已经登记放行。城中哪里可以找大夫看伤？', 'speech'));
    }
    if (!state.knownClueIds.includes('abnormal-wound')) choices.push(action('inspect-wound', '检查左肋伤口', '我低头仔细检查左肋的伤口。', 'action'));
    if (!state.knownClueIds.includes('ding17-fragment')) choices.push(action('inspect-bag', '检查湿透的行囊', '我仔细检查湿透的行囊和被割开的夹层。', 'action'));
    else if (state.inventoryItemIds.includes('ding17-fragment') && !state.knownClueIds.includes('black-scale-wax')) choices.push(action('inspect-fragment', '查看行囊中的残片', '我再次检查行囊里的那张残片。', 'action', state.player.fatigue >= 85 ? '疲劳过重，先休息后再细看。' : undefined));
    if (!state.playerKnownFactIds.includes('gate-selective-inspection')) choices.push(action('observe-gate', '观察城门四周', '我不动声色地观察城门告示和来往行旅。', 'action'));
    return choices;
  }

  if (state.locationId === 'inn') {
    const choices: LimitedAction[] = [];
    if (npcId && !state.npcKnowledge[npcId]?.knownName) choices.push(action('ask-name', '询问对方如何称呼', '敢问阁下如何称呼？', 'speech'));
    choices.push(
      action('ask-news', state.playerKnownFactIds.includes('inn-corpse-rumor') ? '追问无名尸传闻' : '打听近日见闻', '近来县里可有什么反常的事？', 'speech'),
      ...(!state.playerKnownFactIds.includes('inn-arrival-inquiry') ? [action('observe-inn', '观察客栈大堂', '我留意客栈大堂里的客人、出入口和动静。', 'action')] : []),
    );
    if (npcId === 'su-wantang') {
      choices.unshift(action('request-room', '询问客房', '掌柜，这里可还有客房？', 'speech'));
      choices.push(action('rest-night', '付二两住一夜', '我要住一晚，好好休息。', 'action'));
    }
    return choices;
  }

  if (state.locationId === 'clinic') {
    const choices: LimitedAction[] = [];
    if (!state.npcKnowledge['shen-yanqiu']?.knownName) choices.push(action('ask-name', '询问医者如何称呼', '敢问先生如何称呼？', 'speech'));
    if (!state.playerKnownFactIds.includes('clinic-routine')) choices.push(action('observe-clinic', '观察医馆陈设', '我留意医馆里的药柜、器具和来往之人。', 'action'));
    if (state.player.injury !== '无') choices.unshift(action('request-treatment', '请医者处理伤口', '请帮我看看这处伤口，血一直止不住。', 'speech'));
    if (state.triggeredWorldEventIds.includes('nameless-corpse') && !state.playerKnownFactIds.includes('clinic-corpse-details')) {
      choices.push(action('ask-corpse', '询问后堂的担架', '方才抬进后堂的人出了什么事？', 'speech'));
    }
    if (
      state.playerKnownFactIds.includes('clinic-corpse-details')
      && state.playerKnownFactIds.includes('doctor-wound-residue')
      && !state.playerKnownFactIds.includes('corpse-wound-link')
    ) {
      choices.push(action('compare-corpse-wound', '请医者比对两处伤口', '那人的伤口，是否和我先前这处伤一样？', 'speech'));
    }
    return choices;
  }

  const atDock = state.locationId === 'dock';
  const unattendedDock = atDock && npcId === null;
  return [
    ...(npcId && !state.npcKnowledge[npcId]?.knownName && !state.npcKnowledge[npcId]?.learnedFacts.includes(NAME_REFUSED) ? [action('ask-name', '询问对方如何称呼', '敢问阁下如何称呼？', 'speech')] : []),
    ...(atDock && !state.playerKnownFactIds.includes('dock-salt-movement') ? [action('ask-local-news', '试探此地近况', unattendedDock ? '我在岸边听脚夫与船工议论近日的船货动静。' : '这里近日可有什么异样？', unattendedDock ? 'action' : 'speech')] : []),
    ...(atDock && !state.playerKnownFactIds.includes('dock-salt-movement') ? [action('observe-scene', '观察四周', '我仔细观察四周的人、物件和出入口。', 'action')] : []),
    action('leave-conversation', '收住话头，退到一旁', '我没有继续搭话，只退到一旁留意动静。', 'action'),
  ];
}
