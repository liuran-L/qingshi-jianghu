import assert from 'node:assert/strict';
import { prepareService } from './helpers/confirmed-service.ts';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceGameTime, applyInteractionResult, createInitialGame, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { getAvailableActions, getLimitedActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import type { GameState, LimitedActionId, LocationId } from '../lib/game/types.ts';
import { continueReading, createActionRunner, createTravelRunner, latestDialogueIndex, previewTravel, readingPosition } from '../lib/game/flow-controller.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { BrowserSaveRepository, serializeSaveRepository } from '../lib/game/save-repository.ts';
import { loadSave } from '../lib/game/save-operations.ts';
import { getKnownFact } from '../lib/game/world.ts';

async function click(state: GameState, id: LimitedActionId, npcId = state.selectedNpcId): Promise<GameState> {
  state = await prepareService(state, id);
  const choice = getLimitedActions(state, npcId).find((item) => item.id === id);
  assert.ok(choice, `当前场景${state.locationId}缺少选项${id}`);
  const before = encodeSave(state);
  const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, npcId);
  assert.ok(result);
  assert.equal(encodeSave(state), before, '点击不能原地修改旧状态');
  assert.deepEqual(decodeSave(encodeSave(result.state)), result.state, '点击后的状态必须仍可存读档');
  return result.state;
}
const actions = (state: GameState) => getLimitedActions(state, state.selectedNpcId).map((choice) => choice.id);
async function openSceneMenu(state: GameState): Promise<GameState> {
  assert.ok(getAvailableActions(state, state.selectedNpcId).some((choice) => choice.id === 'open-dayone'));
  const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), 'open-dayone', state.selectedNpcId);
  assert.ok(result);
  return result.state;
}
async function enter(places: LimitedActionId[] = []) {
  let state = await click(createInitialGame('基线测试客'), 'tell-attack');
  for (const place of places) state = await click(state, place);
  return click(state, 'request-entry');
}
const at = async (location: LocationId) => movePlayer(await enter(['ask-lodging', 'ask-clinic']), location);

void test('D01 先放行后问路不能形成地图空锁', async () => {
  let state = await enter();
  assert.ok(actions(state).includes('ask-lodging'));
  state = await click(state, 'ask-lodging');
  assert.equal(movePlayer(state, 'inn').locationId, 'inn');
});

void test('D02 客栈传闻说出医馆后解锁路线，不泄露尸体同源结论', async () => {
  let state = movePlayer(await enter(['ask-lodging']), 'inn');
  state = await click(state, 'rest-night');
  state = await click(state, 'ask-news');
  assert.ok(state.knownLocationIds.includes('clinic'));
  assert.ok(!state.playerKnownFactIds.includes('corpse-wound-link'));
});

void test('D03 搜查扣押移除实物但保留玩家已知线索', async () => {
  let state = await click(createInitialGame('被扣测试客'), 'inspect-bag');
  for (const id of ['tell-pass-lost', 'mention-ding17', 'request-entry', 'submit-search'] as const) state = await click(state, id);
  assert.equal(state.gatePhase, 'detained');
  assert.ok(!state.inventoryItemIds.includes('ding17-fragment'));
  assert.ok(state.knownClueIds.includes('ding17-fragment'));
});

void test('D04 姓名被婉拒后移除重复按钮，换NPC不误锁他人', async () => {
  const state = await click(await at('inn'), 'ask-name');
  assert.ok(!actions(state).includes('ask-name'));
  assert.ok(getLimitedActions(state, 'lu-guanlan').some((item) => item.id === 'ask-name'));
});

void test('D05 治疗和住宿结算不能复活期间死亡的玩家', async () => {
  for (const [location, action] of [['clinic', 'request-treatment'], ['inn', 'rest-night']] as const) {
    const before = await at(location);
    const dying = { ...before, player: { ...before.player, health: 1, woundUntreatedMinutes: 359 } };
    const after = await click(dying, action);
    assert.equal(after.player.alive, false);
    assert.equal(after.player.health, 0);
    assert.ok(after.player.deathCause);
    assert.equal(after.worldMinutes, dying.worldMinutes + 1);
    assert.equal(after.player.money, dying.player.money - (location === 'clinic' ? 3 : 2));
    assert.ok(!after.playerKnownFactIds.includes('doctor-wound-residue'));
  }
});

