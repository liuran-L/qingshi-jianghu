import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceGameTime, createInitialGame, applyInteractionResult, createInteractionView } from '../lib/game/engine.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { BrowserSaveRepository, serializeSaveRepository, TauriSaveRepository, type SaveInvoke, type SaveRepository } from '../lib/game/save-repository.ts';
import { AUTO_BACKUP_KEY, SAVE_KEY, decodeSave, findEmptyManualSlot, findLatestExistingSave, manualSaveSlotIds, normalizeSaveLabel, type SaveSlotId } from '../lib/game/storage.ts';
import { consumeSceneReturn, createManualSave, deleteSave, loadSave, overwriteSave, rememberSceneReturn, renameSave, type SavePrompts } from '../lib/game/save-operations.ts';
import type { GameState } from '../lib/game/types.ts';

class FaultStorage {
  values = new Map<string, string>();
  fail: 'read' | 'write' | 'remove' | null = null;
  failKey: string | null = null;
  getItem(key: string) { if (this.fail === 'read') throw new Error('读取被拒绝'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail === 'write' && (!this.failKey || this.failKey === key)) throw new Error('存储空间不足'); this.values.set(key, value); }
  removeItem(key: string) { if (this.fail === 'remove') throw new Error('删除被拒绝'); this.values.delete(key); }
}
function setup(t: { after: (fn: () => void) => void }) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new FaultStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  return { storage, repo: serializeSaveRepository(new BrowserSaveRepository()), state: createInitialGame('回归测试客') };
}
const prompts = (answers: boolean[] = [], label: string | null = '测试档'): SavePrompts => ({ confirm: () => answers.shift() ?? false, prompt: () => label });
const key = (slot: string) => `qingshi-jianghu-save-v7:${slot}`;

void test('S01 新开局→自动保存→规则推进→自动保存→重建仓库恢复完整状态', async (t) => {
  const { repo, state } = setup(t);
  assert.equal(await repo.hasAny(), false);
  await repo.save('auto', state);
  const next = advanceGameTime(state, 17);
  await repo.save('auto', next);
  assert.deepEqual(await new BrowserSaveRepository().load('auto'), next);
  assert.equal((await repo.list()).filter((s) => s.exists && s.id !== 'auto').length, 0);
});

void test('S02 A→B→重复B→主档截断→恢复A，备份时间正确且可继续保存', async (t) => {
  const { repo, state, storage } = setup(t);
  const originalNow = Date.now;
  let timestamp = 100;
  Date.now = () => timestamp;
  t.after(() => { Date.now = originalNow; });
  await repo.save('auto', state);
  timestamp = 200;
  const next = advanceGameTime(state, 12);
  await repo.save('auto', next);
  await repo.save('auto', next);
  storage.values.set(SAVE_KEY, '{截断');
  assert.deepEqual(await repo.load('auto'), state);
  const summary = (await repo.list())[0];
  assert.equal(summary.recovered, true);
  assert.equal(summary.savedAt, 100);
  assert.equal(await loadSave(repo, 'auto', null, false, prompts([false])), null);
  const restored = await loadSave(repo, 'auto', null, false, prompts([true]));
  assert.deepEqual(restored, state);
  await repo.save('auto', advanceGameTime(restored!, 3));
  assert.equal((await repo.list())[0].recovered, false);
  assert.equal((await repo.load('auto'))!.worldMinutes, state.worldMinutes + 3);
});

void test('S03 自动主档缺失可恢复，主档和备份均损坏则明确拒绝且不崩溃', async (t) => {
  const { repo, state, storage } = setup(t);
  await repo.save('auto', state);
  await repo.save('auto', advanceGameTime(state, 1));
  storage.values.delete(SAVE_KEY);
  assert.deepEqual(await repo.load('auto'), state);
  storage.values.set(AUTO_BACKUP_KEY, '坏备份');
  assert.equal(await repo.load('auto'), null);
  assert.equal(await repo.hasAny(), false);
  await assert.rejects(loadSave(repo, 'auto', null, false, prompts()), /损坏/);
});

