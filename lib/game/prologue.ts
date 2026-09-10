import type { GameState, InteractionRequest, LimitedActionId } from './types.ts';
import type { LimitedAction } from './limited-actions.ts';
import type { RuleResolution } from './interaction-rules.ts';
import { recordNpcStatement } from './npc-memory.ts';

export const CARGO_ARRIVAL = 40 * 60;
export const CARGO_DEPARTURE = 46 * 60;
export const prologueFields = ['prologueSchema', 'chengShouyiIdentified', 'poisonWoundLinked', 'cartMarkObserved', 'evidenceCustody', 'day3CargoStatus', 'prologueEnding', 'saltCase'] as const;
export const evidenceMemoryIds = ['abnormal-wound', 'ding17-fragment', 'medical-report', 'cart-mark', 'cheng-identity', 'release-ledger', 'stance-observation'];
export function initialPrologue(): Pick<GameState, typeof prologueFields[number]> {
  return { prologueSchema: 1, chengShouyiIdentified: false, poisonWoundLinked: false, cartMarkObserved: false,
    evidenceCustody: { fragment: 'unknown', medical: 'unknown', cart: 'unknown', identity: 'unknown' },
    day3CargoStatus: 'pending', prologueEnding: null,
    saltCase: { identitySource: null, reported: false, submittedSources: [], cartChecked: false, ledgerChecked: false, endedAt: null, stayPermitUntil: null } };
}

/** 世界事实只按时间推进；是否显示给玩家由消息来源另行决定。 */
export function advanceCargo(state: GameState): GameState {
  if (state.day3CargoStatus === 'sealed') return state;
  const elapsed = state.worldMinutes - state.storyStartedAtMinutes;
  const status = elapsed >= CARGO_DEPARTURE ? 'departed' : elapsed >= CARGO_ARRIVAL ? 'unloading' : 'pending';
  const changed: GameState = state.day3CargoStatus === status ? state : { ...state, day3CargoStatus: status };
  if (status !== 'pending' && state.locationId === 'yamen' && state.saltCase.reported && state.triggeredWorldEventIds.includes('ding17-ship-arrives') && !state.knownWorldEventIds.includes('ding17-ship-arrives')) return { ...changed, knownWorldEventIds: [...changed.knownWorldEventIds, 'ding17-ship-arrives'] };
  return changed;
}

export function verifiableSources(state: GameState): string[] {
  const sources: string[] = [];
  if (state.inventoryItemIds.includes('ding17-fragment') && state.evidenceCustody.fragment === 'player') sources.push('baggage');
  if (state.poisonWoundLinked && state.playerKnownFactIds.includes('medical-report')) sources.push('clinic');
  if (state.cartMarkObserved) sources.push('gate');
  if (state.chengShouyiIdentified) sources.push(state.saltCase.identitySource === 'roster' ? 'inn' : 'recollection');
  return [...new Set(sources)];
}

