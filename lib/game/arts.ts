import type { GameState, LimitedActionId } from './types.ts';
import type { LimitedAction } from './limited-actions.ts';
import { artTrees, artNodes, artBlock, totalArtPoints, hasArt, type ArtTree } from './arts-content.ts';
import { storyEvents } from './campaign-content.ts';
import { campaignDay } from './campaign.ts';
const keys = Object.keys(artTrees) as ArtTree[];
export function mentorAvailable(s:GameState, tree:ArtTree) {
 return artTrees[tree].mentors.some(id=>s.campaign.npcAlive[id] && s.npcStates[id].hostility<3 && (
   Object.entries(s.campaign.resolved).some(([event,r])=>r.witnessed && storyEvents.find(e=>e.id===event)?.choices.find(o=>o.id===r.choice)?.effect.help===id) ||
   tree==='step' && s.growth.step.unlocked || tree==='medicine' && s.growth.medicine.unlocked
 ));
}
export function artTrainingBlock(s:GameState, tree:ArtTree, first=false):string|null {
 if (!s.player.alive || s.gatePhase==='detained' || s.prologueEnding || s.campaign.ending || s.campaign.finale || s.campaign.activeEvent || s.campaign.startedAt===null) return '需在自由行动时研习';
 if(totalArtPoints(s)>=7) return '本篇七点上限';
 if(s.campaign.lastTrainDay===campaignDay(s)) return '今日已训练';
 if(s.player.injury==='重伤'||s.player.fatigue>=85) return '先处理重伤或疲劳';
 if(!mentorAvailable(s,tree)) return '尚无实际交往且愿意指点的导师';
 const route=artTrees[tree].route;
 if(first) return s.arts.grants.some(g=>g.tree===tree&&g.kind==='mentor') ? '已经接受入门指点' : null;
 if((tree==='step'||tree==='medicine')?!s.growth[tree].pointAwardedAt:!s.arts.grants.some(g=>g.tree===tree&&g.kind==='mentor')) return '先接受入门指点';
 if(s.campaign.experience[route]<2) return '还需两点未用阅历';
 if(s.player.money<3) return '还需三两器材钱';
 return null;
}
export function artActions(s:GameState):LimitedAction[] {
 const act=(id:string,label:string):LimitedAction=>({id:`journey-${id}`,input:label,label,mode:'action'});
 const out:LimitedAction[]=[];
 for(const tree of keys) {
  if((tree==='martial'||tree==='speech')&&!artTrainingBlock(s,tree,true)) out.push(act(`arts:mentor:${tree}`,`请教${artTrees[tree].title}入门（一小时、免费，仅一次）`));
  if(!artTrainingBlock(s,tree)) out.push(act(`arts:train:${tree}`,`兑换${artTrees[tree].title}点（四小时、三两、两点${artTrees[tree].route==='healer'?'医道':artTrees[tree].route==='xia'?'侠行':'公门'}阅历）`));
 }
 for(const n of artNodes.filter(n=>!n.legacy)) if(!artBlock(s,n)) out.push(act(`arts:learn:${n.id}`,`投入一点：${n.title} · ${n.effect}`));
 return out;
}
/** 调用方已检查动作并完成时间结算，死亡或错过窗口不会授点。 */
export function settleArtAction(s:GameState, id:LimitedActionId):GameState {
 const [,kind,target]=id.slice(8).split(':');
 const next={...s,arts:structuredClone(s.arts),campaign:structuredClone(s.campaign)};
 if(kind==='learn') {
  const n=artNodes.find(n=>n.id===target)!;
  const grant=next.arts.grants.find(g=>g.tree===n.tree&&!next.arts.learned.some(l=>l.grant===g.id))!;
  next.arts.learned.push({id:n.id,at:next.worldMinutes,grant:grant.id});
 } else {
  const tree=target as ArtTree, route=artTrees[tree].route;
  if(kind==='train') next.campaign.experience[route]-=2;
  next.campaign.lastTrainDay=campaignDay(next);
  next.arts.grants.push({id:`${tree}:${next.arts.grants.length}`,tree,kind:kind==='train'?'practice':'mentor',route,at:next.worldMinutes,practice:kind==='train'?2:0});
 }
 return next;
}
export const artSpent = (s:GameState,route:string) => (s.arts?.grants??[]).filter(g=>g.route===route&&g.kind==='practice').length*2;
export { artTrees, artNodes, artBlock, hasArt };