void test('S04 新建取消、默认名、自定义名、24字截断、特殊字符及重名', async (t) => {
  const { repo, state } = setup(t);
  assert.equal(await createManualSave(repo, state, prompts([], null), '默认'), false);
  assert.equal(await repo.hasAny(), false);
  await createManualSave(repo, state, prompts([], '  '), '默认');
  assert.equal((await repo.list())[1].label, '手动存档 1');
  const long = '侠😀'.repeat(20);
  await createManualSave(repo, state, prompts([], long), '默认');
  assert.equal(Array.from((await repo.list())[2].label).length, 24);
  await createManualSave(repo, state, prompts([], '<script>测试</script>'), '默认');
  await createManualSave(repo, state, prompts([], '<script>测试</script>'), '默认');
  assert.equal((await repo.list()).filter((s) => s.exists).length, 4);
  assert.equal(normalizeSaveLabel('  测试档  '), '测试档');
});

void test('S05 依次建立20档→第21次拒绝→逐一读取→覆盖取消/确认→删除取消/确认→空位复用', async (t) => {
  const { repo, state } = setup(t);
  await repo.save('auto', state);
  for (let i = 1; i <= 20; i++) await createManualSave(repo, advanceGameTime(state, i), prompts([], `分支${i}`), '默认');
  assert.equal(findEmptyManualSlot(await repo.list()), null);
  const full = await repo.list();
  await assert.rejects(createManualSave(repo, state, prompts(), '默认'), /20/);
  assert.deepEqual(await repo.list(), full);
  for (let i = 1; i <= 20; i++) {
    const restored = await loadSave(repo, `manual-${i}`, null, false, prompts());
    assert.equal(restored!.worldMinutes, state.worldMinutes + i);
  }
  assert.equal(await overwriteSave(repo, 'manual-7', state, prompts([false])), false);
  assert.equal((await repo.load('manual-7'))!.worldMinutes, state.worldMinutes + 7);
  await overwriteSave(repo, 'manual-7', state, prompts([true]));
  assert.deepEqual(await repo.load('manual-7'), state);
  assert.equal((await repo.list())[7].label, '分支7');
  assert.equal(await deleteSave(repo, 'manual-7', prompts([false])), false);
  await deleteSave(repo, 'manual-7', prompts([true]));
  assert.equal(findEmptyManualSlot(await repo.list()), 'manual-7');
  await createManualSave(repo, state, prompts([], '重用空位'), '默认');
  assert.equal((await repo.list())[7].label, '重用空位');
  assert.equal((await repo.list()).filter((s) => s.exists).length, 21);
  assert.deepEqual(await repo.load('auto'), state);
});

void test('S06 重命名确认/取消/空白；只改名称不改状态与保存时间', async (t) => {
  const { repo, state } = setup(t);
  await repo.save('manual-1', state, '旧名');
  const before = (await repo.list())[1];
  assert.equal(await renameSave(repo, 'manual-1', prompts([], null)), false);
  await assert.rejects(renameSave(repo, 'manual-1', prompts([], '  ')), /不能为空/);
  await renameSave(repo, 'manual-1', prompts([], '  新名  '));
  assert.equal((await repo.list())[1].label, '新名');
  assert.equal((await repo.list())[1].savedAt, before.savedAt);
  assert.deepEqual(await repo.load('manual-1'), state);
});

void test('S07 读档前先保存/丢弃/取消；自动存档目标不被保存当前进度偷换', async (t) => {
  const { repo, state } = setup(t);
  const current = advanceGameTime(state, 30);
  await repo.save('auto', state);
  assert.equal(await loadSave(repo, 'auto', current, true, prompts([false, false])), null);
  assert.deepEqual(await repo.load('auto'), state);
  assert.deepEqual(await loadSave(repo, 'auto', current, true, prompts([false, true])), state);
  assert.deepEqual(await repo.load('auto'), state);
  assert.deepEqual(await loadSave(repo, 'auto', current, true, prompts([true])), state);
  assert.deepEqual(await repo.load('auto'), current);
});

