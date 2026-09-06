import assert from 'node:assert/strict';
import { prepareService } from './helpers/confirmed-service.ts';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialGame, advanceGameTime, movePlayer, applyInteractionResult, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, createTravelRunner, latestDialogueIndex, finishPrologueDemo, previewTravel } from '../lib/game/flow-controller.ts';
import { getLimitedActions } from '../lib/game/limited-actions.ts';
import { CARGO_ARRIVAL, CARGO_DEPARTURE, verifiableSources, endingSummary, prologueNotice } from '../lib/game/prologue.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { BrowserSaveRepository } from '../lib/game/save-repository.ts';
import { SAVE_KEY, AUTO_BACKUP_KEY, decodeSave, encodeSave, manualSaveSlotIds } from '../lib/game/storage.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';

async function click(state: GameState, id: LimitedActionId, route?: string[]) {
  state = await prepareService(state, id, route);
  const original = encodeSave(state);
  const next = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(next, `地点${state.locationId}、时间${state.worldMinutes}缺少${id}`);
  assert.equal(encodeSave(state), original);
  assert.deepEqual(decodeSave(encodeSave(next.state)), next.state);
  route?.push(id);
  return next.state;
}
const available = (state: GameState, id: LimitedActionId) => getLimitedActions(state, state.selectedNpcId).some((a) => a.id === id);
async function caseReady(identity: 'identify-memory' | 'identify-roster' = 'identify-memory', route?: string[]) {
  let state = createInitialGame('盐引测试客');
  for (const id of ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) state = await click(state, id, route);
  state = movePlayer(state, 'clinic');
  state = await click(state, 'request-treatment', route);
  state = movePlayer(state, 'inn');
  state = await click(state, 'rest-night', route);
  state = movePlayer(state, 'clinic');
  for (const id of ['ask-corpse', 'compare-corpse-wound'] as const) state = await click(state, id, route);
  if (identity === 'identify-roster') state = movePlayer(state, 'inn');
  state = await click(state, identity, route);
  if (identity === 'identify-roster') state = movePlayer(state, 'clinic');
  for (const id of ['request-medical-report', 'ask-ning-referral'] as const) state = await click(state, id, route);
  return movePlayer(state, 'yamen');
}
async function arrive(state: GameState, route?: string[]) {
  state = await click(state, 'report-salt-case', route);
  let waits = 0;
  while (state.day3CargoStatus === 'pending') { state = await click(state, 'await-cargo', route); assert.ok(++waits <= 4); }
  return state;
}
function advanceTo(state: GameState, elapsed: number) {
  const until = state.storyStartedAtMinutes + elapsed;
  while (state.worldMinutes < until && state.player.alive) state = advanceGameTime(state, Math.min(720, until - state.worldMinutes));
  return state;
}
function storage(t: { after: (fn: () => void) => void }) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  let fail = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { if (fail) throw new Error('写入失败'); data.set(k, v); }, removeItem: (k: string) => data.delete(k) } });
  t.after(() => { if (old) Object.defineProperty(globalThis, 'localStorage', old); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  return { repo: new BrowserSaveRepository(), data, fail: (v: boolean) => { fail = v; } };
}

void test('P01 主线A：23个首次有效选项节点（含登记授权），从第一日到第三日封存盐引', async (t) => {
  const route: string[] = [];
  let state = await arrive(await caseReady('identify-memory', route), route);
  for (const id of ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence'] as const) state = await click(state, id, route);
  assert.equal(new Set(route).size, 23);
  assert.equal(state.prologueEnding, 'sealed-salt');
  assert.equal(state.day3CargoStatus, 'sealed');
  assert.ok(state.chengShouyiIdentified && state.poisonWoundLinked && state.cartMarkObserved);
  assert.ok(state.worldMinutes < state.storyStartedAtMinutes + CARGO_DEPARTURE);
  assert.equal(state.evidenceCustody.fragment, 'yamen');
  assert.ok(!state.inventoryItemIds.includes('ding17-fragment'));
  assert.equal(state.saltCase.stayPermitUntil, state.worldMinutes + 4320);
  assert.ok(state.inventoryItemIds.includes('temporary-stay-permit'));
  assert.ok(state.inventoryItemIds.includes('evidence-receipt'));
  assert.equal(state.player.money, 15);
  assert.ok(state.npcStates['ning-buping'].memory.evidence.includes('release-ledger'));
  assert.equal(endingSummary(state)?.facts.length, 5);
  assert.equal(endingSummary(state)?.continueDay4Enabled, true);
  t.diagnostic(`路线：${route.join(' → ')}；共${route.length}次选项、23个去重有效节点，另有5次移动（不计菜单切换）。`);
});

void test('P02 主线B：商旅名册身份路径独立通关，不依赖荒道回忆选项', async () => {
  let state = await arrive(await caseReady('identify-roster'));
  assert.equal(state.saltCase.identitySource, 'roster');
  assert.ok(!state.npcStates['shen-yanqiu'].memory.evidence.includes('cheng-identity'));
  assert.ok(state.npcStates['su-wantang'].memory.evidence.includes('cheng-identity'));
  for (const id of ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence'] as const) state = await click(state, id);
  assert.equal(state.prologueEnding, 'sealed-salt');
});

void test('P03 线索不足不解锁县衙，不可凭残片和其蜡痕冒充两种来源', async () => {
  let state = await click(createInitialGame('少证'), 'inspect-bag');
  state = await click(state, 'inspect-fragment');
  assert.deepEqual(verifiableSources(state), ['baggage']);
  assert.ok(!state.knownLocationIds.includes('yamen'));
  assert.equal(movePlayer(state, 'yamen'), state);
  // 已知县衙的旧档/边界初态，也不能绕过报案佐证阈值。
  state = { ...state, locationId: 'yamen', selectedNpcId: 'ning-buping', knownLocationIds: ['gate', 'yamen'] };
  state = await click(state, 'report-salt-case');
  assert.equal(state.saltCase.reported, false);
  assert.equal(state.evidenceCustody.fragment, 'player');
  assert.ok(!available(state, 'inspect-cargo'));
  assert.ok(state.npcStates['ning-buping'].memory.statements.length > 0);
});

void test('P04 两项独立证据可受理，但没有身份与病案不能直接结局', async () => {
  let state = await caseReady();
  state = { ...state, chengShouyiIdentified: false, poisonWoundLinked: false, saltCase: { ...state.saltCase, identitySource: null }, playerKnownFactIds: state.playerKnownFactIds.filter((id) => !['cheng-identity', 'medical-report'].includes(id)) };
  assert.deepEqual(verifiableSources(state), ['baggage', 'gate']);
  state = await arrive(state);
  state = await click(state, 'inspect-cargo');
  state = await click(state, 'check-release-ledger');
  assert.ok(!available(state, 'seal-salt-evidence'));
  assert.equal(state.prologueEnding, null);
});

void test('P05 不参与：抵埠与离城均按时间触发，不自动泄露船讯或结算结局', async () => {
  let state = createInitialGame('旁观');
  state = advanceTo(state, CARGO_ARRIVAL - 1);
  assert.equal(state.day3CargoStatus, 'pending');
  state = advanceGameTime(state, 1);
  assert.equal(state.day3CargoStatus, 'unloading');
  assert.ok(state.triggeredWorldEventIds.includes('ding17-ship-arrives'));
  assert.ok(!state.knownWorldEventIds.includes('ding17-ship-arrives'));
  assert.equal(prologueNotice(state), null);
  state = advanceTo(state, CARGO_DEPARTURE);
  assert.equal(state.day3CargoStatus, 'departed');
  assert.equal(state.prologueEnding, null);
  assert.deepEqual(decodeSave(encodeSave(state)), state);
});

void test('P06 已报案仍会错过货车；读档和反复进出不能刷新时限', async () => {
  let state = await arrive(await caseReady());
  state = advanceTo(state, CARGO_DEPARTURE);
  assert.ok(!available(state, 'inspect-cargo'));
  assert.match(prologueNotice(state)!, /已.*离城/);
  state = decodeSave(encodeSave(state))!;
  state = movePlayer(movePlayer(state, 'inn'), 'yamen');
  assert.equal(state.day3CargoStatus, 'departed');
  assert.equal(state.prologueEnding, null);
});

void test('P07 封验、复核、交存任一步耗时正好碰到15点均失败，不扣物不写假结局', async () => {
  const ready = await arrive(await caseReady());
  for (const [id, cost] of [['inspect-cargo', 45], ['check-release-ledger', 20], ['seal-salt-evidence', 15]] as const) {
    let state = ready;
    if (id !== 'inspect-cargo') state = await click(state, 'inspect-cargo');
    if (id === 'seal-salt-evidence') state = await click(state, 'check-release-ledger');
    state = advanceTo(state, CARGO_DEPARTURE - cost);
    const after = await click(state, id);
    assert.equal(after.day3CargoStatus, 'departed');
    assert.equal(after.prologueEnding, null);
    assert.equal(after.evidenceCustody.fragment, 'player');
    assert.ok(!after.playerKnownFactIds.includes('sealed-case'));
  }
});

void test('P08 提前一分钟完成交存成功；终态不能继续耗时、移动或重复结算', async () => {
  let state = await arrive(await caseReady());
  state = await click(state, 'inspect-cargo'); state = await click(state, 'check-release-ledger');
  state = advanceTo(state, CARGO_DEPARTURE - 16);
  state = await click(state, 'seal-salt-evidence');
  assert.equal(state.prologueEnding, 'sealed-salt');
  assert.equal(advanceGameTime(state, 720), state);
  assert.equal(movePlayer(state, 'inn'), state);
  assert.equal(selectNpc(state, 'ning-buping'), state);
  assert.equal(previewTravel(state, 'inn'), null);
  assert.deepEqual(getLimitedActions(state, 'ning-buping'), []);
});

void test('P09 死亡或拘押状态不能报案/封存，操作期间死亡不发交存或暂留凭条', async () => {
  let state = await arrive(await caseReady());
  state = await click(state, 'inspect-cargo'); state = await click(state, 'check-release-ledger');
  for (const blocked of [{ ...state, gatePhase: 'detained' as const }, { ...state, player: { ...state.player, alive: false, health: 0, deathCause: '测试' } }]) {
    assert.equal(await createActionRunner(mockAIService)(blocked, latestDialogueIndex(blocked), 'seal-salt-evidence', 'ning-buping'), null);
  }
  state = { ...state, player: { ...state.player, injury: '重伤', health: 1, woundUntreatedMinutes: 359 } };
  const dead = await click(state, 'seal-salt-evidence');
  assert.equal(dead.player.alive, false);
  assert.equal(dead.prologueEnding, null);
  assert.equal(dead.evidenceCustody.fragment, 'player');
  assert.equal(dead.saltCase.stayPermitUntil, null);
});

void test('P10 自动/20手动档保存主线中途与结局；备份回退后继续交存', async (t) => {
  const { repo, data } = storage(t);
  let state = await arrive(await caseReady());
  state = await click(state, 'inspect-cargo'); state = await click(state, 'check-release-ledger');
  await repo.save('auto', state);
  const ending = await click(state, 'seal-salt-evidence');
  await repo.save('auto', ending);
  for (const slot of manualSaveSlotIds) { await repo.save(slot, ending); assert.deepEqual(await repo.load(slot), ending); }
  data.set(SAVE_KEY, '{坏档');
  assert.deepEqual(await repo.load('auto'), state);
  const restored = await click((await repo.load('auto'))!, 'seal-salt-evidence');
  await repo.save('auto', restored);
  assert.deepEqual(await repo.load('auto'), restored);
  assert.ok(data.has(AUTO_BACKUP_KEY));
});

void test('P11 v5及第三阶段真实v6旧档补默认，不清空关系；部分新增字段损坏拒绝', () => {
  for (const file of ['v5-game.json', 'v6-before-prologue.json']) {
    const raw = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
    const loaded = decodeSave(raw)!;
    assert.ok(loaded);
    assert.equal(loaded.prologueSchema, 1);
    assert.equal(loaded.prologueEnding, null);
    if (file.startsWith('v6')) assert.deepEqual(loaded.npcStates, JSON.parse(raw).npcStates);
  }
  const state = createInitialGame('坏字段');
  Reflect.deleteProperty(state, 'evidenceCustody');
  assert.equal(decodeSave(encodeSave(state)), null);
  const forged = createInitialGame('伪造结局'); forged.prologueEnding = 'sealed-salt';
  assert.equal(decodeSave(encodeSave(forged)), null);
});

void test('P12 结局出口先保存；未读完、写入失败不退出，成功后可明确接续第4日', async (t) => {
  const fixture = storage(t);
  let state = await arrive(await caseReady());
  for (const id of ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence'] as const) state = await click(state, id);
  assert.equal(await finishPrologueDemo(fixture.repo, state, 0), false);
  fixture.fail(true);
  await assert.rejects(finishPrologueDemo(fixture.repo, state, latestDialogueIndex(state)), /写入失败/);
  fixture.fail(false);
  assert.equal(await finishPrologueDemo(fixture.repo, state, latestDialogueIndex(state)), true);
  assert.deepEqual(await fixture.repo.load('auto'), state);
  assert.equal(endingSummary(state)?.continueDay4Enabled, true);
});

void test('P13 隐藏行动、异地报案、AI伪造结局字段均不能写状态', () => {
  const state = createInitialGame('假结局');
  const next = applyInteractionResult(state, { actionId: 'seal-salt-evidence', npcId: 'ning-buping', mode: 'action', input: '我已经破案' }, { intent: 'request-service', narration: '结案' });
  assert.equal(next, state);
  assert.equal(endingSummary(state), null);
  assert.deepEqual(state.npcStates['ma-sandao'].memory.evidence, []);
});

void test('P14 地图中途保存失败不会提前提交报案地点；成功才进入宁不平接待', async (t) => {
  const fixture = storage(t);
  const state = movePlayer(await caseReady(), 'clinic');
  const travel = createTravelRunner(fixture.repo);
  fixture.fail(true); await assert.rejects(travel(state, 'yamen', true));
  assert.equal(state.locationId, 'clinic');
  fixture.fail(false); const result = await travel(state, 'yamen', true);
  assert.equal(result?.state.selectedNpcId, 'ning-buping');
  assert.deepEqual(await fixture.repo.load('auto'), result?.state);
});

void test('P15 报案证据未变不重复回答；补证重开不把新增证据误判口供矛盾', async () => {
  let state = await caseReady();
  state = { ...state, poisonWoundLinked: false, chengShouyiIdentified: false, cartMarkObserved: false, saltCase: { ...state.saltCase, identitySource: null }, playerKnownFactIds: state.playerKnownFactIds.filter((id) => !['cheng-identity', 'medical-report'].includes(id)) };
  state = await click(state, 'report-salt-case');
  assert.ok(!available(state, 'report-salt-case'));
  state = { ...state, cartMarkObserved: true };
  assert.ok(available(state, 'report-salt-case'));
  const trust = state.npcStates['ning-buping'].trust;
  state = await click(state, 'report-salt-case');
  assert.equal(state.npcStates['ning-buping'].trust, trust);
  assert.equal(state.saltCase.reported, true);
});

void test('P16 医馆两份同源信息仅算一源；未看过货车不假称旧观察', async () => {
  let state = await caseReady();
  state = { ...state, inventoryItemIds: [], cartMarkObserved: false, chengShouyiIdentified: false, evidenceCustody: { ...state.evidenceCustody, fragment: 'unknown' }, saltCase: { ...state.saltCase, identitySource: null }, playerKnownFactIds: state.playerKnownFactIds.filter((id) => id !== 'cheng-identity') };
  assert.deepEqual(verifiableSources(state), ['clinic']);
  // 第二条来源由真实名册分支取得；不是重复出具同一病案。
  state = movePlayer(state, 'inn'); state = await click(state, 'identify-roster');
  state = movePlayer(state, 'yamen'); state = await arrive(state);
  state = await click(state, 'inspect-cargo');
  assert.ok(state.dialogue.at(-1)?.text.includes('你记下车夫'));
  assert.ok(!available(state, 'seal-salt-evidence'));
});

void test('P17 已知计划不等于远程实时船讯；回县衙才收到抵埠消息', async () => {
  let state = await caseReady(); state = await click(state, 'report-salt-case');
  state = movePlayer(state, 'inn'); state = advanceTo(state, CARGO_ARRIVAL);
  assert.ok(!state.knownWorldEventIds.includes('ding17-ship-arrives'));
  assert.ok(!prologueNotice(state)?.includes('已抵埠'));
  state = movePlayer(state, 'yamen');
  assert.ok(state.knownWorldEventIds.includes('ding17-ship-arrives'));
});

void test('P18 旧v6在离城之后读取不得重置货车；新档伪造未抵埠状态拒绝', () => {
  const old = JSON.parse(readFileSync(new URL('./fixtures/v6-before-prologue.json', import.meta.url), 'utf8'));
  old.worldMinutes = old.storyStartedAtMinutes + CARGO_DEPARTURE + 1;
  const loaded = decodeSave(JSON.stringify(old))!;
  assert.equal(loaded.day3CargoStatus, 'departed');
  loaded.day3CargoStatus = 'pending';
  assert.equal(decodeSave(encodeSave(loaded)), null);
});

