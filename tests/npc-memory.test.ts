import assert from 'node:assert/strict';
import { prepareService } from './helpers/confirmed-service.ts';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceGameTime, createInitialGame, createInteractionView, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getLimitedActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { changeNpcRelationship, getTopicStatus, recordNpcStatement, showNpcEvidence, verifyNpcStatement } from '../lib/game/npc-memory.ts';
import { AUTO_BACKUP_KEY, SAVE_KEY, decodeSave, encodeSave, manualSaveSlotIds } from '../lib/game/storage.ts';
import { BrowserSaveRepository, TauriSaveRepository, type SaveInvoke } from '../lib/game/save-repository.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';

const oldRaw = readFileSync(new URL('./fixtures/v5-game.json', import.meta.url), 'utf8');
async function click(state: GameState, id: LimitedActionId) {
  state = await prepareService(state, id);
  const original = encodeSave(state);
  const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(result, `缺少可用动作 ${id}`);
  assert.equal(encodeSave(state), original);
  assert.deepEqual(decodeSave(encodeSave(result.state)), result.state);
  return result.state;
}
async function enter(location: 'inn' | 'clinic') {
  let state = await click(createInitialGame('记忆测试客'), 'tell-attack');
  for (const id of ['ask-lodging', 'ask-clinic', 'request-entry'] as const) state = await click(state, id);
  return movePlayer(state, location);
}
const available = (state: GameState, id: LimitedActionId) => getLimitedActions(state, state.selectedNpcId).some((a) => a.id === id);
function storageSetup(t: { after: (fn: () => void) => void }) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  return { data, repo: new BrowserSaveRepository() };
}

void test('N01 八名NPC独立五维状态；纯规则写入、事件去重和边界', () => {
  const state = createInitialGame('甲');
  assert.equal(Object.keys(state.npcStates).length, 8);
  const next = changeNpcRelationship(state, 'lu-guanlan', '帮忙1', { attitude: 1, trust: 2, favor: 1, suspicion: 1, hostility: 1 });
  assert.equal(next.npcStates['lu-guanlan'].favor, 1);
  assert.deepEqual(next.npcStates['ma-sandao'], state.npcStates['ma-sandao']);
  assert.equal(changeNpcRelationship(next, 'lu-guanlan', '帮忙1', { favor: 1 }), next);
  assert.equal(changeNpcRelationship(next, 'lu-guanlan', '非法', { favor: NaN }), next);
  assert.equal(changeNpcRelationship(next, 'lu-guanlan', '上限', { trust: 999 }).npcStates['lu-guanlan'].trust, 100);
});

void test('N02 马三刀口供、明码通融与按规质证单次记忆，不把含糊回答判为谎言', async () => {
  let state = await click(createInitialGame('甲'), 'tell-pass-lost');
  assert.equal(state.npcStates['ma-sandao'].memory.statements[0].truth, 'unknown');
  assert.ok(!available(state, 'offer-bribe'));
  state = await click(state, 'challenge-search');
  state = await click(state, 'open-dayone');
  state = await click(state, 'step-aside');
  state = await click(state, 'wait-at-gate');
  state = await click(state, 'reapproach-gate');
  state = await click(state, 'offer-bribe');
  assert.ok(!available(state, 'offer-bribe'));
  assert.ok(!available(state, 'challenge-search'));
  assert.equal(state.npcStates['ma-sandao'].hostility, 1);
  assert.equal(state.player.money, 18);
  assert.equal(await createActionRunner(mockAIService)(state, latestDialogueIndex(state), 'offer-bribe', state.selectedNpcId), null);
});

void test('N03 苏晚棠拒答→转移话题→登记住宿→跨日仅透露称呼，不泄露全名', async () => {
  let state = await click(await enter('inn'), 'ask-name');
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'refused');
  assert.ok(!available(state, 'ask-name'));
  state = await click(state, 'request-room');
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'locked');
  assert.equal(state.npcStates['su-wantang'].trust, 1);
  state = await click(state, 'rest-night');
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'reopened');
  state = await click(state, 'ask-name');
  assert.equal(state.npcKnowledge['su-wantang'].knownName, '苏掌柜');
  assert.ok(!available(state, 'ask-name'));
  assert.equal(state.npcStates['su-wantang'].memory.topics['ask-name']?.attempts, 2);
  assert.equal(state.npcStates['su-wantang'].memory.statements[0].subject, 'name');
});

