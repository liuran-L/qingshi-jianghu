import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialGame, advanceGameTime, movePlayer, selectNpc } from '../lib/game/engine.ts';
import { createActionRunner, latestDialogueIndex, previewTravel } from '../lib/game/flow-controller.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { dayOneTopicIds } from '../lib/game/day-one.ts';
import { recordNpcStatement } from '../lib/game/npc-memory.ts';
import { decodeSave, encodeSave } from '../lib/game/storage.ts';
import { mockAIService } from '../lib/ai/mock-service.ts';
import type { GameState, LimitedActionId } from '../lib/game/types.ts';
import { CARGO_DEPARTURE } from '../lib/game/prologue.ts';

const available = (s: GameState, id: LimitedActionId) => getAvailableActions(s, s.selectedNpcId).some(a => a.id === id);
async function click(s: GameState, id: LimitedActionId): Promise<GameState> {
  assert.ok(available(s, id), `${s.locationId}/${s.selectedNpcId}缺少${id}`);
  const before = encodeSave(s);
  const result = await createActionRunner(mockAIService)(s, latestDialogueIndex(s), id, s.selectedNpcId);
  assert.ok(result, id);
  assert.equal(encodeSave(s), before, '不得原地改写');
  assert.deepEqual(decodeSave(encodeSave(result.state)), result.state, `${id}存读一致`);
  assert.ok(result.dialogueIndex <= latestDialogueIndex(result.state));
  return result.state;
}
async function steps(s: GameState, ids: LimitedActionId[]) { for (const id of ids) s = await click(s, id); return s; }
async function enter(place: 'inn' | 'clinic', npc?: string) {
  let s = await steps(createInitialGame('江客'), ['inspect-wound', 'inspect-bag', 'observe-gate', 'tell-attack', 'request-entry', 'ask-clinic', 'ask-lodging']);
  s = movePlayer(s, place);
  return npc ? selectNpc(s, npc) : s;
}
async function detained() { return steps(createInitialGame('复核客'), ['inspect-bag', 'tell-attack', 'mention-ding17', 'challenge-search', 'request-entry', 'submit-search']); }

void test('F01 失忆与混乱籍贯不假判；退开等待重入保留盘问阶段', async () => {
  for (const id of ['tell-amnesia', 'tell-confused-origin'] as const) {
    let s = await steps(createInitialGame('江客'), ['open-dayone', id]);
    assert.equal(s.gatePhase, 'explaining');
    assert.ok(s.npcStates['ma-sandao'].memory.statements.every(v => !v.contradicts.length));
    s = await steps(s, ['open-dayone', 'step-aside', 'wait-at-gate', 'reapproach-gate']);
    assert.equal(s.gatePhase, 'explaining');
    assert.ok(!available(s, 'wait-at-gate'));
    s = await click(s, 'request-entry');
    assert.ok(s.gateAccess);
  }
  let s = createInitialGame('未知');
  s = recordNpcStatement(s, 'ma-sandao', { id: 'a', subject: 'origin', value: 'unknown', text: '记不起', truth: 'unknown' });
  s = recordNpcStatement(s, 'ma-sandao', { id: 'b', subject: 'origin', value: 'east', text: '想起来自东边', truth: 'unknown' });
  assert.deepEqual(s.npcStates['ma-sandao'].memory.statements[1].contradicts, []);
});

void test('F02 拘押→抄录口供→否认遇袭→真实矛盾→更正→原物返还，可继续入城', async () => {
  let s = await detained();
  s = await click(s, 'request-review');
  assert.equal(s.selectedNpcId, 'ning-buping');
  assert.strictEqual(selectNpc(s, 'ma-sandao'), s);
  assert.equal(previewTravel(s, 'inn'), null);
  s = await click(s, 'review-deny');
  assert.equal(s.dayOne.review, 'disputed');
  assert.equal(s.npcStates['ning-buping'].trust, -2);
  assert.ok(!available(s, 'review-release'));
  s = await steps(s, ['review-correct', 'review-release']);
  assert.equal(s.evidenceCustody.fragment, 'player');
  assert.ok(s.dayOne.returnReceipt);
  assert.ok(s.npcStates['ma-sandao'].searchedPlayer);
  assert.equal(s.npcStates['ning-buping'].trust, -2);
  s = await click(s, 'ask-clinic');
  assert.equal(movePlayer(s, 'clinic').locationId, 'clinic');
});

