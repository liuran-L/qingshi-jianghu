import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialGame, advanceGameTime, movePlayer, applyInteractionResult, estimateTravel, formatWorldTime } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex, previewTravel } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import { prepareService } from './helpers/confirmed-service.ts';
import { campaignDay, dayAt, routeQualification, lifeSummary, conflictPreview, initialCampaign } from '../lib/game/campaign.ts';
import { storyEvents } from '../lib/game/campaign-content.ts';
import { portraits, portraitForLine } from '../lib/game/portraits.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';
import type { LifeRoute } from '../lib/game/campaign-types.ts';

const available = (s: GameState, id: string) => getAvailableActions(s, s.selectedNpcId).some(a => a.id === id);
async function click(s: GameState, id: LimitedActionId) {
  s = await prepareService(s, id);
  const before = encodeSave(s);
  const result = await createActionRunner(mockAIService)(s, latestDialogueIndex(s), id, s.selectedNpcId);
  assert.ok(result, `${id} 不可用，第${campaignDay(s)}日：${getAvailableActions(s, s.selectedNpcId).map(a => a.id).join(',')}`);
  assert.equal(encodeSave(s), before, `${id} 修改了输入快照`);
  assert.ok(result.state.worldMinutes >= s.worldMinutes, `${id} 时间倒流`);
  const loaded = decodeSave(encodeSave(result.state));
  assert.ok(loaded, `${id} 产生不可读取的存档：${JSON.stringify(result.state.campaign)}`);
  assert.deepEqual(loaded, result.state);
  return loaded;
}

/** 不伪造人物资源：序章每一步都走正式规则、真实选项和存档解码。 */
async function beginning(origin: 'sealed-salt' | 'night-ferry' | 'fragment-transferred' | 'missed' = 'sealed-salt') {
  let s = createInitialGame('长路客');
  for (const id of ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'ask-clinic', 'ask-lodging', 'request-entry'] as const) s = await click(s, id);
  s = movePlayer(s, 'clinic');
  s = await click(s, 'request-treatment');
  s = movePlayer(s, 'inn');
  s = await click(s, 'rest-night');
  if (origin === 'fragment-transferred') {
    s = await click(s, 'open-dayone'); s = await click(s, 'show-fragment'); s = await click(s, 'close-dayone');
    s = await click(s, 'open-daytwo'); s = await click(s, 'accept-broker-contact');
    s = movePlayer(s, 'dock');
    while (s.day3CargoStatus !== 'departed') s = await click(s, 'wait-night-ferry');
    s = await click(s, 'transfer-fragment');
  } else if (origin === 'missed') {
    while (s.day3CargoStatus !== 'departed') s = await click(s, 'rest-night');
  } else {
    s = movePlayer(s, 'clinic');
    for (const id of ['ask-corpse', 'compare-corpse-wound', 'identify-memory'] as const) s = await click(s, id);
    if (origin === 'night-ferry') {
      s = await click(s, 'open-daytwo'); s = await click(s, 'decline-report'); s = movePlayer(s, 'dock');
      while (s.day3CargoStatus !== 'departed') s = await click(s, 'wait-night-ferry');
      s = await click(s, 'take-night-ferry');
    } else {
      for (const id of ['request-medical-report', 'ask-ning-referral'] as const) s = await click(s, id);
      s = movePlayer(s, 'yamen'); s = await click(s, 'report-salt-case');
      while (s.day3CargoStatus === 'pending') s = await click(s, 'await-cargo');
      for (const id of ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence'] as const) s = await click(s, id);
    }
  }
  const npcStates = structuredClone(s.npcStates);
  s = await click(s, 'journey-begin');
  assert.equal(s.campaign.origin, origin);
  assert.deepEqual(s.npcStates, npcStates);
  return s;
}

