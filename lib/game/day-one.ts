import type { DayOneState, GameState, InteractionRequest, LimitedActionId } from './types.ts';
import type { LimitedAction } from './limited-actions.ts';
import type { RuleResolution } from './interaction-rules.ts';
import { getLocation } from './world.ts';
import { changeNpcRelationship, recordNpcStatement, showNpcEvidence, verifyNpcStatement } from './npc-memory.ts';

export function initialDayOne(): DayOneState {
  return { schema: 1, menu: false, gatePosition: 'line', review: 'none', returnReceipt: null, gateName: null,
    registration: 'none', registeredName: null, registrationDiscrepancy: false, interview: 'none', consent: 'none', cloth: 'undecided',
    privateCare: false, reportAuthorized: false, bleedingGraceMinutes: 0, guidanceSeed: false, companionLead: false };
}
export const dayOneTopicIds: LimitedActionId[] = ['tell-amnesia', 'tell-confused-origin', 'ask-exempt-cart', 'step-aside', 'wait-at-gate', 'request-review', 'review-confirm', 'review-deny', 'review-correct', 'review-release', 'register-true', 'register-alias', 'register-refuse', 'reconsider-registration', 'share-gate-statement', 'ask-companion', 'show-fragment', 'lu-cart', 'lu-stance', 'lu-test-lie', 'listen-guests', 'medical-truth', 'medical-lie', 'medical-refuse', 'medical-fee', 'consent-exam', 'consent-basic', 'refuse-exam', 'retain-cloth', 'keep-cloth', 'return-cloth', 'pay-basic', 'reopen-exam', 'medical-leave', 'request-privacy', 'authorize-report', 'request-medical-debt'];
export function presentNpcIds(state: GameState): string[] {
  if (state.campaign?.startedAt != null) return [];
  if (state.locationId === 'gate' && ['questioning', 'answered', 'disputed'].includes(state.dayOne.review)) return ['ning-buping'];
  if (state.locationId === 'dock' && (state.dayTwo.departurePlan === 'night-ferry' || state.dayTwo.brokerContact === 'offered')) return [];
  return getLocation(state.locationId).npcIds.filter((id) => state.locationId !== 'yamen' || id === 'ning-buping');
}
const action = (id: LimitedActionId, label: string, input = label, mode: 'speech' | 'action' = 'speech'): LimitedAction => ({ id, label, input, mode });
export function dayOneEntry(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.prologueEnding || state.dayOne.menu || state.gatePhase === 'detained' || state.dayOne.gatePosition === 'aside' || !npcId || !['ma-sandao', 'su-wantang', 'lu-guanlan', 'shen-yanqiu'].includes(npcId) || !presentNpcIds(state).includes(npcId)) return [];
  return [action('open-dayone', npcId === 'shen-yanqiu' ? '问诊、授权与其他交谈' : npcId === 'su-wantang' ? '登记与深入交谈' : '深入交谈与其他行动', '斟酌接下来要谈的事。', 'action')];
}
export function dayOneActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.prologueEnding || !npcId || !presentNpcIds(state).includes(npcId)) return [];
  const d = state.dayOne;
  const options: LimitedAction[] = [];
  const add = (id: LimitedActionId, label: string, input = label, mode: 'speech' | 'action' = 'speech') => {
    if (!state.npcStates[npcId].memory.topics[id]) options.push(action(id, label, input, mode));
  };
  if (state.gatePhase === 'detained' || ['questioning', 'answered', 'disputed'].includes(d.review)) {
    if (npcId === 'ma-sandao' && d.review === 'none') add('request-review', '请求当值总捕头复核（30分钟）', '请叫当值总捕头复核，扣了什么也请记明白。');
    if (npcId === 'ning-buping') {
      if (d.review === 'questioning') { add('review-confirm', '确认遇袭经过，补充不确定之处'); add('review-deny', '改口否认曾遇袭', '我在来青石的这段路上从未遇袭。'); }
      if (d.review === 'disputed') add('review-correct', '承认先前改口，留下更正记录');
      if (d.review === 'answered') add('review-release', '签认复核记录，领回原物（20分钟）');
    }
    return options;
  }
  if (d.gatePosition === 'aside' && state.locationId === 'gate') {
    add('wait-at-gate', '在墙边等一刻（15分钟）', '我在墙边等着，不往城里闯。', 'action');
    options.push(action('reapproach-gate', '重新排到差役面前', '我重新上前接受盘问。', 'action'));
    return options;
  }
  if (!d.menu) return [];
  if (npcId === 'ma-sandao') {
    if (state.npcStates[npcId].searchedPlayer && d.review === 'none') add('request-review', '请当值总捕头复核搜查记录（30分钟）');
    if (state.gatePhase === 'questioning') { add('tell-amnesia', '说明失忆，籍贯暂时想不起', '我叫' + state.player.name + '。遇袭后记不清籍贯，不敢乱报，只想进城治伤。'); add('tell-confused-origin', '说明记忆混乱，只确认来此投宿', '我叫' + state.player.name + '。籍贯的记忆混在一起，我只能确认此行是来投宿。'); }
    if (state.cartMarkObserved) add('ask-exempt-cart', '追问刚才那辆免检货车');
    if (state.gatePhase !== 'searched') add('step-aside', '请求退到墙边，稍后再来', '我先退在墙边，稍后再来答话。', 'action');
  }
  if (npcId === 'su-wantang') {
    if (d.registration === 'none') { add('register-true', '以本名「' + state.player.name + '」登记'); add('register-alias', '谎称本名为「' + aliasName(state) + '」登记'); add('register-refuse', '拒绝登记，暂不入住'); }
    if (d.registration === 'refused') add('reconsider-registration', '改变主意，重新选择登记方式');
    if (d.registration === 'true' || d.registration === 'alias') {
      if (d.gateName) add('share-gate-statement', '主动说明自己在城门报的姓名', '我在城门报的是' + d.gateName + '。');
    }
    if ((d.registration === 'true' || d.registration === 'alias') && state.player.money >= 1 && state.economy.cheapLodgingAt === null) add('cheap-rest', '付一两，在伙房隔间低价落脚（12小时）', '我付一两，在伙房外的隔间将就一夜。', 'action');
    if ((d.registration === 'true' || d.registration === 'alias') && state.economy.innWorkAt === null && !state.lodgingRecords.length) add('inn-work', '以工抵宿：后院杂活（120分钟）', '我可劈柴挑水，换一点房钱或碎银。', 'action');
    add('ask-companion', '询问失散同行者', '同行者失散，样貌也想不全。店中可有能核对身份的登记记录？');
    if (state.inventoryItemIds.includes('ding17-fragment')) add('show-fragment', '展示行囊残片，但不交出');
  }
  if (npcId === 'lu-guanlan') {
    add('ask-companion', '询问同行商旅的去向');
    if (state.cartMarkObserved) add('lu-cart', '谈亲眼看见的免检货车');
    add('lu-stance', '徒手比划握剑姿势，请他点评', '我徒手比出握剑的姿势，请你看看站得如何。', 'action');
    if (d.guidanceSeed && state.npcStates[npcId].memory.evidence.includes('stance-observation')) add('lu-test-lie', '谎称方才脚下一点没晃', '方才我站得很稳，脚下一点没晃。');
    add('listen-guests', '暂不搭话，旁听酒客（10分钟）', '我坐在附近，只听酒客谈话。', 'action');
  }
  if (npcId === 'shen-yanqiu') {
    if (d.interview === 'none') { add('medical-truth', '如实说明刀刃袭击与记忆缺损'); add('medical-lie', '谎称只是被枯枝划伤'); add('medical-refuse', '拒绝解释伤口来由'); add('medical-fee', '先问诊金和处理范围'); }
    else if (d.consent === 'none') { add('consent-exam', '同意完整验伤，另选布条归属', '我同意完整验伤，布条是否留下另行决定。'); add('consent-basic', '只同意止血，不做毒物检查'); add('refuse-exam', '拒绝检查，暂不治疗'); }
    else if (d.consent === 'exam' && d.cloth === 'undecided') { add('retain-cloth', '允许医者保留布条并检验'); add('keep-cloth', '布条由自己保留，暂不化验'); }
    else {
      if (d.consent === 'basic' && state.player.money >= 3 && state.player.injury !== '无') add('pay-basic', '支付三两，只作止血（15分钟）', '只止血，三两诊金照付。', 'action');
      if (['basic', 'refused'].includes(d.consent)) add('reopen-exam', '重新考虑，改做完整验伤');
      if (d.cloth === 'player' && state.inventoryItemIds.includes('blood-cloth')) add('return-cloth', '交回自留布条，授权补做检验');
      if (!d.privateCare) add('request-privacy', '请求伤情不向旁人透露');
      if (d.privateCare && !d.reportAuthorized && state.poisonWoundLinked) add('authorize-report', '单独授权出具供报案使用的病案');
      add('request-medical-debt', '询问能否赊欠诊金');
      if (state.player.injury !== '无' && state.economy.medicalWorkAt === null && state.economy.medicalDebt === 0) add('pharmacy-work', '药房杂活抵两两诊金（90分钟）', '我可以做一次药房杂活，抵扣诊金。', 'action');
      if (state.dayOne.consent === 'exam' && state.player.injury !== '无' && state.economy.medicalDebt === 0) add('medical-credit', '欠下三两诊金，先做完整处理（35分钟）', '请先救治，三两诊金我记下欠账。', 'action');
      if (state.dayOne.consent === 'basic' && state.player.injury !== '无' && state.economy.medicalDebt === 0) add('basic-on-credit', '欠下三两诊金，只先止血（15分钟）', '只先止血，三两诊金记作欠账。', 'action');
      if (state.dayOne.consent === 'exam' && state.economy.medicalCredit === 2 && state.player.money >= 1 && state.player.injury !== '无') add('treat-with-credit', '用杂活抵两两，再付一两完整处理（35分钟）', '两两抵扣、一两现付，请做完整处理。', 'action');
      if (state.economy.medicalDebt === 3 && state.player.money >= 3) add('settle-medical-debt', '补清欠下的三两诊金（5分钟）', '我来补清先前欠下的三两诊金。', 'action');
    }
    add('medical-leave', '结束问诊，退回候诊处', '我暂不继续问诊，先退开。', 'action');
  }
  return [...options.slice(0, 5), action('close-dayone', '返回当前场景选项', '回到眼前的事。', 'action')];
}
export const aliasName = (state: GameState) => state.player.name === '周行' ? '林舟' : '周行';
export function dayOneAllows(state: GameState, id: LimitedActionId): boolean {
  if (id === 'rest-night') return ['true', 'alias'].includes(state.dayOne.registration);
  if (id === 'request-treatment') return state.dayOne.interview !== 'none' && state.dayOne.consent === 'exam' && ['retain', 'keep', 'doctor'].includes(state.dayOne.cloth);
  if (id === 'request-medical-report') return !state.dayOne.privateCare || state.dayOne.reportAuthorized;
  return true;
}

