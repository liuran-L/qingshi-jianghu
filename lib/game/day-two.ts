import type { GameState, InteractionRequest, LimitedActionId } from './types.ts';
import type { LimitedAction } from './limited-actions.ts';
import type { RuleResolution } from './interaction-rules.ts';
import { getLocation } from './world.ts';

export const dayTwoTopicIds: LimitedActionId[] = ['gate-echo', 'inn-echo', 'clinic-echo', 'lu-echo', 'decline-report', 'accept-broker-contact'];
export const initialDayTwo = (): GameState['dayTwo'] => ({ schema: 1, menu: false, gateEchoSeen: false, innEchoSeen: false, clinicEchoSeen: false, luEchoSeen: false, departurePlan: 'none', brokerContact: 'none' });
export const isDayTwo = (state: GameState) => state.worldMinutes - state.storyStartedAtMinutes >= 720;
const choice = (id: LimitedActionId, label: string, input: string, mode: 'speech' | 'action' = 'speech'): LimitedAction => ({ id, label, input, mode });

export function dayTwoEntry(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.gatePhase === 'detained' || state.campaign.activeEvent || state.campaign.finale || state.campaign.ending || state.growth.menu || !isDayTwo(state) || !npcId || state.prologueEnding || state.dayTwo.menu || state.selectedNpcId !== npcId || !getLocation(state.locationId).npcIds.includes(npcId) || !['ma-sandao', 'su-wantang', 'shen-yanqiu', 'lu-guanlan'].includes(npcId)) return [];
  return [choice('open-daytwo', '问问昨日的记录与风声', '我想问问昨日留下的记录与风声。', 'action')];
}

