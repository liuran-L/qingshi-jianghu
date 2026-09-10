import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialGame } from '../lib/game/engine.ts';
import { battlePresentation } from '../lib/game/battle.ts';
import { dayAt } from '../lib/game/campaign.ts';
import { firstActPreludes, storyEvents } from '../lib/game/campaign-content.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { decodeSave, encodeSave, SAVE_KEY } from '../lib/game/storage.ts';
import type { GameState } from '../lib/game/types.ts';
import { beginning, click } from './helpers/campaign.ts';

const actions = (state: GameState) => getAvailableActions(state, state.selectedNpcId);
const byId = (state: GameState, id: string) => {
  const item = actions(state).find(action => action.id === id);
  assert.ok(item, `${id} 应当可见`);
  return item;
};
async function waitUntil(state: GameState, target: number) {
  let next = state;
  while (next.worldMinutes < target) next = await click(next, 'journey-wait');
  return next;
}

void test('P09-01 关键提示由界面派生，普通观察不滥加提示', async () => {
  let state = createInitialGame('闻舟');
  const before = encodeSave(state);
  assert.equal(byId(state, 'inspect-wound').hint, undefined);
  assert.equal(byId(state, 'inspect-bag').hint, undefined);
  assert.equal(encodeSave(state), before);
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /choice\.hint && <small/);
  assert.match(page, /choice\.details && <small/);

  state = await click(state, 'inspect-bag');
  assert.match(byId(state, 'show-gate-fragment').hint ?? '', /暂扣.*候复核/);
  assert.equal(state.version, 6);
  assert.ok(SAVE_KEY.startsWith('qingshi-jianghu-save-v5'));
});

void test('P09-02 第一幕选择常驻说明眼前取舍，离场不预报具体后果', async () => {
  let state = await beginning();
  state = await waitUntil(state, dayAt(state, 4));
  assert.doesNotMatch(byId(state, 'journey-attend:temple').label, /前往\s*·/);
  state = await click(state, 'journey-attend:temple');
  for (const choice of storyEvents.find(event => event.id === 'temple')!.choices) {
    assert.ok(byId(state, `journey-choose:temple:${choice.id}`).hint, `${choice.id} 缺少当场取舍`);
  }
  const leave = byId(state, 'journey-leave:temple');
  assert.equal(leave.label, '离开现场');
  assert.match(leave.hint ?? '', /现场不会等你/);
  assert.doesNotMatch(leave.hint ?? '', /死亡|遗嘱|追兵|结局/);

  const nearDeadline = { ...state, campaign: { ...state.campaign, activeEvent: null }, worldMinutes: dayAt(state, 5) - 60 };
  assert.match(byId(nearDeadline, 'journey-rest').hint ?? '', /现场不会等你/);
  assert.match(byId(nearDeadline, 'journey-wait').hint ?? '', /现场不会等你/);
  assert.doesNotMatch(`${byId(nearDeadline, 'journey-rest').hint} ${byId(nearDeadline, 'journey-wait').hint}`, /死亡|遗嘱|追兵|结局/);
});

void test('P09-03 第五日冲突分三层，只显示本次会变化的战况与代价', async () => {
  let state = await beginning();
  state = await waitUntil(state, dayAt(state, 4));
  state = await click(state, 'journey-attend:temple');
  state = await click(state, 'journey-choose:temple:copy');
  state = await waitUntil(state, dayAt(state, 5));
  state = await click(state, 'journey-attend:assassin');

  const attack = byId(state, 'journey-battle:assassin:attack');
  assert.ok(attack.label && attack.hint && attack.details);
  assert.match(attack.details!, /力量 \d+ \/ 对阵 \d+/);
  assert.doesNotMatch(attack.details!, /气血 -0|真气 -0|损血 0|耗气 0/);

  const bargain = byId(state, 'journey-battle:assassin:bargain');
  assert.match(bargain.hint ?? '', /付出\d+两.*放弃/);
  assert.match(bargain.details ?? '', /用银 \d+ 两.*交易放行.*脱身/);
  assert.doesNotMatch(bargain.details ?? '', /力量|气血 -0|真气 -0|损血|耗气/);

  const surrender = byId(state, 'journey-battle:assassin:surrender');
  assert.match(`${surrender.hint} ${surrender.details}`, /拘押结局/);
  assert.doesNotMatch(surrender.details ?? '', /力量|气血|真气|损血|耗气/);
  const retreat = byId(state, 'journey-battle:assassin:retreat');
  assert.match(retreat.details ?? '', /脱身/);
  assert.doesNotMatch(retreat.details ?? '', /力量/);
  assert.deepEqual(battlePresentation(state, 'assassin', 'bargain'), {
    title: bargain.label,
    hint: bargain.hint,
    details: bargain.details,
  });
});

