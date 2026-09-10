'use client';
import { useState } from 'react';
import { Check, LockKeyhole, BookOpen, CircleAlert } from 'lucide-react';
import { artGraph, artStateLabels, artAcquisition } from '../lib/ui/art-graph';
import { artTrees, artTrainingBlock } from '../lib/game/arts';
import type { ArtTree } from '../lib/game/arts-content';
import { getNpcDisplayName } from '../lib/game/engine';
import type { GameState } from '../lib/game/types';
import type { LimitedAction } from '../lib/game/limited-actions';

const symbols={learned:Check,locked:LockKeyhole,available:BookOpen,blocked:CircleAlert};
export function ArtTreeDiagram({game,tree,actions,ready,onLearn}:{game:GameState;tree:ArtTree;actions:LimitedAction[];ready:boolean;onLearn:(action:LimitedAction)=>void}) {
 const [selected,setSelected]=useState<string|null>(null);
 const graph=artGraph(game,tree,actions,ready);
 const detail=graph.nodes.find(n=>n.id===selected);
 return <section className="art-tree" aria-labelledby={`tree-${tree}`}>
  <h3 id={`tree-${tree}`} className="font-serif text-xl">{artTrees[tree].title}</h3>
  <p className="my-2 text-sm">导师：{artTrees[tree].mentors.map(id=>getNpcDisplayName(game,id)).join('、')} · 可用点 {(tree==='step'||tree==='medicine'?game.growth[tree].availablePoints:0)+game.arts.grants.filter(g=>g.tree===tree&&!game.arts.learned.some(l=>l.grant===g.id)).length}</p>
  <p className="text-xs text-ink/65">从左向右研习，连线表示前置。按 Tab 查看节点，Enter 或空格展开；窄屏可横向滚动。</p>
  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 滚动区域需要键盘焦点，让方向键可横向浏览整个功法图。 */}
  <section className="art-scroll" tabIndex={0} aria-label={`${artTrees[tree].title}前置关系图，可滚动`}>
   <div className="art-canvas" style={{width:graph.width,height:graph.height}}>
    {['基础技艺','分支专精','剧情绝技'].map((label,i)=><span key={label} className="art-column-label" style={{left:24+i*306}}>{label}</span>)}
    <svg className="art-lines" width={graph.width} height={graph.height} aria-hidden="true">
     {graph.edges.map(({from,to})=><path key={to.id} className={from.state==='learned'?'fulfilled':''} d={`M ${from.x+234} ${from.y+100} C ${from.x+270} ${from.y+100}, ${to.x-36} ${to.y+100}, ${to.x} ${to.y+100}`} />)}
    </svg>
    {graph.nodes.map(n=>{const Icon=symbols[n.state];return <button key={n.id} type="button" className={`art-node art-${n.state}`} style={{left:n.x,top:n.y}} aria-expanded={selected===n.id} aria-controls={`art-detail-${tree}`} onFocus={()=>setSelected(n.id)} onClick={()=>setSelected(n.id)}>
     <span className="art-status"><Icon size={16} aria-hidden="true" /> {artStateLabels[n.state]}</span>
     <strong className="block font-serif text-lg">{n.title}</strong>
     <span className="block text-xs">一点 · {n.terminal?'分支终点':'后续有进阶'}</span>
     <span className="block text-xs">前置：{n.prerequisiteTitle}</span>
     <span className="block text-sm leading-6">{n.effect.split('；')[0]}</span>
    </button>})}
   </div>
  </section>
  <section id={`art-detail-${tree}`} className="art-detail" aria-label={`${artTrees[tree].title}节点详情`}>
   {detail?<><h4 className="font-serif text-lg">{detail.title} · {artStateLabels[detail.state]}</h4>
    <p>前置：{detail.prerequisiteTitle}。{detail.pledge?'还需相应守诺或重大事件经历。':''}</p>
    <p>获得与成本：{artAcquisition(tree)}</p>
    <p>当前条件：{detail.reason}</p><p>兑换点数条件：{artTrainingBlock(game,tree)??'可兑换；仍需完成当前对话。'}</p>
    <p>用法与去处：{detail.effect}学会以后，仍要到了相应场合才可选用。</p>
    {detail.state==='available'&&detail.action&&<button type="button" className="art-learn" onClick={()=>onLearn(detail.action!)}>投入一点，学习{detail.title}</button>}
   </>:<p>选择或聚焦节点查看完整说明。勾形图标与双边框表示已学习；书页与朱色边框表示可学习；锁与虚线表示未解锁；叹号与加粗侧边表示受条件限制。</p>}
  </section>
 </section>;
}
