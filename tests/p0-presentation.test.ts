import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import { assetPath } from '../lib/ui/asset-path.ts';
import { portraits,portraitForLine } from '../lib/game/portraits.ts';
import { sceneFor } from '../lib/ui/scenes.ts';
import { playerText,visibleLine } from '../lib/ui/player-text.ts';
import { createInitialGame } from '../lib/game/engine.ts';
import { encodeSave,decodeSave } from '../lib/game/storage.ts';
import { storyEvents } from '../lib/game/campaign-content.ts';
void test('V01 九名立绘与八场景在根站和项目子路径正确寻址',()=>{
 for(const asset of [...Object.values(portraits).map(p=>p.src),...['gate','inn','clinic','dock','road','saltstore','temple','yamen'].map(id=>`/scenes/${id}.svg`)]) {
  assert.ok(existsSync(`public${asset}`));assert.match(readFileSync(`public${asset}`,'utf8'),/<svg/);
  assert.equal(assetPath(asset,'/qingshi-jianghu/'),`/qingshi-jianghu${asset}`);
  assert.equal(new URL(assetPath(asset,'/qingshi-jianghu/'),'https://example.com/qingshi-jianghu/map').pathname,`/qingshi-jianghu${asset}`);
 }
});
void test('V02 场景与立绘随当前台词切换，未知人物不泄露身份',()=>{
 const s=createInitialGame('旅人');assert.equal(sceneFor(s,s.dialogue[0]).id,'road');assert.equal(sceneFor(s,s.dialogue.at(-1)).id,'gate');
 assert.equal(portraitForLine(s,{id:'a',kind:'npc',speaker:'腰挂铁尺的守门差役',text:'停步'}),portraits['ma-sandao']);
 assert.equal(portraitForLine(s,{id:'b',kind:'npc',speaker:'未曾见过的人',text:'停步'}),null);
 assert.equal(sceneFor({...s,locationId:'clinic'}).id,'clinic');
 assert.equal(sceneFor({...s,campaign:{...s.campaign,finale:'xia'}}).id,'saltstore');
});
void test('V03 当前 v7 的内部材料键不直接暴露给玩家',()=>{
 const s=createInitialGame('旅人');s.dialogue[0].text='遗失随身材料：testament、official。';
 const before=encodeSave(s);const loaded=decodeSave(before)!;
 assert.equal(visibleLine(loaded.dialogue[0])?.text,'遗失随身材料：掌门遗嘱、县衙真档副本。');assert.equal(encodeSave(s),before);
 for(const e of storyEvents) for(const text of [...e.opening,e.missed.text,...e.choices.flatMap(c=>[c.label,c.reply])]) assert.doesNotMatch(playerText(text),/testament|undefined|TODO/);
});