export function resolveDayOne(state: GameState, request: InteractionRequest): RuleResolution | null {
  const say = (dialogue: string, minutes = 3): RuleResolution => ({ timeCostMinutes: minutes, dialogue });
  switch (request.actionId) {
    case 'open-dayone': case 'close-dayone': return { timeCostMinutes: 0 };
    case 'tell-amnesia': return { ...say('“记不清？先把能记住的记上。凭空编个籍贯，后头可不好收场。”'), gatePhase: 'explaining', npcStatePatch: { suspicion: state.npcStates['ma-sandao'].suspicion + 1 } };
    case 'tell-confused-origin': return { ...say('“投宿是来由，不是籍贯。暂记不详，日后核对。”'), gatePhase: 'explaining' };
    case 'ask-exempt-cart': return { ...say('“那是验过漕运关防的车。你管好自己的路引，少拿眼睛乱量。”'), discoveredFactIds: ['ma-cart-deflection'], npcStatePatch: { suspicion: state.npcStates['ma-sandao'].suspicion + 1 } };
    case 'step-aside': return { timeCostMinutes: 2, narration: '差役用铁尺指了指墙根，准你退开候着；这不是放行，先前的口供和疑点都没有撤销。' };
    case 'wait-at-gate': return state.playerKnownFactIds.includes('ma-private-bribe-signal')
      ? { timeCostMinutes: 15, narration: '你又在墙边等了一刻。伤势与疲劳照常发展，等候没有替你洗掉先前的口供。' }
      : { timeCostMinutes: 15, discoveredFactIds: ['ma-private-bribe-signal'], narration: '你在墙边等了一刻。换班空隙里，守门差役用两根手指在登记簿下轻敲两次，又朝无人处偏了偏头；像是在暗示“两两、私下谈”。这只是你亲眼看见的暗示，尚未发生交易。' };
    case 'reapproach-gate': return { timeCostMinutes: 2, narration: '你重新来到差役面前。他仍从先前停下的盘问继续，没有把你当作初次到来。' };
    case 'request-review': return { timeCostMinutes: 30, narration: '你在城门侧等到一名佩刀汉子。他让差役读出原始口供和搜查记录：“宁不平。只问你亲历的，不知道就写不知道。”' };
    case 'review-confirm': return say('“原话与补充分别记。失忆、不确定，不等于承认有罪。”', 10);
    case 'review-deny': return say('“这句也照录。我要对照先前的口供，不能只听你此刻一句。”', 10);
    case 'review-correct': return say('“更正另附，原话不删。你承认改口，我记下；这不替你抹掉疑点。”', 15);
    case 'review-release': return { timeCostMinutes: 20, narration: '宁不平核对完记录，未找到你参与袭击的直接证据。' + (state.evidenceCustody.fragment === 'ma' ? '他登记残片特征，签下原物返还记录，将残片交还你。' : '此处没有扣下你的实物，不另造返还凭据。') + '准你入城治伤投宿、随时候询。搜查与原口供记录仍在。' };
    case 'register-true': case 'register-alias': return say('“登记的是你自报的姓名，不是官府验过的身份。住店另付房钱。”', 0);
    case 'register-refuse': return say('“不登记便不能住。问事可以，客房不能赊开。”', 0);
    case 'reconsider-registration': return say('“想清楚再报，先前拒登的事我也记着。”', 0);
    case 'share-gate-statement': return say(state.dayOne.registrationDiscrepancy ? '“你方才报的是另一个名字，如今又说城门报的不同。两句我都留着，不能当没听见。”' : '“与刚才报的一致。我这里只记你亲口说的话。”');
    case 'ask-companion': return say(request.npcId === 'su-wantang' ? '“店里确有商旅住过，名册尚在。你没有样貌特征，我不能指个人让你认。想起线索再来核对。”' : '“我听酒客提过有商旅失散，没见过你们同行，不能指个人让你认。客栈留宿名册倒能查。”');
    case 'show-fragment': return say('“收好，别摊在大堂。你让我看过，这事我记下；是哪份公文，我不会替你下断语。”');
    case 'lu-cart': return say('“你看见的是免检和蜡痕，不是车里的货。为何留意，你自己清楚；我没替你看过那一趟。”');
    case 'lu-stance': return { timeCostMinutes: 10, narration: '你徒手比出握剑姿势，转重心时脚下晃了一下。负剑客叫你先松肩、站稳，再谈出手；你记下这次点评，还远不到凭一句话练成武功的地步。' };
    case 'lu-test-lie': return say('“方才脚下那一晃，我就在面前看着。试我眼力可以，别拿看过的事改口。”');
    case 'listen-guests': return { timeCostMinutes: 10, narration: '酒客说近来商队入城都要留名。你只记下“可查留宿名册”这一条听闻，没有把他们的闲谈当成亲眼见过货车的证据。' };
    case 'medical-truth': return say('“记不起兵器模样便别补造。先记录你遇袭，再看创口。”', 0);
    case 'medical-lie': return say('“枯枝划的？先记作你的说法，拆布看过才知道能不能相合。”', 0);
    case 'medical-refuse': return say('“可以不说来由。我只按允许检查的范围记伤，不凭沉默判你撒谎。”', 0);
    case 'medical-fee': return say('“完整处理三两，三十五分钟。只止血也收三两，十五分钟，不作药性检验。没付诊金，不会无故给你用药。”');
    case 'consent-exam': return say('“检查与留样分开，你再决定布条由谁保管。”', 0);
    case 'consent-basic': return say('“只止血可以，伤和药性都未治清。按三两收诊金，只暂缓失血。”', 0);
    case 'refuse-exam': return say('“我不强拆。要改变主意可以再问，但伤势不会等。”', 0);
    case 'retain-cloth': return say('“布条单独留样，检查结果记入病案，是否外传另议。”', 0);
    case 'keep-cloth': return say('“布条交你自留，暂不化验。以后带回来授权，才补做药性检验。”', 0);
    case 'pay-basic': return { timeCostMinutes: 15, moneyDelta: -3, narration: '你付三两诊金。医者压迫包扎，只暂缓' + (state.growth.medicine.nodes.includes('medicine-bandage') ? '二百四十' : '一百八十') + '分钟的失血；伤仍未愈，没有药性结论，也未增加气血。' };
    case 'reopen-exam': return say('“可以改做完整检查，再决定留样。已经做过的处理与收费不撤销。”', 0);
    case 'return-cloth': return { ...say('“这是你带回的原布条。我补验残血，确有异常苦味，留下检验记录。”', 10), discoveredFactIds: ['doctor-wound-residue'] };
    case 'medical-leave': return { timeCostMinutes: 0, narration: '你结束这轮问诊，退回候诊处。尚未同意的检查不会偷偷进行，仍可以打开地图选择去处。' };
    case 'request-privacy': return say('“我不向闲人讲你的伤。原有病案留存，已经交出去的文书不能追回；日后要写供报案的副本，我会再问你的意思。”');
    case 'authorize-report': return say('“只授权这份报案副本，我记清楚。旁人闲问，我仍不说。”', 0);
    case 'request-medical-debt': return say('“眼下不能替你赊药。这个请求我记下，但未欠下人情，也未给你用药。”');
    default: return null;
  }
}

