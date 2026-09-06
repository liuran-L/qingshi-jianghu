import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGame, estimateTravel, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';

async function click(state: GameState, id: LimitedActionId): Promise<GameState> {
  const next = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(next, `缺少动作：${id}`);
  assert.deepEqual(decodeSave(encodeSave(next.state)), next.state);
  return next.state;
}
const has = (state: GameState, id: LimitedActionId) => getAvailableActions(state, state.selectedNpcId).some((item) => item.id === id);
async function admitted() {
  let s = createInitialGame('习者');
  for (const id of ['inspect-wound', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) s = await click(s, id);
  return s;
}

void test('G01 陆观澜的实际指点解锁步法树，正式练习只授一次步法点并推进时间', async () => {
  let s = await admitted(); s = movePlayer(s, 'inn'); s = selectNpc(s, 'lu-guanlan');
  s = await click(s, 'open-dayone'); s = await click(s, 'lu-stance');
  assert.equal(s.growth.step.unlocked, true);
  s = await click(s, 'close-dayone');
  s = await click(s, 'open-growth'); assert.ok(has(s, 'practice-lu'));
  const before = s.worldMinutes; s = await click(s, 'practice-lu');
  assert.equal(s.worldMinutes - before, 60); assert.equal(s.growth.step.availablePoints, 1); assert.ok(s.growth.step.pointAwardedAt);
  assert.ok(!has(s, 'practice-lu'));
  s = await click(s, 'spend-step-foundation');
  assert.ok(s.growth.step.nodes.includes('step-foundation')); assert.equal(s.growth.step.availablePoints, 0);
});

void test('G02 步法节点实改旅行耗时；高疲劳、重伤或陆观澜高戒心都不能练习', async () => {
  let s = await admitted(); s = movePlayer(s, 'inn'); s = selectNpc(s, 'lu-guanlan'); s = await click(s, 'open-dayone'); s = await click(s, 'lu-stance'); s = await click(s, 'close-dayone'); s = await click(s, 'open-growth'); s = await click(s, 'practice-lu'); s = await click(s, 'spend-step-foundation');
  const baseline = { ...s, growth: { ...s.growth, step: { ...s.growth.step, nodes: [] } } };
  assert.equal(estimateTravel(s, 'gate').totalMinutes, estimateTravel(baseline, 'gate').totalMinutes - 2);
  const tired: GameState = { ...s, player: { ...s.player, fatigue: 90 }, growth: { ...s.growth, menu: true, step: { ...s.growth.step, pointAwardedAt: null, availablePoints: 0 } } };
  assert.ok(!has(tired, 'practice-lu'));
  const suspicious: GameState = { ...tired, player: { ...tired.player, fatigue: 70 }, npcStates: { ...tired.npcStates, 'lu-guanlan': { ...tired.npcStates['lu-guanlan'], suspicion: 3 } } };
  assert.ok(!has(suspicious, 'practice-lu'));
});

void test('G03 医馆实际互动解锁医术；辨伤和包扎不免费治疗也不替代病案', async () => {
  let s = await admitted(); s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'medical-truth', 'consent-basic'] as const) s = await click(s, id);
  assert.equal(s.growth.medicine.unlocked, true);
  s = await click(s, 'close-dayone');
  s = await click(s, 'open-growth'); assert.ok(has(s, 'study-shen'));
  const before = s.worldMinutes; s = await click(s, 'study-shen'); assert.equal(s.worldMinutes - before, 45);
  s = await click(s, 'spend-medicine-diagnosis');
  assert.ok(s.growth.medicine.nodes.includes('medicine-diagnosis')); assert.equal(s.playerKnownFactIds.includes('medical-report'), false);
  const arrived = movePlayer(await click(s, 'close-growth'), 'gate');
  const observation = { ...arrived, knownClueIds: arrived.knownClueIds.filter((id) => id !== 'abnormal-wound') };
  const inspected = await click(observation, 'inspect-wound');
  assert.ok(inspected.dialogue.at(-1)?.text.includes('更准确的观察'));
});

void test('G04 伪造点数、越过前置、冻结、死亡或拘押成长菜单均被拒绝；旧档补默认', async () => {
  const clean = createInitialGame('存档客');
  const legacy = { ...clean }; delete (legacy as Partial<GameState>).growth;
  assert.deepEqual(decodeSave(JSON.stringify(legacy))?.growth.schema, 1);
  const forged = { ...clean, growth: { ...clean.growth, step: { ...clean.growth.step, unlocked: true, availablePoints: 1 } } };
  assert.equal(decodeSave(JSON.stringify(forged)), null);
  const bypass = { ...clean, growth: { ...clean.growth, medicine: { ...clean.growth.medicine, unlocked: true, pointAwardedAt: clean.worldMinutes, availablePoints: 0, nodes: ['medicine-bandage' as const] } } };
  assert.equal(decodeSave(JSON.stringify(bypass)), null);
  for (const terminal of [{ ...clean, prologueEnding: 'night-ferry' as const }, { ...clean, gatePhase: 'detained' as const }, { ...clean, player: { ...clean.player, health: 0, alive: false, deathCause: '测试死亡' } }]) assert.ok(!has(terminal, 'open-growth'));
});
