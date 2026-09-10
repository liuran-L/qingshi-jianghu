import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialGame, advanceGameTime, movePlayer } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { decodeSave, encodeSave, SAVE_KEY } from '../lib/game/storage.ts';
import { firstActPreludes, storyEvents } from '../lib/game/campaign-content.ts';
import { applyCampaignAction, dayAt } from '../lib/game/campaign.ts';
import { actionSlotCapacity, partitionActions, reserveActionSlots } from '../lib/ui/action-layout.ts';
import { knowledgeGroups } from '../lib/ui/knowledge.ts';
import { eventReviews, reviewErrors } from '../tools/scene-review.ts';
import { beginning, click } from './helpers/campaign.ts';
import type { GameState, LimitedActionId, LocationId } from '../lib/game/types.ts';

const run = createActionRunner(mockAIService);
const atScene = (locationId: LocationId, selectedNpcId: string | null): GameState => {
  const state = createInitialGame('入口审查客');
  return {
    ...state,
    gatePhase: 'cleared', gateAccess: true, locationId, selectedNpcId,
    knownLocationIds: ['gate', 'inn', 'yamen', 'dock', 'temple', 'clinic'],
    npcKnowledge: selectedNpcId ? { ...state.npcKnowledge, [selectedNpcId]: { ...state.npcKnowledge[selectedNpcId], observed: true } } : state.npcKnowledge,
  };
};

async function advanceToElapsed(state: GameState, elapsed: number) {
  let next = state;
  while (next.worldMinutes - next.storyStartedAtMinutes < elapsed) {
    next = advanceGameTime(next, Math.min(720, elapsed - (next.worldMinutes - next.storyStartedAtMinutes)));
  }
  return next;
}

void test('P2-01 渡口试探和同类探索入口均有结算；无内容隐藏，条件不足明确禁用', async () => {
  const dock = atScene('dock', null);
  const dockAction = getAvailableActions(dock, null).find(item => item.id === 'ask-local-news')!;
  assert.equal(dockAction.mode, 'action', '无人渡口不得生成无目标 speech');
  const result = await run(dock, latestDialogueIndex(dock), dockAction.id, null);
  assert.ok(result);
  assert.ok(result.state.playerKnownFactIds.includes('dock-salt-movement'));
  assert.ok(result.state.dialogue.length > dock.dialogue.length);
  assert.ok(!getAvailableActions(result.state, null).some(item => item.id === 'ask-local-news' || item.id === 'observe-scene'));

  for (const [location, npc] of [['gate', 'ma-sandao'], ['inn', 'su-wantang'], ['clinic', 'shen-yanqiu'], ['temple', 'yue-hansheng']] as const) {
    const state = atScene(location, npc);
    const explorations = getAvailableActions(state, npc).filter(item => /^(ask-(?:name|news|local-news)|observe-|inspect-)/.test(item.id));
    for (const action of explorations) {
      if (action.disabledReason) { assert.ok(action.disabledReason.trim()); continue; }
      const settled = await run(state, latestDialogueIndex(state), action.id, npc);
      assert.ok(settled, `${location}/${action.id} 可见却没有结算`);
      assert.ok(settled.state.worldMinutes > state.worldMinutes || settled.state.dialogue.length > state.dialogue.length);
    }
  }

  let tired = createInitialGame('疲惫客');
  const bag = await run(tired, latestDialogueIndex(tired), 'inspect-bag', tired.selectedNpcId);
  tired = { ...bag!.state, player: { ...bag!.state.player, fatigue: 90 } };
  const fragment = getAvailableActions(tired, tired.selectedNpcId).find(item => item.id === 'inspect-fragment')!;
  assert.match(fragment.disabledReason!, /疲劳/);
  assert.equal(await run(tired, latestDialogueIndex(tired), fragment.id, tired.selectedNpcId), null);
});

void test('P2-02 移动端选项槽位按数量而非文字长度，二级收纳不吞关键行动且容量只增不减', () => {
  const base = (id: LimitedActionId, label: string) => ({ id, label, input: label, mode: 'action' as const });
  const short = [base('observe-scene', '看'), base('tell-attack', '说')];
  const long = short.map(item => ({ ...item, label: item.label.repeat(80) }));
  assert.equal(actionSlotCapacity(short, false), actionSlotCapacity(long, false));
  const parts = partitionActions([...short, base('journey-attend:fire', '前往火场'), base('rest-night', '休息')], false);
  assert.ok(parts.secondary.some(item => item.id === 'observe-scene'));
  assert.ok(parts.primary.some(item => item.id === 'journey-attend:fire'));
  assert.ok(parts.primary.some(item => item.id === 'rest-night'));
  assert.equal(reserveActionSlots(8, short, false), 8);
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /--action-slots/);
  assert.match(css, /action-region[\s\S]*--action-slots/);
  assert.doesNotMatch(page, /label\.length|text\.length/);
});