export function applyDayOne(before: GameState, state: GameState, request: InteractionRequest): GameState {
  const id = request.npcId;
  let next = { ...state, dayOne: { ...state.dayOne } };
  const d = next.dayOne;
  const aid = request.actionId;
  const claim = (subject: string, value: string, text: string, target = id!) => {
    next = recordNpcStatement(next, target, { id: `${aid}:${before.worldMinutes}:${next.npcStates[target].memory.statements.length}`, subject, value, text, truth: 'unknown' });
  };
  const relationship = (changes: Parameters<typeof changeNpcRelationship>[3]) => { next = changeNpcRelationship(next, id!, `dayone:${aid}`, changes); };
  if (id && dayOneTopicIds.includes(aid)) {
    const npc = next.npcStates[id];
    next = { ...next, npcStates: { ...next.npcStates, [id]: { ...npc, memory: { ...npc.memory, topics: { ...npc.memory.topics, [aid]: { status: ['register-refuse', 'refuse-exam', 'request-medical-debt'].includes(aid) ? 'refused' : 'answered', atMinutes: before.worldMinutes, day: Math.floor(before.worldMinutes / 1440), attempts: 1, evidence: [], respected: false } } } } } };
  }
  switch (aid) {
    case 'open-dayone': d.menu = true; break;
    case 'close-dayone': d.menu = false; break;
    case 'tell-attack': case 'tell-pass-lost': case 'tell-amnesia': case 'tell-confused-origin':
      d.gateName = before.player.name; claim('name', before.player.name, `我叫${before.player.name}`);
      if (aid === 'tell-amnesia' || aid === 'tell-confused-origin') { claim('origin', 'unknown', request.input); d.menu = false; }
      if (aid === 'tell-amnesia') claim('journey', 'attacked', request.input);
      break;
    case 'step-aside': d.gatePosition = 'aside'; d.menu = false; break;
    case 'reapproach-gate': d.gatePosition = 'line'; break;
    case 'request-review': {
      d.review = 'questioning'; d.menu = false;
      const npc = next.npcStates['ning-buping'];
      const copied = next.npcStates['ma-sandao'].memory.statements.map((s) => ({ ...s, id: `gate-copy:${s.id}`, contradicts: s.contradicts.map((v) => `gate-copy:${v}`) }));
      next.npcStates = { ...next.npcStates, 'ning-buping': { ...npc, memory: { ...npc.memory, statements: [...npc.memory.statements, ...copied], evidence: [...new Set([...npc.memory.evidence, ...(next.evidenceCustody.fragment === 'ma' ? ['ding17-fragment'] : [])])] } } };
      next.npcKnowledge = { ...next.npcKnowledge, 'ning-buping': { ...next.npcKnowledge['ning-buping'], observed: true, matched: true, knownName: '宁不平', knownIdentity: '青石县总捕头' } };
      next.selectedNpcId = 'ning-buping'; break;
    }
    case 'review-confirm': claim('journey', 'attacked', '确认遇袭，其他记不清'); d.review = next.npcStates[id!].memory.statements.at(-1)!.contradicts.length ? 'disputed' : 'answered'; break;
    case 'review-deny': {
      claim('journey', 'not-attacked', request.input);
      d.review = next.npcStates[id!].memory.statements.at(-1)!.contradicts.length ? 'disputed' : 'answered'; break;
    }
    case 'review-correct': claim('correction', 'attacked', '承认刚才否认不实，遇袭属实；原话保留'); d.review = 'answered'; break;
    case 'review-release':
      d.review = 'cleared'; next.gatePhase = 'cleared'; next.gateAccess = true; next.selectedNpcId = 'ma-sandao';
      if (next.evidenceCustody.fragment === 'ma') { next.evidenceCustody = { ...next.evidenceCustody, fragment: 'player' }; next.inventoryItemIds = [...new Set([...next.inventoryItemIds, 'ding17-fragment' as const])]; d.returnReceipt = { atMinutes: next.worldMinutes, from: 'ma', to: 'player' }; }
      next.npcStates = { ...next.npcStates, 'ma-sandao': { ...next.npcStates['ma-sandao'], detainedPlayer: false } };
      break;
    case 'register-true': case 'register-alias':
      d.registration = aid === 'register-true' ? 'true' : 'alias'; d.registeredName = aid === 'register-true' ? before.player.name : aliasName(before);
      d.registrationDiscrepancy = d.gateName !== null && d.registeredName !== d.gateName;
      claim('name', d.registeredName, `我本名是${d.registeredName}`); d.menu = false; break;
    case 'register-refuse': d.registration = 'refused'; d.registeredName = null; d.menu = false; break;
    case 'reconsider-registration': d.registration = 'none'; break;
    case 'share-gate-statement': claim('name', d.gateName!, request.input); break;
    case 'ask-companion': d.companionLead = true; claim('companion-description', 'unknown', request.input); break;
    case 'show-fragment': next = showNpcEvidence(next, id!, 'ding17-fragment'); relationship({ suspicion: 1 }); break;
    case 'lu-cart': claim('cart-account', 'observed-exemption', request.input); break;
    case 'ask-exempt-cart': {
      const npc = next.npcStates[id!]; next.npcStates = { ...next.npcStates, [id!]: { ...npc, memory: { ...npc.memory, evidence: [...new Set([...npc.memory.evidence, 'cart-mark'])] } } }; break;
    }
    case 'lu-stance': {
      d.guidanceSeed = true; const npc = next.npcStates[id!]; next.npcStates = { ...next.npcStates, [id!]: { ...npc, memory: { ...npc.memory, evidence: [...new Set([...npc.memory.evidence, 'stance-observation'])] } } }; break;
    }
    case 'lu-test-lie': claim('observed-stance', 'steady', request.input); next = verifyNpcStatement(next, id!, next.npcStates[id!].memory.statements.at(-1)!.id, 'false', 'stance-observation'); break;
    case 'listen-guests': d.companionLead = true; break;
    case 'medical-truth': d.interview = 'truth'; claim('injury-source', 'blade', '遇袭受刃伤，其他模糊'); break;
    case 'medical-lie': d.interview = 'lie'; claim('injury-source', 'branch', '只是枯枝划伤'); break;
    case 'medical-refuse': d.interview = 'refused'; claim('injury-source', 'unknown', '不愿说明'); break;
    case 'consent-exam': d.consent = 'exam'; break;
    case 'consent-basic': d.consent = 'basic'; break;
    case 'refuse-exam': d.consent = 'refused'; d.menu = false; break;
    case 'retain-cloth': d.cloth = 'retain'; d.menu = false; break;
    case 'keep-cloth': d.cloth = 'keep'; d.menu = false; break;
    case 'pay-basic': d.bleedingGraceMinutes = state.growth.medicine.nodes.includes('medicine-bandage') ? 240 : 180; d.menu = false; break;
    case 'reopen-exam': d.consent = 'exam'; d.menu = true; break;
    case 'return-cloth': d.cloth = 'doctor'; next.inventoryItemIds = next.inventoryItemIds.filter((v) => v !== 'blood-cloth'); next.player = { ...next.player, poison: '不明残毒' }; d.menu = false; break;
    case 'request-treatment': if (before.player.money >= 3) {
      if (d.cloth === 'keep') { d.cloth = 'player'; next.inventoryItemIds = [...next.inventoryItemIds, 'blood-cloth']; next.player = { ...next.player, poison: before.player.poison }; }
      else d.cloth = 'doctor';
      if (d.interview === 'lie') for (const s of next.npcStates['shen-yanqiu'].memory.statements.filter((s) => s.subject === 'injury-source' && s.value === 'branch')) next = verifyNpcStatement(next, 'shen-yanqiu', s.id, 'false', 'abnormal-wound');
    } break;
    case 'medical-leave': d.menu = false; break;
    case 'request-privacy': d.privateCare = true; d.reportAuthorized = false; break;
    case 'authorize-report': d.reportAuthorized = true; break;
  }
  return next;
}