const plan: Record<LifeRoute, Record<string, string>> = {
  xia: { temple: 'shelter', assassin: 'shield', inheritance: 'will', fire: 'people', identity: 'correct', survivor: 'escort', sister: 'rescue', roads: 'mountain', pharmacy: 'test', assembly: 'testament', riverfight: 'rescue', hearing: 'witness', olddebt: 'hide', hunt: 'escort', ship: 'people', order: 'escort', threeledgers: 'official', witnessnight: 'guard' },
  trade: { temple: 'copy', assassin: 'warn', inheritance: 'supply', fire: 'cargo', identity: 'bond', survivor: 'ransom', sister: 'buy', roads: 'river', pharmacy: 'purchase', assembly: 'withdraw', riverfight: 'bargain', hearing: 'buycopy', olddebt: 'sister', hunt: 'hire', ship: 'tow', order: 'market', threeledgers: 'medicine', witnessnight: 'cars' },
  shadow: { temple: 'steal', assassin: 'archive', inheritance: 'will', fire: 'ledger', identity: 'hide', survivor: 'key', sister: 'swap', roads: 'backdoor', pharmacy: 'recover', assembly: 'medicine', riverfight: 'copy', hearing: 'amnesty', olddebt: 'shadow', hunt: 'hide', ship: 'leverage', order: 'redistribute', threeledgers: 'official', witnessnight: 'network' },
  office: { temple: 'copy', assassin: 'warn', inheritance: 'record', fire: 'cordon', identity: 'correct', survivor: 'writ', sister: 'petition', roads: 'prefecture', pharmacy: 'test', assembly: 'medicine', riverfight: 'rescue', hearing: 'official', olddebt: 'hide', hunt: 'writ', ship: 'seal', order: 'office', threeledgers: 'official', witnessnight: 'public' },
  healer: { temple: 'medicine', assassin: 'triage', inheritance: 'record', fire: 'people', identity: 'correct', survivor: 'escort', sister: 'petition', roads: 'mountain', pharmacy: 'test', assembly: 'medicine', riverfight: 'rescue', hearing: 'witness', olddebt: 'hide', hunt: 'hide', ship: 'seal', order: 'escort', threeledgers: 'medicine', witnessnight: 'network' },
};

async function fullLife(route: LifeRoute, tactic: string, origin: Parameters<typeof beginning>[0] = 'sealed-salt', capture?: (s: GameState) => void) {
  let s = await beginning(origin);
  s = await click(s, 'journey-care');
  for (const event of storyEvents) {
    let guard = 0;
    while (s.worldMinutes < dayAt(s, event.day)) {
      assert.ok(++guard < 100);
      // 路线可以谋生，医道通过实际分药积累；不拿空白身份当官。
      const work: LifeRoute = route === 'shadow' ? 'trade' : route;
      if (available(s, `journey-work:${work}`) && dayAt(s, event.day) - s.worldMinutes >= 360) {
        s = await click(s, `journey-work:${work}`);
      } else if (route === 'healer' && available(s, 'journey-train:healer') && dayAt(s, event.day) - s.worldMinutes >= 240) s = await click(s, 'journey-train:healer');
      else if (route === 'xia' && available(s, 'journey-train:xia') && dayAt(s, event.day) - s.worldMinutes >= 240) s = await click(s, 'journey-train:xia');
      else if (s.player.money < 25 && dayAt(s, event.day) - s.worldMinutes >= 480) s = await click(s, 'journey-rest');
      else s = await click(s, 'journey-wait');
    }
    if (s.campaign.resolved[event.id]) continue;
    s = await click(s, `journey-attend:${event.id}`);
    capture?.(s);
    s = await click(s, `journey-choose:${event.id}:${plan[route][event.id] ?? 'copy'}`);
  }
  while (s.worldMinutes < dayAt(s, 58)) s = await click(s, 'journey-wait');
  if (route === 'office' && s.campaign.wanted >= 4) s = await click(s, 'journey-amends');
  assert.equal(routeQualification(s, route), null, `${route} 缺少终局资格`);
  s = await click(s, `journey-finale:${route}`);
  capture?.(s);
  s = await click(s, `journey-end:${route}:${tactic}`);
  s = await click(s, 'journey-end:record');
  s = await click(s, 'journey-end:finish');
  assert.equal(s.campaign.ending, route);
  assert.ok(s.worldMinutes >= dayAt(s, 60));
  assert.equal(advanceGameTime(s, 60), s);
  assert.equal(movePlayer(s, s.locationId === 'gate' ? 'inn' : 'gate'), s);
  assert.deepEqual(getAvailableActions(s, s.selectedNpcId), []);
  assert.ok(lifeSummary(s)!.facts.length >= 7);
  return s;
}

