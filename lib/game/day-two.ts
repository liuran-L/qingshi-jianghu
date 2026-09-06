import type { GameState, InteractionRequest, LimitedActionId } from './types.ts';
import type { LimitedAction } from './limited-actions.ts';
import type { RuleResolution } from './interaction-rules.ts';

export const dayTwoTopicIds: LimitedActionId[] = ['gate-echo', 'inn-echo', 'clinic-echo', 'lu-echo', 'decline-report', 'accept-broker-contact'];
export const initialDayTwo = (): GameState['dayTwo'] => ({ schema: 1, menu: false, gateEchoSeen: false, innEchoSeen: false, clinicEchoSeen: false, luEchoSeen: false, departurePlan: 'none', brokerContact: 'none' });
export const isDayTwo = (state: GameState) => state.worldMinutes - state.storyStartedAtMinutes >= 720;
const choice = (id: LimitedActionId, label: string, input: string, mode: 'speech' | 'action' = 'speech'): LimitedAction => ({ id, label, input, mode });

export function dayTwoEntry(state: GameState, npcId: string | null): LimitedAction[] {
  if (!isDayTwo(state) || !npcId || state.prologueEnding || state.dayTwo.menu || !['ma-sandao', 'su-wantang', 'shen-yanqiu', 'lu-guanlan'].includes(npcId)) return [];
  return [choice('open-daytwo', '追问第一日留下的余波', '我想问问昨日留下的记录与风声。', 'action')];
}

export function dayTwoActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.dayTwo.menu || !npcId || !isDayTwo(state)) return [];
  const out: LimitedAction[] = [];
  if (npcId === 'ma-sandao' && !state.dayTwo.gateEchoSeen) out.push(choice('gate-echo', '核对城门口供、搜查与复核记录', '昨日的口供、搜查和复核，如今怎样记着？'));
  if (npcId === 'su-wantang' && !state.dayTwo.innEchoSeen) out.push(choice('inn-echo', '询问客栈登记与残片风声', '昨日留在客栈的名字和那张残片，如今可有余波？'));
  if (npcId === 'shen-yanqiu' && !state.dayTwo.clinicEchoSeen) out.push(choice('clinic-echo', '询问验伤、保密与病案边界', '我的验伤和病案，如今哪些能写、哪些仍该保密？'));
  if (npcId === 'lu-guanlan' && !state.dayTwo.luEchoSeen) out.push(choice('lu-echo', '询问他的信任与昨日指点', '昨日你看见、听见的那些，如今还作数么？'));
  const dangerConfirmed = state.chengShouyiIdentified || state.poisonWoundLinked;
  const canBroker = state.inventoryItemIds.includes('ding17-fragment') && state.evidenceCustody.fragment === 'player' && (state.npcStates['ma-sandao'].informedRiverGang || state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment'));
  if (dangerConfirmed && !state.saltCase.reported && state.dayTwo.departurePlan === 'none') out.push(choice('decline-report', '拒绝报案，设法夜渡离县', '程守义的事我不能替他结案。我不报官，只求今晚离开青石。'));
  if (canBroker && state.dayTwo.brokerContact === 'none') out.push(choice('accept-broker-contact', '接受一个未具名中人的渡口口信', '若有人只认残片、不问其余，我愿去河岸听他一句。'));
  return [...out.slice(0, 5), choice('close-daytwo', '返回当前场景选项', '先回到眼前。', 'action')];
}