export function dayTwoActions(state: GameState, npcId: string | null): LimitedAction[] {
  if (!state.player.alive || state.gatePhase === 'detained' || state.campaign.activeEvent || state.campaign.finale || state.campaign.ending || !state.dayTwo.menu || !npcId || state.selectedNpcId !== npcId || !getLocation(state.locationId).npcIds.includes(npcId) || !isDayTwo(state)) return [];
  const out: LimitedAction[] = [];
  if (npcId === 'ma-sandao' && !state.dayTwo.gateEchoSeen) out.push(choice('gate-echo', '核对城门口供、搜查与复核记录', '昨日的口供、搜查和复核，如今怎样记着？'));
  if (npcId === 'su-wantang' && !state.dayTwo.innEchoSeen) out.push(choice('inn-echo', '询问客栈登记与残片风声', '昨日留在客栈的名字和那张残片，如今可有余波？'));
  if (npcId === 'shen-yanqiu' && !state.dayTwo.clinicEchoSeen) out.push(choice('clinic-echo', '询问验伤、保密与病案边界', '我的验伤和病案，如今哪些能写、哪些仍该保密？'));
  if (npcId === 'lu-guanlan' && !state.dayTwo.luEchoSeen) out.push(choice('lu-echo', '询问他的信任与昨日指点', '昨日你看见、听见的那些，如今还作数么？'));
  const dangerConfirmed = state.chengShouyiIdentified || state.poisonWoundLinked;
  const canBroker = state.inventoryItemIds.includes('ding17-fragment') && state.evidenceCustody.fragment === 'player' && (state.npcStates['ma-sandao'].informedRiverGang || state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment'));
  if (npcId === 'su-wantang' && dangerConfirmed && !state.saltCase.reported && state.dayTwo.departurePlan === 'none') out.push(choice('decline-report', '先不递状，请苏掌柜指一条夜渡', '我眼下不递状。若你确实知道今晚离开青石的小渡，只告诉我船家认什么。'));
  if (npcId === 'su-wantang' && canBroker && state.dayTwo.brokerContact === 'none') out.push(choice('accept-broker-contact', '接下苏掌柜转来的无名纸条', '这纸条既是从你柜前递来，我只去听一句，不把你的转交当作担保。'));
  return [...out.slice(0, 5), choice('close-daytwo', '先问到这里', '先回到眼前。', 'action')];
}

export function resolveDayTwo(state: GameState, request: InteractionRequest): RuleResolution | null {
  switch (request.actionId) {
    case 'open-daytwo': case 'close-daytwo': return { timeCostMinutes: 0 };
    case 'gate-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.review === 'cleared' ? '“原话、更正和原物返还都在册。你可以入城，日后问到这桩事，还得照册应答。”' : state.npcStates['ma-sandao'].searchedPlayer ? '“昨日搜过什么、扣过什么，簿上写着。旁处的事别来问我。”' : '“城门只记你当时亲口说的。河边那具尸首，去问验过的人。”', narration: state.dayOne.gateName ? '昨日口供还夹在城门登记簿里。客栈房簿与医馆病案各在别处，没有人替你把三张纸并作一张。' : '登记簿上没有你的完整自报姓名，差役仍按昨日留下的几句盘问认你。' };
    case 'inn-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.registration === 'refused' ? '“你昨日没登记，房簿上自然没有名字。至于大堂里见过什么，我只说自己见过的。”' : state.dayOne.registrationDiscrepancy ? '“两个名字都是你亲口报的。哪一个真，我不知道；有人问起，我也不会替你圆。”' : state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment') ? '“簿上是你报的名字。那张残片我见过，来路却没见过。”' : '“我只记你在店里说过、做过的事。没见过的东西，别叫我替你作保。”', narration: state.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment') ? '苏晚棠见过那张残片。她只说昨日有人在大堂打听残纸，来人没有留下姓名。' : '客栈没人见过你的残片。房簿与城门登记仍各自收着，没有互通。' };
    case 'clinic-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.privateCare && !state.dayOne.reportAuthorized ? '“你叫我守口，我便不开报案副本。原病案仍锁在药柜后。”' : state.dayOne.consent === 'basic' ? '“昨日只替你止血，药性没验，病案上也没有这几笔。”' : state.dayOne.cloth === 'player' ? '“布条在你手里，我这里没有留样可验。”' : '“病案只写我验过的伤。程守义的身份、城门的口供，都不在这本簿里。”', narration: '沈砚秋翻给你看的只有医馆病案。客栈房簿和城门口供，他从未经手。' };
    case 'lu-echo': return { timeCostMinutes: 5, dialogue: state.dayOne.guidanceSeed ? (state.npcStates['lu-guanlan'].memory.statements.some((s) => s.subject === 'observed-stance' && s.truth === 'false') ? '“脚下那一晃我亲眼看过，便不信你后来说得那句。指点仍是指点，不替你挡刀。”' : '“松肩、站稳，这句话还作数。肯不肯练，是你的事；我还没收徒。”') : (state.npcStates['lu-guanlan'].memory.statements.some((s) => s.subject === 'cart-account') ? '“货车是你说的，不是我亲见的。传话与目击，我分得清。”' : '“我只记得自己听见、看见的。旁处发生了什么，你得问旁处的人。”'), narration: '陆观澜记得昨日亲眼见过的站姿，也记得你说过的货车；医馆和城门的私话没有进过他的耳朵。' };
    case 'decline-report': return request.npcId === 'su-wantang' ? { timeCostMinutes: 5, dialogue: '“我只知道今夜有条收船钱的小渡。你若不递状，往后出了城门，没人替你担保去向。”', narration: '你没有当场递状。苏晚棠只把夜渡的时辰与认船灯色说清，没有许诺替你藏人、销物或说情。', discoveredLocationIds: ['dock'] } : null;
    case 'accept-broker-contact': return request.npcId === 'su-wantang' ? { timeCostMinutes: 5, dialogue: '“纸不是我写的，人也不是我保的。你若去，只当我替人递过一次。”', narration: '苏晚棠从柜下递来一张没有署名的纸条：今夜河岸，带残片来。纸上没写程守义，也没提病案与城门口供。', discoveredLocationIds: ['dock'] } : null;
    case 'wait-night-ferry': return { timeCostMinutes: 720, narration: '你在河岸阴影里等到夜深。远处货船靠岸，车轮随后穿过城门；河面与官道都没有为谁停下。' };
    case 'take-night-ferry': return { timeCostMinutes: 10, narration: '船篙一点，小渡离开青石河湾。城门灯火渐远，你带着手中余物顺流而下。' };
    case 'transfer-fragment': return { timeCostMinutes: 10, narration: '斗笠下的人对过残片边角，递给你一枚今夜可用的渡口木牌，随即收走纸片。他没有问程守义的姓名。' };
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