for (const [route, tactic, origin] of [
  ['xia', 'proof', 'sealed-salt'], ['xia', 'escort', 'night-ferry'],
  ['trade', 'public', 'missed'], ['trade', 'monopoly', 'sealed-salt'],
  ['shadow', 'publish', 'fragment-transferred'], ['shadow', 'sell', 'night-ferry'],
  ['office', 'trial', 'sealed-salt'], ['office', 'compromise', 'missed'],
  ['healer', 'clinic', 'sealed-salt'], ['healer', 'travel', 'missed'],
] as const) {
  void test(`L01 全程 ${origin} → ${route}/${tactic}：开局至六十日，每步存读一致`, async () => {
    const s = await fullLife(route, tactic, origin);
    assert.ok(s.campaign.flags.some(f => f.startsWith(route) || f === 'public-truth' || f === 'office-compromise' || f === 'healer-clinic' || f === 'healer-travel'));
  });
}

void test('L02 缺席推进：不生成已救人事实，旧档、地图往返不重置期限', async () => {
  let s = await beginning('missed');
  s = await click(s, 'journey-care');
  while (s.worldMinutes < dayAt(s, 58)) s = await click(s, 'journey-wait');
  assert.equal(Object.keys(s.campaign.resolved).length, storyEvents.length);
  assert.equal(s.campaign.npcAlive['gu-qinghe'], false);
  assert.equal(s.campaign.npcAlive['shen-yanqiu'], false);
  assert.ok(!s.campaign.flags.includes('sister-safe'));
  const original = encodeSave(s); assert.equal(encodeSave(decodeSave(original)!), original);
  assert.ok(Object.values(s.campaign.resolved).every(r => !r.witnessed));
  s = await click(s, 'journey-rumors');
  assert.ok(Object.values(s.campaign.resolved).every(r => r.witnessed));
  s = await click(s, 'journey-retire');
  assert.equal(s.campaign.ending, 'retired');
  assert.match(lifeSummary(s)!.facts.join(''), /没有被你救出/);
});

void test('L03 路线转向有实际代价，已学技艺不抹除；重复工作与伪造行动无效', async () => {
  let s = await beginning();
  for (let i = 0; i < 3; i++) { s = await click(s, 'journey-work:trade'); s = await click(s, 'journey-wait'); }
  s = await click(s, 'journey-pledge:trade');
  const money = s.player.money, trust = s.npcStates['su-wantang'].trust, score = s.campaign.scores.trade;
  s = await click(s, 'journey-break');
  assert.equal(s.player.money, Math.max(0, money - 6));
  assert.equal(s.npcStates['su-wantang'].trust, trust - 3);
  assert.equal(s.campaign.scores.trade, score);
  s = await click(s, 'journey-work:office');
  assert.equal(available(s, 'journey-work:trade'), false);
  assert.equal(applyInteractionResult(s, { actionId: 'journey-choose:ship:tow', mode: 'action', npcId: s.selectedNpcId, input: '冒充' }, { intent: 'wait' }), s);
  // 边界夹具：立约不能让明确失败的偷盗凭空获得奖金。
  let failed = await beginning();
  failed.campaign.pledge = 'shadow';
  failed.player.abilities.agility = 0;
  failed.campaign.wanted = 6;
  const beforeFailure = failed.player.money;
  failed = await click(failed, 'journey-work:shadow');
  assert.equal(failed.player.money, beforeFailure);
  assert.equal(failed.campaign.wanted, 8);
});

