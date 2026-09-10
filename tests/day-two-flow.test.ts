import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGame, advanceGameTime, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { endingSummary } from '../lib/game/prologue.ts';
import { presentNpcIds } from '../lib/game/day-one.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';

async function click(state: GameState, id: LimitedActionId): Promise<GameState> {
  const before = encodeSave(state);
  const next = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(next, `缺少动作：${id}，地点${state.locationId}`);
  assert.equal(encodeSave(state), before);
  assert.deepEqual(decodeSave(encodeSave(next.state)), next.state);
  return next.state;
}
const has = (state: GameState, id: LimitedActionId) => getAvailableActions(state, state.selectedNpcId).some((item) => item.id === id);
async function prepared(showFragment = false) {
  let s = createInitialGame('回声客');
  for (const id of ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'request-entry', 'ask-clinic', 'ask-lodging'] as const) s = await click(s, id);
  s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth', 'request-treatment'] as const) s = await click(s, id);
  s = movePlayer(s, 'inn');
  if (showFragment) for (const id of ['open-dayone', 'show-fragment', 'close-dayone'] as const) s = await click(s, id);
  if (!showFragment) for (const id of ['open-dayone', 'register-true'] as const) s = await click(s, id);
  else for (const id of ['open-dayone', 'register-true'] as const) s = await click(s, id);
  s = await click(s, 'rest-night');
  s = movePlayer(s, 'clinic');
  for (const id of ['ask-corpse', 'compare-corpse-wound', 'identify-memory'] as const) s = await click(s, id);
  return s;
}
async function waitForDeparture(s: GameState) {
  while (s.day3CargoStatus !== 'departed') s = await click(s, 'wait-night-ferry');
  return s;
}

void test('R01 第二日回声逐人消费第一日记录，且不跨 NPC 伪造口供或证物', async () => {
  let s = await prepared(true);
  assert.ok(has(s, 'open-daytwo'));
  s = await click(s, 'open-daytwo'); s = await click(s, 'clinic-echo');
  assert.equal(s.dayTwo.clinicEchoSeen, true);
  assert.ok(s.dialogue.at(-1)?.text.includes('城门口供'));
  s = movePlayer(s, 'inn'); s = await click(s, 'open-daytwo'); s = await click(s, 'inn-echo');
  assert.equal(s.dayTwo.innEchoSeen, true);
  assert.ok(s.npcStates['su-wantang'].memory.evidence.includes('ding17-fragment'));
  assert.ok(!s.npcStates['shen-yanqiu'].memory.evidence.includes('ding17-fragment'));
  s = movePlayer(s, 'gate'); s = await click(s, 'open-daytwo'); s = await click(s, 'gate-echo');
  assert.equal(s.dayTwo.gateEchoSeen, true);
  s = movePlayer(s, 'inn'); s = selectNpc(s, 'lu-guanlan'); s = await click(s, 'open-daytwo'); s = await click(s, 'lu-echo');
  assert.equal(s.dayTwo.luEchoSeen, true);
});

void test('R02 夜渡生还：确认危险后拒绝报案，等货车离城再夜渡；终态锁定且可存读', async () => {
  let s = await prepared();
  s = movePlayer(s, 'inn');
  s = await click(s, 'open-daytwo');
  assert.ok(has(s, 'decline-report'));
  s = await click(s, 'decline-report');
  s = movePlayer(s, 'dock');
  assert.equal(s.selectedNpcId, null);
  assert.deepEqual(presentNpcIds(s), []);
  s = await waitForDeparture(s);
  s = await click(s, 'take-night-ferry');
  assert.equal(s.prologueEnding, 'night-ferry');
  assert.equal(s.day3CargoStatus, 'departed');
  assert.equal(s.evidenceCustody.fragment, 'player');
  assert.equal(endingSummary(s)?.title, '雨夜盐引 · 夜渡生还');
  assert.equal(movePlayer(s, 'inn'), s);
  assert.equal(advanceGameTime(s, 60), s);
  assert.deepEqual(decodeSave(encodeSave(s)), s);
});

void test('R03 残片易手：实际展示建立接触、交物后不可再报案或封存，并拒绝伪造终态', async () => {
  let s = await prepared(true);
  s = movePlayer(s, 'inn'); s = await click(s, 'open-daytwo');
  assert.ok(has(s, 'accept-broker-contact'));
  s = await click(s, 'accept-broker-contact'); s = movePlayer(s, 'dock'); s = await waitForDeparture(s); s = await click(s, 'transfer-fragment');
  assert.equal(s.prologueEnding, 'fragment-transferred');
  assert.equal(s.evidenceCustody.fragment, 'broker');
  assert.ok(!s.inventoryItemIds.includes('ding17-fragment'));
  assert.equal(endingSummary(s)?.title, '雨夜盐引 · 残片易手');
  assert.ok(!has(s, 'seal-salt-evidence'));
  const forged = { ...s, dayTwo: { ...s.dayTwo, brokerContact: 'none' as const } };
  assert.equal(decodeSave(JSON.stringify(forged)), null);
});

void test('R04 错过货车只在满足路线资格时保留渡口出口；无资格仍是失败事实', async () => {
  let noRoute = createInitialGame('迟到客');
  noRoute = advanceGameTime(noRoute, 720); noRoute = advanceGameTime(noRoute, 720); noRoute = advanceGameTime(noRoute, 720); noRoute = advanceGameTime(noRoute, 720); noRoute = advanceGameTime(noRoute, 720);
  assert.equal(noRoute.day3CargoStatus, 'departed');
  assert.ok(!has(noRoute, 'decline-report'));
  let route = await prepared(); route = movePlayer(route, 'inn'); route = await click(route, 'open-daytwo'); route = await click(route, 'decline-report'); route = movePlayer(route, 'dock'); route = await waitForDeparture(route);
  assert.ok(has(route, 'take-night-ferry'));
});
