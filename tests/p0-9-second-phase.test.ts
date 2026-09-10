import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyCampaignAction, campaignActions, dayAt } from '../lib/game/campaign.ts';
import { firstActPreludes, storyEvents } from '../lib/game/campaign-content.ts';
import { applyInteractionResult, createInitialGame, movePlayer } from '../lib/game/engine.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { decodeSave, encodeSave, SAVE_RESET_MESSAGE } from '../lib/game/storage.ts';
import type { GameState } from '../lib/game/types.ts';
import { beginning, click } from './helpers/campaign.ts';

const listed = (state: GameState) => getAvailableActions(state, state.selectedNpcId);
const ids = (state: GameState) => listed(state).map(item => item.id);
const eventState = async (eventId: string) => {
  const base = await beginning();
  const event = storyEvents.find(item => item.id === eventId)!;
  return {
    ...base,
    worldMinutes: dayAt(base, event.day),
    locationId: event.location,
    selectedNpcId: null,
    campaign: { ...structuredClone(base.campaign), activeEvent: event.id, resolved: {} },
  } as GameState;
};

void test('P09-2-G01 城门问路以实际放行为界，伪造请求不产生地点或服务', async () => {
  let state = createInitialGame('候验客');
  state = await click(state, 'tell-attack');
  assert.ok(!ids(state).includes('ask-lodging'));
  assert.ok(!ids(state).includes('ask-clinic'));
  assert.strictEqual(applyInteractionResult(state, { actionId: 'ask-lodging', input: '哪里投宿？', mode: 'speech', npcId: 'ma-sandao' }, { intent: 'request-service' }), state);
  assert.strictEqual(applyInteractionResult(state, { actionId: 'ask-clinic', input: '哪里治伤？', mode: 'speech', npcId: 'ma-sandao' }, { intent: 'request-service' }), state);

  state = await click(state, 'request-entry');
  assert.equal(state.gateAccess, true);
  assert.ok(ids(state).includes('ask-lodging'));
  assert.ok(ids(state).includes('ask-clinic'));

  let detained = createInitialGame('复核客');
  for (const id of ['inspect-bag', 'tell-attack', 'mention-ding17', 'challenge-search', 'request-entry', 'submit-search'] as const) detained = await click(detained, id);
  assert.equal(detained.gatePhase, 'detained');
  assert.deepEqual(ids(detained), ['request-review']);
  assert.ok(!ids(detained).some(id => id === 'ask-lodging' || id === 'ask-clinic' || id.startsWith('journey-')));
});

void test('P09-2-G02 第二日委托只由现场的苏晚棠提出', async () => {
  let state = createInitialGame('问事客');
  for (const id of ['inspect-wound', 'inspect-bag', 'tell-attack', 'request-entry', 'ask-clinic', 'ask-lodging'] as const) state = await click(state, id);
  state = movePlayer(state, 'clinic');
  state = await click(state, 'request-treatment');
  state = movePlayer(state, 'inn');
  state = await click(state, 'rest-night');

  state = movePlayer(state, 'clinic');
  state = await click(state, 'open-daytwo');
  assert.ok(!ids(state).includes('decline-report'));
  assert.ok(!ids(state).includes('accept-broker-contact'));
  assert.strictEqual(applyInteractionResult(state, { actionId: 'decline-report', input: '请指夜渡。', mode: 'speech', npcId: 'shen-yanqiu' }, { intent: 'request-service' }), state);
  state = await click(state, 'close-daytwo');

  state = movePlayer(state, 'inn');
  state = {
    ...state,
    poisonWoundLinked: true,
    npcStates: {
      ...state.npcStates,
      'su-wantang': {
        ...state.npcStates['su-wantang'],
        memory: { ...state.npcStates['su-wantang'].memory, evidence: ['ding17-fragment'] },
      },
    },
  };
  state = await click(state, 'open-daytwo');
  assert.ok(ids(state).includes('decline-report'));
  assert.ok(ids(state).includes('accept-broker-contact'));
  const option = listed(state).find(item => item.id === 'decline-report')!;
  assert.match(option.label, /苏掌柜/);
});

void test('P09-2-C01 十九事件都有事前查探、自然到场与事后补知文本', async () => {
  assert.equal(firstActPreludes.length, storyEvents.length);
  assert.deepEqual(new Set(firstActPreludes.map(item => item.eventId)), new Set(storyEvents.map(item => item.id)));
  for (const event of storyEvents) {
    const prelude = firstActPreludes.find(item => item.eventId === event.id)!;
    assert.ok(prelude.label && prelude.naturalSource && prelude.activeSource && prelude.recoverySource && prelude.aftermath, `${event.id} 理解链不完整`);
    const base = await beginning();
    const resolved = Object.fromEntries(storyEvents.filter(item => item.day < event.day).map(item => [item.id, { choice: 'missed', at: dayAt(base, item.day), text: item.missed.text, witnessed: false }]));
    const before = { ...base, worldMinutes: dayAt(base, event.day - 1), campaign: { ...structuredClone(base.campaign), resolved, activeEvent: null } } as GameState;
    assert.ok(campaignActions(before).some(item => item.id === `journey-scout:${event.id}`), `${event.id} 缺少事前查探`);
    const due = { ...before, worldMinutes: dayAt(before, event.day) };
    const attend = campaignActions(due).find(item => item.id === `journey-attend:${event.id}`);
    assert.ok(attend, `${event.id} 缺少自然到场入口`);
    assert.doesNotMatch(attend!.label, /前往\s*·/);
  }
});