void test('F03 真名、假名、拒登独立；假名仅主动告知另一口供后被掌柜识别', async () => {
  const base = await enter('inn');
  let alias = await steps(base, ['open-dayone', 'register-alias']);
  assert.ok(alias.dayOne.registrationDiscrepancy);
  assert.equal(alias.npcStates['su-wantang'].trust, 0);
  alias = await click(alias, 'rest-night');
  assert.equal(alias.lodgingRecords[0].registeredName, '周行');
  alias = await steps(alias, ['open-dayone', 'share-gate-statement']);
  assert.equal(alias.npcStates['su-wantang'].trust, -1);
  assert.ok(alias.npcStates['su-wantang'].memory.statements.at(-1)!.contradicts.length);
  assert.deepEqual(alias.npcStates['ma-sandao'], base.npcStates['ma-sandao']);
  let refused = await steps(base, ['open-dayone', 'register-refuse']);
  assert.ok(!available(refused, 'rest-night'));
  refused = await steps(refused, ['open-dayone', 'reconsider-registration', 'register-true', 'rest-night']);
  assert.equal(refused.lodgingRecords[0].registeredName, '江客');
});

void test('F04 陆观澜仅依据当场姿势识假；指点不加属性，转述不变亲见证物', async () => {
  let s = await enter('inn', 'lu-guanlan');
  const abilities = s.player.abilities;
  s = await click(s, 'open-dayone');
  assert.ok(!available(s, 'lu-test-lie'));
  s = await steps(s, ['lu-cart', 'lu-stance', 'lu-test-lie']);
  assert.ok(s.dayOne.guidanceSeed);
  assert.deepEqual(s.player.abilities, abilities);
  assert.equal(s.npcStates['lu-guanlan'].trust, -2);
  assert.equal(s.npcStates['lu-guanlan'].memory.statements.at(-1)!.truth, 'false');
  assert.ok(!s.npcStates['lu-guanlan'].memory.evidence.includes('cart-mark'));
  assert.equal(s.npcStates['su-wantang'].trust, 0);
});

void test('F05 假伤情须验伤才识破；拒答不算撒谎；自留布条须交回才获化验结论', async () => {
  for (const account of ['medical-truth', 'medical-lie', 'medical-refuse'] as const) {
    let s = await steps(await enter('clinic'), ['open-dayone', account, 'consent-exam', 'keep-cloth']);
    assert.equal(s.npcStates['shen-yanqiu'].trust, 0);
    s = await click(s, 'request-treatment');
    assert.equal(s.npcStates['shen-yanqiu'].trust, account === 'medical-lie' ? -2 : 0);
    assert.ok(s.inventoryItemIds.includes('blood-cloth'));
    assert.ok(!s.playerKnownFactIds.includes('doctor-wound-residue'));
    s = await steps(s, ['open-dayone', 'return-cloth']);
    assert.ok(s.playerKnownFactIds.includes('doctor-wound-residue'));
    assert.ok(!s.inventoryItemIds.includes('blood-cloth'));
  }
});

void test('F06 只止血付三两，无气血/功法收益；180分钟暂缓后恢复失血，不能刷', async () => {
  let s = await steps(await enter('clinic'), ['open-dayone', 'medical-refuse', 'consent-basic']);
  const hp = s.player.health, money = s.player.money;
  s = await click(s, 'pay-basic');
  assert.equal(s.player.money, money - 3);
  assert.equal(s.player.health, hp);
  assert.notEqual(s.player.injury, '无');
  const wound = s.player.woundUntreatedMinutes;
  s = advanceGameTime(s, 180);
  assert.equal(s.player.woundUntreatedMinutes, wound);
  s = advanceGameTime(s, 10);
  assert.equal(s.player.woundUntreatedMinutes, wound + 10);
  s = await click(s, 'open-dayone');
  assert.ok(!available(s, 'pay-basic'));
  s = await steps(s, ['reopen-exam', 'retain-cloth', 'request-treatment']);
  assert.equal(s.player.injury, '无');
});

void test('F07 保密锁住报案病案，另行授权恢复；拒检后可合法重开，不强制留样', async () => {
  let s = await steps(await enter('clinic'), ['open-dayone', 'medical-refuse', 'refuse-exam']);
  assert.ok(!available(s, 'request-treatment'));
  s = await steps(s, ['open-dayone', 'reopen-exam', 'retain-cloth', 'open-dayone', 'request-privacy', 'close-dayone', 'request-treatment']);
  s = advanceGameTime(s, 720);
  s = await steps(s, ['ask-corpse', 'compare-corpse-wound']);
  assert.ok(!available(s, 'request-medical-report'));
  s = await steps(s, ['open-dayone', 'authorize-report', 'close-dayone', 'request-medical-report']);
  assert.ok(s.dayOne.privateCare && s.dayOne.reportAuthorized);
  assert.equal(s.evidenceCustody.medical, 'player');
});

