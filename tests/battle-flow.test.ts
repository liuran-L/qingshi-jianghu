import assert from 'node:assert/strict';
import test from 'node:test';
import { fullLife, click, available } from './helpers/campaign.ts';
import { battles, battleContext, battlePreview, tacticNames, type BattleTactic } from '../lib/game/battle.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import type { GameState } from '../lib/game/types.ts';
void test('B01 七个真实剧情冲突现场：胜败、撤退、交易、质证、投降每步存读且不重复',async()=>{
 const seeds:GameState[]=[];await fullLife('xia','proof','sealed-salt',s=>{if(s.campaign.activeEvent&&battles[s.campaign.activeEvent]||s.campaign.finale==='xia')seeds.push(s);});
 assert.equal(seeds.length,7);let count=0;
 for(const s of seeds){const event=s.campaign.activeEvent??'finale';
  for(const tactic of Object.keys(tacticNames) as BattleTactic[]){
   const id=event==='finale'&&tactic==='attack'?'journey-end:xia:fight':event==='finale'&&tactic==='surrender'?'journey-end:surrender':event==='finale'&&tactic==='proof'?'journey-end:xia:proof':`journey-battle:${event}:${tactic}`;
   if(!available(s,id))continue;
   const p=battlePreview(s,event,tactic),result=await click(s,id as never);count++;
   if(!id.endsWith(':proof')&&!id.endsWith('end:surrender')){
    const record=result.battles.records.at(-1)!;
    assert.equal(record.damage,p.damage);assert.equal(record.healthAfter,Math.max(0,s.player.health-p.damage));
    assert.equal(result.player.money,s.player.money-p.cost);
    assert.equal(available(result,id),false);
    const forged=structuredClone(result);forged.battles.records.at(-1)!.damage++;
    assert.equal(decodeSave(encodeSave(forged)),null);
    const missing=JSON.parse(encodeSave(result));delete missing.battles;if(event!=='finale')assert.equal(decodeSave(JSON.stringify(missing)),null);
   }
   if(tactic==='surrender'){assert.equal(result.campaign.ending,'prison');assert.deepEqual(getAvailableActions(result,result.selectedNpcId),[]);}
  }
 }
 assert.ok(count>=40,`仅验证${count}个转换`);
});
void test('B02 助阵严格检查在场、承诺、信任、敌意与战斗等级；失守可负伤或死亡',async()=>{
 let seed:GameState|undefined;await fullLife('xia','proof','sealed-salt',s=>{if(s.campaign.activeEvent==='riverfight')seed=s;});
 const s=seed!;const plain=structuredClone(s);plain.campaign.flags=plain.campaign.flags.filter(f=>f!=='lu-pledged');
 assert.equal(battleContext(plain,'riverfight').allies.length,0);
 const trusted=structuredClone(s);trusted.npcStates['lu-guanlan'].trust=4;trusted.npcStates['lu-guanlan'].hostility=0;
 assert.equal(battleContext(trusted,'riverfight').allies.find(a=>a.id==='lu-guanlan')?.level,7);
 trusted.npcStates['lu-guanlan'].hostility=3;assert.equal(battleContext(trusted,'riverfight').allies.length,0);
 const weak=structuredClone(s);weak.player.abilities.martial=0;weak.player.qi=0;weak.player.fatigue=100;weak.campaign.trained.xia=0;weak.campaign.experience.xia=weak.campaign.scores.xia;weak.npcStates['lu-guanlan'].trust=0;
 weak.player.health=100;
 const result=await click(weak,'journey-battle:riverfight:attack');
 assert.equal(result.battles.records.at(-1)!.win,false);assert.equal(result.player.injury,'重伤');assert.ok(result.battles.records.at(-1)!.lostEvidence.length);
 weak.player.health=1;const dead=await click(weak,'journey-battle:riverfight:attack');assert.equal(dead.campaign.ending,'dead');assert.match(dead.player.deathCause!,/受创过重.*气血耗尽/);
});

void test('B03 伪造战前证据和参与者被拒绝，坏新档沿用自动备份恢复',async t=>{
 let seed:GameState|undefined;await fullLife('xia','proof','sealed-salt',s=>{if(s.campaign.activeEvent==='assassin')seed=s;});
 const state=await click(seed!,'journey-battle:assassin:environment');
 const evidence=structuredClone(state);evidence.battles.records[0].context.evidence.push('medicine');assert.equal(decodeSave(encodeSave(evidence)),null);
 const ally=structuredClone(state);ally.battles.records[0].context.allies.push({id:'ning-buping',level:99,style:'封口缴械',trust:4,hostility:0,present:true,pledged:false,alive:true,injured:false});assert.equal(decodeSave(encodeSave(ally)),null);
 const partial=JSON.parse(encodeSave(state));delete partial.battles.records;assert.equal(decodeSave(JSON.stringify(partial)),null);
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 t.after(()=>{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');});
 const {BrowserSaveRepository}=await import('../lib/game/save-repository.ts');const {SAVE_KEY}=await import('../lib/game/storage.ts');
 const repo=new BrowserSaveRepository();await repo.save('auto',seed!);await repo.save('auto',state);
 const envelope=JSON.parse(values.get(SAVE_KEY)!);envelope.payload=encodeSave(evidence);values.set(SAVE_KEY,JSON.stringify(envelope));
 assert.deepEqual(await repo.load('auto'),seed);assert.equal((await repo.list())[0].recovered,true);
});

