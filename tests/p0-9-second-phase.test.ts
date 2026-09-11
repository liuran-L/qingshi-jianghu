import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyCampaignAction, campaignActions, dayAt } from '../lib/game/campaign.ts';
import { firstActPreludes, storyEvents } from '../lib/game/campaign-content.ts';
import { artEchoChoices } from '../lib/game/arts-content.ts';
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
const beforeEventState = async (eventId: string) => {
  const base = await beginning();
  const event = storyEvents.find(item => item.id === eventId)!;
  const resolved = Object.fromEntries(storyEvents
    .filter(item => item.day < event.day)
    .map(item => [item.id, { choice: 'missed', at: dayAt(base, item.day), text: item.missed.text, witnessed: false }]));
  return {
    ...base,
    worldMinutes: dayAt(base, event.day) - 60,
    locationId: event.location,
    selectedNpcId: null,
    campaign: { ...structuredClone(base.campaign), activeEvent: null, resolved },
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

void test('P09-2-C02 第九至六十日关键选择使用逐项小字，冲突不暴露内部字段', async () => {
  for (const event of storyEvents.filter(item => item.day >= 9)) {
    const state = await eventState(event.id);
    const choices = campaignActions(state);
    for (const choice of choices.filter(item => item.id.startsWith(`journey-choose:${event.id}:`))) {
      const source = event.choices.find(item => choice.id === `journey-choose:${event.id}:${item.id}`)!;
      assert.equal(choice.hint, source.hint, `${choice.id} 不得由效果统一拼接小字`);
      assert.ok(choice.hint, `${choice.id} 的即时取舍缺少逐项小字`);
      assert.doesNotMatch(`${choice.label}${choice.hint}`, /战斗等级|内部|hidden|flag|wanted|正确选项|结局资格|幕后|真凶/i);
    }
    for (const battle of choices.filter(item => item.id.startsWith(`journey-battle:${event.id}:`))) {
      assert.ok(battle.label && battle.hint && battle.details, `${battle.id} 三层战况不完整`);
      assert.doesNotMatch(`${battle.label}${battle.hint}${battle.details}`, /战斗等级|损血\s*0|耗气\s*0|气血\s*-0|真气\s*-0/);
    }
    const leave = choices.find(item => item.id === `journey-leave:${event.id}`)!;
    assert.equal(leave.label, '离开现场');
    assert.equal(leave.hint, undefined);
  }
});

void test('P09-2-C04 第四、七、二十、三十二、五十七日查探各有独立决策视角或真实准备', async () => {
  const focus = {
    temple: /后墙.*后窗与岔路/,
    fire: /补水.*油罐挪远.*破窗钩.*疏散绳/,
    roads: /路牌.*公开告示.*来往簿.*脚程/,
    riverfight: /底舱.*伤员.*民船.*绳梯.*松缆/,
    witnessnight: /南巷.*东路.*桥头.*轮钉.*灯号/,
  } as const;
  for (const eventId of Object.keys(focus) as (keyof typeof focus)[]) {
    const prelude = firstActPreludes.find(item => item.eventId === eventId)!;
    const event = storyEvents.find(item => item.id === eventId)!;
    assert.match(prelude.activeSource, focus[eventId]);
    assert.ok(!event.opening.some(line => line.includes(prelude.activeSource)), `${eventId} 查探不得重复事件开场`);

    const before = await beforeEventState(eventId);
    const scout = campaignActions(before).find(item => item.id === `journey-scout:${eventId}`);
    assert.ok(scout, `${eventId} 查探入口应当可见`);
    const snapshot = {
      money: before.player.money,
      evidence: [...before.campaign.evidence],
      flags: [...before.campaign.flags],
      resolved: structuredClone(before.campaign.resolved),
    };
    const after = applyCampaignAction(before, `journey-scout:${eventId}`);
    assert.equal(after.campaign.journal.filter(entry => entry.action === `scout:${eventId}`).length, 1);
    assert.deepEqual(after.campaign.evidence, snapshot.evidence);
    assert.deepEqual(after.campaign.resolved, snapshot.resolved);
    if (eventId === 'fire') {
      assert.equal(after.player.money, snapshot.money - 3);
      assert.ok(after.campaign.flags.includes('firebreak-ready'));
    } else {
      assert.equal(after.player.money, snapshot.money);
      assert.deepEqual(after.campaign.flags, snapshot.flags);
    }
  }
});

void test('P09-2-C05 第二十日城门查探只核公开物件、来往记录与脚程', async () => {
  const prelude = firstActPreludes.find(item => item.eventId === 'roads')!;
  assert.match(prelude.activeSource, /城门/);
  for (const term of ['路牌', '公开告示', '来往簿', '脚程']) assert.ok(prelude.activeSource.includes(term));
  assert.doesNotMatch(prelude.activeSource, /向药农|向船户|向递状人|问过药农|问过船户|问过递状人|分别问话/);

  const before = await beforeEventState('roads');
  const after = applyCampaignAction(before, 'journey-scout:roads');
  const added = after.dialogue.slice(before.dialogue.length).map(line => line.text).join('');
  assert.match(added, /城门.*路牌.*公开告示.*来往簿.*脚程/);
  assert.doesNotMatch(added, /向药农|向船户|向递状人|分别问话/);
  assert.equal(after.campaign.evidence.length, before.campaign.evidence.length);
  assert.equal(after.worldMinutes - before.worldMinutes, 30);
});

void test('P09-2-C06 第四十九日只由进水、药桶、取水口、脚夫和船货建立风险', () => {
  const prelude = firstActPreludes.find(item => item.eventId === 'ship')!;
  const event = storyEvents.find(item => item.id === 'ship')!;
  const text = JSON.stringify({ prelude, event });
  assert.doesNotMatch(text, /点火|纵火|火把|火不能替你分清/);
  for (const term of ['进水', '药桶', '取水口', '脚夫', '船货']) assert.ok(text.includes(term), `第四十九日缺少 ${term}`);
  assert.deepEqual(event.missed.effect, { flags: ['river-poisoned'] });
  assert.deepEqual(event.choices.map(choice => choice.effect), [
    { route: 'xia', flags: ['boatmen-safe', 'river-poisoned'], evidence: ['witness'], help: 'lu-guanlan' },
    { route: 'trade', money: -10, flags: ['boatmen-safe', 'river-safe'], evidence: ['medicine'] },
    { route: 'office', flags: ['boatmen-safe', 'river-safe'], evidence: ['medicine'] },
    { route: 'shadow', evidence: ['medicine', 'transport'], flags: ['river-poisoned'], help: 'qiao-wu' },
    ...event.choices.filter(choice => choice.id.startsWith('art-') || choice.id.startsWith('battle-')).map(choice => choice.effect),
  ]);
});

void test('P09-2-C07 第四十一日及同类运行时文本用人物、物件与动作交代边界', () => {
  const visibleContent = JSON.stringify({ firstActPreludes, storyEvents });
  assert.doesNotMatch(visibleContent, /不能证明|不等于|实际|结论|回声|规则/);
  const olddebt = JSON.stringify({
    prelude: firstActPreludes.find(item => item.eventId === 'olddebt'),
    event: storyEvents.find(item => item.id === 'olddebt'),
  });
  for (const term of ['茶壶', '账本', '后巷', '伙计', '后门', '钥匙', '落脚']) assert.ok(olddebt.includes(term), `第四十一日缺少 ${term}`);
});

void test('P09-2-C08 小字只来自逐项文案，离场、越时限与无即时改变的入口不补兜底', async () => {
  for (const event of storyEvents) {
    for (const choice of event.choices.filter(item => !item.id.startsWith('battle-'))) {
      const immediate = Boolean(
        choice.effect.money
        || choice.effect.wanted
        || choice.effect.evidence?.length
        || choice.effect.dead?.length
        || choice.effect.help
        || choice.effect.harm
        || choice.effect.flags?.length
        || choice.effect.pass,
      );
      assert.equal(Boolean(choice.hint), immediate, `${event.id}/${choice.id} 小字与本次即时改变不一致`);
      assert.doesNotMatch(choice.hint ?? '', /正确选项|隐藏路线|幕后|真凶|结局资格|未到场的人|不会随之补齐/);
    }
  }

  const temple = await eventState('temple');
  assert.equal(campaignActions(temple).find(item => item.id === 'journey-leave:temple')!.hint, undefined);
  const nearDeadline = { ...temple, campaign: { ...temple.campaign, activeEvent: null }, worldMinutes: dayAt(temple, 5) - 60 };
  assert.equal(campaignActions(nearDeadline).find(item => item.id === 'journey-rest')!.hint, undefined);
  assert.equal(campaignActions(nearDeadline).find(item => item.id === 'journey-wait')!.hint, undefined);

  const beforeRoads = await beforeEventState('roads');
  assert.equal(campaignActions(beforeRoads).find(item => item.id === 'journey-scout:roads')!.hint, undefined);
  const dueRoads = { ...beforeRoads, worldMinutes: dayAt(beforeRoads, 20) };
  assert.equal(campaignActions(dueRoads).find(item => item.id === 'journey-attend:roads')!.hint, undefined);
});

void test('P09-2-C09 功法介入小字不显示零资源变化', () => {
  for (const event of storyEvents) {
    for (const choice of artEchoChoices(event.id)) {
      assert.doesNotMatch(choice.hint ?? '', /不另付银两|用银\s*0|损血\s*0|耗气\s*0/);
    }
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