const choice = (id: LimitedActionId, label: string, input: string, mode: 'speech' | 'action' = 'speech'): LimitedAction => ({ id, label, input, mode });
export function getPrologueActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.gatePhase === 'detained' || state.prologueEnding) return [];
  const result: LimitedAction[] = [];
  if (state.locationId === 'clinic' && npcId === 'shen-yanqiu') {
    if (state.playerKnownFactIds.includes('clinic-corpse-details') && !state.chengShouyiIdentified) result.push(choice('identify-memory', '再看一眼死者，回想荒道同行人', '我想再看一眼他的面容，试着回想同行者。', 'action'));
    if (state.poisonWoundLinked && !state.playerKnownFactIds.includes('medical-report')) result.push(choice('request-medical-report', '请医者写下两处伤痕', '能否把两处伤痕的比对结果写下来？'));
    if (verifiableSources(state).length >= 2 && !state.knownLocationIds.includes('yamen')) result.push(choice('ask-ning-referral', '询问这些证据该交给谁', '这些东西应当交给谁查验？'));
  }
  if (state.locationId === 'inn' && npcId === 'su-wantang' && state.playerKnownFactIds.includes('clinic-corpse-details') && !state.chengShouyiIdentified) result.push(choice('identify-roster', '拿体貌特征去查商旅名册', '死者左耳有旧豁口，小指缺了半节。店里可有这样一位商旅？'));
  if (state.locationId === 'yamen' && npcId === 'ning-buping') {
    const sourceKey = verifiableSources(state).join(',') || 'unsubstantiated';
    if (!state.npcStates[npcId].memory.statements.some((s) => s.id.startsWith('salt-report:') && s.value === sourceKey)) result.push(choice('report-salt-case', '报案并出示手中线索', '我想报荒道遇袭与河边死者的案，请先核验这些线索。'));
    if (state.saltCase.reported && state.day3CargoStatus === 'pending') result.push(choice('await-cargo', '在候事廊等船讯（最多六时辰）', '我在候事廊等船讯，不另作走动。', 'action'));
    if (state.saltCase.reported && state.day3CargoStatus === 'unloading' && !state.saltCase.cartChecked) result.push(choice('inspect-cargo', '随宁不平封验转运货车（45分钟）', '请带我去核对货车与手中的证据。', 'action'));
    if (state.saltCase.cartChecked && !state.saltCase.ledgerChecked && state.day3CargoStatus === 'unloading') result.push(choice('check-release-ledger', '核对放行簿与收钱记录（20分钟）', '还请把车号、日期和当班差役的签押一并核对。'));
    if (state.saltCase.ledgerChecked && state.day3CargoStatus === 'unloading' && state.chengShouyiIdentified && state.poisonWoundLinked && state.playerKnownFactIds.includes('medical-report') && state.evidenceCustody.fragment === 'player') result.push(choice('seal-salt-evidence', '交出残片与病案，请县衙封存（15分钟）', '我愿把残片和病案副本正式交存，请给我收据。', 'action'));
  }
  if (state.locationId === 'dock' && npcId === null) {
    const dangerConfirmed = state.chengShouyiIdentified || state.poisonWoundLinked;
    const departed = state.day3CargoStatus === 'departed';
    if (!departed && (state.dayTwo.departurePlan === 'night-ferry' || state.dayTwo.brokerContact === 'offered')) result.push(choice('wait-night-ferry', '在河岸等到夜渡时分（最多十二时辰）', '我留在河岸暗处，等货船与转运车的动静过去。', 'action'));
    if (departed && state.dayTwo.departurePlan === 'night-ferry' && dangerConfirmed && !state.saltCase.reported) result.push(choice('take-night-ferry', '登上夜渡，离开青石', '我不再报案，登船离开青石。', 'action'));
    if (departed && state.dayTwo.brokerContact === 'offered' && state.inventoryItemIds.includes('ding17-fragment') && state.evidenceCustody.fragment === 'player') result.push(choice('transfer-fragment', '交出盐引残片，换一枚渡口木牌', '我把残片交出，只要这一次渡口凭记。', 'action'));
  }
  return result;
}

