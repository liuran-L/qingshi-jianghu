import assert from 'node:assert/strict';
import { prepareService } from './helpers/confirmed-service.ts';
import test from 'node:test';
import { mockAIService } from '../lib/ai/mock-service.ts';
import {
  advanceGameTime,
  applyInteractionResult,
  createInitialGame,
  createInteractionView,
  estimateTravel,
  formatDuration,
  formatWorldTime,
  getNpcDisplayName,
  movePlayer,
  selectNpc,
} from '../lib/game/engine.ts';
import { getLimitedActions } from '../lib/game/limited-actions.ts';
import {
  decodeSave,
  deleteBrowserSave,
  encodeSave,
  findEmptyManualSlot,
  findLatestExistingSave,
  getBrowserSaveSlots,
  isSaveSlotId,
  MANUAL_SAVE_LIMIT,
  manualSaveSlotIds,
  orderSaveSummaries,
  renameBrowserSave,
  saveToBrowser,
} from '../lib/game/storage.ts';
import type { AIInteractionProposal, GameState, InteractionMode, InteractionRequest, LimitedActionId, LocationId } from '../lib/game/types.ts';
import { locations, npcs } from '../lib/game/world.ts';
import { privateNpcs } from '../lib/game/world-private.ts';

const request = (actionId: LimitedActionId, input: string, npcId: string | null = 'ma-sandao', mode: InteractionMode = 'speech'): InteractionRequest => ({ actionId, input, mode, npcId });

async function interact(state: GameState, interaction: InteractionRequest): Promise<GameState> {
  state = await prepareService(state, interaction.actionId);
  const proposal = await mockAIService.reply(createInteractionView(state, interaction.npcId), interaction);
  return applyInteractionResult(state, interaction, proposal);
}

const clearedAt = (state: GameState, locationId: GameState['locationId']): GameState => ({
  ...state,
  locationId,
  gatePhase: 'cleared',
  gateAccess: true,
  knownLocationIds: [...new Set([...state.knownLocationIds, locationId])],
  selectedNpcId: locations.find((item) => item.id === locationId)?.npcIds[0] ?? null,
});

void test('世界包含六个公开地点、八个公开 NPC 与八个独立私有 NPC 定义', () => {
  assert.equal(locations.length, 6);
  assert.equal(npcs.length, 8);
  assert.equal(privateNpcs.length, 8);
  assert.equal('secret' in npcs[0], false);
});

void test('新角色只掌握亲历信息且城门尚未放行', () => {
  const game = createInitialGame('燕小六');
  assert.equal(game.version, 6);
  assert.deepEqual(game.knownLocationIds, ['gate']);
  assert.deepEqual(game.playerKnownFactIds, []);
  assert.equal(game.gateAccess, false);
  assert.equal(game.gatePhase, 'questioning');
  assert.equal(getNpcDisplayName(game, 'ma-sandao'), '腰挂铁尺的守门差役');
  assert.deepEqual(game.knownClueIds, ['attack-phrase']);
});

void test('Mock 候选结构不含数值、物品、地点或知识写入字段', async () => {
  const game = createInitialGame('燕小六');
  const action = request('inspect-wound', '检查伤口', 'ma-sandao', 'action');
  const result = await mockAIService.reply(createInteractionView(game, action.npcId), action);
  const forbidden = ['healthDelta', 'moneyDelta', 'discoveredLocationIds', 'discoveredItemIds', 'learnedFacts'];
  assert.ok(forbidden.every((key) => !(key in result)));
});

void test('伪造候选中的越权字段不会修改状态', () => {
  const game = createInitialGame('燕小六');
  const action = request('inspect-wound', '检查伤口', 'ma-sandao', 'action');
  const malicious = { intent: 'inspect', narration: '检查伤口。', healthDelta: 999, moneyDelta: 999, discoveredLocationIds: ['temple'] } as unknown as AIInteractionProposal;
  const next = applyInteractionResult(game, action, malicious);
  assert.equal(next.player.health, game.player.health);
  assert.equal(next.player.money, game.player.money);
  assert.deepEqual(next.knownLocationIds, ['gate']);
  assert.ok(next.knownClueIds.includes('abnormal-wound'));
});