void test('F08 v5/v6 旧档、部分字段损坏与非法返还时间均拒绝', () => {
  for (const file of ['v5-game.json', 'v6-before-dayone.json']) {
    assert.equal(decodeSave(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')), null);
  }
  const s = createInitialGame('坏档');
  assert.equal(decodeSave(JSON.stringify({ ...s, dayOne: { schema: 1 } })), null);
  assert.equal(decodeSave(JSON.stringify({ ...s, dayOne: { ...s.dayOne, returnReceipt: { from: 'ma', to: 'player', atMinutes: s.worldMinutes + 1 } } })), null);
});

void test('F09 新分支矩阵：首次、重复锁、NPC记忆、存读、死亡及拘押非法动作', async (t) => {
  const matrix: [GameState, LimitedActionId][] = [];
  const add = (s: GameState, ids: LimitedActionId[]) => ids.forEach(id => matrix.push([s, id]));
  const gate = await click(createInitialGame('矩阵客'), 'open-dayone');
  add(gate, ['tell-amnesia', 'tell-confused-origin', 'step-aside']);
  add(await click(gate, 'step-aside'), ['wait-at-gate']);
  add(await steps(createInitialGame('矩阵客'), ['inspect-wound', 'observe-gate', 'open-dayone']), ['ask-exempt-cart']);
  const captive = await detained(); add(captive, ['request-review']);
  const review = await click(captive, 'request-review'); add(review, ['review-confirm', 'review-deny']);
  add(await click(review, 'review-deny'), ['review-correct']);
  add(await click(review, 'review-confirm'), ['review-release']);
  const inn = await click(await enter('inn'), 'open-dayone');
  add(inn, ['register-true', 'register-alias', 'register-refuse', 'ask-companion', 'show-fragment']);
  add(await steps(inn, ['register-refuse', 'open-dayone']), ['reconsider-registration']);
  add(await steps(inn, ['register-alias', 'open-dayone']), ['share-gate-statement']);
  const lu = await click(await enter('inn', 'lu-guanlan'), 'open-dayone');
  add(lu, ['ask-companion', 'lu-cart', 'lu-stance', 'listen-guests']);
  add(await click(lu, 'lu-stance'), ['lu-test-lie']);
  const clinic = await click(await enter('clinic'), 'open-dayone');
  add(clinic, ['medical-truth', 'medical-lie', 'medical-refuse', 'medical-fee', 'medical-leave']);
  const interview = await click(clinic, 'medical-truth');
  add(interview, ['consent-exam', 'consent-basic', 'refuse-exam']);
  add(await click(interview, 'consent-exam'), ['retain-cloth', 'keep-cloth']);
  const basic = await click(interview, 'consent-basic');
  add(basic, ['pay-basic', 'reopen-exam', 'request-privacy', 'request-medical-debt']);
  add(await steps(interview, ['consent-exam', 'keep-cloth', 'request-treatment', 'open-dayone']), ['return-cloth']);
  let report = await steps(interview, ['consent-exam', 'retain-cloth', 'request-treatment']);
  report = await steps(advanceGameTime(report, 720), ['ask-corpse', 'compare-corpse-wound', 'open-dayone', 'request-privacy']);
  add(report, ['authorize-report']);
  assert.deepEqual([...new Set(matrix.map(([, id]) => id))].sort(), [...dayOneTopicIds].sort());
  for (const [s, id] of matrix) {
    const next = await click(s, id);
    assert.ok(next.npcStates[s.selectedNpcId!].memory.topics[id], `${id}有后果记忆`);
    assert.ok(!available(next, id), `${id}重复锁`);
    const dead: GameState = { ...s, player: { ...s.player, health: 0, alive: false, deathCause: '测试死亡' } };
    assert.equal(await createActionRunner(mockAIService)(dead, latestDialogueIndex(dead), id, dead.selectedNpcId), null, `${id}死亡禁止`);
    if (!id.startsWith('review-') && id !== 'request-review') {
      const blocked: GameState = { ...s, gatePhase: 'detained' };
      assert.equal(await createActionRunner(mockAIService)(blocked, latestDialogueIndex(blocked), id, blocked.selectedNpcId), null, `${id}拘押禁止`);
    }
  }
  t.diagnostic(`${matrix.length}组首次分支；覆盖${dayOneTopicIds.length}个新增话题。复核是拘押的合法例外。`);
});

void test('F10 复核或止血中死亡不返还、不复活、不授予暂缓；无钱赊诊不免费治疗', async () => {
  let s = await steps(await detained(), ['request-review', 'review-confirm']);
  s = { ...s, player: { ...s.player, health: 1, woundUntreatedMinutes: 359 } };
  const dead = await click(s, 'review-release');
  assert.equal(dead.player.alive, false);
  assert.equal(dead.evidenceCustody.fragment, 'ma');
  assert.equal(dead.dayOne.returnReceipt, null);
  assert.equal(dead.gatePhase, 'detained');
  let clinic = await steps(await enter('clinic'), ['open-dayone', 'medical-truth', 'consent-basic']);
  clinic = { ...clinic, player: { ...clinic.player, health: 1, woundUntreatedMinutes: 359 } };
  const lost = await click(clinic, 'pay-basic');
  assert.equal(lost.player.alive, false);
  assert.equal(lost.dayOne.bleedingGraceMinutes, 0);
  assert.equal(lost.player.money, clinic.player.money - 3);
  const poor = { ...clinic, player: { ...clinic.player, health: 78, woundUntreatedMinutes: 0, money: 0 } };
  assert.ok(!available(poor, 'pay-basic'));
  const refused = await click(poor, 'request-medical-debt');
  assert.equal(refused.player.money, 0);
  assert.notEqual(refused.player.injury, '无');
  assert.equal(refused.npcStates['shen-yanqiu'].favor, 0);
});

void test('F11 新分支组合→读档→保密病案授权→第三日既有封存结局；货车截止不变', async (t) => {
  let s = await steps(createInitialGame('江客'), ['inspect-wound', 'inspect-bag', 'observe-gate']);
  s = await steps(s, ['open-dayone', 'tell-amnesia', 'request-entry', 'ask-clinic', 'ask-lodging']);
  s = movePlayer(s, 'inn');
  s = await steps(s, ['open-dayone', 'register-alias', 'open-dayone', 'ask-companion', 'show-fragment', 'close-dayone']);
  s = selectNpc(s, 'lu-guanlan');
  s = await steps(s, ['open-dayone', 'lu-cart', 'lu-stance', 'lu-test-lie', 'close-dayone']);
  s = movePlayer(s, 'clinic');
  s = await steps(s, ['open-dayone', 'medical-lie', 'consent-exam', 'keep-cloth', 'request-treatment', 'open-dayone', 'request-privacy', 'return-cloth']);
  s = movePlayer(s, 'inn'); s = await click(s, 'rest-night');
  s = decodeSave(encodeSave(s))!;
  assert.equal(s.lodgingRecords[0].registeredName, '周行');
  s = movePlayer(s, 'clinic');
  s = await steps(s, ['ask-corpse', 'compare-corpse-wound', 'identify-memory', 'open-dayone', 'authorize-report', 'close-dayone', 'request-medical-report', 'ask-ning-referral']);
  s = movePlayer(s, 'yamen'); s = await click(s, 'report-salt-case');
  let count = 0;
  while (s.day3CargoStatus === 'pending') { s = await click(s, 'await-cargo'); assert.ok(++count < 5); }
  s = await steps(s, ['inspect-cargo', 'check-release-ledger', 'seal-salt-evidence']);
  assert.equal(s.prologueEnding, 'sealed-salt');
  assert.ok(s.worldMinutes < s.storyStartedAtMinutes + CARGO_DEPARTURE);
  assert.equal(s.dayOne.privateCare, true);
  assert.equal(s.npcStates['lu-guanlan'].trust, -2);
  assert.equal(s.npcStates['shen-yanqiu'].trust, -2);
  t.diagnostic('组合包含化名、同行调查、展示、假话、指点、自留布条、归还、保密、跨日、读档和病案再授权。');
});

void test('F12 搜查未扣物也能复核；无中生有的返还物与等待洗口供均被阻止', async () => {
  let s = await steps(createInitialGame('核对客'), ['tell-pass-lost', 'mention-ding17', 'challenge-search', 'request-entry', 'submit-search', 'open-dayone', 'request-review']);
  s = await steps(s, ['review-confirm', 'review-release']);
  assert.ok(s.gateAccess);
  assert.equal(s.dayOne.returnReceipt, null);
  assert.ok(!s.inventoryItemIds.includes('ding17-fragment'));
  assert.ok(s.npcStates['ma-sandao'].suspicion >= 4);
});

void test('F13 菜单切换不伪造对白或时间，未观察货车不能追问，损坏新状态不能冒充旧档', async () => {
  const start = createInitialGame('菜单客');
  let s = await click(start, 'open-dayone');
  assert.equal(s.worldMinutes, start.worldMinutes);
  assert.deepEqual(s.dialogue, start.dialogue);
  assert.ok(!available(s, 'ask-exempt-cart'));
  s = await click(s, 'tell-amnesia');
  const raw = JSON.parse(encodeSave(s));
  delete raw.dayOne;
  assert.equal(decodeSave(JSON.stringify(raw)), null);
  s = await steps(s, ['open-dayone', 'close-dayone']);
  assert.equal(s.dayOne.menu, false);
});
