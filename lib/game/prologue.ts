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
    if (state.playerKnownFactIds.includes('clinic-corpse-details') && !state.chengShouyiIdentified) result.push(choice('identify-memory', '细看死者，回想荒道同行的人', '我想再看一眼他的面容，试着回想同行者。', 'action'));
    if (state.poisonWoundLinked && !state.playerKnownFactIds.includes('medical-report')) result.push(choice('request-medical-report', '请医者写下伤痕说明', '能否把两处伤痕的比对结果写下来？'));
    if (verifiableSources(state).length >= 2 && !state.knownLocationIds.includes('yamen')) result.push(choice('ask-ning-referral', '询问这些证据该交给谁', '这些东西应当交给谁查验？'));
  }
  if (state.locationId === 'inn' && npcId === 'su-wantang' && state.playerKnownFactIds.includes('clinic-corpse-details') && !state.chengShouyiIdentified) result.push(choice('identify-roster', '请掌柜核对死者与商旅名册', '死者左耳有旧豁口，小指缺了半节。店里可有这样一位商旅？'));
  if (state.locationId === 'yamen' && npcId === 'ning-buping') {
    const sourceKey = verifiableSources(state).join(',') || 'unsubstantiated';
    if (!state.npcStates[npcId].memory.statements.some((s) => s.id.startsWith('salt-report:') && s.value === sourceKey)) result.push(choice('report-salt-case', '报案并出示手中线索', '我想报荒道遇袭与河边死者的案，请先核验这些线索。'));
    if (state.saltCase.reported && state.day3CargoStatus === 'pending') result.push(choice('await-cargo', '候差役传来船讯（最多六时辰）', '我在候事廊等船讯，不另作走动。', 'action'));
    if (state.saltCase.reported && state.day3CargoStatus === 'unloading' && !state.saltCase.cartChecked) result.push(choice('inspect-cargo', '随宁不平封验转运货车（45分钟）', '请带我去核对货车与手中的证据。', 'action'));
    if (state.saltCase.cartChecked && !state.saltCase.ledgerChecked && state.day3CargoStatus === 'unloading') result.push(choice('check-release-ledger', '核对放行簿与收钱记录（20分钟）', '还请把车号、日期和当班差役的签押一并核对。'));
    if (state.saltCase.ledgerChecked && state.day3CargoStatus === 'unloading' && state.chengShouyiIdentified && state.poisonWoundLinked && state.playerKnownFactIds.includes('medical-report') && state.evidenceCustody.fragment === 'player') result.push(choice('seal-salt-evidence', '交存残片、病案并完成封存（15分钟）', '我愿把残片和病案副本正式交存，请给我收据。', 'action'));
  }
  if (state.locationId === 'dock' && npcId === null) {
    const dangerConfirmed = state.chengShouyiIdentified || state.poisonWoundLinked;
    const departed = state.day3CargoStatus === 'departed';
    if (!departed && (state.dayTwo.departurePlan === 'night-ferry' || state.dayTwo.brokerContact === 'offered')) result.push(choice('wait-night-ferry', '在河岸等到夜渡时分（最多十二时辰）', '我留在河岸暗处，等货船与转运车的动静过去。', 'action'));
    if (departed && state.dayTwo.departurePlan === 'night-ferry' && dangerConfirmed && !state.saltCase.reported) result.push(choice('take-night-ferry', '登上夜渡，离开青石', '我不再报案，登船离开青石。', 'action'));
    if (departed && state.dayTwo.brokerContact === 'offered' && state.inventoryItemIds.includes('ding17-fragment') && state.evidenceCustody.fragment === 'player') result.push(choice('transfer-fragment', '把盐引残片交给未具名中人', '我把残片交出，只要这一次渡口凭记。', 'action'));
  }
  return result;
}