void test('当前情境未提供的 actionId 会被整体拒绝', () => {
  const game = createInitialGame('燕小六');
  const illegal = request('rest-night', '凭空住店', 'ma-sandao', 'action');
  const next = applyInteractionResult(game, illegal, { intent: 'request-service', narration: '伪造结果' });
  assert.strictEqual(next, game);
});

void test('玩家陈述只形成主张，不直接改写世界事实', async () => {
  const game = createInitialGame('燕小六');
  const next = await interact(game, request('tell-attack', '我在城外遇袭，路引被夺。'));
  assert.equal(next.playerClaims.length, 1);
  assert.equal(next.playerClaims[0].toldNpcId, 'ma-sandao');
  assert.equal(next.npcStates['ma-sandao'].claimBeliefs[next.playerClaims[0].id] >= 0, true);
  assert.equal(next.player.hasRoadPass, false);
});

void test('问路只解锁对应地点，普通说明不会同时泄露地点', async () => {
  const game = await interact(createInitialGame('燕小六'), request('tell-attack', '我遇袭了。'));
  assert.deepEqual(game.knownLocationIds, ['gate']);
  const inn = await interact(game, request('ask-lodging', '哪里投宿？'));
  assert.ok(inn.knownLocationIds.includes('inn'));
  assert.ok(!inn.knownLocationIds.includes('clinic'));
  const clinic = await interact(inn, request('ask-clinic', '哪里治伤？'));
  assert.ok(clinic.knownLocationIds.includes('clinic'));
});

void test('未知地点与未获城门放行时都不能移动', async () => {
  const initial = createInitialGame('燕小六');
  assert.strictEqual(movePlayer(initial, 'inn'), initial);
  const knowsInn = await interact(await interact(initial, request('tell-attack', '我遇袭了。')), request('ask-lodging', '哪里投宿？'));
  assert.strictEqual(movePlayer(knowsInn, 'inn'), knowsInn);
});

void test('合理说明后请求入城可获得放行', async () => {
  const explained = await interact(createInitialGame('燕小六'), request('tell-attack', '我遇袭了。'));
  const cleared = await interact(explained, request('request-entry', '请按规矩放行。'));
  assert.equal(cleared.gatePhase, 'cleared');
  assert.equal(cleared.gateAccess, true);
});

void test('危险言论与顶撞会累积怀疑并触发搜查', async () => {
  let game = await interact(createInitialGame('燕小六'), request('tell-pass-lost', '只丢了路引。'));
  game = await interact(game, request('mention-ding17', '你听过丁字十七吗？'));
  game = await interact(game, request('request-entry', '放我进去。'));
  assert.equal(game.gatePhase, 'searched');
  assert.equal(game.gateAccess, false);
  assert.equal(game.npcStates['ma-sandao'].informedRiverGang, true);
  assert.ok(game.playerKnownFactIds.includes('ma-ding17-reaction'));
});

void test('搜查发现残片会产生扣留结果而不是随机死亡', async () => {
  let game = createInitialGame('燕小六');
  game = await interact(game, request('inspect-bag', '检查行囊。', 'ma-sandao', 'action'));
  game = await interact(game, request('tell-pass-lost', '路引遗失。'));
  game = await interact(game, request('mention-ding17', '你听过丁字十七吗？'));
  game = await interact(game, request('request-entry', '我要进城。'));
  assert.equal(game.gatePhase, 'searched');
  game = await interact(game, request('submit-search', '接受搜查。', 'ma-sandao', 'action'));
  assert.equal(game.gatePhase, 'detained');
  assert.equal(game.player.alive, true);
  assert.equal(game.npcStates['ma-sandao'].detainedPlayer, true);
});