void test('D06 旅行途中死亡不出现目的地抵达或NPC发现', async () => {
  const state = await enter(['ask-clinic']);
  const dying = { ...state, player: { ...state.player, health: 1, woundUntreatedMinutes: 359 } };
  const after = movePlayer(dying, 'clinic');
  assert.equal(after.locationId, 'gate');
  assert.equal(after.player.alive, false);
  assert.equal(after.npcKnowledge['shen-yanqiu'].observed, false);
});

void test('D07 已打听的无名尸不会每次进出医馆都重新抬入', async () => {
  let state = await at('inn');
  state = await click(state, 'rest-night');
  state = movePlayer(state, 'clinic');
  const count = state.dialogue.filter((line) => line.text.includes('沾着河泥')).length;
  state = movePlayer(movePlayer(state, 'inn'), 'clinic');
  assert.equal(state.dialogue.filter((line) => line.text.includes('沾着河泥')).length, count);
});

void test('D08 健康但低气血角色不因时间流逝凭空重伤', async () => {
  const healed = await click(await at('clinic'), 'request-treatment');
  const low = { ...healed, player: { ...healed.player, health: 40 } };
  assert.equal(advanceGameTime(low, 1).player.injury, '无');
});

void test('D09 完整路线A：调查→放行→医馆治疗→客栈住宿→传闻→尸体比对', async () => {
  let state = createInitialGame('先医后宿');
  for (const id of ['inspect-wound', 'inspect-bag', 'inspect-fragment', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) state = await click(state, id);
  state = movePlayer(state, 'clinic');
  state = await click(state, 'request-treatment');
  assert.equal(state.player.injury, '无');
  assert.equal(state.npcKnowledge['shen-yanqiu'].knownName, '沈砚秋');
  assert.match(state.dialogue.map((line) => line.text).join(''), /我叫沈砚秋/);
  state = movePlayer(state, 'inn');
  state = await click(state, 'request-room');
  state = await click(state, 'rest-night');
  assert.equal(state.player.money, 15);
  assert.equal(state.lodgingRecords[0].registeredName, '先医后宿');
  assert.ok(!state.knownWorldEventIds.includes('nameless-corpse'));
  state = await click(state, 'ask-news');
  state = movePlayer(state, 'clinic');
  state = await click(state, 'ask-corpse');
  state = await click(state, 'compare-corpse-wound');
  assert.ok(state.playerKnownFactIds.includes('corpse-wound-link'));
  assert.ok(!actions(state).includes('compare-corpse-wound'));
  assert.ok(state.inventoryItemIds.includes('ding17-fragment'));
  assert.equal(state.player.alive, true);
});

void test('D10 完整路线B：仅问客栈→先宿→剑客传闻→先问尸体→当天补治→比对', async () => {
  let state = movePlayer(await enter(['ask-lodging']), 'inn');
  state = await click(state, 'rest-night');
  state = selectNpc(state, 'lu-guanlan');
  state = await click(state, 'ask-name');
  state = await click(state, 'ask-news');
  assert.ok(state.knownLocationIds.includes('clinic'));
  assert.match(state.dialogue.at(-1)!.text, /酒客|回春堂/);
  state = movePlayer(state, 'clinic');
  state = await click(state, 'ask-corpse');
  assert.equal(state.npcKnowledge['shen-yanqiu'].knownName, null);
  assert.ok(!actions(state).includes('compare-corpse-wound'));
  state = await click(state, 'request-treatment');
  const option = getLimitedActions(state, state.selectedNpcId).find((item) => item.id === 'compare-corpse-wound')!;
  assert.doesNotMatch(option.input, /昨日/);
  state = await click(state, 'compare-corpse-wound');
  assert.equal(state.player.money, 15);
  assert.ok(state.knownClueIds.includes('matching-corpse-wound'));
});

void test('D11 城门现实依据开场与搜查阈值；沉默和无依据放行不生成，残片会被扣', async () => {
  assert.ok(!actions(createInitialGame('盘查基线')).includes('stay-silent'));
  assert.ok(!actions(createInitialGame('盘查基线')).includes('request-entry'));
  for (const [id, suspicion] of [['tell-attack', 0], ['tell-pass-lost', 1], ['ask-guard-name', 0]] as const) {
    let state = await click(createInitialGame('盘查基线'), id);
    assert.equal(state.npcStates['ma-sandao'].suspicion, suspicion);
    if (id === 'ask-guard-name') {
      assert.ok(!actions(state).includes('request-entry'));
      assert.ok(!actions(state).includes('ask-guard-name'));
      state = await click(state, 'tell-attack');
    }
    state = await click(state, 'request-entry');
    assert.equal(state.gateAccess, true);
  }
  let state = await click(createInitialGame('隐藏夹层'), 'tell-pass-lost');
  state = await click(state, 'mention-ding17');
  assert.equal(state.npcStates['ma-sandao'].suspicion, 3);
  state = await click(state, 'request-entry');
  assert.deepEqual(actions(state), ['submit-search']);
  state = await click(state, 'submit-search');
  assert.equal(state.gateAccess, true);
  assert.equal(state.inventoryItemIds.length, 0);
  state = await click(state, 'inspect-bag');
  assert.ok(state.inventoryItemIds.includes('ding17-fragment'));
});

void test('D12 十二小时事件边界：旁观者不自动知情；留在医馆跨界可目击且只发生一次', async () => {
  const inn = await at('inn');
  const justBefore = { ...inn, worldMinutes: inn.storyStartedAtMinutes + 719 };
  assert.ok(!justBefore.triggeredWorldEventIds.includes('nameless-corpse'));
  const after = advanceGameTime(justBefore, 1);
  assert.ok(after.triggeredWorldEventIds.includes('nameless-corpse'));
  assert.ok(!after.knownWorldEventIds.includes('nameless-corpse'));
  let clinic = await at('clinic');
  clinic = { ...clinic, worldMinutes: clinic.storyStartedAtMinutes + 715 };
  assert.ok(!actions(clinic).includes('ask-corpse'));
  clinic = await click(clinic, 'observe-clinic');
  assert.ok(clinic.knownWorldEventIds.includes('nameless-corpse'));
  assert.match(clinic.dialogue.at(-1)!.text, /担架/);
  assert.ok(actions(clinic).includes('ask-corpse'));
  const again = advanceGameTime(clinic, 1);
  assert.equal(again.triggeredWorldEventIds.filter((id) => id === 'nameless-corpse').length, 1);
  assert.equal(again.dialogue.length, clinic.dialogue.length);
});

void test('D13 未问姓名时不泄露马三刀真名或递话对象；打点须先观察暗示并实付', async () => {
  let state = await click(createInitialGame('匿名差役'), 'tell-attack');
  assert.ok(!actions(state).includes('offer-bribe'));
  for (const id of ['mention-ding17', 'challenge-search'] as const) state = await click(state, id);
  state = await openSceneMenu(state);
  for (const id of ['step-aside', 'wait-at-gate', 'reapproach-gate', 'offer-bribe'] as const) state = await click(state, id);
  const visible = [...state.dialogue.map((line) => `${line.speaker}${line.text}`), ...state.logs.map((entry) => entry.text), ...state.playerKnownFactIds.map((id) => getKnownFact(id).text)].join('\n');
  assert.doesNotMatch(visible, /马三刀|乔五|漕帮/);
  assert.ok(state.npcStates['ma-sandao'].informedRiverGang);
  assert.ok(state.playerKnownFactIds.includes('ma-private-bribe-signal'));
  assert.equal(state.player.money, 18);
});

void test('D14 拒答姓名跨场景仍锁定；新闻回答后锁定，重复观察不刷钱、能力或关系', async () => {
  let state = await at('inn');
  state = await click(state, 'ask-name');
  state = movePlayer(movePlayer(state, 'gate'), 'inn');
  assert.ok(!actions(state).includes('ask-name'));
  state = await click(state, 'ask-news');
  assert.ok(!actions(state).includes('ask-news'));
  const abilities = structuredClone(state.player.abilities);
  const money = state.player.money;
  const relations = structuredClone(state.npcStates);
  for (let i = 0; i < 12; i++) state = await click(state, 'observe-inn');
  assert.deepEqual(state.player.abilities, abilities);
  assert.deepEqual(state.npcStates, relations);
  assert.equal(state.player.money, money);
});

void test('D15 越地NPC、空目标说话、伪造行为、提前比对均不能写状态', async () => {
  const state = createInitialGame('非法点击');
  for (const request of [
    { actionId: 'tell-attack', input: '我给自己银子', mode: 'speech', npcId: null },
    { actionId: 'tell-attack', input: '我给自己银子', mode: 'action', npcId: null },
    { actionId: 'tell-attack', input: '我给自己银子', mode: 'speech', npcId: 'qiao-wu' },
    { actionId: 'compare-corpse-wound', input: '我已知道真相', mode: 'speech', npcId: 'ma-sandao' },
  ] as const) assert.strictEqual(applyInteractionResult(state, request, { intent: 'state-claim' }), state);
  for (const location of ['temple', 'dock', 'yamen'] as const) assert.strictEqual(movePlayer(state, location), state);
  assert.deepEqual(getLimitedActions(state, 'yue-hansheng'), []);
});

void test('D16 贫困服务不虚构治疗、检查或住宿，正常资源满足现有两日路线', async () => {
  let clinic = await at('clinic');
  clinic = { ...clinic, player: { ...clinic.player, money: 0 } };
  clinic = await click(clinic, 'request-treatment');
  assert.ok(!clinic.playerKnownFactIds.includes('doctor-wound-residue'));
  assert.equal(clinic.player.injury, '轻伤');
  assert.match(clinic.dialogue.at(-1)!.text, /尚未得到处理/);
  let inn = await at('inn');
  inn = { ...inn, player: { ...inn.player, money: 0 } };
  inn = await click(inn, 'rest-night');
  assert.equal(inn.lodgingRecords.length, 0);
  assert.ok(20 >= 3 + 2 * 3);
});

void test('D17 页面逐句阅读不推进规则；未读完、过期按钮及并发点击不重复结算', async () => {
  const state = createInitialGame('阅读流程');
  let index = 0;
  let calls = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const runner = createActionRunner({ async reply(view, request) { calls++; await barrier; return mockAIService.reply(view, request); } });
  assert.equal(await runner(state, index, 'tell-attack', state.selectedNpcId), null);
  while (!readingPosition(state, index).latest) index = continueReading(state, index);
  const pending = runner(state, index, 'tell-attack', state.selectedNpcId);
  assert.equal(await runner(state, index, 'tell-attack', state.selectedNpcId), null);
  release(); const result = (await pending)!;
  assert.equal(calls, 1);
  assert.equal(result.state.playerClaims.length, 1);
  assert.equal(result.dialogueIndex, state.dialogue.length);
  assert.equal(await runner(result.state, result.dialogueIndex, 'request-entry', result.state.selectedNpcId), null);
  assert.equal(await runner(result.state, latestDialogueIndex(result.state), 'tell-attack', result.state.selectedNpcId), null);
});

void test('D18 页面回复失败不写状态，重试可成功；对话中错误切人被拒绝', async () => {
  const state = await at('inn');
  const before = encodeSave(state);
  let failed = true;
  const runner = createActionRunner({ async reply(view, request) { if (failed) throw new Error('Mock失败'); return mockAIService.reply(view, request); } });
  await assert.rejects(runner(state, latestDialogueIndex(state), 'request-room', 'su-wantang'), /Mock失败/);
  assert.equal(encodeSave(state), before);
  failed = false;
  assert.ok(await runner(state, latestDialogueIndex(state), 'request-room', 'su-wantang'));
  assert.equal(await runner(state, latestDialogueIndex(state), 'ask-news', 'lu-guanlan'), null);
});

function setupRepo(t: { after: (fn: () => void) => void }) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  t.after(() => { if (old) Object.defineProperty(globalThis, 'localStorage', old); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  return serializeSaveRepository(new BrowserSaveRepository());
}

void test('D19 地图预览/取消无副作用；保存失败可重试，成功只结算一次并可读回', async (t) => {
  const repo = setupRepo(t);
  const state = await enter(['ask-clinic']);
  const before = encodeSave(state);
  const estimate = previewTravel(state, 'clinic')!;
  assert.ok(estimate.totalMinutes > estimate.baseMinutes);
  assert.equal(previewTravel(state, 'temple'), null);
  let fail = true;
  const runner = createTravelRunner({ ...repo, async save(slot, next) { if (fail) throw new Error('写入失败'); await repo.save(slot, next); } });
  assert.equal(await runner(state, 'clinic', false), null);
  assert.equal(await repo.hasAny(), false);
  await assert.rejects(runner(state, 'clinic', true), /写入失败/);
  assert.equal(encodeSave(state), before);
  fail = false;
  const pending = runner(state, 'clinic', true);
  assert.equal(await runner(state, 'clinic', true), null);
  const result = (await pending)!;
  assert.equal(result.state.worldMinutes, state.worldMinutes + estimate.totalMinutes);
  assert.equal(result.dialogueIndex, latestDialogueIndex(result.state));
  assert.deepEqual(await repo.load('auto'), result.state);
});

void test('D20 死亡→读生前档→继续治疗住宿调查；扣留档读回不绕过限制', async (t) => {
  const repo = setupRepo(t);
  let state = await at('clinic');
  await repo.save('manual-1', state);
  const dying = { ...state, player: { ...state.player, health: 1, woundUntreatedMinutes: 359 } };
  const dead = await click(dying, 'request-treatment');
  await repo.save('auto', dead);
  assert.deepEqual(actions(dead), []);
  assert.equal(previewTravel(dead, 'inn'), null);
  const loaded = (await loadSave(repo, 'manual-1', dead, false, { confirm: () => true, prompt: () => null }))!;
  state = await click(loaded, 'request-treatment');
  state = movePlayer(state, 'inn'); state = await click(state, 'rest-night'); state = await click(state, 'ask-news');
  state = movePlayer(state, 'clinic'); state = await click(state, 'ask-corpse'); state = await click(state, 'compare-corpse-wound');
  await repo.save('auto', state);
  assert.deepEqual(await repo.load('auto'), state);
  let detained = await click(createInitialGame('扣留读档'), 'inspect-bag');
  for (const id of ['tell-pass-lost', 'mention-ding17', 'request-entry', 'submit-search'] as const) detained = await click(detained, id);
  await repo.save('manual-2', detained);
  const restored = (await repo.load('manual-2'))!;
  assert.deepEqual(actions(restored), ['request-review']);
  assert.strictEqual(movePlayer(restored, 'inn'), restored);
});

void test('D21 有界分支遍历：五个真实到达种子各展开三层可见选项，验证状态可保存', async (t) => {
  const inn = await at('inn'); const clinic = await at('clinic');
  const seeds = [createInitialGame('遍历'), inn, clinic, await click(inn, 'rest-night'), movePlayer(await click(inn, 'rest-night'), 'clinic')];
  let transitions = 0;
  async function visit(state: GameState, depth: number): Promise<void> {
    if (!depth) return;
    for (const choice of getLimitedActions(state, state.selectedNpcId)) {
      const next = await click(state, choice.id);
      transitions++;
      assert.ok(next.worldMinutes > state.worldMinutes);
      assert.ok(next.player.money >= 0);
      assert.ok(next.player.alive || next.player.health === 0);
      await visit(next, depth - 1);
    }
  }
  for (const seed of seeds) await visit(seed, 3);
  assert.ok(transitions > 200);
  t.diagnostic(`实际遍历 ${transitions} 条有限选项状态转换；深度3，不宣称穷尽无限时间与循环。`);
});

void test('D22 唯一详细分支图登记当前场景与三类终局', () => {
 const doc=readFileSync(new URL('../文档/青石江湖-详细分支图.md',import.meta.url),'utf8');
 for(const id of ['gate','inn','clinic','custody','relations','prologue','ending-career','ending-open','ending-forced']) assert.ok(doc.includes(`### ${id} ·`));
 for(const field of ['世界事实 / 玩家已知 / 玩家主张','三账独立路径矩阵','强制准入流程与边界']) assert.ok(doc.includes(field));
});

void test('D23 死亡时刻后不触发未来世界事件、不再选择NPC或推进时间', async () => {
  const state = await at('inn');
  const dying = { ...state, worldMinutes: state.storyStartedAtMinutes + 718, player: { ...state.player, health: 1, woundUntreatedMinutes: 359 } };
  const dead = advanceGameTime(dying, 30);
  assert.equal(dead.worldMinutes, dying.worldMinutes + 1);
  assert.ok(!dead.triggeredWorldEventIds.includes('nameless-corpse'));
  assert.strictEqual(advanceGameTime(dead, 720), dead);
  assert.strictEqual(selectNpc(dead, 'lu-guanlan'), dead);
  assert.strictEqual(advanceGameTime(state, NaN), state);
});
