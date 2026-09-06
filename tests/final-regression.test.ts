import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGame, advanceGameTime, estimateTravel, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';

async function click(state: GameState, id: LimitedActionId): Promise<GameState> {
  const before = encodeSave(state);
  const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(result, `缺少合法动作：${id}`);
  assert.equal(encodeSave(state), before);
  assert.deepEqual(decodeSave(encodeSave(result.state)), result.state);
  return result.state;
}
const has = (state: GameState, id: LimitedActionId) => getAvailableActions(state, state.selectedNpcId).some((item) => item.id === id);
async function admitted(name = '回归客') {
  let s = createInitialGame(name);
  for (const id of ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) s = await click(s, id);
  return s;
}
async function caseReady(identity: 'identify-memory' | 'identify-roster') {
  let s = await admitted(); s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth', 'request-treatment'] as const) s = await click(s, id);
  s = movePlayer(s, 'inn'); s = await click(s, 'open-dayone'); s = await click(s, 'register-alias'); s = await click(s, 'rest-night');
  s = movePlayer(s, 'clinic'); for (const id of ['ask-corpse', 'compare-corpse-wound'] as const) s = await click(s, id);
  if (identity === 'identify-roster') s = movePlayer(s, 'inn');
  s = await click(s, identity);
  if (identity === 'identify-roster') s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'request-privacy', 'authorize-report', 'close-dayone', 'request-medical-report', 'ask-ning-referral'] as const) s = await click(s, id);
  return movePlayer(s, 'yamen');
}
async function seal(s: GameState) {
  s = await click(s, 'report-salt-case');
  while (s.day3CargoStatus === 'pending') s = await click(s, 'await-cargo');
  for (const id of ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence'] as const) s = await click(s, id);
  return s;
}

void test('Q01 有界全路线：两条身份确认均可携带假名、保密再授权变量封存，且不改变结局资格', async () => {
  for (const identity of ['identify-memory', 'identify-roster'] as const) {
    const ending = await seal(await caseReady(identity));
    assert.equal(ending.prologueEnding, 'sealed-salt');
    assert.equal(ending.dayOne.registration, 'alias');
    assert.equal(ending.dayOne.privateCare, true); assert.equal(ending.dayOne.reportAuthorized, true);
    assert.equal(ending.evidenceCustody.fragment, 'yamen'); assert.ok(!ending.inventoryItemIds.includes('ding17-fragment'));
  }
});

void test('Q02 低银两经济兜底、技能规则与主线边界：不刷收益，也不绕过封存条件', async () => {
  let s = await admitted('拮据回归客'); s = { ...s, player: { ...s.player, money: 0 } }; s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth', 'open-dayone', 'medical-credit'] as const) s = await click(s, id);
  assert.equal(s.economy.medicalDebt, 3); assert.equal(s.player.injury, '无');
  s = movePlayer(s, 'inn'); s = await click(s, 'open-dayone'); s = await click(s, 'register-true'); s = await click(s, 'open-dayone'); s = await click(s, 'inn-work');
  assert.equal(s.economy.innCredit, 2); assert.equal(has(s, 'inn-work'), false);
  s = await click(s, 'close-dayone'); s = await click(s, 'rest-night'); assert.equal(s.economy.innCredit, 0);
  s = selectNpc(s, 'lu-guanlan'); s = await click(s, 'open-dayone'); s = await click(s, 'lu-stance'); s = await click(s, 'close-dayone'); s = await click(s, 'open-growth'); s = await click(s, 'practice-lu'); s = await click(s, 'spend-step-foundation');
  const plain = { ...s, growth: { ...s.growth, step: { ...s.growth.step, nodes: [] } } };
  assert.equal(estimateTravel(s, 'gate').totalMinutes, estimateTravel(plain, 'gate').totalMinutes - 2);
  assert.equal(s.chengShouyiIdentified, false); assert.equal(has(s, 'seal-salt-evidence'), false);
  assert.equal(s.economy.transactions.filter((t) => t.id === 'medical-credit').length, 1);
});

void test('Q03 夜渡与两条中人入口均冻结且不泄露未传达信息或残片', async () => {
  let night = await caseReady('identify-memory'); night = movePlayer(night, 'inn'); night = await click(night, 'open-daytwo'); night = await click(night, 'decline-report'); night = movePlayer(night, 'dock');
  while (night.day3CargoStatus !== 'departed') night = await click(night, 'wait-night-ferry');
  night = await click(night, 'take-night-ferry');
  assert.equal(night.prologueEnding, 'night-ferry'); assert.equal(advanceGameTime(night, 60), night); assert.ok(!has(night, 'open-growth'));

  for (const route of ['inn', 'ma'] as const) {
    let broker = await admitted(`中人${route}`);
    if (route === 'inn') { broker = movePlayer(broker, 'inn'); broker = await click(broker, 'open-dayone'); broker = await click(broker, 'show-fragment'); broker = await click(broker, 'close-dayone'); }
    else {
      broker = createInitialGame('中人马');
      for (const id of ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'mention-ding17', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) broker = await click(broker, id);
      assert.equal(broker.npcStates['ma-sandao'].informedRiverGang, true);
    }
    broker = movePlayer(broker, 'inn'); broker = await click(broker, 'open-dayone'); broker = await click(broker, 'register-true'); broker = await click(broker, 'rest-night');
    broker = await click(broker, 'open-daytwo'); assert.ok(has(broker, 'accept-broker-contact')); broker = await click(broker, 'accept-broker-contact');
    assert.ok(!broker.npcStates['su-wantang'].memory.evidence.includes('medical-report'));
    broker = movePlayer(broker, 'dock'); while (broker.day3CargoStatus !== 'departed') broker = await click(broker, 'wait-night-ferry'); broker = await click(broker, 'transfer-fragment');
    assert.equal(broker.prologueEnding, 'fragment-transferred'); assert.equal(broker.evidenceCustody.fragment, 'broker'); assert.ok(!broker.inventoryItemIds.includes('ding17-fragment'));
    assert.ok(!has(broker, 'report-salt-case')); assert.ok(!has(broker, 'open-growth'));
  }
});

void test('Q04 终态、死亡与伪造增长/账本/证物档不会发放未完成收益', async () => {
  let s = await admitted(); s = movePlayer(s, 'clinic');
  for (const id of ['open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth'] as const) s = await click(s, id);
  s = { ...s, player: { ...s.player, health: 1, woundUntreatedMinutes: 359 } };
  const dead = await click(s, 'request-treatment'); assert.equal(dead.player.alive, false); assert.equal(dead.player.injury, '轻伤');
  const clean = createInitialGame('伪造档');
  const forgedGrowth = { ...clean, growth: { ...clean.growth, step: { ...clean.growth.step, unlocked: true, pointAwardedAt: clean.worldMinutes, availablePoints: 0, nodes: ['step-breath' as const] } } };
  const forgedEconomy = { ...clean, economy: { ...clean.economy, innCredit: 2 } };
  const forgedCustody = { ...clean, evidenceCustody: { ...clean.evidenceCustody, fragment: 'broker' as const }, inventoryItemIds: ['ding17-fragment' as const] };
  assert.equal(decodeSave(JSON.stringify(forgedGrowth)), null); assert.equal(decodeSave(JSON.stringify(forgedEconomy)), null); assert.equal(decodeSave(JSON.stringify(forgedCustody)), null);
});