export function resolvePrologue(state: GameState, request: InteractionRequest): RuleResolution | null {
  const left = state.storyStartedAtMinutes + CARGO_DEPARTURE - state.worldMinutes;
  switch (request.actionId) {
    case 'identify-roster': return { timeCostMinutes: 15, discoveredFactIds: ['cheng-identity'], dialogue: '“有。程守义，替商旅记账的。前些天还在这里落过脚。”', narration: '她翻出留宿商旅的名册：程守义，左耳旧伤，小指残缺。你记下该页日期与同宿商号；两处特征与医者描述一致。这次，死者不再只是河边的无名客。' };
    case 'identify-memory': return { timeCostMinutes: 15, discoveredFactIds: ['cheng-identity'], narration: '你走近白布。那处缺了半节的小指使雨夜的记忆骤然清晰：他用那只手替商队拨算盘，别人叫他“程守义，程账房”。左耳的豁口、低头记账的侧脸，都与同行时相合。你把可以肯定的面貌与仍然模糊的袭击过程分开说出。', dialogue: '“姓名是你认出的，伤体特征是我验的。我会分别记下，不把猜测写成你亲眼见过的事。”' };
    case 'request-medical-report': return { timeCostMinutes: 15, discoveredFactIds: ['medical-report'], dialogue: '“我能写明：两处都是同类淬毒刃造成的浅创，有乌鳞散残留。死者因持续失血、毒性加重而亡。至于谁下的手，病案不能替你猜。”', narration: '沈砚秋摊开病案，在两处创口的长度、走向和药性反应下分别签名。原案留在回春堂，你拿到盖了医馆印记的副本。' };
    case 'ask-ning-referral': return { timeCostMinutes: 5, discoveredLocationIds: ['yamen'], discoveredFactIds: ['ning-referral'], dialogue: '“这已不是我一个医者能查的事。去县衙候事廊找总捕头宁不平，进门说要递验伤文书。不同来处的东西分开交代，不要把听说的混作亲见。”', narration: '他告诉你县衙的走法，也提醒你：认识一个名字，不等于已经认得那个人。' };
    case 'report-salt-case': {
      const enough = verifiableSources(state).length >= 2;
      return { timeCostMinutes: 10, learnedNpcName: '宁不平', learnedNpcIdentity: '青石县总捕头', discoveredFactIds: enough ? ['cargo-schedule'] : [], dialogue: enough ? '“宁不平。文书、验伤和目击，各记各的。两处来由能互证，我可以临时查验，但还不能凭此定罪。”' : '“我是宁不平。口供我会记下，但你手里不足两处独立佐证，不能只凭一件东西就截官盐车。补齐再来。”', narration: enough ? '他翻出预报船期：第三日上午九点，丁字十七号船抵埠；转运车计划下午三点离城。封验、复核、交存都要在三点前办完，查不实便不能继续扣车。病案和身份若还没弄清，应先回医馆补齐。' : '差役记下你出示了什么，没有收走残片，也没有许诺扣车。' };
    }
    case 'await-cargo': {
      const remaining = state.storyStartedAtMinutes + CARGO_ARRIVAL - state.worldMinutes;
      return { timeCostMinutes: Math.min(720, remaining), narration: remaining > 1440 ? '白日里，差役逐项抄录你带来的线索。宁不平让人分别去医馆和城门询问，没有把你的推测抄成定论。你在廊下候着，听见值更牌第一次交接。' : remaining > 720 ? '灯油换过，廊下已少了人声。记录被分送查对，货船还在河上。你没有再催问同样的问题，只记下哪几件东西仍由自己保管。' : '第三日上午，传讯差役带回靠岸消息：丁字十七号船已抵埠，货车将在下午三点离城。宁不平把临时查验文书压在桌上：现在可以动身，但不能拖过时限。' };
    }
    case 'inspect-cargo': return { timeCostMinutes: 45, narration: left <= 45 ? '赶到交接处时，车队已经离城。宁不平撤回临时查验的人手：晚了一步，眼下不能把未验的货车写成已扣。' : `你随宁不平到城门内的转运交接处，查完后回候事廊。${state.cartMarkObserved ? '车夫右眉的疤与旧观察相合' : '你记下车夫右眉的旧疤'}，车门铰链留着鱼鳞形黑蜡。宁不平取蜡样、核车号，封条尚未落印；下午三点仍是临时查验的最后期限。`, discoveredFactIds: left > 45 ? ['cart-verified', 'cart-mark'] : [] };
    case 'check-release-ledger': return { timeCostMinutes: 20, narration: left <= 20 ? '放行簿尚未核完，离城时限已过。缺少及时完成的封验手续，货车按原程离开。' : '宁不平对照车号和签押，发现免检记录与车夫记下的“门钱”相合。差役去取原簿时，守门差役正撕下对应的一页；湿纸没有烧透，日期和签押还在。车夫与递话的小厮被分开问话，两份口供均指向收钱放行与传递行程消息。', discoveredFactIds: left > 20 ? ['ledger-verified'] : [] };
    case 'seal-salt-evidence': return { timeCostMinutes: 15, narration: left <= 15 ? '最后的交存手续未能赶在三点前完成。临时查验期限已过，宁不平不能把已经离城的货车登记为封存。残片仍在你手中。' : '残片的断边与车中文书存根相接，丁字十七、县衙火漆、车门黑蜡和放行簿的日期逐一对上。你忽然想起雨夜程守义把那半张纸塞进自己行囊的动作——袭击者要找的是他带走的盐引，不是你的姓名。', dialogue: left <= 15 ? undefined : '“这是马三刀收钱免检、递出消息和毁簿的证据，不是整条盐路主谋的判词。残片、病案副本和簿页由县衙封存，车扣下，人带走。给你三日暂留凭条，日后仍须候询。”', discoveredFactIds: left > 15 ? ['sealed-case'] : [] };
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
    case 'submit-search': if (before.inventoryItemIds.includes('ding17-fragment')) next.evidenceCustody.fragment = 'ma'; break;
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
  if (state.locationId !== 'yamen') return '已知船期：第三日上午九点抵埠，下午三点货车离城。实际查验进展请回县衙候事廊问讯。';
  if (state.day3CargoStatus === 'departed') {
    if (state.dayTwo.departurePlan === 'night-ferry' || state.dayTwo.brokerContact === 'offered') return '转运车已在第三日下午三点按原程离城。你已准备的河岸路线仍在，但这不是封存成功；程守义尚未进入正式案卷。';
    return '转运车已在第三日下午三点按原程离城。本轮封存机会已错过；若此前已取得夜渡或中人口信，仍可去河岸选择自己的出路。';
  }
  if (state.day3CargoStatus === 'pending') return '已知船期：第三日上午九点抵埠，下午三点货车离城。可先补齐死者身份、病案与残片，再到县衙候讯。';
  return `差役传讯：货船已抵埠。距下午三点货车离城还有 ${Math.max(0, state.storyStartedAtMinutes + CARGO_DEPARTURE - state.worldMinutes)} 分钟；须在期限前完成封存。`;
}

export function endingSummary(state: GameState) {
  if (state.prologueEnding === 'sealed-salt') return { title: '雨夜盐引 · 封存盐引', facts: [
    '程守义：遭袭商旅的账房。经身份核对与伤痕比对，确认死于同类淬毒兵刃造成的失血和毒性加重。',
    '盐引残片：程守义在荒道袭击中藏入你的行囊，现由县衙封存；你保留交存收据。',
    '马三刀：收钱免检、递出消息并试图毁掉放行簿，已被带走候审，并非据此认定为全案主谋。',
    '货船按时抵埠，一辆转运货车及可疑货物被扣。只封住这一段线索，盐路幕后仍未查清。',
    '你获得三日暂留凭条。病案副本、蜡样、身份记录与放行簿一并入卷，原病案仍留回春堂。',
  ], continueDay4Enabled: true as const, stayPermitUntil: state.saltCase.stayPermitUntil };
  if (state.prologueEnding === 'night-ferry') return { title: '雨夜盐引 · 夜渡生还', facts: [
    '程守义：你已确认他与荒道袭击或同类伤痕有关，却没有把他的名字送进正式案卷。',
    `盐引残片：仍由你保留${state.inventoryItemIds.includes('ding17-fragment') ? '，随夜渡离开青石' : '，或已由你自行处置'}。`,
    '马三刀与货车：私放货车照常离城，相关交易没有因你的离开被写成已查清的案件。',
    '你选择的是生还，不是洗清嫌疑，也不是替任何人结案。旧口供和被人盯上的风险会随你离开。',
  ], continueDay4Enabled: true as const, stayPermitUntil: null };
  if (state.prologueEnding === 'fragment-transferred') return { title: '雨夜盐引 · 残片易手', facts: [
    '程守义：他的死仍停在无名尸与零散传闻之间，未进入正式案卷。',
    '盐引残片：你已交给一个未具名中人，不再在背包、报案或封存手续中可用。',
    '马三刀与货车：货车照常离城；中人只认得残片，不知道你的医馆、城门与客栈细节。',
    '你换到的是一次性的暂时通行承诺，不是银钱、清白或长久保护。交出证物让你少一张牌，也多一层被追问的风险。',
  ], continueDay4Enabled: true as const, stayPermitUntil: null };
  return null;
}

