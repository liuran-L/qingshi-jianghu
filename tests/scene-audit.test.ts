import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {eventReviews,specialReviews,proofPaths,reviewErrors} from '../tools/scene-review.ts';
import {storyEvents} from '../lib/game/campaign-content.ts';
import {beginning,click,fullLife} from './helpers/campaign.ts';
import {createInitialGame,advanceGameTime,movePlayer} from '../lib/game/engine.ts';
import {applyCampaignAction,dayAt} from '../lib/game/campaign.ts';
import {decodeSave,encodeSave} from '../lib/game/storage.ts';
import {getAvailableActions} from '../lib/game/limited-actions.ts';
import {inventoryView,nextStep} from '../lib/ui/inventory.ts';
import type {GameState} from '../lib/game/types.ts';

void test('A01 场景准入：十九事件、特殊转折和三类终局逐项登记',()=>{
 assert.deepEqual(reviewErrors(),[]);
 const doc=readFileSync(new URL('../文档/青石江湖-详细分支图.md',import.meta.url),'utf8');
 for(const r of eventReviews) {assert.ok(doc.includes(`### ${r.id} ·`));assert.ok(doc.includes(r.defaultResult));assert.ok(doc.includes(r.refusal!));for(const feedback of r.feedback)assert.ok(doc.includes(feedback));}
 for(const [id] of specialReviews) assert.ok(doc.includes(`### ${id} ·`));
});
void test('A02 十九缺席按时结算、未闻不知、传闻可追溯且不重复，退隐冻结',async()=>{
 let s=await click(await beginning('missed'),'journey-care');
 for(const event of storyEvents) {
  while(!s.campaign.resolved[event.id]) s=await click(s,'journey-wait');
  assert.equal(s.campaign.resolved[event.id].choice,'missed');
  assert.equal(s.campaign.resolved[event.id].witnessed,false);
  const result=structuredClone(s.campaign.resolved[event.id]);
  assert.equal(applyCampaignAction(s,`journey-attend:${event.id}`),s);
  s=await click(s,'journey-rumors');
  assert.equal(s.campaign.resolved[event.id].witnessed,true);
  assert.equal(s.campaign.resolved[event.id].at,result.at);
  assert.equal(applyCampaignAction(s,'journey-rumors'),s);
 }
 assert.equal(s.campaign.evidence.length,0);assert.equal(s.campaign.pledge,null);
 s=await click(s,'journey-retire');assert.equal(s.campaign.ending,'retired');
 assert.equal(advanceGameTime(s,1440),s);assert.equal(applyCampaignAction(s,'journey-work:trade'),s);
 assert.deepEqual(getAvailableActions(s,null),[]);assert.deepEqual(decodeSave(encodeSave(s)),s);
});
void test('A03 三类关键证明各有三个独立场景，真实备选行动可取证并存读',async()=>{
 const samples:Record<string,GameState>={};
 await fullLife('trade','public','sealed-salt',s=>{if(s.campaign.activeEvent)samples[s.campaign.activeEvent]=s;});
 for(const [proof,paths] of Object.entries(proofPaths)) for(const [id,choice] of paths) {
  const before=samples[id];assert.ok(before,`${id} 缺实际到达样本`);
  const after=await click(before,`journey-choose:${id}:${choice}`);
  assert.ok(after.campaign.evidence.includes(proof));
  assert.equal(applyCampaignAction(after,`journey-choose:${id}:${choice}`),after);
 }
});
void test('A04 盘问不把沉默做成通行路径；医馆拒绝确有取舍且不补写知识',async()=>{
 const original=createInitialGame('寡言客');
 assert.ok(!getAvailableActions(original,original.selectedNpcId).some(a=>a.id==='stay-silent'));
 assert.ok(!getAvailableActions(original,original.selectedNpcId).some(a=>a.id==='request-entry'));
 assert.deepEqual(original.npcKnowledge['shen-yanqiu'],createInitialGame('寡言客').npcKnowledge['shen-yanqiu']);
 let s=await click(original,'tell-attack');s=await click(s,'ask-clinic');s=await click(s,'request-entry');s=movePlayer(s,'clinic');
 for(const id of ['open-dayone','medical-refuse','refuse-exam'] as const)s=await click(s,id);
 assert.equal(s.dayOne.interview,'refused');assert.equal(s.dayOne.consent,'refused');assert.equal(s.playerKnownFactIds.includes('medical-report'),false);
 assert.ok(s.dialogue.some(d=>d.text.includes('伤势不会等')));
 assert.ok(getAvailableActions(s,s.selectedNpcId).length>0);
 const old=JSON.parse(encodeSave(original));delete old.dayTwo;
 const loaded=decodeSave(JSON.stringify(old));assert.ok(loaded);assert.equal(loaded.dayTwo.departurePlan,'none');assert.equal(loaded.dayTwo.clinicEchoSeen,false);
 const partial=JSON.parse(encodeSave(original));delete partial.dayTwo.departurePlan;assert.equal(decodeSave(JSON.stringify(partial)),null);
});
void test('A05 背包不恢复扣押物，已知与实物分开，死亡拘押只可查看',async()=>{
 let s=createInitialGame('持物客');s=await click(s,'inspect-bag');
 assert.ok(inventoryView(s,getAvailableActions(s,s.selectedNpcId)).some(i=>i.id==='ding17-fragment'));
 for(const id of ['tell-pass-lost','mention-ding17','request-entry','submit-search'] as const)s=await click(s,id);
 assert.equal(s.gatePhase,'detained');assert.ok(s.knownClueIds.includes('ding17-fragment'));
 assert.ok(!inventoryView(s,getAvailableActions(s,s.selectedNpcId)).some(i=>i.id==='ding17-fragment'));
 assert.match(nextStep(s,getAvailableActions(s,s.selectedNpcId)),/复核|不能自由/);
 assert.equal(inventoryView(s,[]).flatMap(i=>i.actions).length,0);
 const dead={...s,player:{...s.player,alive:false,health:0,deathCause:'伤势恶化'}};
 assert.equal(inventoryView(dead,getAvailableActions(s,s.selectedNpcId)).flatMap(i=>i.actions).length,0);
 assert.equal(dayAt(s,4)>s.worldMinutes,true);
});
