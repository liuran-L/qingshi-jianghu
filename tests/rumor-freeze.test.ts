import test from 'node:test';
import assert from 'node:assert/strict';
import {beginning,click} from './helpers/campaign.ts';
import {applyCampaignAction} from '../lib/game/campaign.ts';
import {decodeSave,encodeSave} from '../lib/game/storage.ts';
void test('A07 打听途中死亡即冻结，不再把未听到的消息写为已知',async()=>{
 let s=await click(await beginning('missed'),'journey-care');
 while(!s.campaign.resolved.temple)s=await click(s,'journey-wait');
 const dying={...s,player:{...s.player,health:1,injury:'轻伤' as const,woundUntreatedMinutes:359}};
 const next=applyCampaignAction(dying,'journey-rumors');
 assert.equal(next.player.alive,false);assert.equal(next.campaign.ending,'dead');
 assert.equal(next.campaign.resolved.temple.witnessed,false);
 assert.ok(!next.dialogue.slice(dying.dialogue.length).some(l=>l.text.includes('行旅带来的消息')));
 assert.deepEqual(decodeSave(encodeSave(next)),next);
 assert.equal(applyCampaignAction(next,'journey-rumors'),next);
});
