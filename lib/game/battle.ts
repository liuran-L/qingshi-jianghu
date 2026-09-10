import type { GameState } from './types.ts';
import type { StoryChoice, StoryEffect } from './campaign-types.ts';
import { hasArt } from './arts-content.ts';
import { getPrivateNpc } from './world-private.ts';
export type BattleTactic='attack'|'guard'|'environment'|'retreat'|'bargain'|'proof'|'surrender';
export interface BattleAlly { id:string; level:number; style:string; trust:number; hostility:number; present:boolean; pledged:boolean; alive:boolean; injured:boolean }
export interface BattleContext { martial:number; agility:number; eloquence:number; trained:number; fatigue:number; injury:string; health:number; qi:number; wanted:number; money:number; skills:string[]; allies:BattleAlly[]; evidence:string[] }
export interface BattleRecord { event:string; tactic:BattleTactic; at:number; context:BattleContext; power:number; target:number; damage:number; cost:number; qiCost:number; win:boolean; outcome:string; lostEvidence:string[]; companionInjuries:string[]; relationChanges:{id:string;trust:number;favor:number}[]; healthAfter:number; injuryAfter:string }
export interface BattlePresentation { title:string; hint:string; details:string }
export interface BattleState { schema:1; records:BattleRecord[] }
export const initialBattles=():BattleState=>({schema:1,records:[]});
export const battles:Record<string,{title:string;cause:string;opponent:string;goal:string;target:number;present:string[];success:StoryEffect;failure:StoryEffect}>={
 assassin:{title:'廊门伏击',cause:'梁上刺客封住书房退路',opponent:'持弩刺客与接应刀手',goal:'护住书房与门外伤者',target:7,present:['ning-buping'],success:{route:'xia',flags:['gu-safe','people-safe'],help:'ning-buping'},failure:{wanted:1,dead:['gu-qinghe']}},
 survivor:{title:'护送过闸',cause:'看守扣住商旅，堵住退路',opponent:'盐场看守',goal:'把活口带出闸口',target:6,present:[],success:{route:'xia',flags:['survivor-safe'],evidence:['witness'],help:'su-wantang'},failure:{wanted:2}},
 riverfight:{title:'码头断索',cause:'两岸持弓者夹住民船',opponent:'河岸刀手',goal:'保住民船与扣船证言',target:8,present:[],success:{route:'xia',flags:['people-safe'],evidence:['witness'],help:'lu-guanlan'},failure:{wanted:2}},
 hunt:{title:'医馆追捕',cause:'灭口名单上的追兵包围医馆',opponent:'夜袭刀手',goal:'让医者与病人离开',target:9,present:['shen-yanqiu'],success:{route:'healer',flags:['shen-safe'],help:'shen-yanqiu'},failure:{wanted:2,dead:['shen-yanqiu']}},
 ship:{title:'药船争渡',cause:'逃船刀手截断拖船缆索',opponent:'护船刀手',goal:'拖船入浅滩，保住脚夫和药桶',target:9,present:[],success:{route:'xia',flags:['boatmen-safe','river-safe'],evidence:['medicine']},failure:{wanted:2,flags:['river-poisoned']}},
 witnessnight:{title:'护证夜路',cause:'拦路者要夺走具名材料',opponent:'受雇截路人',goal:'把证人与材料送到官驿',target:9,present:['su-wantang'],success:{route:'xia',flags:['witnesses-safe']},failure:{wanted:2}},
 finale:{title:'盐仓合力破阵',cause:'护仓刀客拒绝让证人离开',opponent:'护仓刀客',goal:'护证出围，保住证据',target:8,present:['ning-buping'],success:{},failure:{}},
};
export const tacticNames:Record<BattleTactic,string>={attack:'进攻破隙',guard:'守势护人',environment:'借现场地形与同伴掩护',retreat:'撤退脱身',bargain:'付资交易放行',proof:'公开质证',surrender:'交械投降'};
const styles:Record<string,string>={'lu-guanlan':'收剑护人','ning-buping':'封口缴械','shen-yanqiu':'救护伤员','su-wantang':'安排接应','yue-hansheng':'指点破绽'};
const skillIds=['step-foundation','step-breath','step-escape','step-guard','medicine-diagnosis','medicine-bandage','medicine-poison','medicine-case','martial-opening','martial-block','martial-restraint','speech-listen','speech-witness','speech-charter'];
export function battleContext(s:GameState,event:string):BattleContext {
 const def=battles[event];
 const allies=Object.keys(styles).map(id=>({id,level:getPrivateNpc(id).combatLevel,style:styles[id],trust:s.npcStates[id].trust,hostility:s.npcStates[id].hostility,present:def.present.includes(id),pledged:id==='lu-guanlan'&&s.campaign.flags.includes('lu-pledged'),alive:s.campaign.npcAlive[id],injured:s.battles.records.some(r=>r.companionInjuries.includes(id))})).filter(a=>a.alive&&(a.present||a.pledged)&&a.trust>=4&&a.hostility<3);
 return {martial:s.player.abilities.martial,agility:s.player.abilities.agility,eloquence:s.player.abilities.eloquence,trained:s.campaign.trained.xia,fatigue:s.player.fatigue,injury:s.player.injury,health:s.player.health,qi:s.player.qi,wanted:s.campaign.wanted,money:s.player.money,skills:skillIds.filter(id=>hasArt(s,id)),allies,evidence:[...s.campaign.evidence]};
}
export function judgeBattle(event:string,tactic:BattleTactic,c:BattleContext) {
 const skill=(id:string)=>c.skills.includes(id), target=battles[event].target+Math.floor(c.wanted/3);
 const aid=c.allies.reduce((n,a)=>n+Math.max(0,Math.floor(a.level/2)-(a.injured?1:0)),0);
 const penalty=(c.fatigue>=70?2:0)+(c.injury==='重伤'?3:c.injury==='轻伤'?2:0);
 let power=c.martial+c.trained+aid+(skill('step-foundation')?1:0)-penalty;
 if(tactic==='attack') power+=(skill('martial-opening')?2:0)+(c.qi>=8?1:-2);
 if(tactic==='guard') power+=(skill('martial-block')?3:1)+(skill('step-guard')?3:0);
 if(tactic==='environment') power=c.agility+aid+2+(skill('step-guard')?3:0)+(skill('speech-listen')?1:0)-penalty;
 if(tactic==='retreat') power=c.agility+aid+3+(skill('step-escape')?3:0)+(skill('step-breath')?1:0)-penalty;
 if(tactic==='proof') power=c.eloquence+c.evidence.length*2+aid+(skill('speech-witness')?2:0)-Math.floor(c.wanted/3);
 if(c.allies.some(a=>a.id==='ning-buping')&&(tactic==='guard'||tactic==='proof'))power+=1;
 if(c.allies.some(a=>a.id==='lu-guanlan')&&(tactic==='environment'||tactic==='retreat'))power+=1;
 if(c.allies.some(a=>a.id==='yue-hansheng')&&tactic==='attack')power+=2;
 const cost=tactic==='bargain'?Math.max(2,8-(skill('speech-charter')?2:0)-(c.allies.some(a=>a.id==='su-wantang')?1:0)):0;
 const win=tactic==='surrender'||tactic==='bargain'?true:power>=target;
 const mitigation=(skill('martial-block')?3:0)+(skill('medicine-bandage')?2:0)+(c.allies.some(a=>a.id==='shen-yanqiu')?2:0);
 const damage=tactic==='surrender'||tactic==='bargain'||tactic==='proof'&&win?0:Math.max(0,(win?tactic==='retreat'?2:8:18+(target-power)*5)-mitigation);
 const qiCost=tactic==='attack'?Math.min(c.qi,8):0;
 const lostEvidence=!win&&tactic!=='retreat'?c.evidence.slice(0,1):[];
 const companionInjuries=!win?c.allies.filter(a=>a.id!=='shen-yanqiu'&&!a.injured).slice(0,1).map(a=>a.id):[];
 const relationChanges=c.allies.map(a=>({id:a.id,trust:win?1:-1,favor:win?1:0}));
 const healthAfter=Math.max(0,c.health-damage);
 const injuryAfter=damage>=25?'重伤':damage>0&&c.injury==='无'?'轻伤':c.injury;
 const outcome=healthAfter===0?'死亡':tactic==='surrender'?'拘押':tactic==='retreat'?win?'脱身':'负伤脱身':win?tactic==='proof'?'质证放行':tactic==='bargain'?'交易放行':skill('martial-restraint')&&tactic==='attack'?'非致命制服':'目标达成':'负伤失守';
 return {power,target,damage,cost,qiCost,win,outcome,lostEvidence,companionInjuries,relationChanges,healthAfter,injuryAfter};
}
export function battlePreview(s:GameState,event:string,tactic:BattleTactic) { return judgeBattle(event,tactic,battleContext(s,event)); }
export function battleEnabled(s:GameState,event:string,tactic:BattleTactic) {
 if(!battles[event]||!Object.hasOwn(tacticNames,tactic)||!s.player.alive||s.gatePhase==='detained'||s.prologueEnding||s.campaign.ending||s.battles.records.some(r=>r.event===event)) return false;
 if(event==='finale'?s.campaign.finale!=='xia'||s.campaign.finaleStep!==0:s.campaign.activeEvent!==event) return false;
 return (tactic!=='bargain'||s.player.money>=battlePreview(s,event,tactic).cost) && (tactic!=='proof'||s.campaign.evidence.length>=2);
}
export function battleChoices(event:string):StoryChoice[] {
 const def=battles[event];if(!def||event==='finale') return [];
 return (Object.keys(tacticNames) as BattleTactic[]).flatMap(tactic=>[true,false].map(win=>{
  const firstActReply=event==='assassin'
   ? tactic==='surrender'?'你放下兵刃，任人缚住双手。廊下的救援停在这里。'
    :tactic==='retreat'?(win?'你翻过矮墙脱离县衙，身后的弦声仍在廊下震响。':'你挨了一记才越过矮墙。自己脱了身，书房与伤者却仍留在箭路里。')
    :tactic==='bargain'?'银两落进对方手中，他们让开一条窄路。你独自离开，书房与伤者仍在身后。'
    :win?'你们逼退伏击者，护着书房与门外伤者撤进内院。':'你带伤退出廊门，没能拦住射向书房的第二轮箭。'
   :`${def.title}：${tactic==='surrender'?'你交械认拘，后续行动停止。':tactic==='retreat'?'你脱离现场，未把撤离自己写成救下所有人。':win?`你们完成了${def.goal}。`:'你负伤退走，没能完成现场目标。'}`;
  const abandonsFirstActGoal=event==='assassin'&&['retreat','bargain','surrender'].includes(tactic);
  return {id:`battle-${tactic}-${win?'win':'loss'}`,label:'战斗结算记录',reply:firstActReply,effect:abandonsFirstActGoal?{dead:['gu-qinghe']}:tactic==='surrender'||tactic==='retreat'?{}:win?def.success:def.failure};
 }));
}
export function battleLabel(s:GameState,event:string,tactic:BattleTactic) {
 const p=battlePreview(s,event,tactic);
 return `${tacticNames[tactic]}：力量 ${p.power}/${p.target} · ${p.win?'可成':'会失手'} · 损血 ${p.damage} · 耗气 ${p.qiCost}${p.cost?` · ${p.cost}两`:''}${p.damage>=s.player.health?' · 致命！':''}${!p.win?' · 可能失证、追查或同伴负伤':''}`;
}

