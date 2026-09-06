'use client';
import { useState } from 'react';
import type { KnowledgeGroup } from '../lib/ui/knowledge';
import { toggleDisclosure } from '../lib/ui/knowledge';

export function KnownInformation({ groups }: { groups: KnowledgeGroup[] }) {
 const [category,setCategory]=useState(groups[0].id);
 const [expanded,setExpanded]=useState<string|null>(null);
 const group=groups.find(g=>g.id===category)!;
 return <section className="paper-panel p-4" aria-label="已知情报">
  <h2 className="section-title">已知情报</h2>
  <label className="mt-3 block text-sm">分类
   <select className="ml-3 max-w-full border border-ink/30 bg-transparent p-2" value={category} onChange={e=>{setCategory(e.target.value);setExpanded(null);}} aria-controls="known-entries">
    {groups.map(g=><option key={g.id} value={g.id}>{g.title}（{g.entries.length}）</option>)}
   </select>
  </label>
  <ul id="known-entries" aria-label={group.title} className="mt-3 space-y-2 text-sm">
   {group.entries.map(e=><li key={e.id} className="border-b border-ink/15">
    <button type="button" className="knowledge-toggle" aria-expanded={expanded===e.id} aria-controls={`known-${group.id}-${e.id}`} onClick={()=>setExpanded(toggleDisclosure(expanded,e.id))}>
     <span aria-hidden="true">{expanded===e.id?'−':'＋'}</span> {e.title}
    </button>
    {expanded===e.id&&<p id={`known-${group.id}-${e.id}`} className="px-2 pb-3 leading-7 text-ink/70">{e.detail}</p>}
   </li>)}
  </ul>
  {!group.entries.length&&<output className="mt-3 block text-sm text-ink/60">此分类暂无已知条目。</output>}
 </section>;
}