void test('L04 六十日存档结构损坏拒绝，完整旧档补默认不推进时钟', async () => {
  const initial = createInitialGame('旧客');
  const old = JSON.parse(encodeSave(initial)); delete old.campaign;
  assert.deepEqual(decodeSave(JSON.stringify(old))!.campaign, initialCampaign());
  let s = await beginning(); s = await click(s, 'journey-work:trade');
  for (const mutate of [
    (x: GameState) => { x.campaign.wanted = 11; },
    (x: GameState) => { x.campaign.experience.trade = 999; },
    (x: GameState) => { x.campaign.flags.push('凭空团圆'); },
    (x: GameState) => { x.campaign.ending = 'trade'; x.campaign.endedAt = x.worldMinutes; },
    (x: GameState) => { x.campaign.activeEvent = 'ship'; },
    (x: GameState) => { x.campaign.journal[0].at = x.worldMinutes + 1; },
    (x: GameState) => { Reflect.deleteProperty(x.campaign, 'debt'); },
  ]) { const x = structuredClone(s); mutate(x); assert.equal(decodeSave(encodeSave(x)), null); }
});

void test('L05 危险有确定预览，受伤死亡中断服务不复活，终态不可旅行', async () => {
  let s = await beginning();
  s.player.injury = '重伤'; s.player.health = 2; s.player.woundUntreatedMinutes = 359; s.dayOne.bleedingGraceMinutes = 0;
  s = await click(s, 'journey-care');
  assert.equal(s.campaign.ending, 'dead'); assert.equal(s.player.health, 0);
  assert.equal(previewTravel(s, 'inn'), null);
  const p = conflictPreview(s); assert.equal(p.win, p.power >= p.target);
});

void test('L06 九张本地立绘存在，身份未知时仍按说话者匹配且旁白不冒充NPC', () => {
  const s = createInitialGame('看图客');
  assert.equal(Object.keys(portraits).length, 9);
  for (const p of Object.values(portraits)) assert.match(readFileSync(new URL(`../public${p.src}`, import.meta.url), 'utf8'), /<svg/);
  assert.equal(portraitForLine(s, s.dialogue.at(-1)), portraits['ma-sandao']);
  assert.equal(portraitForLine(s, s.dialogue[0]), null);
});

void test('L07 序章结案期限与交存记录归档，长篇可继续原有技能树并实际作用于规则', async () => {
  let s = await beginning();
  assert.equal(s.campaign.prologueRecord!.stayPermitUntil, s.campaign.startedAt! + 4320);
  assert.ok(s.inventoryItemIds.includes('evidence-receipt'));
  for (let i = 0; i < 2; i++) { s = await click(s, 'journey-work:xia'); s = await click(s, 'journey-wait'); }
  s = await click(s, 'journey-lesson:step');
  const duration = estimateTravel(s, 'inn').totalMinutes;
  s = await click(s, 'journey-node:step-foundation');
  assert.ok(estimateTravel(s, 'inn').totalMinutes <= duration - 2);
  s = await click(s, 'journey-wait');
  s = await click(s, 'journey-lesson:step');
  s = await click(s, 'journey-node:step-breath');
  assert.equal(s.campaign.extraLessons.step, 1);
  assert.deepEqual(s.growth.step.nodes, ['step-foundation', 'step-breath']);
  assert.equal(available(s, 'journey-lesson:step'), false);
  assert.equal(available(s, 'journey-node:step-breath'), false);
});

void test('L08 时刻边界、过期选项与地图预览不倒流；晚到不重开已结束桥段', async () => {
  let s = await beginning();
  s = await click(s, 'journey-wait');
  s = await click(s, 'journey-attend:temple');
  const deadline = dayAt(s, 5);
  while (s.worldMinutes < deadline - 15) s = advanceGameTime(s, Math.min(720, deadline - 15 - s.worldMinutes));
  s = await click(s, 'journey-choose:temple:shelter');
  assert.equal(s.campaign.resolved.temple.choice, 'missed');
  assert.ok(!s.campaign.flags.includes('yue-safe'));
  assert.equal(available(s, 'journey-choose:temple:shelter'), false);
  const before = encodeSave(s); previewTravel(s, 'inn'); assert.equal(encodeSave(s), before);
  const restored = decodeSave(before)!; assert.equal(restored.worldMinutes, s.worldMinutes);
  assert.equal(advanceGameTime(restored, -50), restored);
  assert.doesNotMatch(formatWorldTime(dayAt(s, 60)), /初6\d/);
});