const firstActTacticTitles:Record<BattleTactic,string>={
 attack:'抢先破开刀路', guard:'守住退路，先护身边的人', environment:'借廊柱与空隙突围',
 retreat:'抽身离开', bargain:'付银换一条退路', proof:'当众举证，逼其让路', surrender:'放下兵刃',
};
const battleEvidenceNames:Record<string,string>={official:'县衙真档副本',transport:'漕运账副本',medicine:'药库出入记录',testament:'掌门遗嘱',witness:'幸存商旅证言'};
const battleNpcNames:Record<string,string>={'gu-qinghe':'顾清河','shen-yanqiu':'沈砚秋'};

/** 第一阶段冲突按钮的三层文案。只读取裁决预览，不改动存档。 */
export function battlePresentation(s:GameState,event:string,tactic:BattleTactic):BattlePresentation {
 const p=battlePreview(s,event,tactic), goal=battles[event].goal;
 const hint:Record<BattleTactic,string>={
  attack:`直取对手，争取${goal}；放弃稳守退路。`,
  guard:`先守住${goal}；放弃追击对手。`,
  environment:`借眼前地形完成${goal}；不与对手正面缠斗。`,
  retreat:`只求自己脱身；放弃${goal}。`,
  bargain:`当场付出${p.cost}两换自己脱身；放弃${goal}。`,
  proof:`以手中材料逼对方让路；若压不住场面，${goal}便会失守。`,
  surrender:`保住性命，放弃抵抗与${goal}；本程进入拘押结局。`,
 };
 const parts:string[]=[];
 if(tactic==='bargain') parts.push(`用银 ${p.cost} 两`,'交易放行，自行脱身');
 else if(tactic==='surrender') parts.push('放下兵刃','进入拘押结局');
 else {
  if(tactic==='retreat') parts.push(p.win?'可以脱身':'负伤脱身');
  else parts.push(`力量 ${p.power} / 对阵 ${p.target}`,p.win?'足以完成当场目标':'不足以完成当场目标');
  if(p.damage>0) parts.push(`气血 -${p.damage}${p.damage>=s.player.health?'，此举致命':''}`);
  if(p.qiCost>0) parts.push(`真气 -${p.qiCost}`);
  if(p.lostEvidence.length) parts.push(`失手会遗失：${p.lostEvidence.map(id=>battleEvidenceNames[id]??'随身材料').join('、')}`);
  if(p.companionInjuries.length) parts.push('失手会使一名助阵同伴负伤');
  const failure=battles[event].failure;
  if(!p.win&&failure.wanted) parts.push('失手会招来更多追查');
  if(!p.win&&failure.dead?.length) parts.push(`失手会使${failure.dead.map(id=>battleNpcNames[id]??'受护者').join('、')}遇害`);
 }
 return {title:firstActTacticTitles[tactic],hint:hint[tactic],details:parts.join(' · ')};
}