export function resolvePrologue(state: GameState, request: InteractionRequest): RuleResolution | null {
  const left = state.storyStartedAtMinutes + CARGO_DEPARTURE - state.worldMinutes;
  switch (request.actionId) {
    case 'identify-roster': return { timeCostMinutes: 15, discoveredFactIds: ['cheng-identity'], dialogue: '“有。程守义，替商旅记账的。前些天还在这里落过脚。”', narration: '她翻出留宿商旅的名册：程守义，左耳旧伤，小指残缺。你记下该页日期与同宿商号；两处特征与医者描述一致。这次，死者不再只是河边的无名客。' };
    case 'identify-memory': return { timeCostMinutes: 15, discoveredFactIds: ['cheng-identity'], narration: '你走近白布。那处缺了半节的小指让雨夜的记忆骤然清晰：他曾用这只手替商队拨算盘，旁人叫他“程守义，程账房”。左耳豁口与低头记账的侧脸，也都对得上。至于袭击时那阵混乱，你仍只记得零散声响。', dialogue: '“姓名是你认出的，伤处是我验的。”沈砚秋把两句话分行记下。' };
    case 'request-medical-report': return { timeCostMinutes: 15, discoveredFactIds: ['medical-report'], dialogue: '“两处都是淬毒刃留下的浅创，残着乌鳞散。死者失血太久，毒性又重，才没撑住。至于下手人的姓名，我从伤口里验不出来。”', narration: '沈砚秋摊开病案，在两处创口的长度、走向与药性反应下分别签名。原案留在回春堂，你拿到一份盖着医馆印的副本。' };
    case 'ask-ning-referral': return { timeCostMinutes: 5, discoveredLocationIds: ['yamen'], discoveredFactIds: ['ning-referral'], dialogue: '“这桩事医馆查不下去。去县衙候事廊找总捕头宁不平，就说要递验伤文书。哪件是亲眼见的，哪件是别人转告的，照原样说。”', narration: '沈砚秋把去县衙的路指给你，又叮嘱一句：“只凭名字，别认错人。”' };
    case 'report-salt-case': {
      const enough = verifiableSources(state).length >= 2;
      return { timeCostMinutes: 10, learnedNpcName: '宁不平', learnedNpcIdentity: '青石县总捕头', discoveredFactIds: enough ? ['cargo-schedule'] : [], dialogue: enough ? '“宁不平。文书、验伤和目击分开记。两处来由对得上，我能先发临时查验文书；要拿人，还得看车上查出什么。”' : '“我是宁不平。口供先记下。只有这一件东西，还拦不得官盐车；再找一处能对得上的人或物来。”', narration: enough ? '他翻出预报船期：第三日上午九点，丁字十七号船抵埠；转运车下午三点离城。封验、复核与交存都得在三点前办完。若病案或死者身份还没弄清，须先去补齐。' : '差役逐项记下你出示的东西，把残片原样交回，也没有发下扣车文书。' };
    }
    case 'await-cargo': {
      const remaining = state.storyStartedAtMinutes + CARGO_ARRIVAL - state.worldMinutes;
      return { timeCostMinutes: Math.min(720, remaining), narration: remaining > 1440 ? '白日里，差役抄录你带来的几样东西。宁不平分别派人去医馆与城门问话，你在廊下候着，听见值更牌第一次交接。' : remaining > 720 ? '灯油换过，廊下少了人声。几份记录已分送查对，货船还在河上；残片仍在你手里。' : '第三日上午，传讯差役带回靠岸消息：丁字十七号船已抵埠，货车将在下午三点离城。宁不平把临时查验文书压在桌上：“现在动身，别误了时辰。”' };
    }
    case 'inspect-cargo': return { timeCostMinutes: 45, narration: left <= 45 ? '你们赶到交接处时，车队已经出了城。宁不平收起临时查验文书：“车没验过，簿上便不能写扣下。”' : `你随宁不平到城门内的转运处。${state.cartMarkObserved ? '车夫右眉的疤与先前所见相合' : '你记下车夫右眉那道旧疤'}，车门铰链也留着鱼鳞形黑蜡。宁不平取下蜡样、核过车号；封条尚未落印，离下午三点还要抓紧。`, discoveredFactIds: left > 45 ? ['cart-verified', 'cart-mark'] : [] };
    case 'check-release-ledger': return { timeCostMinutes: 20, narration: left <= 20 ? '放行簿尚未核完，离城时限已过。缺少及时完成的封验手续，货车按原程离开。' : '宁不平对照车号和签押，发现免检记录与车夫记下的“门钱”相合。差役去取原簿时，守门差役正撕下对应的一页；湿纸没有烧透，日期和签押还在。车夫与递话的小厮被分开问话，两份口供均指向收钱放行与传递行程消息。', discoveredFactIds: left > 20 ? ['ledger-verified'] : [] };
    case 'seal-salt-evidence': return { timeCostMinutes: 15, narration: left <= 15 ? '交存手续还没办完，下午三点的更牌已经敲过。货车出了城，宁不平只得撤下封条；残片仍在你手中。' : '残片断边与车中文书存根严丝合缝，“丁字十七”、县衙火漆、车门黑蜡与放行簿日期也逐一对上。你记得程守义曾靠近自己的行囊；袭击者受谁差遣、半张纸原要送往何处，卷中仍是空白。', dialogue: left <= 15 ? undefined : '“马三刀收钱放车、向城里递话，又撕毁簿页，这几桩已有物证。”宁不平把残片、病案副本和簿页分别封好，“车扣下，人带走。你拿三日暂留凭条，随时候询。”', discoveredFactIds: left > 15 ? ['sealed-case', 'public-yamen-role', 'public-river-gang-role', 'public-qingyue-role', 'act-one-surface-conflict', 'act-one-involvement'] : [] };
    default: return null;
  }
}

function rememberEvidence(state: GameState, npcId: string, ids: string[]): GameState {
  const npc = state.npcStates[npcId];
  return { ...state, npcStates: { ...state.npcStates, [npcId]: { ...npc, memory: { ...npc.memory, evidence: [...new Set([...npc.memory.evidence, ...ids])] } } } };
}