void test('L09 中途远走有完整结局，离开不是假破案', async () => {
  let s = await beginning('night-ferry');
  while (s.worldMinutes < dayAt(s, 18)) s = await click(s, 'journey-wait');
  s = await click(s, 'journey-away');
  assert.equal(s.campaign.ending, 'away');
  assert.match(lifeSummary(s)!.facts[0], /没有参与的清算/);
  assert.equal(s.campaign.finale, null);
});

void test('L10 真实可达种子的事件分支矩阵，缺席与所有可用分支均能存读', async (t) => {
  const seeds: GameState[] = [];
  await fullLife('trade', 'public', 'sealed-salt', s => { if (s.campaign.activeEvent) seeds.push(s); });
  let count = 0;
  for (const s of seeds) {
    for (const a of getAvailableActions(s, s.selectedNpcId)) {
      const next = await click(s, a.id);
      assert.ok(next.campaign.resolved[s.campaign.activeEvent!]);
      count++;
    }
  }
  assert.equal(seeds.length, 19);
  assert.ok(count >= 65);
  t.diagnostic(`19个实达现场，验证${count}条选择转换；每次检查输入不变、时间单调及存读一致。`);
});

void test('L11 战力公开裁决：胜、负伤撤退、明确致死、投降分别成立', async () => {
  let encounter: GameState | null = null;
  await fullLife('xia', 'proof', 'sealed-salt', s => { if (s.campaign.finale) encounter = s; });
  assert.ok(encounter);
  let s = encounter as GameState;
  assert.ok(conflictPreview(s).win);
  const win = await click(s, 'journey-end:xia:fight');
  assert.ok(win.campaign.flags.includes('xia-victory'));
  s = structuredClone(encounter as GameState);
  s.npcStates['lu-guanlan'].trust = 0; s.npcStates['ning-buping'].trust = 0;
  s.player.injury = '重伤'; s.player.fatigue = 100; s.player.health = 90;
  assert.equal(conflictPreview(s).win, false);
  const loss = await click(s, 'journey-end:xia:fight');
  assert.ok(loss.campaign.flags.includes('xia-defeat')); assert.ok(loss.player.alive);
  s.player.health = 1;
  const death = await click(s, 'journey-end:xia:fight');
  assert.equal(death.campaign.ending, 'dead'); assert.match(death.player.deathCause!, /战前已明示致命风险/);
  const prison = await click(encounter as GameState, 'journey-end:surrender');
  assert.equal(prison.campaign.ending, 'prison'); assert.equal(prison.player.alive, true);
});

void test('L12 后续医术节点可习得、包扎缓冲可存读；无钱照料不伪造病案', async () => {
  let s = await beginning();
  for (let i = 0; i < 2; i++) { s = await click(s, 'journey-work:healer'); s = await click(s, 'journey-wait'); }
  s = await click(s, 'journey-lesson:medicine');
  s = await click(s, 'journey-node:medicine-diagnosis');
  s = await click(s, 'journey-wait');
  s = await click(s, 'journey-lesson:medicine');
  s = await click(s, 'journey-node:medicine-bandage');
  s.player.injury = '轻伤';
  s = await click(s, 'journey-bandage');
  assert.equal(s.dayOne.bleedingGraceMinutes, 240);
  const health = s.player.health;
  s = advanceGameTime(s, 240);
  assert.equal(s.player.health, health); assert.equal(s.dayOne.bleedingGraceMinutes, 0);
  s.player.money = 0;
  const evidence = [...s.campaign.evidence], medical = [...s.playerKnownFactIds];
  s = await click(s, 'journey-care');
  assert.ok(s.campaign.debt >= 4); assert.equal(s.player.injury, '无');
  assert.deepEqual(s.campaign.evidence, evidence); assert.deepEqual(s.playerKnownFactIds, medical);
});

void test('L13 最迟第六十日结束，未选终局不会拖到第六十一日或冻结成死档', async () => {
  let s = await beginning('missed');
  s = await click(s, 'journey-care');
  let steps = 0;
  while (!s.campaign.ending) { s = await click(s, 'journey-wait'); assert.ok(++steps < 30); }
  assert.equal(campaignDay(s), 60);
  assert.equal(s.campaign.ending, 'retired');
  assert.deepEqual(getAvailableActions(s, s.selectedNpcId), []);
});