void test('N04 陆观澜独立拒答；跨日/切人/读档不无条件重开；重复观察不刷信任', async () => {
  let state = selectNpc(await enter('inn'), 'lu-guanlan');
  state = await click(state, 'ask-name');
  state = await click(state, 'observe-inn');
  const trust = state.npcStates['lu-guanlan'].trust;
  assert.ok(!available(state, 'observe-inn'), '已观察内容不得继续显示空结算入口');
  assert.equal(state.npcStates['lu-guanlan'].trust, trust);
  state = advanceGameTime(state, 480);
  assert.ok(!available(state, 'ask-name'));
  state = decodeSave(encodeSave(state))!;
  assert.ok(!available(state, 'ask-name'));
  assert.equal(state.npcStates['su-wantang'].memory.topics['ask-name'], undefined);
  // 本地规则条件测试；尚无为陆兄增加第二点信任的新增剧情选项。
  state = changeNpcRelationship(state, 'lu-guanlan', '测试守约条件', { trust: 1 });
  state = await click(state, 'ask-name');
  assert.equal(state.npcKnowledge['lu-guanlan'].knownName, '陆兄');
});

void test('N05 新闻同日锁定；无名尸传播后重开一次，各NPC独立；隔日回应不冒充新发现', async () => {
  let state = await click(await enter('inn'), 'ask-news');
  assert.ok(!available(state, 'ask-news'));
  state = await click(state, 'rest-night');
  assert.ok(available(state, 'ask-news'));
  state = await click(state, 'ask-news');
  assert.ok(state.playerKnownFactIds.includes('inn-corpse-rumor'));
  assert.ok(!available(state, 'ask-news'));
  assert.ok(available(selectNpc(state, 'lu-guanlan'), 'ask-news'));
  state = { ...state, player: { ...state.player, injury: '无' } };
  state = advanceGameTime(advanceGameTime(state, 720), 720);
  state = await click(state, 'ask-news');
  assert.ok(state.dialogue.at(-1)?.text.includes('新的可信消息'));
});

void test('N06 沈砚秋费用不足锁定→资源达到条件重开→实际验伤记录→尸体比对一次', async () => {
  let state = await enter('clinic');
  state = { ...state, player: { ...state.player, money: 0 } };
  state = await click(state, 'request-treatment');
  assert.ok(!available(state, 'request-treatment'));
  assert.deepEqual(state.npcStates['shen-yanqiu'].memory.evidence, []);
  state = { ...state, player: { ...state.player, money: 3 } };
  state = await click(state, 'request-treatment');
  assert.deepEqual(state.npcStates['shen-yanqiu'].memory.evidence, ['abnormal-wound']);
  assert.ok(!available(state, 'request-treatment'));
  state = advanceGameTime(state, 720);
  state = await click(state, 'ask-corpse');
  state = await click(state, 'compare-corpse-wound');
  assert.ok(!available(state, 'ask-corpse'));
  assert.ok(!available(state, 'compare-corpse-wound'));
});

void test('N07 自查不等于展示；搜查证物被扣后仍留下该NPC见过证物的记忆', async () => {
  let state = await click(createInitialGame('甲'), 'inspect-bag');
  assert.deepEqual(state.npcStates['ma-sandao'].memory.evidence, []);
  for (const id of ['tell-pass-lost', 'mention-ding17', 'request-entry', 'submit-search'] as const) state = await click(state, id);
  assert.deepEqual(state.npcStates['ma-sandao'].memory.evidence, ['ding17-fragment']);
  assert.deepEqual(state.inventoryItemIds, []);
  assert.deepEqual(state.npcStates['shen-yanqiu'].memory.evidence, []);
});