void test('P09-04 第四至八日因果链齐全，第七日起火前只写可见火险', () => {
  assert.deepEqual(firstActPreludes.map(prelude => prelude.eventId), ['temple', 'assassin', 'inheritance', 'fire', 'identity']);
  for (const prelude of firstActPreludes) {
    assert.ok(prelude.naturalSource && prelude.activeSource && prelude.recoverySource && prelude.aftermath);
    const event = storyEvents.find(item => item.id === prelude.eventId)!;
    assert.ok(event.opening.length >= 2 && event.choices.filter(choice => !choice.id.startsWith('battle-')).every(choice => choice.hint));
  }
  const fire = firstActPreludes.find(prelude => prelude.eventId === 'fire')!;
  assert.match(`${fire.naturalSource}${fire.activeSource}`, /油罐/);
  assert.match(`${fire.naturalSource}${fire.activeSource}`, /水缸/);
  assert.match(`${fire.naturalSource}${fire.activeSource}`, /东风|风口/);
  assert.match(fire.naturalSource, /换岗/);
  assert.doesNotMatch(`${fire.label}${fire.hint}${fire.naturalSource}${fire.activeSource}`, /纵火|点火|幕后|真凶/);
  assert.match(fire.recoverySource, /火后/);

  const firstActText = JSON.stringify({ preludes: firstActPreludes, events: storyEvents.filter(event => event.day <= 8) });
  assert.doesNotMatch(firstActText, /不能证明|不等于|实际|结论|回声|规则/);
  const day12 = storyEvents.find(event => event.day === 12)!;
  assert.equal(day12.title, '活人的价');
  assert.equal(day12.choices[0].label, '付八两赎回商旅');
});

void test('P09-05 当前第一幕结果可严格读取，旧文案与伪造文案均不混入新结算', async () => {
  let state = await beginning();
  state = await waitUntil(state, dayAt(state, 4));
  state = await click(state, 'journey-attend:temple');
  state = await click(state, 'journey-choose:temple:shelter');

  const oldTemple = structuredClone(state);
  oldTemple.campaign.resolved.temple.text = '“别把命许得太轻。”你替他换了干草，又在岔口留下向西的脚印。天亮时他把遗嘱交给你，信物仍握在自己手里。';
  assert.equal(decodeSave(encodeSave(oldTemple)), null);
  const forgedTemple = structuredClone(state);
  forgedTemple.campaign.resolved.temple.text = '伪造的破庙结果';
  assert.equal(decodeSave(encodeSave(forgedTemple)), null);

  state = await waitUntil(state, dayAt(state, 5));
  state = await click(state, 'journey-attend:assassin');
  state = await click(state, 'journey-battle:assassin:attack');
  const record = state.battles.records.find(item => item.event === 'assassin')!;
  const oldBattle = structuredClone(state);
  oldBattle.campaign.resolved.assassin.text = record.win
    ? '廊门伏击：你们完成了护住书房与门外伤者。'
    : '廊门伏击：你负伤退走，没能完成现场目标。';
  assert.equal(decodeSave(encodeSave(oldBattle)), null);

  state = await click(state, 'journey-wait');
  state = await click(state, 'journey-wait');
  state = await click(state, 'journey-wait');
  assert.equal(state.campaign.resolved.fire.choice, 'missed');
  const oldFire = structuredClone(state);
  oldFire.campaign.resolved.fire.text = '码头账房焚毁，账房未能逃出。脚夫说原账烧了，别处是否有副本无人肯说。';
  assert.equal(decodeSave(encodeSave(oldFire)), null);
  oldFire.campaign.resolved.fire.text = '伪造的火场结果';
  assert.equal(decodeSave(encodeSave(oldFire)), null);
});