void test('P2-03 第一日至第三日理解递进：只先留悬念，后知盐路秩序，再知公开三方与卷入原因', async () => {
  let state = createInitialGame('新玩家');
  state = { ...state, player: { ...state.player, injury: '无', health: state.player.maxHealth, woundUntreatedMinutes: 0 } };
  state = await advanceToElapsed(state, 12 * 60);
  assert.ok(state.playerKnownFactIds.some(id => id === 'day-end-watch-rumor' || id === 'next-morning-moving-lead'));
  assert.ok(!state.playerKnownFactIds.includes('day2-public-notice'));
  assert.ok(!state.playerKnownFactIds.includes('act-one-surface-conflict'));
  state = await advanceToElapsed(state, 36 * 60);
  assert.ok(state.playerKnownFactIds.includes('day2-public-notice'));
  assert.ok(!state.playerKnownFactIds.includes('act-one-surface-conflict'));
  state = await advanceToElapsed(state, 40 * 60);
  for (const id of ['public-yamen-role', 'public-river-gang-role', 'public-qingyue-role', 'act-one-surface-conflict', 'act-one-involvement'] as const) assert.ok(state.playerKnownFactIds.includes(id));
  const visible = state.dialogue.map(line => line.text).join('\n');
  assert.match(visible, /县衙差役守着官盐验印/); assert.match(visible, /码头按船旗点卯/); assert.match(visible, /青岳门弟子.*名帖/);
  assert.match(visible, /谁在暗处动手，眼下无人肯拿姓名担保/);

  let missed = createInitialGame('漏线客');
  missed = { ...missed, player: { ...missed.player, injury: '无', health: missed.player.maxHealth, woundUntreatedMinutes: 0 }, playerKnownFactIds: [] };
  missed = await advanceToElapsed(missed, 40 * 60);
  assert.ok(missed.playerKnownFactIds.includes('act-one-surface-conflict'));
  assert.ok(missed.playerKnownFactIds.includes('act-one-involvement'));
});

void test('P2-04 十九事件审查字段完整，三层来源互异，结果已写入唯一详细分支图', () => {
  assert.deepEqual(reviewErrors(), []);
  assert.equal(eventReviews.length, 19);
  const fields = ['promoterMotive','trigger','playerKnown','defaultResult','prelude','naturalSource','activeSource','recoverySource','aftermath','changeable','saveImpact','tests'] as const;
  for (const review of eventReviews) {
    for (const field of fields) assert.ok(review[field]?.trim(), `${review.id}/${field} 缺失`);
    assert.equal(new Set([review.naturalSource, review.activeSource, review.recoverySource]).size, 3);
  }
  const doc = readFileSync(new URL('../文档/青石江湖-详细分支图.md', import.meta.url), 'utf8');
  assert.match(doc, /十九事件因果与玩家视角审查总表/);
  for (const event of storyEvents) assert.ok(doc.includes(`#### ${event.id} ·`), `${event.id} 未写入审查总表`);
});

async function reachFirePrelude() {
  let state = await beginning('missed');
  for (const [id, option] of [['temple', 'copy'], ['assassin', 'warn'], ['inheritance', 'record']] as const) {
    while (state.worldMinutes < dayAt(state, storyEvents.find(event => event.id === id)!.day)) state = await click(state, 'journey-wait');
    state = await click(state, `journey-attend:${id}`);
    state = await click(state, `journey-choose:${id}:${option}`);
  }
  return state;
}

void test('P2-05 第七日可用明示代价的前期布置阻止最坏结果，失败仍有继续路线且不得重复结算', async () => {
  let state = await reachFirePrelude();
  const scout = getAvailableActions(state, null).find(item => item.id === 'journey-scout:fire')!;
  assert.match(scout.label, /三两/);
  const beforeMoney = state.player.money;
  state = await click(state, 'journey-scout:fire');
  assert.equal(state.player.money, beforeMoney - 3);
  assert.ok(state.campaign.flags.includes('firebreak-ready'));
  assert.equal(state.campaign.journal.filter(entry => entry.action === 'scout:fire').length, 1);
  assert.equal(applyCampaignAction(state, 'journey-scout:fire'), state);
  assert.deepEqual(decodeSave(encodeSave(state)), state);
  while (state.worldMinutes < dayAt(state, 7)) state = await click(state, 'journey-wait');
  state = await click(state, 'journey-attend:fire');
  assert.ok(getAvailableActions(state, null).some(item => item.id === 'journey-choose:fire:prepared'));
  state = await click(state, 'journey-choose:fire:prepared');
  assert.ok(state.campaign.flags.includes('clerk-safe'));
  assert.ok(state.campaign.flags.includes('cargo-safe'));
  assert.ok(state.campaign.evidence.includes('transport'));
  assert.match(state.campaign.resolved.fire.text, /内室原账烧成黑灰/);

  let failed = await reachFirePrelude();
  while (failed.worldMinutes < dayAt(failed, 7)) failed = await click(failed, 'journey-wait');
  failed = await click(failed, 'journey-attend:fire');
  failed = await click(failed, 'journey-leave:fire');
  assert.match(failed.campaign.resolved.fire.text, /东仓也过了火/);
  assert.match(failed.campaign.resolved.fire.text, /苏晚棠手里或许另有抄件/);
  assert.ok(!failed.campaign.ending);
  assert.ok(getAvailableActions(failed, null).some(item => item.id === 'journey-wait'));
});

