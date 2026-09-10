import type { GameState } from './types.ts';
import { artNodes, artTrees, totalArtPoints, type ArtTree } from './arts-content.ts';
import { storyEvents } from './campaign-content.ts';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const time=(x:unknown,s:GameState)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=s.storyStartedAtMinutes&&x<=s.worldMinutes;
export function decodeArts(s:GameState|null):GameState|null {
 if(!s) return null;
 if(!Object.hasOwn(s,'arts')) return null;
 const a=s.arts;
 if(!record(a)||a.schema!==1||!Array.isArray(a.grants)||!Array.isArray(a.learned)||totalArtPoints(s)>7) return null;
 const grantIds=new Set<string>(), used=new Set<string>(), nodes=new Set<string>();
 let last=s.storyStartedAtMinutes;
 for(const g of a.grants) {
  if(!record(g)||!Object.hasOwn(artTrees,g.tree)||!['mentor','practice'].includes(g.kind)||!time(g.at,s)||g.at<last||g.id!==`${g.tree}:${grantIds.size}`||g.route!==artTrees[g.tree as ArtTree].route||g.practice!==(g.kind==='practice'?2:0)) return null;
  if(g.kind==='mentor' && (g.tree==='step'||g.tree==='medicine'||a.grants.some(other=>other!==g&&other.tree===g.tree&&other.kind==='mentor'))) return null;
  if(g.kind==='practice' && ((g.tree==='step'||g.tree==='medicine') ? s.growth[g.tree].pointAwardedAt===null||s.growth[g.tree].pointAwardedAt!>g.at : !a.grants.some(prev=>prev.tree===g.tree&&prev.kind==='mentor'&&prev.at<g.at))) return null;
  const action=`arts:${g.kind==='mentor'?'mentor':'train'}:${g.tree}`;
  if(!s.campaign.journal.some(j=>j.action===action&&j.at===g.at&&(g.kind==='mentor'||j.money===-3))) return null;
  const knownMentor=artTrees[g.tree as ArtTree].mentors.some(id=>Object.entries(s.campaign.resolved).some(([event,r])=>r.at<=g.at&&r.witnessed&&storyEvents.find(e=>e.id===event)?.choices.find(o=>o.id===r.choice)?.effect.help===id)) || (g.tree==='step'||g.tree==='medicine')&&s.growth[g.tree].unlocked;
  if(!knownMentor) return null;
  const date=Math.floor((g.at-s.storyStartedAtMinutes+1020)/1440);
  if(a.grants.some(other=>other!==g && Math.floor((other.at-s.storyStartedAtMinutes+1020)/1440)===date)) return null;
  grantIds.add(g.id);last=g.at;
 }
 const acquired=(id:string,at:number) => {
  const n=artNodes.find(n=>n.id===id);
  if(!n) return false;
  if(n.legacy) { const tree=s!.growth[n.tree as 'step'|'medicine']; return tree.nodes.includes(id as never)&&tree.pointAwardedAt!==null&&tree.pointAwardedAt<=at; }
  return a.learned.some(l=>l.id===id&&l.at<=at&&nodes.has(l.id));
 };
 last=s.storyStartedAtMinutes;
 for(const l of a.learned) {
  if(!record(l)||!time(l.at,s)||l.at<last||typeof l.id!=='string'||nodes.has(l.id)||used.has(l.grant)) return null;
  const n=artNodes.find(n=>n.id===l.id),g=a.grants.find(g=>g.id===l.grant);
  if(!n||n.legacy||!g||g.tree!==n.tree||g.at>l.at||n.prerequisite&&!acquired(n.prerequisite,l.at)) return null;
  if(n.pledge&&!Object.entries(s.campaign.resolved).some(([id,r])=>r.at<=l.at&&storyEvents.find(e=>e.id===id)?.choices.find(o=>o.id===r.choice)?.effect.flags?.includes(n.pledge!))) return null;
  if(!s.campaign.journal.some(j=>j.action===`arts:learn:${l.id}`&&j.at===l.at)) return null;
  nodes.add(l.id);used.add(l.grant);last=l.at;
 }
 for(const [id,r] of Object.entries(s.campaign.resolved)) {
  const n=storyEvents.find(e=>e.id===id)?.choices.find(o=>o.id===r.choice)?.need?.node;
  if(n&&!acquired(n,r.at)) return null;
 }
 for(const j of s.campaign.journal) {
  if(j.action.startsWith('arts:learn:')&&!a.learned.some(l=>l.at===j.at&&j.action===`arts:learn:${l.id}`))return null;
  if(/^arts:(mentor|train):/.test(j.action)&&!a.grants.some(g=>g.at===j.at&&j.action===`arts:${g.kind==='mentor'?'mentor':'train'}:${g.tree}`))return null;
 }
 return s;
}