void test('S08 读手动档→执行真实对话规则→自动保存→另存新档→重开仓库再读', async (t) => {
  const { repo, state } = setup(t);
  await repo.save('manual-1', state, '入城之前');
  const loaded = await loadSave(repo, 'manual-1', null, false, prompts());
  const request = { actionId: 'tell-attack', input: '路上遇袭了', mode: 'speech', npcId: 'ma-sandao' } as const;
  const proposal = await mockAIService.reply(createInteractionView(loaded!, 'ma-sandao'), request);
  const next = applyInteractionResult(loaded!, request, proposal);
  assert.ok(next.worldMinutes > state.worldMinutes);
  await repo.save('auto', next);
  await createManualSave(repo, next, prompts([], '交谈之后'), '默认');
  const reopened = new BrowserSaveRepository();
  assert.deepEqual(await reopened.load('manual-1'), state);
  assert.deepEqual(await reopened.load('manual-2'), next);
  assert.deepEqual(await reopened.load('auto'), next);
});

void test('S09 损坏手动档占名额、其他档仍可读、需确认覆盖/删除', async (t) => {
  const { repo, state, storage } = setup(t);
  for (const slot of manualSaveSlotIds) await repo.save(slot, state);
  storage.values.set(key('manual-1'), '非JSON');
  assert.equal((await repo.list())[1].exists, false);
  assert.equal((await repo.list())[1].occupied, true);
  assert.equal(findEmptyManualSlot(await repo.list()), null);
  assert.deepEqual(await repo.load('manual-2'), state);
  await assert.rejects(loadSave(repo, 'manual-1', null, false, prompts()), /损坏/);
  assert.equal(await overwriteSave(repo, 'manual-1', state, prompts([false])), false);
  assert.equal(storage.values.get(key('manual-1')), '非JSON');
  await overwriteSave(repo, 'manual-1', state, prompts([true]));
  assert.deepEqual(await repo.load('manual-1'), state);
  storage.values.set(key('manual-1'), '再次损坏');
  await deleteSave(repo, 'manual-1', prompts([true]));
  assert.equal(findEmptyManualSlot(await repo.list()), 'manual-1');
});

void test('S10 写入失败保留旧档与名称；失败后可重试，重命名/删除失败不报告成功', async (t) => {
  const { repo, state, storage } = setup(t);
  await repo.save('manual-1', state, '旧档');
  const original = storage.values.get(key('manual-1'));
  storage.fail = 'write';
  await assert.rejects(repo.save('manual-1', advanceGameTime(state, 1), '新档'), /空间不足/);
  await assert.rejects(repo.rename('manual-1', '新名'), /空间不足/);
  assert.equal(storage.values.get(key('manual-1')), original);
  storage.fail = 'remove';
  await assert.rejects(repo.delete('manual-1'), /删除被拒绝/);
  assert.equal(storage.values.get(key('manual-1')), original);
  storage.fail = null;
  await repo.rename('manual-1', '重试成功');
  assert.equal((await repo.list())[1].label, '重试成功');
  await repo.delete('manual-1');
  assert.equal(await repo.load('manual-1'), null);
});

void test('S11 自动备份写失败/主档写失败均保留可恢复进度；先保存失败中止读档', async (t) => {
  const { repo, state, storage } = setup(t);
  await repo.save('auto', state);
  await repo.save('manual-1', state);
  for (const failKey of [AUTO_BACKUP_KEY, SAVE_KEY]) {
    storage.fail = 'write'; storage.failKey = failKey;
    await assert.rejects(repo.save('auto', advanceGameTime(state, 2)), /空间不足/);
    assert.deepEqual(await repo.load('auto'), state);
  }
  await assert.rejects(loadSave(repo, 'manual-1', advanceGameTime(state, 3), true, prompts([true])), /空间不足/);
  storage.fail = null;
  await repo.save('auto', advanceGameTime(state, 4));
  assert.equal((await repo.load('auto'))!.worldMinutes, state.worldMinutes + 4);
});