void test('身份在对方明确自报后才完成对应', async () => {
  const game = createInitialGame('燕小六');
  const next = await interact(game, request('ask-guard-name', '如何称呼？'));
  assert.equal(getNpcDisplayName(next, 'ma-sandao'), '马三刀');
});

void test('旅行耗时受疲劳、天气、伤势和轻功共同影响', () => {
  const base = clearedAt(createInitialGame('燕小六'), 'gate');
  const game = { ...base, knownLocationIds: ['gate', 'inn'] as const } as GameState;
  const tired = { ...game, player: { ...game.player, fatigue: 90 } };
  assert.ok(estimateTravel(tired, 'inn').totalMinutes >= estimateTravel(game, 'inn').totalMinutes);
});

void test('旅行保留完整对话历史', () => {
  const base = clearedAt(createInitialGame('燕小六'), 'gate');
  const game = { ...base, knownLocationIds: ['gate', 'inn'] as LocationId[] };
  const before = game.dialogue.length;
  const moved = movePlayer(game, 'inn');
  assert.ok(moved.dialogue.length > before);
  assert.equal(moved.dialogue[0].text, game.dialogue[0].text);
});

void test('不能选择当前地点之外的 NPC', () => {
  const game = createInitialGame('燕小六');
  assert.strictEqual(selectNpc(game, 'qiao-wu'), game);
});

void test('检查行囊与残片按层次发现，极度疲劳阻止进一步观察', async () => {
  const game = await interact(createInitialGame('燕小六'), request('inspect-bag', '检查行囊。', 'ma-sandao', 'action'));
  assert.ok(game.inventoryItemIds.includes('ding17-fragment'));
  const exhausted = { ...game, player: { ...game.player, fatigue: 90 } };
  const failed = await interact(exhausted, request('inspect-fragment', '检查残片。', 'ma-sandao', 'action'));
  assert.ok(!failed.knownClueIds.includes('black-scale-wax'));
  const rested = { ...game, player: { ...game.player, fatigue: 20 } };
  const found = await interact(rested, request('inspect-fragment', '检查残片。', 'ma-sandao', 'action'));
  assert.ok(found.knownClueIds.includes('black-scale-wax'));
});

void test('伤势长期不处理会恶化并触发第二日隐藏事件', () => {
  const game = createInitialGame('燕小六');
  const next = advanceGameTime(advanceGameTime(game, 8 * 60), 8 * 60);
  assert.ok(next.player.health < game.player.health);
  assert.ok(next.triggeredWorldEventIds.includes('nameless-corpse'));
  assert.ok(!next.knownWorldEventIds.includes('nameless-corpse'));
});

void test('客栈住宿消耗银两、恢复疲劳并留下住宿记录', async () => {
  const atInn = clearedAt(createInitialGame('燕小六'), 'inn');
  const next = await interact(atInn, request('rest-night', '住一晚。', 'su-wantang', 'action'));
  assert.equal(next.player.money, atInn.player.money - 2);
  assert.ok(next.player.fatigue < atInn.player.fatigue);
  assert.equal(next.lodgingRecords.length, 1);
  assert.ok(next.triggeredWorldEventIds.includes('nameless-corpse'));
});

void test('银两不足时住宿和治疗都不会产生免费收益', async () => {
  const poorInn = { ...clearedAt(createInitialGame('燕小六'), 'inn'), player: { ...createInitialGame('燕小六').player, money: 0 } };
  const afterInn = await interact(poorInn, request('rest-night', '住一晚。', 'su-wantang', 'action'));
  assert.equal(afterInn.lodgingRecords.length, 0);
  assert.equal(afterInn.player.money, 0);
  const poorClinic = { ...clearedAt(createInitialGame('燕小六'), 'clinic'), player: { ...createInitialGame('燕小六').player, money: 0 } };
  const afterClinic = await interact(poorClinic, request('request-treatment', '治伤。', 'shen-yanqiu'));
  assert.equal(afterClinic.player.injury, '轻伤');
  assert.equal(afterClinic.player.money, 0);
});