export function resolveDayTwo(state: GameState, request: InteractionRequest): RuleResolution | null {
  switch (request.actionId) {
    case 'open-daytwo': case 'close-daytwo': return { timeCostMinutes: 0 };
    case 'gate-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.review === 'cleared' ? '“复核原话、更正和返还都在册。你是候询入城，不是洗清了所有疑点。”' : state.npcStates['ma-sandao'].searchedPlayer ? '“搜查的事我记着；没经你当面说的，我也不会替别人补进记录。”' : '“城门只留你当时亲口说的。无名尸的事，不是我在这里替医馆断的。”', narration: state.dayOne.gateName ? '城门的口供仍是城门的口供：它影响差役对你的态度，却没有自动传到客栈或医馆。' : '你没有留下完整自报姓名，差役只按当时可核的盘问记录看你。' };
    case 'inn-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.registration === 'refused' ? '“你昨日拒绝登记，便没有客房簿上的名字。大堂里看过什么，我不会替你添成住客记录。”' : state.dayOne.registrationDiscrepancy ? '“两个名字我都只在你亲口说过后才记下。哪一句真，我不知道；只是有人问起时，别指望我替你圆。”' : state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment') ? '“簿上只记你自报的名字。那张残片我见过，却不知它从哪里来。”' : '“我这里只记你亲口说过、当面做过的事。没有看过的东西，我不能替你证明。”', narration: state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment') ? '苏晚棠确实见过残片，因此她只提醒你：大堂有人在打听一张残纸，却没有说出那人的来历。' : '客栈没有见过你的残片；登记本与城门记录仍是彼此分开的两份纸。' };
    case 'clinic-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.privateCare && !state.dayOne.reportAuthorized ? '“你要我保密，新的报案副本便不开。验伤结论仍在医馆，不会因为保密就消失。”' : state.dayOne.consent === 'basic' ? '“我只替你止了血，没替你确认药性，更没有把它写成案情。”' : state.dayOne.cloth === 'player' ? '“布条由你带走，我不能拿不存在的留样替你作结论。”' : '“我只写自己验过的伤。程守义的身份和城门的事，不在我的病案里。”', narration: '沈砚秋的边界没有改变：授权决定副本能否用于报案，不会让他知晓客栈登记或城门口供。' };
    case 'lu-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.guidanceSeed ? (state.npcStates['lu-guanlan'].memory.statements.some((s) => s.subject === 'observed-stance' && s.truth === 'false') ? '“脚下那一晃我亲眼看过，便不信你后来那句。指点仍只是指点，不替你挡刀。”' : '“松肩、站稳这句话仍作数。你肯听进去，是你的事；我没把它算作师承。”') : (state.npcStates['lu-guanlan'].memory.statements.some((s) => s.subject === 'cart-account') ? '“货车是你说的，不是我亲见的。传话与目击，我分得清。”' : '“我只记得自己听见、看见的，没替你补出一段案情。'), narration: '陆观澜的态度取决于他实际观察和你说过的话；他没有得到医馆或城门的私下记录。' };
    case 'decline-report': return { timeCostMinutes: 5, narration: '你拒绝把程守义的死写进正式案卷。有人告诉你，河岸夜里有条只问船资和去向的小渡；你只能带着自己还握着的东西离开。', discoveredLocationIds: ['dock'] };
    case 'accept-broker-contact': return { timeCostMinutes: 5, narration: '一张没有署名的纸条从柜台边递来：今夜河岸，带残片来。纸条没有提程守义、病案或城门口供；递话的人显然只知道有人见过残片。', discoveredLocationIds: ['dock'] };
    case 'wait-night-ferry': return { timeCostMinutes: 720, narration: '你在河岸阴影里等到更深的夜。远处货船靠岸、转运车离城的动静照常发生，没有人因你的等待停下。' };
    case 'take-night-ferry': return { timeCostMinutes: 10, narration: '小船离开青石河弯。你没有替程守义结案，只把活下去的决定留在自己手里。' };
    case 'transfer-fragment': return { timeCostMinutes: 10, narration: '斗笠下的人只验了残片边角，留下一次性的夜渡凭记，随即把纸片收走。他没有问程守义是谁，也没有替你许诺清白。' };
    default: return null;
  }
}

export function applyDayTwo(state: GameState, request: InteractionRequest): GameState {
  const d = { ...state.dayTwo };
  switch (request.actionId) {
    case 'open-daytwo': d.menu = true; break;
    case 'close-daytwo': d.menu = false; break;
    case 'gate-echo': d.gateEchoSeen = true; break;
    case 'inn-echo': d.innEchoSeen = true; break;
    case 'clinic-echo': d.clinicEchoSeen = true; break;
    case 'lu-echo': d.luEchoSeen = true; break;
    case 'decline-report': d.departurePlan = 'night-ferry'; d.menu = false; break;
    case 'accept-broker-contact': d.brokerContact = 'offered'; d.menu = false; break;
  }
  return { ...state, dayTwo: d };
}