export function applyPrologue(state: GameState, before: GameState, request: InteractionRequest): GameState {
  let next = { ...state, evidenceCustody: { ...state.evidenceCustody }, saltCase: { ...state.saltCase } };
  switch (request.actionId) {
    case 'inspect-bag': next.evidenceCustody.fragment = 'player'; break;
    case 'submit-search': case 'show-gate-fragment': if (before.inventoryItemIds.includes('ding17-fragment')) next.evidenceCustody.fragment = 'ma'; break;
    case 'observe-gate': next.cartMarkObserved = true; next.evidenceCustody.cart = 'player'; break;
    case 'request-treatment': if (before.player.money >= 3) next.evidenceCustody.medical = 'shen'; break;
    case 'compare-corpse-wound': next.poisonWoundLinked = true; break;
    case 'identify-roster': case 'identify-memory':
      next.chengShouyiIdentified = true;
      next.saltCase.identitySource = request.actionId === 'identify-roster' ? 'roster' : 'recollection';
      next.evidenceCustody.identity = 'player';
      next = rememberEvidence(next, request.npcId!, ['cheng-identity']);
      break;
    case 'request-medical-report': next.evidenceCustody.medical = 'player'; next = rememberEvidence(next, 'shen-yanqiu', ['medical-report']); break;
    case 'report-salt-case': {
      const sources = verifiableSources(before);
      next = recordNpcStatement(next, 'ning-buping', { id: `salt-report:${before.worldMinutes}`, subject: `evidence-shown:${before.worldMinutes}`, value: sources.join(',') || 'unsubstantiated', text: '请求查验：' + (sources.join('、') || '只有口头报案'), truth: 'unknown' });
      next = rememberEvidence(next, 'ning-buping', [ ...(sources.includes('baggage') ? ['ding17-fragment'] : []), ...(sources.includes('clinic') ? ['medical-report'] : []), ...(sources.includes('gate') ? ['cart-mark'] : []), ...(before.chengShouyiIdentified ? ['cheng-identity'] : []) ]);
      if (sources.length >= 2) { next.saltCase.reported = true; next.saltCase.submittedSources = sources; }
      break;
    }
    case 'inspect-cargo': if (next.day3CargoStatus === 'unloading') { next.saltCase.cartChecked = true; next.cartMarkObserved = true; next.evidenceCustody.cart = 'player'; next = rememberEvidence(next, 'ning-buping', ['cart-mark']); } break;
    case 'check-release-ledger': if (next.day3CargoStatus === 'unloading') { next.saltCase.ledgerChecked = true; next = rememberEvidence(next, 'ning-buping', ['release-ledger']); } break;
    case 'seal-salt-evidence':
      if (next.day3CargoStatus === 'unloading') {
        next.day3CargoStatus = 'sealed'; next.prologueEnding = 'sealed-salt';
        next.saltCase.endedAt = next.worldMinutes; next.saltCase.stayPermitUntil = next.worldMinutes + 3 * 1440;
        next.evidenceCustody = { fragment: 'yamen', medical: 'yamen', cart: 'yamen', identity: 'yamen' };
        next.inventoryItemIds = [...next.inventoryItemIds.filter((id) => id !== 'ding17-fragment'), 'temporary-stay-permit', 'evidence-receipt'];
        next = rememberEvidence(next, 'ning-buping', ['ding17-fragment', 'medical-report', 'cart-mark', 'cheng-identity', 'release-ledger']);
        next.npcKnowledge = { ...next.npcKnowledge, 'ma-sandao': { ...next.npcKnowledge['ma-sandao'], matched: true, knownName: '马三刀', knownIdentity: '被带走候审的守门差役' } };
        next.worldEventOutcomes = { ...next.worldEventOutcomes, 'ding17-ship-arrives': '货船如期抵埠；一辆转运车、盐引残片及放行簿被宁不平封存，马三刀被带走候审。' };
      }
      break;
    case 'take-night-ferry':
      if (next.day3CargoStatus === 'departed' && next.dayTwo.departurePlan === 'night-ferry' && !next.saltCase.reported && (next.chengShouyiIdentified || next.poisonWoundLinked)) {
        next.prologueEnding = 'night-ferry'; next.saltCase.endedAt = next.worldMinutes;
        next.worldEventOutcomes = { ...next.worldEventOutcomes, 'ding17-ship-arrives': '货船如期抵埠，转运货车按原程离城；马三刀的私放货车与程守义之死未进入正式案卷。' };
      }
      break;
    case 'transfer-fragment':
      if (next.day3CargoStatus === 'departed' && next.dayTwo.brokerContact === 'offered' && next.inventoryItemIds.includes('ding17-fragment') && next.evidenceCustody.fragment === 'player') {
        next.prologueEnding = 'fragment-transferred'; next.saltCase.endedAt = next.worldMinutes;
        next.evidenceCustody = { ...next.evidenceCustody, fragment: 'broker' };
        next.inventoryItemIds = next.inventoryItemIds.filter((id) => id !== 'ding17-fragment');
        next.worldEventOutcomes = { ...next.worldEventOutcomes, 'ding17-ship-arrives': '货船如期抵埠，转运货车按原程离城；盐引残片被一个未具名中人带走，程守义仍未进入正式案卷。' };
      }
      break;
  }
  return next;
}

