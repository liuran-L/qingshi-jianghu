import assert from 'node:assert/strict';
import { createInitialGame, advanceGameTime, movePlayer } from '../../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex } from '../../lib/game/flow-controller.ts';
import { getAvailableActions } from '../../lib/game/limited-actions.ts';
import { decodeSave, encodeSave } from '../../lib/game/storage.ts';
import { mockAIService } from '../../lib/ai/mock-service.ts';
import { prepareService } from './confirmed-service.ts';
import { campaignDay, dayAt, routeQualification, lifeSummary } from '../../lib/game/campaign.ts';
import { storyEvents } from '../../lib/game/campaign-content.ts';
import type { GameState, LimitedActionId } from '../../lib/game/types.ts';
import type { LifeRoute } from '../../lib/game/campaign-types.ts';

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

export { beginning, click, available, fullLife, plan };