void test('S12 存储权限拒绝使列表/读取/保存失败，恢复权限后正常重试', async (t) => {
  const { repo, state, storage } = setup(t);
  storage.fail = 'read';
  await assert.rejects(repo.list(), /读取被拒绝/);
  await assert.rejects(repo.load('auto'), /读取被拒绝/);
  await assert.rejects(repo.save('auto', state), /读取被拒绝/);
  storage.fail = null;
  await repo.save('auto', state);
  assert.equal(await repo.hasAny(), true);
});

void test('S13 非法版本、地点、嵌套NPC、数值、事件和槽位被拒绝，不污染有效档', async (t) => {
  const { repo, state } = setup(t);
  const mutations: Array<(value: GameState) => void> = [
    (v) => { (v as { version: number }).version = 4; },
    (v) => { v.player.health = -1; }, (v) => { v.player.money = Infinity; },
    (v) => { v.npcKnowledge = {}; }, (v) => { v.npcStates['ma-sandao'].claimBeliefs = null!; },
    (v) => { v.knownLocationIds = []; }, (v) => { v.conversationTurns['ma-sandao'] = -1; },
    (v) => { v.worldEventOutcomes['roadside-ambush'] = 3 as unknown as string; },
    (v) => { v.knownWorldEventIds.push('county-lockdown'); },
  ];
  await repo.save('manual-1', state);
  for (const mutate of mutations) {
    const invalid = structuredClone(state); mutate(invalid);
    assert.equal(decodeSave(JSON.stringify(invalid)), null);
    await assert.rejects(repo.save('manual-1', invalid), /不完整|不兼容/);
  }
  for (const slot of ['manual-0', 'manual-21', 'manual-01', 'manual-+1', '../auto', 'auto-backup']) {
    await assert.rejects(repo.save(slot as SaveSlotId, state), /非法/);
    await assert.rejects(repo.delete(slot as SaveSlotId), /非法/);
  }
  await assert.rejects(repo.delete('auto'), /自动存档/);
  await assert.rejects(repo.rename('auto', '改名'), /重命名/);
  assert.deepEqual(await repo.load('manual-1'), state);
});

void test('S14 最新有效档排序跳过损坏档，指定读取不偷换为最新档', async (t) => {
  const { repo, state, storage } = setup(t);
  const previousNow = Date.now; let clock = 1;
  Date.now = () => clock++;
  t.after(() => { Date.now = previousNow; });
  await repo.save('auto', state);
  await repo.save('manual-1', advanceGameTime(state, 1));
  await repo.save('manual-2', advanceGameTime(state, 2));
  storage.values.set(key('manual-2'), '{');
  assert.equal(findLatestExistingSave(await repo.list())!.id, 'manual-1');
  assert.deepEqual(await loadSave(repo, 'auto', null, false, prompts()), state);
});

void test('S15 异步保存串行化：慢旧档不覆盖新档、快照隔离、失败后队列继续', async () => {
  const writes: number[] = [];
  let release!: () => void;
  let calls = 0;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const source = {
    async prepareVersion() { return false; },
    async save(_slot: SaveSlotId, state: GameState) { if (++calls === 1) { await barrier; throw new Error('首写失败'); } writes.push(state.worldMinutes); },
    async load() { return null; }, async list() { return []; }, async rename() {}, async delete() {}, async hasAny() { return false; },
  } satisfies SaveRepository;
  const repo = serializeSaveRepository(source);
  const state = createInitialGame('队列测试'); const minutes = state.worldMinutes;
  const first = repo.save('auto', state);
  const rejected = assert.rejects(first, /首写失败/);
  const second = repo.save('auto', advanceGameTime(state, 1));
  const third = repo.save('auto', advanceGameTime(state, 2));
  state.worldMinutes += 1000;
  release(); await Promise.all([rejected, second, third]);
  assert.deepEqual(writes, [minutes + 1, minutes + 2]);
});

