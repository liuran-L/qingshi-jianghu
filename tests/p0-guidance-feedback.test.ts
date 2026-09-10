import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceGameTime, createInitialGame, movePlayer } from '../lib/game/engine.ts';
import { applyCampaignAction, dayAt } from '../lib/game/campaign.ts';
import { coreNames, storyEvents } from '../lib/game/campaign-content.ts';
import { createActionRunner, latestDialogueIndex } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { changeNpcRelationship } from '../lib/game/npc-memory.ts';
import { knowledgeGroups } from '../lib/ui/knowledge.ts';
import { sceneGuidance } from '../lib/ui/guidance.ts';
import { playerText, visibleLine } from '../lib/ui/player-text.ts';
import { relationshipStage, relationshipStageChanges } from '../lib/ui/relationships.ts';
import type { DialogueLine, GameState, LimitedActionId } from '../lib/game/types.ts';

async function click(state: GameState, id: LimitedActionId): Promise<GameState> {
  assert.ok(getAvailableActions(state, state.selectedNpcId).some((action) => action.id === id), `缺少动作 ${id}`);
  const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), id, state.selectedNpcId);
  assert.ok(result);
  return result.state;
}

void test('P0-01 城门首次盘查只有现实应对；陈述、凭据、证物与明码代价各自受规则约束', async () => {
  const initial = createInitialGame('过客');
  const opening = getAvailableActions(initial, initial.selectedNpcId);
  assert.ok(!opening.some((action) => action.id === 'stay-silent'));
  assert.ok(!opening.some((action) => action.id === 'request-entry'));
  let stated = await click(initial, 'tell-attack');
  assert.match(getAvailableActions(stated, stated.selectedNpcId).find((action) => action.id === 'request-entry')!.label, /登记候验/);

  const documented = { ...initial, player: { ...initial.player, hasRoadPass: true } };
  assert.ok(getAvailableActions(documented, documented.selectedNpcId).some((action) => action.id === 'present-gate-document'));
  assert.equal((await click(documented, 'present-gate-document')).gateAccess, true);

  let evidence = await click(createInitialGame('持证人'), 'inspect-bag');
  evidence = await click(evidence, 'tell-attack');
  evidence = await click(evidence, 'show-gate-fragment');
  assert.equal(evidence.gatePhase, 'detained');
  assert.equal(evidence.evidenceCustody.fragment, 'ma');
  assert.ok(!evidence.inventoryItemIds.includes('ding17-fragment'));

  stated = await click(stated, 'open-dayone');
  stated = await click(stated, 'step-aside');
  stated = await click(stated, 'wait-at-gate');
  stated = await click(stated, 'reapproach-gate');
  assert.ok(getAvailableActions(stated, stated.selectedNpcId).some((action) => action.id === 'offer-bribe'));
  const paid = await click(stated, 'offer-bribe');
  assert.equal(paid.player.money, initial.player.money - 2);
  assert.equal(paid.gateAccess, true);
});

void test('P0-02 行囊、NPC异常和客栈问话是独立入口；错过主动调查仍有一次夜间保底', async () => {
  const bag = await click(createInitialGame('查包客'), 'inspect-bag');
  assert.ok(bag.playerKnownFactIds.includes('baggage-watch-mark'));

  let reaction = await click(createInitialGame('试探客'), 'tell-attack');
  reaction = await click(reaction, 'mention-ding17');
  assert.ok(reaction.playerKnownFactIds.includes('ma-ding17-reaction'));
  assert.ok(!reaction.playerKnownFactIds.includes('baggage-watch-mark'));

  let inn = await click(createInitialGame('投店客'), 'tell-attack');
  inn = await click(inn, 'request-entry');
  inn = await click(inn, 'ask-lodging');
  inn = movePlayer(inn, 'inn');
  inn = await click(inn, 'observe-inn');
  assert.ok(inn.playerKnownFactIds.includes('inn-arrival-inquiry'));
  assert.ok(!inn.playerKnownFactIds.includes('baggage-watch-mark'));

  const missed = advanceGameTime(createInitialGame('错过者'), 12 * 60);
  assert.ok(missed.playerKnownFactIds.includes('day-end-watch-rumor'));
  assert.ok(!missed.playerKnownFactIds.includes('next-morning-moving-lead'));
  assert.match(missed.dialogue.at(-1)!.text, /打听今日进城的带伤外乡客/);
  const again = advanceGameTime(missed, 5);
  assert.equal(again.playerKnownFactIds.filter((id) => id === 'day-end-watch-rumor').length, 1);
});

void test('P0-03 主动命中任一入口后，第一夜提示次日线索会变化但不设置立即失败', async () => {
  const investigated = await click(createInitialGame('追痕客'), 'inspect-bag');
  const nextMorning = advanceGameTime(investigated, 12 * 60);
  assert.ok(nextMorning.playerKnownFactIds.includes('next-morning-moving-lead'));
  assert.ok(!nextMorning.playerKnownFactIds.includes('day-end-watch-rumor'));
  assert.match(nextMorning.dialogue.at(-1)!.text, /换船、换人、换落脚处/);
  assert.equal(nextMorning.player.alive, true);
  assert.equal(nextMorning.prologueEnding, null);
});

