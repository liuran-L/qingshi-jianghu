import type { GameState } from './types.ts';
import type { LifeRoute, StoryChoice, StoryEffect } from './campaign-types.ts';
export type ArtTree = 'step' | 'medicine' | 'martial' | 'speech';
export interface ArtGrant { id: string; tree: ArtTree; at: number; kind: 'mentor' | 'practice'; route: LifeRoute; practice: number }
export interface ArtsState { schema: 1; grants: ArtGrant[]; learned: { id: string; at: number; grant: string }[] }
export const initialArts = (): ArtsState => ({ schema: 1, grants: [], learned: [] });
export interface ArtNode { id: string; tree: ArtTree; title: string; tier: 1 | 2 | 3; prerequisite?: string; pledge?: string; effect: string; echoes: [string, string]; legacy?: boolean }
export const artTrees: Record<ArtTree, { title: string; route: LifeRoute; mentors: string[] }> = {
 step: { title: '步法', route: 'xia', mentors: ['lu-guanlan'] }, medicine: { title: '医术', route: 'healer', mentors: ['shen-yanqiu'] },
 martial: { title: '武学', route: 'xia', mentors: ['lu-guanlan', 'yue-hansheng'] }, speech: { title: '交涉', route: 'office', mentors: ['su-wantang', 'ning-buping', 'gu-qinghe'] },
};
export const artNodes: ArtNode[] = [
 { id: 'step-foundation', tree:'step',title:'基础步法',tier:1,legacy:true,effect:'旅行减两分钟；护送与河道冲突可走稳妥落脚处。',echoes:['survivor','riverfight'] },
 { id: 'step-breath',tree:'step',title:'调息赶路',tier:2,prerequisite:'step-foundation',legacy:true,effect:'高疲劳旅行惩罚减一级；外路与追捕可安排轮换撤离。',echoes:['roads','hunt'] },
 { id: 'step-escape',tree:'step',title:'借势脱身',tier:2,prerequisite:'step-foundation',effect:'撤退判定加三；护送与追捕可借地形脱身。',echoes:['survivor','hunt'] },
 { id: 'step-guard',tree:'step',title:'护人转位',tier:3,prerequisite:'step-escape',pledge:'lu-pledged',effect:'守势与环境行动加三；船难和证人夜间可护人转位。',echoes:['ship','witnessnight'] },
 { id: 'medicine-diagnosis',tree:'medicine',title:'基础辨伤',tier:1,legacy:true,effect:'保留创口观察；核药、补账可进行有来源的病伤比对。',echoes:['pharmacy','threeledgers'] },
 { id: 'medicine-bandage',tree:'medicine',title:'基础包扎',tier:2,prerequisite:'medicine-diagnosis',legacy:true,effect:'包扎缓冲四小时；河道和追捕中可先稳定伤员。',echoes:['riverfight','hunt'] },
 { id: 'medicine-poison',tree:'medicine',title:'毒性分辨',tier:2,prerequisite:'medicine-diagnosis',effect:'核药与船难可凭实际药签辨别原料，保留药账或封存药桶。',echoes:['pharmacy','ship'] },
 { id: 'medicine-case',tree:'medicine',title:'病案合参',tier:3,prerequisite:'medicine-poison',pledge:'shen-safe',effect:'问案与补账可查验病案签押，补回药证，不替死人编证词。',echoes:['threeledgers','witnessnight'] },
 { id: 'martial-opening',tree:'martial',title:'识隙',tier:1,effect:'进攻力量加二；刺杀与河道冲突可断兵护人。',echoes:['assassin','riverfight'] },
 { id: 'martial-block',tree:'martial',title:'架桥护卫',tier:2,prerequisite:'martial-opening',effect:'守势加三，伤害减三；追捕与船难可护卫撤离。',echoes:['hunt','ship'] },
 { id: 'martial-restraint',tree:'martial',title:'收锋制人',tier:3,prerequisite:'martial-block',pledge:'lu-pledged',effect:'进攻胜利不杀对手；粮仓与证人之夜可缴械护证。',echoes:['order','witnessnight'] },
 { id: 'speech-listen',tree:'speech',title:'听言记事',tier:1,effect:'环境交涉加一；赎人与问案逐项核条件，节省费用或补全材料。',echoes:['survivor','hearing'] },
 { id: 'speech-witness',tree:'speech',title:'具名对证',tier:2,prerequisite:'speech-listen',effect:'公开质证力量加二；问案与补账可核章取真档。',echoes:['hearing','threeledgers'] },
 { id: 'speech-charter',tree:'speech',title:'共守一约',tier:3,prerequisite:'speech-witness',pledge:'civil-order',effect:'交易费用减二；最终开价与证人夜间可按公约筹车护人。',echoes:['lastprice','witnessnight'] },
];
export const hasArt = (s: GameState, id: string) => s.growth.step.nodes.includes(id as never) || s.growth.medicine.nodes.includes(id as never) || !!s.arts?.learned.some(n=>n.id===id);
export const oldPointCount = (s: GameState) => Number(s.growth.step.pointAwardedAt !== null) + Number(s.growth.medicine.pointAwardedAt !== null) + s.campaign.extraLessons.step + s.campaign.extraLessons.medicine;
export const totalArtPoints = (s: GameState) => oldPointCount(s) + (s.arts?.grants.length ?? 0);
export function artBlock(s: GameState, n: ArtNode): string | null {
 if (hasArt(s,n.id)) return '已投入';
 if (!s.player.alive || s.gatePhase==='detained' || s.prologueEnding || s.campaign.ending) return '当前状态冻结成长';
 if(n.prerequisite && !hasArt(s,n.prerequisite)) return `前置：${artNodes.find(p=>p.id===n.prerequisite)!.title}`;
 if(n.pledge && !s.campaign.flags.includes(n.pledge)) return '尚缺实际守诺或重大事件经历';
 if(n.legacy) return s.growth[n.tree as 'step'|'medicine'].availablePoints ? null : '缺此树可用点数，先请教或训练';
 return s.arts.grants.some(g=>g.tree===n.tree && !s.arts.learned.some(l=>l.grant===g.id)) ? null : '缺此树可用点数，先请教或实践兑换';
}
const echoEffects: Record<string, StoryEffect> = {
 survivor:{route:'xia',flags:['survivor-safe'],evidence:['witness'],help:'su-wantang'},
 assassin:{route:'xia',flags:['gu-safe','people-safe'],help:'ning-buping'},
 roads:{route:'xia',evidence:['medicine'],flags:['assembly-pass']},
 pharmacy:{route:'healer',evidence:['medicine'],help:'shen-yanqiu'},
 riverfight:{route:'xia',flags:['people-safe'],evidence:['witness'],help:'lu-guanlan'},
 hearing:{route:'office',evidence:['official'],flags:['hearing-filed'],help:'ning-buping'},
 hunt:{route:'healer',flags:['shen-safe'],help:'shen-yanqiu'},
 ship:{route:'healer',flags:['boatmen-safe','river-safe'],evidence:['medicine']},
 order:{route:'xia',flags:['civil-order'],help:'ning-buping'},
 threeledgers:{route:'healer',evidence:['medicine']},
 lastprice:{route:'trade',money:6,help:'su-wantang'},
 witnessnight:{route:'xia',flags:['witnesses-safe']},
};
const scenes: Record<string,string> = {
 survivor:'你逐一核对送饭与放人的条件，沿已经看到的后门把商旅接走，留下他亲述的证言。',
 assassin:'你不追梁上的人，先断开压住门索的短刃，护着书吏与县令退入廊门。',
 roads:'你在两日往返中按脚程安排轮换，从药农手里核取了药库留底。',
 pharmacy:'你对着残渣与原药签逐项记录，保留药库副本；药性仍不能独自指认下毒的人。',
 riverfight:'你选定干燥落脚处，先稳住伤员再解民船，脚夫活着留下扣船证言。',
 hearing:'你逐栏核对编号、签押与收据，取得盖章真档副本，未确认的地方仍留空。',
 hunt:'你利用病床与巷口错位安排人手，医者与病人先后撤出；追兵扑到空房。',
 ship:'你分清破桶与完好药桶的位置，先堵破口，再借浅滩拖住船身，人货留在封锁河湾。',
 order:'你缴下堵门者的兵器，不取性命，让各巷领粮人具名互保。',
 threeledgers:'你核对已有病伤样本与药农签押，在废栈找到可复查的留底，补成药库材料。',
 lastprice:'你按已经公开的约定接运粮食，实收六两，未签独占条款。',
 witnessnight:'你按门、桥、车三处安排守护，证人逐个点名到达，没有假写无人照看的平安。',
};
/** 每个节点两处明示、可选的规则回响，不自动替玩家完成事件。 */
export function artEchoChoices(event: string): StoryChoice[] {
 return artNodes.filter(n=>n.echoes.includes(event)).map(n=>({id:`art-${n.id}`,label:`运用${n.title}：${event==='hearing'?'核章取档':event==='threeledgers'?'比对补账':'依所学护人办事'}（不另付银两）`,reply:`${n.title}在此派上用场。${event==='threeledgers'&&n.tree==='speech'?'你逐栏核对官面签押，从公示底档补出真档副本，没有把药案猜测填入官账。':scenes[event]}`,need:{node:n.id},effect:{...echoEffects[event],...(event==='threeledgers' && n.tree==='speech'?{route:'office',evidence:['official']}:{} )}}));
}