void test('P09-2-C02 第九至六十日选择均提供玩家可理解提示，冲突不暴露内部字段', async () => {
  for (const event of storyEvents.filter(item => item.day >= 9)) {
    const state = await eventState(event.id);
    const choices = campaignActions(state);
    for (const choice of choices.filter(item => item.id.startsWith(`journey-choose:${event.id}:`))) {
      assert.ok(choice.hint, `${choice.id} 缺少关键行动提示`);
      assert.doesNotMatch(`${choice.label}${choice.hint}`, /战斗等级|内部|hidden|flag|wanted/i);
    }
    for (const battle of choices.filter(item => item.id.startsWith(`journey-battle:${event.id}:`))) {
      assert.ok(battle.label && battle.hint && battle.details, `${battle.id} 三层战况不完整`);
      assert.doesNotMatch(`${battle.label}${battle.hint}${battle.details}`, /战斗等级|损血\s*0|耗气\s*0|气血\s*-0|真气\s*-0/);
    }
    const leave = choices.find(item => item.id === `journey-leave:${event.id}`)!;
    assert.equal(leave.label, '离开现场');
    assert.match(leave.hint ?? '', /现场不会等你/);
  }
});

void test('P09-2-C03 说得出口但没有事实基础的后期请求不可见且伪造无效', async () => {
  let hearing = await eventState('hearing');
  assert.ok(!ids(hearing).includes('journey-choose:hearing:amnesty'));
  assert.strictEqual(applyCampaignAction(hearing, 'journey-choose:hearing:amnesty'), hearing);
  hearing = { ...hearing, campaign: { ...hearing.campaign, flags: ['waterway'] } };
  assert.ok(ids(hearing).includes('journey-choose:hearing:amnesty'));

  let price = await eventState('lastprice');
  assert.ok(!ids(price).includes('journey-choose:lastprice:vanish'));
  assert.strictEqual(applyCampaignAction(price, 'journey-choose:lastprice:vanish'), price);
  price = { ...price, campaign: { ...price.campaign, wanted: 1 } };
  assert.ok(ids(price).includes('journey-choose:lastprice:vanish'));
});

void test('P09-2-A01 事件现场不开放脱离场景的成长菜单，伪造请求无效', async () => {
  const state = await eventState('hunt');
  assert.ok(!ids(state).includes('open-growth'));
  assert.strictEqual(applyInteractionResult(state, { actionId: 'open-growth', input: '查看成长。', mode: 'action', npcId: null }, { intent: 'wait' }), state);
});

void test('P09-2-S01 v7 为唯一可读取结构，缺字段与 v1 至 v6 全部拒绝', () => {
  const state = createInitialGame('新档客');
  for (let version = 1; version <= 6; version++) assert.equal(decodeSave(encodeSave({ ...state, version } as GameState)), null);
  for (const field of ['dayOne', 'dayTwo', 'economy', 'growth', 'campaign', 'arts', 'battles'] as const) {
    const missing = structuredClone(state) as unknown as Record<string, unknown>;
    delete missing[field];
    assert.equal(decodeSave(JSON.stringify(missing)), null, `缺少 ${field} 时不得补默认值`);
  }
  const missingPrologue = structuredClone(state) as unknown as Record<string, unknown>;
  delete missingPrologue.prologueSchema;
  assert.equal(decodeSave(JSON.stringify(missingPrologue)), null, '缺少序章字段时不得补默认值');
  assert.equal(SAVE_RESET_MESSAGE, '剧情规则已更新，旧存档已失效，请重新开局。');
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /await saveRepository\.prepareVersion\(\)/);
  assert.match(page, /setNotice\(SAVE_RESET_MESSAGE\)/);
  const rust = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(rust, /qingshi-jianghu-v7\.db/);
  assert.match(rust, /qingshi-jianghu-v5\.db/);
  assert.match(rust, /DELETE FROM save_backups/);
  assert.match(rust, /DELETE FROM saves/);
});

void test('P09-2-D01 实施记录含全篇行动审计字段与十九事件测试落点', () => {
  const record = readFileSync(new URL('../文档/青石江湖-实施与验收总记录.md', import.meta.url), 'utf8');
  for (const heading of ['行动 ID', '场景', '前置状态', '在场人物', '玩家已知', '当前结果', '问题判定', '处理方式', '测试位置']) assert.ok(record.includes(heading));
  for (const event of storyEvents) assert.ok(record.includes(event.id), `${event.id} 未登记`);
});