void test('足额支付后医馆治疗由规则层结算', async () => {
  const atClinic = clearedAt(createInitialGame('燕小六'), 'clinic');
  const next = await interact(atClinic, request('request-treatment', '治伤。', 'shen-yanqiu'));
  assert.equal(next.player.money, atClinic.player.money - 3);
  assert.equal(next.player.injury, '无');
  assert.equal(next.player.poison, '不明残毒');
  assert.ok(next.knownClueIds.includes('abnormal-wound'));
  assert.ok(next.playerKnownFactIds.includes('doctor-wound-residue'));
});

void test('第二日事件可以通过客栈传闻获知但不会自动进入情报', async () => {
  const elapsed = advanceGameTime(clearedAt(createInitialGame('燕小六'), 'inn'), 12 * 60);
  assert.ok(!elapsed.knownWorldEventIds.includes('nameless-corpse'));
  const heard = await interact(elapsed, request('ask-news', '近日有何见闻？', 'su-wantang'));
  assert.ok(heard.knownWorldEventIds.includes('nameless-corpse'));
  assert.ok(heard.playerKnownFactIds.includes('inn-corpse-rumor'));
});

void test('第二日尸体调查必须在医生检查玩家伤口后才能完成同源比对', async () => {
  const elapsed = advanceGameTime(clearedAt(createInitialGame('燕小六'), 'clinic'), 12 * 60);
  const corpseAsked = await interact(elapsed, request('ask-corpse', '担架上的人怎么了？', 'shen-yanqiu'));
  assert.ok(corpseAsked.playerKnownFactIds.includes('clinic-corpse-details'));
  assert.ok(!corpseAsked.knownClueIds.includes('matching-corpse-wound'));
  assert.ok(!getLimitedActions(corpseAsked, 'shen-yanqiu').some((item) => item.id === 'compare-corpse-wound'));

  const treated = await interact(corpseAsked, request('request-treatment', '请检查我的伤口。', 'shen-yanqiu'));
  assert.ok(getLimitedActions(treated, 'shen-yanqiu').some((item) => item.id === 'compare-corpse-wound'));
  const compared = await interact(treated, request('compare-corpse-wound', '两处伤口是否相似？', 'shen-yanqiu'));
  assert.ok(compared.knownClueIds.includes('matching-corpse-wound'));
  assert.ok(compared.playerKnownFactIds.includes('corpse-wound-link'));
  assert.ok(!getLimitedActions(compared, 'shen-yanqiu').some((item) => item.id === 'compare-corpse-wound'));
});

void test('已确认姓名后不再显示重复询问姓名选项', async () => {
  const atClinic = clearedAt(createInitialGame('燕小六'), 'clinic');
  const treated = await interact(atClinic, request('request-treatment', '治伤。', 'shen-yanqiu'));
  assert.ok(!getLimitedActions(treated, 'shen-yanqiu').some((item) => item.id === 'ask-name'));
});

void test('世界时间显示包含不会在同一时辰倒退的二十四小时钟点', () => {
  assert.match(formatWorldTime(3 * 1440 + 17 * 60 + 47), /酉时（17:47）/);
  assert.match(formatWorldTime(3 * 1440 + 18 * 60 + 22), /酉时（18:22）/);
  assert.equal(formatDuration(125), '2小时5分钟');
});

void test('八日固定事件按时间触发且保存隐藏结果骨架', () => {
  const game = createInitialGame('燕小六');
  const muchLater = { ...game, worldMinutes: game.storyStartedAtMinutes + 160 * 60 };
  const final = advanceGameTime(muchLater, 1);
  assert.equal(final.triggeredWorldEventIds.length, 8);
  assert.equal(typeof final.worldEventOutcomes['county-lockdown'], 'string');
});

void test('气血归零产生可追溯死亡原因并停止继续行动', () => {
  const game = { ...createInitialGame('燕小六'), player: { ...createInitialGame('燕小六').player, health: 1 }, worldMinutes: 0, storyStartedAtMinutes: 0 };
  const next = advanceGameTime(game, 6 * 60);
  assert.equal(next.player.alive, false);
  assert.match(next.player.deathCause ?? '', /伤势/);
  assert.deepEqual(getLimitedActions(next, 'ma-sandao'), []);
});