void test('P0-04 有有效探索时不强推；探索收束后只给至多两条叙事内去向并把紧迫项放前', async () => {
  const initial = createInitialGame('看路客');
  assert.deepEqual(sceneGuidance(initial, getAvailableActions(initial, initial.selectedNpcId)), []);
  let state = initial;
  for (const id of ['inspect-wound', 'inspect-bag', 'inspect-fragment', 'observe-gate', 'tell-attack', 'request-entry', 'ask-clinic', 'ask-lodging'] as const) state = await click(state, id);
  const guidance = sceneGuidance(state, getAvailableActions(state, state.selectedNpcId));
  assert.ok(guidance.length > 0 && guidance.length <= 2);
  assert.equal(guidance[0].urgent, true);
  assert.match(guidance[0].text, /回春堂|伤口/);
  assert.doesNotMatch(guidance.map((item) => item.text).join('\n'), /正确答案|任务目标|必须选择/);
});

void test('P0-05 未知姓名在说话者、正文和日志投影中保持观察称呼；明确披露后人物资料同步', () => {
  const initial = createInitialGame('识人客');
  const hidden: DialogueLine = { id: 'hidden', speaker: '苏晚棠', text: '苏晚棠把账簿收起。', kind: 'npc', portraitId: 'su-wantang' };
  const projected = visibleLine(hidden, initial)!;
  assert.equal(projected.speaker, '柜台后的青衣女子');
  assert.equal(projected.text, '柜台后的青衣女子把账簿收起。');
  assert.equal(playerText('日志里写着苏晚棠。', initial), '日志里写着柜台后的青衣女子。');
  const referred = { ...initial, playerKnownFactIds: ['ning-referral' as const] };
  assert.equal(playerText('医者让我找宁不平。', referred), '医者让我找宁不平。');
  assert.equal(visibleLine({ id: 'ning', speaker: '宁不平', text: '宁不平看着你。', kind: 'npc', portraitId: 'ning-buping' }, referred)?.speaker, '沉默的佩刀汉子');

  let campaign: GameState = { ...initial, gatePhase: 'cleared', gateAccess: true, day3CargoStatus: 'departed' };
  campaign = applyCampaignAction(campaign, 'journey-begin');
  for (const [index, event] of storyEvents.entries()) {
    let scene: GameState = structuredClone(campaign);
    scene.campaign.resolved = Object.fromEntries(storyEvents.slice(0, index).map((prior) => [prior.id, { choice: 'missed', at: scene.worldMinutes, text: prior.missed.text, witnessed: false }]));
    scene = { ...scene, worldMinutes: dayAt(scene, event.day) };
    scene = applyCampaignAction(scene, `journey-attend:${event.id}`);
    assert.equal(scene.npcKnowledge[event.speaker].knownName, coreNames[event.speaker], `${event.id} 姓名未同步`);
    assert.ok(scene.dialogue.some((line) => line.text.includes(coreNames[event.speaker])), `${event.id} 缺少可追溯姓名来源`);
    assert.equal(visibleLine(scene.dialogue.find((line) => line.portraitId === event.speaker), scene)?.speaker, coreNames[event.speaker]);
  }
});

void test('P0-06 关系只显示阶段；细微数值变化不产生阶段提示，v7 当前档不提前获知新线索', () => {
  const initial = createInitialGame('旧识客');
  assert.equal(relationshipStage(initial, 'ma-sandao'), '陌路');
  const crossed = changeNpcRelationship(initial, 'ma-sandao', 'p0-stage', { trust: 2 });
  assert.deepEqual(relationshipStageChanges(initial, crossed), [{ npcId: 'ma-sandao', from: '陌路', to: '熟稔' }]);
  const subtle = changeNpcRelationship(crossed, 'ma-sandao', 'p0-subtle', { attitude: 1 });
  assert.deepEqual(relationshipStageChanges(crossed, subtle), []);
  const person = knowledgeGroups(crossed).find((group) => group.id === 'people')!.entries[0];
  assert.match(person.detail, /关系阶段：熟稔/);
  assert.doesNotMatch(person.detail, /信任|好感|怀疑|敌意|\b\d+\b/);

  const current = decodeSave(encodeSave(initial))!;
  assert.deepEqual(current.playerKnownFactIds, []);
  assert.equal(current.worldMinutes, initial.worldMinutes);
  assert.equal(decodeSave(readFileSync(new URL('./fixtures/v5-game.json', import.meta.url), 'utf8')), null);
  const currentCampaign = { ...current, campaign: { ...current.campaign, startedAt: current.worldMinutes }, worldMinutes: current.storyStartedAtMinutes + 4 * 1440 };
  const advancedCurrentCampaign = advanceGameTime(currentCampaign, 5);
  assert.ok(!advancedCurrentCampaign.playerKnownFactIds.some((id) => ['day-end-watch-rumor', 'next-morning-moving-lead'].includes(id)));
});
