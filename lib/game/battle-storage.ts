import type { GameState } from './types.ts';
import { initialBattles, battles, tacticNames, judgeBattle } from './battle.ts';
import { artNodes, hasArt } from './arts-content.ts';
import { dayAt } from './campaign.ts';
import { storyEvents } from './campaign-content.ts';
import { getPrivateNpc } from './world-private.ts';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function decodeBattles(s:GameState|null):GameState|null {
 if(!s)return null;
 if(!Object.hasOwn(s,'battles')) s={...s,battles:initialBattles()};
 const b=s.battles;
 if(!record(b)||b.schema!==1||!Array.isArray(b.records)||b.records.length>Object.keys(battles).length)return null;
 const used=new Set<string>();let last=s.storyStartedAtMinutes;
 for(const r of b.records) {
  if(!record(r)||!Object.hasOwn(battles,r.event)||used.has(r.event)||!Object.hasOwn(tacticNames,r.tactic)||!Number.isSafeInteger(r.at)||r.at<last||r.at>s.worldMinutes||!record(r.context))return null;
  const c=r.context;
  if(!['martial','agility','eloquence','trained','fatigue','health','qi','wanted','money'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])&&(c[k] as number)>=0))return null;
  if(c.health<=0||c.health>s.player.maxHealth||c.qi>s.player.maxQi||c.fatigue>100||c.wanted>10||c.trained>3||!['无','轻伤','重伤'].includes(c.injury))return null;
  if(c.martial>s.player.abilities.martial||c.agility>s.player.abilities.agility||c.eloquence>s.player.abilities.eloquence||c.trained>s.campaign.trained.xia)return null;
  if(!Array.isArray(c.skills)||new Set(c.skills).size!==c.skills.length||!c.skills.every(id=>artNodes.some(n=>n.id===id)&&hasArt(s!,id)))return null;
  if(c.skills.some(id=>s!.arts.learned.some(l=>l.id===id&&l.at>r.at)))return null;
  if(!Array.isArray(c.evidence)||new Set(c.evidence).size!==c.evidence.length||!c.evidence.every(id=>['official','transport','medicine','testament','witness'].includes(id)))return null;
  const evidenceAtBattle=new Set<string>();
  for(const [event,x] of Object.entries(s.campaign.resolved).sort((a,b)=>a[1].at-b[1].at)) {
    if(event===r.event||x.at>r.at)continue;
    const def=storyEvents.find(e=>e.id===event)!;
    const effect=x.choice==='missed'?def.missed.effect:def.choices.find(o=>o.id===x.choice)!.effect;
    for(const id of effect.evidence??[])evidenceAtBattle.add(id);
    for(const prev of b.records)if(used.has(prev.event)&&prev.event===event)for(const id of prev.lostEvidence)evidenceAtBattle.delete(id);
  }
  if(c.evidence.length!==evidenceAtBattle.size||!c.evidence.every(id=>evidenceAtBattle.has(id)))return null;
  if(!Array.isArray(c.allies)||new Set(c.allies.map(a=>a.id)).size!==c.allies.length)return null;
  for(const a of c.allies) {
   if(!record(a)||!['lu-guanlan','ning-buping','shen-yanqiu','su-wantang','yue-hansheng'].includes(a.id)||a.level!==getPrivateNpc(a.id).combatLevel||typeof a.style!=='string'||typeof a.trust!=='number'||a.trust<4||typeof a.hostility!=='number'||a.hostility>=3||a.alive!==true||typeof a.injured!=='boolean')return null;
   const pledged=a.id==='lu-guanlan'&&Object.entries(s.campaign.resolved).some(([id,x])=>x.at<=r.at&&storyEvents.find(e=>e.id===id)?.choices.find(o=>o.id===x.choice)?.effect.flags?.includes('lu-pledged'));
   if(a.present!==battles[r.event].present.includes(a.id)||a.pledged!==pledged||!a.present&&!a.pledged)return null;
   const deadBefore=Object.entries(s.campaign.resolved).some(([id,x])=>{
    if(id===r.event||x.at>r.at)return false;
    const e=storyEvents.find(e=>e.id===id)!;
    return (x.choice==='missed'?e.missed.effect:e.choices.find(o=>o.id===x.choice)!.effect).dead?.includes(a.id);
   });
   if(deadBefore||a.id==='yue-hansheng'&&r.at>=dayAt(s,6)&&!s.campaign.flags.includes('yue-safe'))return null;
   if(!s.npcStates[a.id].memory.appliedEvents.includes(`battle:${r.event}:${r.tactic}`))return null;
   if(a.injured!==b.records.some(prev=>prev!==r&&prev.at<=r.at&&used.has(prev.event)&&prev.companionInjuries.includes(a.id)))return null;
  }
  const expected=judgeBattle(r.event,r.tactic,c);
  for(const [key,value] of Object.entries(expected))if(JSON.stringify(r[key])!==JSON.stringify(value))return null;
  if(c.money<expected.cost||r.tactic==='proof'&&c.evidence.length<2)return null;
  if(r.event==='finale') {if(s.campaign.finale!=='xia'||s.campaign.finaleStep<1)return null;}
  else {
   const resolved=s.campaign.resolved[r.event];
   if(!resolved||resolved.at!==r.at||resolved.choice!==`battle-${r.tactic}-${r.healthAfter>0&&r.win?'win':'loss'}`)return null;
  }
  if(!s.campaign.journal.some(j=>j.at===r.at&&(j.action===`battle:${r.event}:${r.tactic}`||r.event==='finale'&&(r.tactic==='attack'&&j.action==='end:xia:fight'||r.tactic==='surrender'&&j.action==='end:surrender'))))return null;
  if(r.healthAfter===0&&(s.player.alive||s.campaign.ending!=='dead'||s.worldMinutes!==r.at))return null;
  if(r.tactic==='surrender'&&(s.campaign.ending!=='prison'||s.worldMinutes!==r.at))return null;
  if(r.at===s.worldMinutes&&(s.player.health!==r.healthAfter||s.player.qi!==c.qi-r.qiCost||s.player.injury!==r.injuryAfter))return null;
  used.add(r.event);last=r.at;
 }
 for(const [event,result] of Object.entries(s.campaign.resolved))if(result.choice.startsWith('battle-')&&!used.has(event))return null;
 for(const j of s.campaign.journal)if(j.action.startsWith('battle:')&&!b.records.some(r=>j.action===`battle:${r.event}:${r.tactic}`&&j.at===r.at))return null;
 return s;
}
