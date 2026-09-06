import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGame, advanceGameTime, movePlayer } from '../lib/game/engine.ts';
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
const has = (s: GameState, id: LimitedActionId) => getAvailableActions(s, s.selectedNpcId).some((a) => a.id === id);
async function admitted() {
  let s = createInitialGame('拮据客');
  for (const id of ['inspect-wound', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) s = await click(s, id);
  return s;
}
async function clinicLowMoney(money = 0) {
  let s = await admitted(); s = movePlayer(s, 'clinic'); s = { ...s, player: { ...s.player, money } };
  for (const id of ['open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth', 'open-dayone'] as const) s = await click(s, id);
  return s;
}

void test('E01 客栈低价落脚与工抵宿各有一次账本记录，登记/拒登决定资格', async () => {
  let s = await admitted(); s = movePlayer(s, 'inn'); s = { ...s, player: { ...s.player, money: 1 } };
  s = await click(s, 'open-dayone');
  assert.ok(!has(s, 'cheap-rest'));
  s = await click(s, 'register-true'); s = await click(s, 'open-dayone');
  assert.ok(has(s, 'cheap-rest') && has(s, 'inn-work'));
  const before = s.worldMinutes; s = await click(s, 'cheap-rest');
  assert.equal(s.player.money, 0); assert.equal(s.worldMinutes - before, 720); assert.equal(s.economy.cheapLodgingAt, s.worldMinutes);
  assert.equal(has(s, 'cheap-rest'), false);
  let work = await admitted(); work = movePlayer(work, 'inn'); work = { ...work, player: { ...work.player, money: 0 } };
  work = await click(work, 'open-dayone'); work = await click(work, 'register-true'); work = await click(work, 'open-dayone'); work = await click(work, 'inn-work');
  assert.equal(work.player.money, 1); assert.equal(work.economy.innCredit, 2); assert.equal(work.economy.transactions.filter((t) => t.id === 'inn-work').length, 1);
  work = await click(work, 'close-dayone'); work = await click(work, 'rest-night');
  assert.equal(work.economy.innCredit, 0); assert.equal(work.player.money, 1);
  assert.equal(has(work, 'inn-work'), false);
});

void test('E02 医馆赊完整处理与欠账关系可读回、不可重复治疗；补账改变后续条件', async () => {
  let s = await clinicLowMoney();
  assert.ok(has(s, 'medical-credit'));
  s = await click(s, 'medical-credit');
  assert.equal(s.player.injury, '无'); assert.equal(s.economy.medicalDebt, 3); assert.equal(s.npcStates['shen-yanqiu'].favor, -3);
  assert.equal(has(s, 'medical-credit'), false);
  assert.deepEqual(decodeSave(encodeSave(s)), s);
  s = { ...s, player: { ...s.player, money: 3 } }; s = await click(s, 'settle-medical-debt');
  assert.equal(s.economy.medicalDebt, 0); assert.equal(s.player.money, 0); assert.equal(s.npcStates['shen-yanqiu'].favor, 0);
  assert.equal(s.economy.transactions.filter((t) => t.id === 'settle-medical-debt').length, 1);
});

void test('E03 药房杂活只抵一次诊金，不发银钱或重复证物；时间照常推进世界', async () => {
  let s = await clinicLowMoney(1);
  const before = s.worldMinutes; assert.ok(has(s, 'pharmacy-work'));
  s = await click(s, 'pharmacy-work');
  assert.equal(s.worldMinutes - before, 90); assert.equal(s.economy.medicalCredit, 2); assert.equal(s.player.money, 1);
  s = await click(s, 'treat-with-credit');
  assert.equal(s.player.injury, '无'); assert.equal(s.player.money, 0); assert.equal(s.economy.medicalCredit, 0);
  assert.equal(has(s, 'pharmacy-work'), false); assert.equal(has(s, 'treat-with-credit'), false);
  assert.equal(s.economy.transactions.filter((t) => t.id === 'pharmacy-work').length, 1);
});

void test('E04 欠账止血、死亡/拘押/结局冻结和跨日读档均不能刷经济事务', async () => {
  let s = await admitted(); s = movePlayer(s, 'clinic'); s = { ...s, player: { ...s.player, money: 0 } };
  for (const id of ['open-dayone', 'medical-refuse', 'consent-basic', 'basic-on-credit'] as const) s = await click(s, id);
  assert.equal(s.dayOne.bleedingGraceMinutes, 180); assert.equal(s.economy.medicalDebt, 3);
  const saved = encodeSave(s); s = advanceGameTime(s, 720); assert.equal(has(s, 'basic-on-credit'), false);
  assert.deepEqual(decodeSave(saved), decodeSave(saved));
  const frozen = { ...s, prologueEnding: 'night-ferry' as const };
  assert.ok(!getAvailableActions(frozen, frozen.selectedNpcId).some((a) => ['pharmacy-work', 'medical-credit', 'cheap-rest'].includes(a.id)));
  const detained = { ...s, gatePhase: 'detained' as const };
  assert.ok(!getAvailableActions(detained, detained.selectedNpcId).some((a) => ['pharmacy-work', 'medical-credit'].includes(a.id)));
});
