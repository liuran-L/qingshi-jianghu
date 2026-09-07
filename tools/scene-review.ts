import { storyEvents } from '../lib/game/campaign-content.ts';
/** 内部准入清单，不导入玩家界面。 */
export const proofPaths = {
 official: [['assassin','archive'],['roads','prefecture'],['hearing','buycopy']],
 transport: [['fire','cordon'],['roads','river'],['riverfight','bargain']],
 medicine: [['temple','medicine'],['roads','mountain'],['pharmacy','recover']],
} as const;
const notes:Record<string,[string,string,string]>={
 temple:['不承诺护送，只送信或暂离；保留自由但不护住老人','遗嘱可用于公议，陆观澜仅承认实际托付','岳寒声知道门内药源，不知道官档'],
 assassin:['救门外伤者或暂离；不追凶但县令可能无人保护','顾清河存亡与官档去向分开，邻府仍留底档','宁不平看见弦与梁上动静，不能指认幕后'],
 inheritance:['不争位，登记证人或暂离；不作护送承诺也无守诺助阵','名单可供公议，遗嘱不能替陆观澜决定继位','陆只依据所见遗嘱、师门死讯和证人名册'],
 fire:['留在火外保粮或暂离；避免深入却不能保全人与账','脚夫门路、苏的抄账与账房存亡各自回收','苏只知抄账，不知伪印制作'],
 identity:['避开复核或暂离；省担保银却无合法路引','公门差事、公开验人、水道盘问受实际身份影响','自报、登记、核验三栏独立'],
 survivor:['暂离，不赎也不订三日约；保住银钱和时间，失去活人口供','其后可查货单和三账，不能伪造此人的目击证言','商旅只能述亲见袭击，不指认未见的下令人'],
 sister:['不救或暂离；不花钱、不露面，却失去救人窗口','第四十一日不得假称妹妹已获救，也不能凭空核货签','苏优先妹妹，只交自己掌握的抄账'],
 roads:['留县不出门；省两日食宿，但错失本轮外路材料','药库、听审和补账仍可补证','药农、秤签、邻府分别只证一段'],
 pharmacy:['不买不夜取或暂离；省钱免追查，却拿不到当场药库记录','药源可由前期留底或后续补账确认','沈能辨药性，不能替人证定罪'],
 assembly:['护不站队者下山；放弃当场问责，保全离山者','公议问责和乡民互保都是侠行资格来源','门人核笔迹，药农核领用，遗嘱不是毒案判词'],
 riverfight:['救民船不取账或撤离；不用替乔五付钱，但运输账留在对方','幸存脚夫可作证；后续仍可补账','乔五只交易实际掌握的账'],
 hearing:['不具结，抄底档或暂离；不补虚词，暂失当场立案机会','真档可留到末期核卷；交夜路会损害旧关系','宁区分证词、抄件和判词'],
 olddebt:['不护客栈或暂离；免当夜风险，也无安全屋安排','证人之夜只承认实际设置的落脚处','苏只回收妹妹、护店、已知水道经历'],
 hunt:['撤退或暂离；保自己但可能失证或失去医者','医者生死影响差事与助阵，病案不能补回一个人','医者只对亲自验过的伤作证'],
 ship:['保人、保货、封水分选或退开；免现场风险而药害继续','河水、船工与药记录进入终局','不能把沉船说成毒物已消失'],
 order:['不接公账或暂离；免持续责任，却无转运行或互保资格','民生责任分别支撑侠行、行商、公门','乡民互保不代表全县一致同意'],
 threeledgers:['只补缺账或暂离；不凑伪证，缺账只能有限控告','三种来源分别核验，终局保留缺口','副本不能冒充原件，人证不能代替药性'],
 lastprice:['拒绝站队或暂离；不拿即时好处，旧债追查不抹去','终局仍受实际钱债、材料、门路限制','买家不能知道未交付的材料'],
 witnessnight:['不护证或暂离；免守候和车费，证人散去','未设落脚处不能写成证人获救','可公开威胁信，幕后指使仍需证据'],
};
export const eventReviews=storyEvents.map((e,i)=>({id:e.id,title:e.title,defaultResult:e.missed.text,deadline:storyEvents[i+1]?.day??58,refusal:notes[e.id]?.[0],echo:notes[e.id]?.[1],knowledge:notes[e.id]?.[2],feedback:e.choices.filter(c=>!c.id.startsWith('art-')&&!c.id.startsWith('battle-')).map(c=>`${c.id}：${c.reply}`)}));
export const specialReviews=[
 ['gate','城门盘查','车流与盘查照常进行，等候耗时','不报细节但被继续盘问，不等同安全放行','gate-echo只核当时口供，不向医馆共享','gatePhase / playerClaims / npcStates.memory / dayOne','D03、D20、A04'],
 ['inn','客栈登记','只按实际登记提供客房','拒绝登记不留姓名，也不能入住；可重新登记','inn-echo区分登记与亲见残片','lodgingRecords / dayOne.registration / npcStates.memory','D04、A04'],
 ['clinic','医馆授权','伤口随时间恶化，不强制验伤','拒绝来历保隐私；拒检不花诊金但延误止血，可重新授权','clinic-echo区分止血、验毒、留样、保密和报案授权','dayOne.interview / consent / cloth / reportAuthorized','G03、D05、A04'],
 ['custody','证物归属转折','搜查、交存、交易和战败按实物扣除','不交存保有纸张，却不能声称已经封案','背包只显示仍持有物；已知线索不会因失物抹去','inventoryItemIds / evidenceCustody / campaign.evidence / battles.records','D03、P10、A05'],
 ['relations','立约与拒绝转折','NPC继续自身职责','解约付六两或记债；不锁死路线、不归零所学','旧伙伴减少协助，新差事仍可积累','campaign.pledge / journal / npcStates.memory','L系列、A04'],
 ['prologue','序章三种暂结','第三日船车按时离开','封存、夜渡、交物都不强迫查全案','接续长篇保留伤势、旧债、身份、实物','prologueEnding / saltCase / campaign.prologueRecord','P01–P18、L系列'],
 ['ending-career','人生立业终局','第六十日最后时刻按事实定稿','五方向各有承担，有限追责不等于真相大白','三账齐全才公开链条，人物逐项核卷','campaign.finale / finaleStep / ending / flags','L01十条通关样本、A02'],
 ['ending-open','退隐与远走终局','到时留城；满足窗口可远走','不担清算职责，旧债与未解问题仍在','不奖励完整真相与深度关系','campaign.ending / endedAt / debt','L系列、A02'],
 ['ending-forced','死亡与拘押终局','明示危险或认拘后冻结','认拘保命却冻结；死亡不能由休息复活','可存读回看，不能继续移动、战斗、取物','player.alive / deathCause / gatePhase / campaign.ending','D20、D23、B系列、A02'],
] as const;
export function reviewErrors() {
 const errors:string[]=[];
 if(eventReviews.length!==19||new Set(eventReviews.map(r=>r.id)).size!==19) errors.push('关键事件登记不完整');
 for(const r of eventReviews) if(!r.refusal||!r.echo||!r.knowledge||!r.feedback.length) errors.push(`${r.id} 模板缺项`);
 for(const [proof,paths] of Object.entries(proofPaths)) {
  if(new Set(paths.map(p=>p[0])).size<3) errors.push(`${proof} 不足三个独立场景来源`);
  for(const [id,choice] of paths) if(!storyEvents.find(e=>e.id===id)?.choices.find(c=>c.id===choice)?.effect.evidence?.includes(proof)) errors.push(`${proof} 来源未实现`);
 }
 return errors;
}
