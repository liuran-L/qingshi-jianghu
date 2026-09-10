import type { GameState } from '../game/types.ts';
import { artNodes, artTrees, hasArt, artBlock, type ArtTree } from '../game/arts-content.ts';
import type { LimitedAction } from '../game/limited-actions.ts';

export const artStateLabels = {locked:'未解锁',available:'可学习',learned:'已学习',blocked:'受条件限制'};
export function artGraph(s: GameState, tree: ArtTree, actions: LimitedAction[], readingReady = true) {
 const source=artNodes.filter(n=>n.tree===tree);
 const rows=new Map<number,number>();
 const nodes=source.map(n=>{
  const row=rows.get(n.tier)??0; rows.set(n.tier,row+1);
  const action=actions.find(a=>a.id===(n.legacy?`journey-node:${n.id}`:`journey-arts:learn:${n.id}`)||n.legacy&&a.id===`spend-${n.id}`);
  const entered=tree==='step'||tree==='medicine'?s.growth[tree].unlocked:s.arts.grants.some(g=>g.tree===tree);
  const missingPre=!!n.prerequisite&&!hasArt(s,n.prerequisite);
  const state: keyof typeof artStateLabels=hasArt(s,n.id)?'learned':!entered||missingPre?'locked':artBlock(s,n)||!action||!readingReady?'blocked':'available';
  const reason=state==='learned'?'已投入一点。':missingPre?`先学习${artNodes.find(x=>x.id===n.prerequisite)!.title}`:!entered?'先从相应人物那里得过入门指点。':artBlock(s,n)??(!readingReady?'先读完当前对话。':!action?'眼下不便参悟；先回到自由行动，或打开场景中的功法选项。':'可以投入一点。');
  return {...n,state,reason,action,x:24+(n.tier-1)*306,y:48+row*236,prerequisiteTitle:artNodes.find(x=>x.id===n.prerequisite)?.title??'无',terminal:!source.some(x=>x.prerequisite===n.id)};
 });
 return {nodes,width:Math.max(...nodes.map(n=>n.x))+258,height:Math.max(...nodes.map(n=>n.y))+224,edges:nodes.filter(n=>n.prerequisite).map(n=>({from:nodes.find(x=>x.id===n.prerequisite)!,to:n}))};
}
export function artAcquisition(tree: ArtTree) {
 const intro=tree==='step'?'先从步法导师处得过指点；序章请教需六十分钟。':tree==='medicine'?'先随医者辨过伤；序章请教需四十五分钟。':'先帮过相应人物，再向他请教入门。';
 return `${intro}旅程入门指点一小时、免费；后续兑换需两点${artTrees[tree].route==='healer'?'医道':artTrees[tree].route==='office'?'公门':'侠行'}阅历、三两、四小时，每日训练一次。${tree==='step'||tree==='medicine'?'旧基础节点使用原有点数：重练基础需对应实践至少二、导师存活、六小时、三两，每树限一次；还需未满两节点、无剩余旧点、今日未训练。':''}投入节点本身不耗时、不耗银，消耗本树一点；本篇总授点上限七点。`;
}