void test('P2-06 错过事件可从事发地痕迹补知，但不补奖励、不重演事件', async () => {
  let state = await beginning('missed');
  while (state.worldMinutes < dayAt(state, 4)) state = await click(state, 'journey-wait');
  state = await click(state, 'journey-wait');
  assert.equal(state.campaign.resolved.temple.choice, 'missed');
  assert.equal(state.campaign.resolved.temple.witnessed, false);
  const before = { evidence: [...state.campaign.evidence], flags: [...state.campaign.flags], resolvedAt: state.campaign.resolved.temple.at, dialogueLength: state.dialogue.length };
  state = movePlayer(state, 'temple');
  assert.equal(state.campaign.resolved.temple.witnessed, true);
  assert.deepEqual(state.campaign.evidence, before.evidence);
  assert.deepEqual(state.campaign.flags, before.flags);
  assert.equal(state.campaign.resolved.temple.at, before.resolvedAt);
  assert.ok(state.dialogue.slice(before.dialogueLength).some(line => /血绷带/.test(line.text)));
  assert.deepEqual(decodeSave(encodeSave(state)), state);
});

void test('P2-07 见闻札记只分亲见、他人说法和疑问，不显示幕后摘要或正确答案', () => {
  const state = createInitialGame('札记客');
  const known: GameState = { ...state, playerKnownFactIds: ['day-end-watch-rumor', 'public-yamen-role', 'public-river-gang-role', 'public-qingyue-role', 'act-one-surface-conflict', 'act-one-involvement'] };
  const groups = knowledgeGroups(known);
  const facts = groups.find(group => group.id === 'journal-facts')!;
  const hearsay = groups.find(group => group.id === 'journal-hearsay')!;
  const questions = groups.find(group => group.id === 'journal-questions')!;
  assert.ok(facts.entries.some(entry => entry.id === 'act-one-surface-conflict'));
  assert.ok(hearsay.entries.some(entry => entry.id === 'day-end-watch-rumor'));
  assert.ok(questions.entries.some(entry => entry.id === 'question-three-sides'));
  const text = JSON.stringify(groups);
  assert.doesNotMatch(text, /hiddenSummary|正确答案|凶手就是|幕后主使是/);
  for (const event of storyEvents) assert.ok(!text.includes(event.opening.join('')));
});

void test('P2-08 GameState v7 严格读取：布置可存读，旧结果、伪造与重复均被拒绝', async () => {
  assert.equal(decodeSave(readFileSync(new URL('./fixtures/v5-game.json', import.meta.url), 'utf8')), null);
  const v7 = createInitialGame('当前档客');
  assert.deepEqual(decodeSave(encodeSave(v7)), v7);
  assert.equal(v7.worldMinutes, decodeSave(encodeSave(v7))!.worldMinutes);

  const prepared = await click(await reachFirePrelude(), 'journey-scout:fire');
  const loaded = decodeSave(encodeSave(prepared))!;
  assert.ok(loaded.campaign.flags.includes('firebreak-ready'));
  assert.equal(loaded.campaign.journal.filter(entry => entry.action === 'scout:fire').length, 1);
  assert.equal(applyCampaignAction(loaded, 'journey-scout:fire'), loaded);
  const forged = structuredClone(v7); forged.campaign.flags.push('firebreak-ready');
  assert.equal(decodeSave(encodeSave(forged)), null);

  const legacy = structuredClone(prepared);
  legacy.campaign.resolved.fire = { choice: 'missed', at: legacy.worldMinutes, text: '码头账房焚毁，账房未能逃出。脚夫说原账烧了，别处是否有副本无人肯说。', witnessed: true };
  assert.equal(decodeSave(encodeSave(legacy)), null);
  assert.equal(SAVE_KEY, 'qingshi-jianghu-save-v7:auto');
  assert.equal(firstActPreludes.length, 19);
});
