import assert from 'node:assert/strict';
import test from 'node:test';
import { beginning, click, available, plan } from './helpers/campaign.ts';
import { storyEvents } from '../lib/game/campaign-content.ts';
import { artNodes, hasArt, totalArtPoints, type ArtTree } from '../lib/game/arts-content.ts';
import { dayAt } from '../lib/game/campaign.ts';
import { artTrainingBlock } from '../lib/game/arts.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import type { GameState } from '../lib/game/types.ts';
import type { LifeRoute } from '../lib/game/campaign-types.ts';

for(const tree of ['step','medicine','martial','speech'] as ArtTree[]) void test(`G05 ${tree} 实际实践、授点、前置、两个剧情回响与旧档坏档`,async()=>{
 let s=await beginning(); s=await click(s,'journey-care');
 const route:LifeRoute=tree==='medicine'?'healer':tree==='speech'?'office':'xia';
 let echoes=0, latest:GameState=s; const echoCounts:Record<string,number>={};
 for(const event of storyEvents) {
  let guard=0;
  while(s.worldMinutes<dayAt(s,event.day)) {
   assert.ok(++guard<60);
   const left=dayAt(s,event.day)-s.worldMinutes;
   const nextNode=artNodes.find(n=>n.tree===tree&&!hasArt(s,n.id));
   const learn=nextNode?nextNode.legacy?`journey-node:${nextNode.id}`:`journey-arts:learn:${nextNode.id}`:'';
   if(learn&&available(s,learn)) s=await click(s,learn as never);
   else if(nextNode?.legacy&&available(s,`journey-lesson:${tree}`)&&left>360) s=await click(s,`journey-lesson:${tree}`);
   else if(available(s,`journey-arts:mentor:${tree}`)&&left>60) s=await click(s,`journey-arts:mentor:${tree}`);
   else if(nextNode&&!nextNode.legacy&&available(s,`journey-arts:train:${tree}`)&&left>240&&totalArtPoints(s)<5) s=await click(s,`journey-arts:train:${tree}`);
   else if(!nextNode&&totalArtPoints(s)<5&&left>60&&available(s,'journey-arts:mentor:martial')) s=await click(s,'journey-arts:mentor:martial');
   else if(!nextNode&&totalArtPoints(s)<5&&left>60&&available(s,'journey-arts:mentor:speech')) s=await click(s,'journey-arts:mentor:speech');
   else if(!nextNode&&totalArtPoints(s)<5&&left>60&&available(s,'journey-teach:medicine')) s=await click(s,'journey-teach:medicine');
   else if(!nextNode&&totalArtPoints(s)<5&&left>60&&available(s,'journey-teach:step')) s=await click(s,'journey-teach:step');
   else if(available(s,`journey-work:${route}`)&&left>360) s=await click(s,`journey-work:${route}`);
   else if(s.player.fatigue>=60&&left>480) s=await click(s,'journey-rest');
   else s=await click(s,'journey-wait');
  }
  if(s.campaign.resolved[event.id]) continue;
  s=await click(s,`journey-attend:${event.id}`);
  for(const n of artNodes.filter(n=>n.tree===tree&&n.echoes.includes(event.id)&&hasArt(s,n.id))) {
   const result=await click(s,`journey-choose:${event.id}:art-${n.id}`);
   assert.equal(result.campaign.resolved[event.id].choice,`art-${n.id}`); echoes++; echoCounts[n.id]=(echoCounts[n.id]??0)+1;
   const bad=structuredClone(result); if(n.legacy) bad.growth[n.tree as 'step'|'medicine'].nodes=[]; else bad.arts.learned=[];
   assert.equal(decodeSave(encodeSave(bad)),null);
  }
  s=await click(s,`journey-choose:${event.id}:${plan[route][event.id]??'copy'}`); latest=s;
 }
 for(const n of artNodes.filter(n=>n.tree===tree)) assert.equal(echoCounts[n.id],2,`${n.id} 缺实际回响`);
 assert.ok(echoes>=4,`${tree} 实际回响仅 ${echoes}`);
 assert.ok(totalArtPoints(s)>=5&&totalArtPoints(s)<=7);
 assert.ok(artNodes.filter(n=>n.tree===tree).every(n=>hasArt(s,n.id)),`${tree} 未学完：${JSON.stringify(s.arts)}`);
 const missing=JSON.parse(encodeSave(latest)); delete missing.arts;
 // 没有新增成长消耗的旧快照可以补齐；已经消耗阅历的快照不能删账冒充旧档。
 if(latest.arts.grants.some(g=>g.kind==='practice')) assert.equal(decodeSave(JSON.stringify(missing)),null);
 const forged=structuredClone(latest); forged.arts.grants[0].at=latest.worldMinutes+1; assert.equal(decodeSave(encodeSave(forged)),null);
 assert.match(artTrainingBlock({...latest,gatePhase:'detained'},tree)!,/自由行动/);
});

void test('G06 首点免费、单日限制、授点来源不可删除、缺字段旧档拒绝',async()=>{
 let s=await beginning();s=await click(s,'journey-care');s=await click(s,'journey-wait');s=await click(s,'journey-attend:temple');s=await click(s,'journey-choose:temple:medicine');
 const money=s.player.money,time=s.worldMinutes;
 assert.equal(available(s,'journey-teach:medicine'),true);
 s=await click(s,'journey-teach:medicine');assert.equal(s.player.money,money);assert.equal(s.worldMinutes-time,60);assert.equal(s.growth.medicine.availablePoints,1);
 assert.equal(available(s,'journey-teach:medicine'),false);assert.equal(available(s,'journey-arts:train:medicine'),false);
 const old=JSON.parse(encodeSave(s));delete old.arts;delete old.battles;
 assert.equal(decodeSave(JSON.stringify(old)),null);
 let m=await beginning();m=await click(m,'journey-care');m=await click(m,'journey-wait');m=await click(m,'journey-attend:temple');m=await click(m,'journey-choose:temple:shelter');m=await click(m,'journey-arts:mentor:martial');
 const removed=JSON.parse(encodeSave(m));delete removed.arts;assert.equal(decodeSave(JSON.stringify(removed)),null);
 const malformed=structuredClone(m);malformed.arts.learned.push({id:'martial-restraint',at:m.worldMinutes,grant:m.arts.grants[0].id});assert.equal(decodeSave(encodeSave(malformed)),null);
});