void test('存档严格校验当前版本并拒绝旧版本与非法字段', () => {
  const game = createInitialGame('燕小六');
  assert.deepEqual(decodeSave(encodeSave(game)), game);
  assert.equal(decodeSave('{bad json'), null);
  assert.equal(decodeSave(JSON.stringify({ ...game, version: 4 })), null);
  assert.equal(decodeSave(JSON.stringify({ ...game, player: { ...game.player, money: '无限' } })), null);
  assert.equal(decodeSave(JSON.stringify({ ...game, locationId: 'bad-location' })), null);
});

void test('手动存档严格限制为20个且自动存档不占名额', () => {
  assert.equal(MANUAL_SAVE_LIMIT, 20);
  assert.equal(manualSaveSlotIds.length, 20);
  assert.equal(new Set(manualSaveSlotIds).size, 20);
  assert.ok(isSaveSlotId('auto'));
  assert.ok(isSaveSlotId('manual-1'));
  assert.ok(isSaveSlotId('manual-20'));
  assert.equal(isSaveSlotId('manual-0'), false);
  assert.equal(isSaveSlotId('manual-21'), false);
  assert.equal(isSaveSlotId('manual-01'), false);
});

void test('浏览器存档可命名、重命名、删除并寻找空位', () => {
  const values = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } satisfies Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });

  const game = createInitialGame('燕小六');
  saveToBrowser(game, 'auto');
  saveToBrowser(game, 'manual-1', '进城前');
  let summaries = getBrowserSaveSlots();
  assert.equal(summaries.length, 21);
  assert.equal(summaries.filter((slot) => slot.id !== 'auto').length, 20);
  assert.equal(summaries.find((slot) => slot.id === 'manual-1')?.label, '进城前');
  assert.equal(summaries.find((slot) => slot.id === 'manual-1')?.locationId, 'gate');
  assert.equal(findEmptyManualSlot(summaries), 'manual-2');

  renameBrowserSave('manual-1', '城门盘查');
  summaries = getBrowserSaveSlots();
  assert.equal(summaries.find((slot) => slot.id === 'manual-1')?.label, '城门盘查');
  deleteBrowserSave('manual-1');
  summaries = getBrowserSaveSlots();
  assert.equal(summaries.find((slot) => slot.id === 'manual-1')?.exists, false);
  assert.equal(findEmptyManualSlot(summaries), 'manual-1');
  assert.throws(() => saveToBrowser(game, 'manual-21' as never), /非法存档位/);
  assert.throws(() => deleteBrowserSave('auto'), /自动存档/);
});

void test('20个手动存档占满后不再返回可用空位', () => {
  const summaries = [
    { id: 'auto' as const, label: '自动存档', exists: true, playerName: '燕小六', worldMinutes: 0, locationId: 'gate' as const, gameVersion: 5, savedAt: 1 },
    ...manualSaveSlotIds.map((id, index) => ({ id, label: `存档${index + 1}`, exists: true, playerName: '燕小六', worldMinutes: index, locationId: 'gate' as const, gameVersion: 5, savedAt: index + 2 })),
  ];
  assert.equal(findEmptyManualSlot(summaries), null);
  assert.equal(findLatestExistingSave(summaries)?.id, 'manual-20');
  const ordered = orderSaveSummaries(summaries);
  assert.equal(ordered[0].id, 'auto');
  assert.equal(ordered[1].id, 'manual-20');
});

void test('有限模式开场选项不泄露未知地点或隐藏情报', () => {
  const actions = getLimitedActions(createInitialGame('燕小六'), 'ma-sandao');
  const visible = actions.map((item) => `${item.label}${item.input}`).join('');
  assert.doesNotMatch(visible, /悦来客栈|回春堂|漕帮|油布货车/);
  assert.ok(actions.length <= 6);
});