void test('N08 矛盾只影响听过双方口供的NPC；并不自动判定哪一句是假话或改写世界', () => {
  let state = createInitialGame('甲');
  const original = state;
  state = recordNpcStatement(state, 'ma-sandao', { id: 'a', subject: 'name', value: '甲', text: '我叫甲', truth: 'unknown' });
  state = recordNpcStatement(state, 'ma-sandao', { id: 'b', subject: 'name', value: '乙', text: '我叫乙', truth: 'unknown' });
  assert.equal(state.npcStates['ma-sandao'].trust, -2);
  assert.equal(state.npcStates['ma-sandao'].suspicion, 2);
  assert.deepEqual(state.npcStates['ma-sandao'].memory.statements[1].contradicts, ['a']);
  assert.deepEqual(state.npcStates['su-wantang'], original.npcStates['su-wantang']);
  assert.deepEqual(state.player, original.player);
  assert.deepEqual(state.worldEventOutcomes, original.worldEventOutcomes);
  assert.deepEqual(decodeSave(encodeSave(state)), state);
});

void test('N09 已证伪口供持久化且惩罚去重；未实际展示证据不能核验', async () => {
  const gate = createInitialGame('甲');
  assert.equal(showNpcEvidence(gate, 'shen-yanqiu', 'abnormal-wound'), gate);
  let state = recordNpcStatement(await enter('clinic'), 'shen-yanqiu', { id: 'a', subject: 'injury', value: 'none', text: '我没有受伤', truth: 'unknown' });
  assert.equal(verifyNpcStatement(state, 'shen-yanqiu', 'a', 'false', 'abnormal-wound'), state);
  state = showNpcEvidence(state, 'shen-yanqiu', 'abnormal-wound');
  state = verifyNpcStatement(state, 'shen-yanqiu', 'a', 'false', 'abnormal-wound');
  assert.equal(state.npcStates['shen-yanqiu'].memory.statements[0].truth, 'false');
  assert.equal(verifyNpcStatement(state, 'shen-yanqiu', 'a', 'false', 'abnormal-wound'), state);
  assert.deepEqual(decodeSave(encodeSave(state)), state);
  assert.ok(!('npcStates' in createInteractionView(state, 'ma-sandao')));
});

void test('N10 真正v5夹具：自动档和20手动档只读升级，不改原档/标签/旧数值与口供', async (t) => {
  const { data, repo } = storageSetup(t);
  const old = JSON.parse(oldRaw);
  old.npcStates['ma-sandao'].suspicion = 7;
  old.npcStates['ma-sandao'].claimBeliefs = { old: 1 };
  old.playerClaims.push({ id: 'old', text: '旧口供', toldNpcId: 'ma-sandao', atMinutes: old.worldMinutes });
  old.npcKnowledge['su-wantang'].learnedFacts.push('对方已婉拒透露姓名');
  const raw = JSON.stringify(old);
  for (const slot of ['auto', ...manualSaveSlotIds] as const) data.set(`qingshi-jianghu-save-v5:${slot}`, JSON.stringify({ format: 1, payload: raw, label: `旧档${slot}`, savedAt: 100, backup: null }));
  const snapshot = new Map(data);
  for (const slot of ['auto', ...manualSaveSlotIds] as const) {
    const loaded = (await repo.load(slot))!;
    assert.equal(loaded.version, 6);
    assert.equal(loaded.npcStates['ma-sandao'].suspicion, 7);
    assert.deepEqual(loaded.playerClaims, old.playerClaims);
    assert.equal(loaded.npcStates['su-wantang'].memory.topics['ask-name']?.status, 'refused');
    assert.equal(loaded.npcStates['ma-sandao'].trust, 0);
  }
  assert.equal((await repo.list()).filter((s) => s.exists).length, 21);
  assert.deepEqual(data, snapshot);
  const continued = await click((await repo.load('manual-20'))!, 'tell-attack');
  await repo.save('auto', continued);
  assert.deepEqual(await repo.load('auto'), continued);
  assert.equal(data.get('qingshi-jianghu-save-v5:manual-20'), snapshot.get('qingshi-jianghu-save-v5:manual-20'));
});

void test('N11 v6损坏不静默清空记忆；自动回退v5备份后可继续保存', async (t) => {
  const { data, repo } = storageSetup(t);
  const bad = createInitialGame('坏档');
  for (const mutate of [
    (s: GameState) => { Reflect.deleteProperty(s.npcStates['ma-sandao'], 'memory'); },
    (s: GameState) => { s.npcStates['ma-sandao'].trust = Infinity; },
    (s: GameState) => { s.npcStates['ma-sandao'].memory.topics['ask-name'] = { status: 'locked', day: 3, atMinutes: 5340, attempts: -1, respected: false, evidence: [] }; },
  ]) { const copy = structuredClone(bad); mutate(copy); assert.equal(decodeSave(encodeSave(copy)), null); }
  Reflect.deleteProperty(bad.npcStates['ma-sandao'], 'memory');
  data.set(SAVE_KEY, encodeSave(bad));
  data.set(AUTO_BACKUP_KEY, oldRaw);
  const loaded = (await repo.load('auto'))!;
  assert.equal(loaded.version, 6);
  assert.equal((await repo.list())[0].recovered, true);
  await repo.save('auto', await click(loaded, 'tell-attack'));
  assert.equal((await repo.list())[0].recovered, false);
});