void test('S16 地图往返交接保持状态，消费后清空，不影响下一次冷启动', () => {
  const state = createInitialGame('地图回归');
  rememberSceneReturn(state);
  assert.deepEqual(consumeSceneReturn(), state);
  assert.equal(consumeSceneReturn(), null);
});

void test('S17 Tauri桥接：坏主档回退、预览校验、保护好备份、命令失败传播', async () => {
  const state = createInitialGame('桌面回归');
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  let fail = false;
  const invoke: SaveInvoke = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
    calls.push({ command, args });
    if (fail) throw new Error('数据库写入失败');
    if (command === 'load_game') return '坏JSON' as T;
    if (command === 'load_backup') return { payload: JSON.stringify(state), savedAt: 123 } as T;
    if (command === 'list_saves') return [{ id: 'auto', exists: true, label: '自动存档', savedAt: 999 }, { id: 'manual-1', exists: true, label: '坏档', locationId: '无效地点' }] as T;
    return undefined as T;
  };
  const repo = serializeSaveRepository(new TauriSaveRepository(invoke));
  assert.deepEqual(await repo.load('auto'), state);
  const slots = await repo.list();
  assert.equal(slots[0].savedAt, 123); assert.equal(slots[0].recovered, true);
  assert.equal(slots[1].exists, false); assert.equal(slots[1].occupied, true); assert.equal(slots[1].locationId, null);
  await repo.save('auto', state);
  assert.equal(calls.find((item) => item.command === 'save_game')!.args.rotateBackup, false);
  fail = true;
  await assert.rejects(repo.save('manual-1', state), /数据库写入失败/);
  await assert.rejects(repo.delete('manual-1'), /数据库写入失败/);
});

void test('S18 快速连点新建20次不会覆盖同一空位，第21次失败后删除再建可重试', async (t) => {
  const { repo, state } = setup(t);
  const results = await Promise.allSettled(Array.from({ length: 21 }, (_, i) => createManualSave(repo, advanceGameTime(state, i + 1), prompts([], `连点${i}`), '默认')));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 20);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  for (let i = 1; i <= 20; i++) assert.equal((await repo.load(`manual-${i}`))!.worldMinutes, state.worldMinutes + i);
  await deleteSave(repo, 'manual-1', prompts([true]));
  await createManualSave(repo, state, prompts([], '失败后重试'), '默认');
  assert.equal((await repo.list())[1].label, '失败后重试');
});

void test('S19 元数据异常不会冒充有效档，旧版本不迁移，预览不包含隐藏状态', async (t) => {
  const { repo, state, storage } = setup(t);
  await repo.save('manual-1', state);
  const envelope = JSON.parse(storage.values.get(key('manual-1'))!);
  envelope.savedAt = -1;
  storage.values.set(key('manual-1'), JSON.stringify(envelope));
  assert.equal((await repo.list())[1].exists, false);
  storage.values.set(key('manual-2'), JSON.stringify({ format: 1, payload: JSON.stringify({ ...state, version: 4 }), label: '旧版本', savedAt: 1, backup: null }));
  assert.equal(await repo.load('manual-2'), null);
  await repo.save('auto', state);
  const preview = (await repo.list())[0] as unknown as Record<string, unknown>;
  assert.equal('npcStates' in preview, false);
  assert.equal('worldEventOutcomes' in preview, false);
  assert.equal('playerClaims' in preview, false);
});

void test('S20 死亡档可读回且不会复活，合法复杂状态逐字段保留', async (t) => {
  const { repo, state } = setup(t);
  const dead = advanceGameTime({ ...state, player: { ...state.player, health: 1 } }, 24 * 60);
  assert.equal(dead.player.alive, false);
  await repo.save('manual-1', dead);
  assert.deepEqual(await repo.load('manual-1'), dead);
  await repo.save('auto', dead);
  assert.deepEqual(await repo.load('auto'), dead);
});
