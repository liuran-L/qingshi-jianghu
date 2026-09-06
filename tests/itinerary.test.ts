import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGame } from '../lib/game/engine.ts';
import { itinerary } from '../lib/game/itinerary.ts';
import { encodeSave } from '../lib/game/storage.ts';
void test('U03 行程笺只显示公开时限与条件，不公开未来标题、人物秘密或修改时间', () => {
 const s=createInitialGame('行旅'); s.campaign.startedAt=s.worldMinutes;
 const before=encodeSave(s), note=itinerary(s), text=JSON.stringify(note);
 assert.match(note.appointment,/第 4 日/); assert.match(note.deadline!,/第 5 日 09:00/);
 assert.doesNotMatch(text,/岳寒声|刺杀|掌门|毒杀|廊下|正确|错误|江湖有路/);
 assert.equal(note.routes.length,5); assert.match(note.routes.find(r=>r.route==='office')!.missing.join(''),/路引/);
 assert.equal(encodeSave(s),before);
 s.player.alive=false; assert.equal(itinerary(s).routes.length,0);
});