void test('N12 四人复杂记忆自动/手动档往返完全一致，读档继续不解锁已答话题', async (t) => {
  const { repo } = storageSetup(t);
  let state = await click(await enter('clinic'), 'request-treatment');
  state = movePlayer(state, 'inn');
  state = await click(state, 'ask-name');
  state = await click(state, 'rest-night');
  state = await click(selectNpc(state, 'lu-guanlan'), 'ask-name');
  for (const slot of ['auto', 'manual-1', 'manual-20'] as const) { await repo.save(slot, state); assert.deepEqual(await repo.load(slot), state); }
  const loaded = (await repo.load('manual-20'))!;
  assert.ok(!available(loaded, 'ask-name'));
  const continued = await click(loaded, 'ask-news');
  await repo.save('auto', continued);
  assert.deepEqual(await repo.load('auto'), continued);
});

void test('N13 Tauri命令桥接v5只读升级，坏主档回退v5；不冒充原生SQLite运行', async () => {
  let raw = oldRaw;
  const commands: string[] = [];
  const invoke: SaveInvoke = async <T>(command: string, args: Record<string, unknown>) => {
    commands.push(command);
    if (command === 'load_game') return raw as T;
    if (command === 'load_backup') return { payload: oldRaw, savedAt: 100 } as T;
    if (command === 'save_game') { raw = args.payload as string; return undefined as T; }
    throw new Error(command);
  };
  const repo = new TauriSaveRepository(invoke);
  const loaded = (await repo.load('auto'))!;
  assert.equal(loaded.version, 6);
  assert.deepEqual(commands, ['load_game']);
  raw = '{';
  assert.deepEqual(await repo.load('auto'), loaded);
  await repo.save('auto', loaded);
  assert.deepEqual(await repo.load('auto'), loaded);
});

void test('N14 姓名重开必须同时满足跨日、尊重、信任且没有高戒心/敌意', async () => {
  let state = await click(await enter('inn'), 'ask-name');
  state = changeNpcRelationship(state, 'su-wantang', '条件测试', { trust: 2 });
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'refused');
  state = await click(state, 'observe-inn');
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'locked');
  state = advanceGameTime(state, 480);
  assert.equal(getTopicStatus(state, 'su-wantang', 'ask-name'), 'reopened');
  for (const changes of [{ suspicion: 3 }, { hostility: 1 }]) {
    const blocked = changeNpcRelationship(state, 'su-wantang', '阻止条件', changes);
    assert.equal(getTopicStatus(blocked, 'su-wantang', 'ask-name'), 'locked');
    assert.ok(!available(blocked, 'ask-name'));
  }
  const before = encodeSave(state);
  getLimitedActions(state, state.selectedNpcId);
  assert.equal(encodeSave(state), before, '渲染选项不得写入状态');
});

void test('N15 同一日新消息使新闻重开；死亡交互不结算未完成记忆', async () => {
  let state = await enter('inn');
  state = advanceGameTime(state, state.storyStartedAtMinutes + 710 - state.worldMinutes);
  state = await click(state, 'ask-news');
  const oldDay = Math.floor(state.worldMinutes / 1440);
  assert.ok(!available(state, 'ask-news'));
  state = advanceGameTime(state, 10);
  assert.equal(Math.floor(state.worldMinutes / 1440), oldDay);
  assert.ok(available(state, 'ask-news'));
  const clinic = await prepareService(await enter('clinic'), 'request-treatment');
  const dying = { ...clinic, player: { ...clinic.player, health: 1, woundUntreatedMinutes: 359 } };
  const dead = await click(dying, 'request-treatment');
  assert.equal(dead.player.alive, false);
  assert.deepEqual(dead.npcStates, dying.npcStates);
});