export function prologueNotice(state: GameState): string | null {
  if (!state.playerKnownFactIds.includes('cargo-schedule') || state.prologueEnding) return null;
  if (state.locationId !== 'yamen') return '船期写明：第三日上午九点抵埠，下午三点货车离城。要问查验进展，须回县衙候事廊。';
  if (state.day3CargoStatus === 'departed') {
    if (state.dayTwo.departurePlan === 'night-ferry' || state.dayTwo.brokerContact === 'offered') return '转运车已在第三日下午三点离城。河岸那条路还在等你，程守义的姓名却还没有落进县衙案卷。';
    return '转运车已在第三日下午三点离城，这次封验已经赶不上了。若你曾得过夜渡或中人的口信，仍可去河岸。';
  }
  if (state.day3CargoStatus === 'pending') return '船期写明：第三日上午九点抵埠，下午三点货车离城。死者身份、病案与残片仍可在开船前查对。';
  return `差役传讯：货船已抵埠。距下午三点货车离城还有 ${Math.max(0, state.storyStartedAtMinutes + CARGO_DEPARTURE - state.worldMinutes)} 分钟；须在期限前完成封存。`;
}

export function endingSummary(state: GameState) {
  if (state.prologueEnding === 'sealed-salt') return { title: '雨夜盐引 · 封存盐引', facts: [
    '程守义是遇袭商旅的账房。名册与体貌对得上；他死于淬毒刃留下的浅创，失血与毒性一同夺了性命。',
    '盐引残片已交县衙封存，你手里留下交存收据。荒道上那阵混乱里，程守义曾靠近你的行囊。',
    '马三刀收钱放过货车、向城内递话，又试图撕毁放行簿，已被带走候审。谁在更深处使唤他，案卷里还没有姓名。',
    '丁字十七号船按时抵埠，一辆转运货车被扣。盐路仍长，这次只截住了眼前这一程。',
    '你领到三日暂留凭条。病案副本、蜡样、身份记录与放行簿一并入卷，原病案仍锁在回春堂。',
  ], continueDay4Enabled: true as const, stayPermitUntil: state.saltCase.stayPermitUntil };
  if (state.prologueEnding === 'night-ferry') return { title: '雨夜盐引 · 夜渡生还', facts: [
    '你认出了程守义，也见过他与自己身上相似的伤痕。他的姓名没有送进县衙案卷。',
    `盐引残片：仍由你保留${state.inventoryItemIds.includes('ding17-fragment') ? '，随夜渡离开青石' : '，或已由你自行处置'}。`,
    '马三刀放过的货车照常离城。那笔门钱与递话仍留在城里，没人替你追到纸面。',
    '小渡带你离开青石，旧口供与行囊上的记号也一同随行。',
  ], continueDay4Enabled: true as const, stayPermitUntil: null };
  if (state.prologueEnding === 'fragment-transferred') return { title: '雨夜盐引 · 残片易手', facts: [
    '程守义的死仍散在无名尸传闻与几处伤痕里，没有进入县衙案卷。',
    '盐引残片：你已交给一个未具名中人，不再在背包、报案或封存手续中可用。',
    '货车照常离城。中人只验过残片，没有问你在医馆、城门与客栈见过什么。',
    '你换到一枚只在今夜管用的渡口木牌。残片不再在手，往后若有人追问，你也少了这张纸。',
  ], continueDay4Enabled: true as const, stayPermitUntil: null };
  return null;
}

