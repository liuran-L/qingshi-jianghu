import { initialBattles } from './battle.ts';
import { initialArts } from './arts-content.ts';
import { resolveInteraction } from './interaction-rules.ts';
import { initialCampaign, settleCampaign, applyCampaignAction, gameEnded, campaignActive, campaignDeadline, observeCampaignAftermath } from './campaign.ts';
import { initialDayOne, applyDayOne, presentNpcIds } from './day-one.ts';
import { initialDayTwo, applyDayTwo } from './day-two.ts';
import { initialEconomy, applyEconomy } from './economy.ts';
import { initialGrowth, applyGrowth, hasGrowthNode } from './growth.ts';
import { emptyNpcMemory, rememberNpcInteraction } from './npc-memory.ts';
import { initialPrologue, advanceCargo, applyPrologue } from './prologue.ts';
import { clues, getClue, getInventoryItem, getKnownFact, getLocation, getNpc, inventoryItems, knownFacts, locations, npcs, worldEvents } from './world.ts';
import type {
  AIInteractionProposal,
  DialogueLine,
  EventLogEntry,
  GameState,
  InteractionRequest,
  InteractionView,
  KnownFactId,
  LocationId,
  NpcKnowledge,
  NpcRuntimeState,
  TravelEstimate,
  WorldEventId,
} from './types.ts';

let sequence = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${sequence++}`;
const log = (state: GameState, type: EventLogEntry['type'], text: string): EventLogEntry => ({ id: makeId('log'), atMinutes: state.worldMinutes, type, text });
const line = (speaker: string, text: string, kind: DialogueLine['kind']): DialogueLine => ({ id: makeId('line'), speaker, text, kind });
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const createKnowledge = (): Record<string, NpcKnowledge> => Object.fromEntries(
  npcs.map((npc) => [npc.id, { observed: false, matched: false, knownName: null, knownIdentity: null, learnedFacts: [] }]),
);

const createNpcStates = (): Record<string, NpcRuntimeState> => Object.fromEntries(
  npcs.map((npc) => [npc.id, { trust: 0, favor: 0, memory: emptyNpcMemory(), attitude: 0, suspicion: 0, hostility: 0, informedRiverGang: false, searchedPlayer: false, detainedPlayer: false, claimBeliefs: {} }]),
);

export function createInitialGame(name: string): GameState {
  const playerName = name.trim().slice(0, 12) || '无名客';
  const npcKnowledge = createKnowledge();
  npcKnowledge['ma-sandao'].observed = true;
  const firstNpc = getNpc('ma-sandao');
  const storyStartedAtMinutes = 3 * 24 * 60 + 17 * 60;
  return {
    version: 6,
    dayOne: initialDayOne(),
    dayTwo: initialDayTwo(),
    economy: initialEconomy(),
    growth: initialGrowth(),
    campaign: initialCampaign(),
    arts: initialArts(),
    battles: initialBattles(),
    ...initialPrologue(),
    started: true,
    player: {
      name: playerName,
      abilities: { martial: 2, agility: 3, insight: 3, eloquence: 2, vigilance: 3, medicine: 1 },
      health: 78,
      maxHealth: 100,
      qi: 30,
      maxQi: 30,
      injury: '轻伤',
      poison: '未确认',
      fatigue: 65,
      maxFatigue: 100,
      woundUntreatedMinutes: 0,
      hasRoadPass: false,
      money: 20,
      reputation: 0,
      chivalry: 0,
      infamy: 0,
      alive: true,
      deathCause: null,
    },
    locationId: 'gate',
    worldMinutes: storyStartedAtMinutes,
    selectedNpcId: firstNpc.id,
    knownLocationIds: ['gate'],
    npcKnowledge,
    npcStates: createNpcStates(),
    playerKnownFactIds: [],
    playerClaims: [],
    lodgingRecords: [],
    conversationTurns: {},
    storyStartedAtMinutes,
    gatePhase: 'questioning',
    gateAccess: false,
    knownClueIds: ['attack-phrase'],
    inventoryItemIds: [],
    triggeredWorldEventIds: ['roadside-ambush'],
    knownWorldEventIds: ['roadside-ambush'],
    worldEventOutcomes: { 'roadside-ambush': '账房失踪，主角负伤抵达城门。' },
    dialogue: [
      line('旁白', '雨水冲淡了荒道上的血。你醒来时，同行者已经失散，路引和部分财物不知所踪。左肋的伤口仍在渗血。', 'narration'),
      line('旁白', '昏沉中，你只记得袭击者反复喊着一句：“找丁字十七。”暮鼓将响，青石县是天黑前唯一能赶到的避处。', 'narration'),
      line('旁白', '你拖着湿透的行囊来到城门，雨云正压过斑驳城楼。', 'narration'),
      line('旁白', firstNpc.observation, 'narration'),
      line(firstNpc.observedLabel, '“站住。路引拿出来。哪里人，来青石县做什么？”', 'npc'),
    ],
    logs: [{ id: makeId('log'), atMinutes: storyStartedAtMinutes, type: 'system', text: `${playerName}带伤抵达青石县城门。` }],
  };
}

const eventOutcome = (id: WorldEventId): string => {
  if (id === 'nameless-corpse') return '无名尸被送往回春堂，消息尚未完全传开。';
  return '外头已有动静，详情尚未传到你耳中。';
};

export function applyScheduledWorldEvents(state: GameState): GameState {
  const elapsedMinutes = state.worldMinutes - state.storyStartedAtMinutes;
  const newlyTriggered = worldEvents.filter((event) => event.offsetMinutes <= elapsedMinutes && !state.triggeredWorldEventIds.includes(event.id));
  const worldEventOutcomes = { ...state.worldEventOutcomes };
  for (const event of newlyTriggered) worldEventOutcomes[event.id] = eventOutcome(event.id);
  let next: GameState = newlyTriggered.length
    ? { ...state, triggeredWorldEventIds: [...state.triggeredWorldEventIds, ...newlyTriggered.map((event) => event.id)], worldEventOutcomes }
    : state;
  const firstNightPassed = elapsedMinutes >= 12 * 60;
  const hookAlreadyGiven = next.playerKnownFactIds.includes('day-end-watch-rumor') || next.playerKnownFactIds.includes('next-morning-moving-lead');
  if (firstNightPassed && next.player.alive && !campaignActive(next) && !hookAlreadyGiven) {
    const activeSources: KnownFactId[] = ['baggage-watch-mark', 'inn-arrival-inquiry', 'ma-ding17-reaction'];
    const followedActiveSource = activeSources.some((id) => next.playerKnownFactIds.includes(id));
    const fact: KnownFactId = followedActiveSource ? 'next-morning-moving-lead' : 'day-end-watch-rumor';
    const text = followedActiveSource
      ? '黎明换班时，你想起那几处异样：有人早早打听过你的模样和行囊，如今又在换船、换人、换落脚处。天亮以后再追，眼前的人与船便不是昨日那一拨了。'
      : '黎明换班时，一名脚夫低声告诉你：昨夜有人打听今日进城的带伤外乡客，问话的人明早要去码头改搭别船。天一亮，人和船都要换。';
    next = {
      ...next,
      playerKnownFactIds: [...next.playerKnownFactIds, fact],
      dialogue: [...next.dialogue, line('旁白', text, 'narration')],
      logs: [...next.logs, log(next, 'discovery', `记下消息：${getKnownFact(fact).text}`)],
    };
  }
  if (elapsedMinutes >= 36 * 60 && next.player.alive && !campaignActive(next) && !next.playerKnownFactIds.includes('day2-public-notice')) {
    next = {
      ...next,
      playerKnownFactIds: [...next.playerKnownFactIds, 'day2-public-notice'],
      dialogue: [...next.dialogue, line('旁白', '第二日将尽，县衙在城门与渡口贴出加验告示：近日盐路交接须复核船号、路引与经手签押。告示落着官印，没有点任何人的姓名。', 'narration')],
      logs: [...next.logs, log(next, 'discovery', `记下告示：${getKnownFact('day2-public-notice').text}`)],
    };
  }
  const publicConflictFacts: KnownFactId[] = ['public-yamen-role', 'public-river-gang-role', 'public-qingyue-role', 'act-one-surface-conflict', 'act-one-involvement'];
  const missingPublicFacts = publicConflictFacts.filter(id => !next.playerKnownFactIds.includes(id));
  if (elapsedMinutes >= 40 * 60 && next.player.alive && !campaignActive(next) && missingPublicFacts.length) {
    next = {
      ...next,
      playerKnownFactIds: [...next.playerKnownFactIds, ...missingPublicFacts],
      dialogue: [...next.dialogue, line('旁白', '第三日上午，县衙差役守着官盐验印，漕帮工头在码头按船旗点卯，几名青岳门弟子则带着名帖进城寻同门。荒道上的“丁字十七”、行囊内侧的新划痕和今日靠岸的同号盐船，把你的来路牵进了三方眼前。至于谁在暗处动手，眼下无人肯拿姓名担保。', 'narration')],
      logs: [...next.logs, ...missingPublicFacts.map(id => log(next, 'discovery', `记下见闻：${getKnownFact(id).text}`))],
    };
  }
  return next;
}

export function advanceGameTime(state: GameState, requestedMinutes: number): GameState {
  if (!state.player.alive || gameEnded(state) || !Number.isFinite(requestedMinutes) || requestedMinutes <= 0) return state;
  let minutes = clamp(Math.round(requestedMinutes), 1, 12 * 60);
  if (campaignActive(state)) {
    minutes = Math.min(minutes, Math.max(0, campaignDeadline(state) - state.worldMinutes));
    if (!minutes) return settleCampaign(state);
  }
  const wasInjured = state.player.injury !== '无';
  // 不将世界推进到角色死亡之后，也不结算死亡后的恢复收益。
  if (wasInjured) {
    const fatalAt = (Math.floor(state.player.woundUntreatedMinutes / 360) + Math.ceil(state.player.health / 2)) * 360;
    minutes = Math.min(minutes, fatalAt - state.player.woundUntreatedMinutes + state.dayOne.bleedingGraceMinutes);
  }
  const woundUntreatedMinutes = wasInjured ? state.player.woundUntreatedMinutes + Math.max(0, minutes - state.dayOne.bleedingGraceMinutes) : 0;
  const oldSteps = Math.floor(state.player.woundUntreatedMinutes / 360);
  const newSteps = Math.floor(woundUntreatedMinutes / 360);
  const healthLoss = wasInjured ? Math.max(0, newSteps - oldSteps) * 2 : 0;
  const health = clamp(state.player.health - healthLoss, 0, state.player.maxHealth);
  const fatigue = clamp(state.player.fatigue + Math.ceil(minutes / 30), 0, state.player.maxFatigue);
  const alive = health > 0;
  const next = advanceCargo(applyScheduledWorldEvents({
    ...state,
    worldMinutes: state.worldMinutes + minutes,
    dayOne: { ...state.dayOne, bleedingGraceMinutes: Math.max(0, state.dayOne.bleedingGraceMinutes - minutes) },
    player: {
      ...state.player,
      health,
      fatigue,
      woundUntreatedMinutes,
      injury: wasInjured && health > 0 && health <= 45 ? '重伤' : state.player.injury,
      alive,
      deathCause: alive ? state.player.deathCause : '伤势长期未得到处理，气血耗尽。',
    },
  }));
  if (!alive) return settleCampaign({ ...next, dialogue: [...state.dialogue, line('旁白', '伤口的失血终于耗尽了你的气力。意识沉入黑暗，你未能撑过这一段时间。', 'narration')], logs: [...state.logs, log(next, 'danger', next.player.deathCause!)] });
  return settleCampaign(observeLocalWorldEvent(next));
}

/** 现场目击只发生一次；隐藏事件不能仅凭按钮名称泄露。 */
function observeLocalWorldEvent(state: GameState): GameState {
  if (state.locationId !== 'clinic' || !state.triggeredWorldEventIds.includes('nameless-corpse') || state.knownWorldEventIds.includes('nameless-corpse')) return state;
  return { ...state, knownWorldEventIds: [...state.knownWorldEventIds, 'nameless-corpse'], dialogue: [...state.dialogue,
    line('旁白', '后堂门帘掀开，伙计把一副沾着河泥的担架抬了进去。白布下露出一只发青的手。', 'narration')],
    logs: [...state.logs, log(state, 'discovery', '你在医馆看见一副沾着河泥的担架被抬入后堂。')] };
}

export function getNpcDisplayName(state: GameState, npcId: string): string {
  const npc = getNpc(npcId);
  const knowledge = state.npcKnowledge[npcId];
  return knowledge?.matched && knowledge.knownName ? knowledge.knownName : npc.observedLabel;
}

export function getNpcVisibleIdentity(state: GameState, npcId: string): string | null {
  const knowledge = state.npcKnowledge[npcId];
  return knowledge?.matched ? knowledge.knownIdentity : null;
}

export function createInteractionView(state: GameState, npcId: string | null): InteractionView {
  const npc = npcId ? getNpc(npcId) : null;
  const sceneSignals: string[] = [];
  if (state.triggeredWorldEventIds.includes('nameless-corpse') && (state.locationId === 'inn' || state.locationId === 'clinic')) sceneSignals.push('nameless-corpse-spread');
  if (state.locationId === 'clinic' && state.triggeredWorldEventIds.includes('nameless-corpse')) sceneSignals.push('corpse-at-clinic');
  return {
    locationId: state.locationId,
    worldMinutes: state.worldMinutes,
    npc,
    npcDisplayName: npcId ? getNpcDisplayName(state, npcId) : null,
    conversationTurns: npcId ? (state.conversationTurns[npcId] ?? 0) : 0,
    player: { injury: state.player.injury, fatigue: state.player.fatigue, money: state.player.money, hasRoadPass: state.player.hasRoadPass },
    knownFactIds: [...state.playerKnownFactIds],
    knownClueIds: [...state.knownClueIds],
    inventoryItemIds: [...state.inventoryItemIds],
    sceneSignals,
  };
}

export function discoverPresentNpcs(state: GameState): GameState {
  const presentIds = presentNpcIds(state);
  const npcKnowledge = { ...state.npcKnowledge };
  let changed = false;
  for (const npcId of presentIds) {
    if (!npcKnowledge[npcId]?.observed) {
      npcKnowledge[npcId] = { ...npcKnowledge[npcId], observed: true };
      changed = true;
    }
  }
  return changed ? { ...state, npcKnowledge } : state;
}

const baseTravelMinutes: Record<LocationId, Record<LocationId, number>> = {
  gate: { gate: 0, inn: 20, yamen: 30, dock: 45, temple: 55, clinic: 25 },
  inn: { gate: 20, inn: 0, yamen: 15, dock: 30, temple: 50, clinic: 15 },
  yamen: { gate: 30, inn: 15, yamen: 0, dock: 35, temple: 55, clinic: 20 },
  dock: { gate: 45, inn: 30, yamen: 35, dock: 0, temple: 60, clinic: 35 },
  temple: { gate: 55, inn: 50, yamen: 55, dock: 60, temple: 0, clinic: 45 },
  clinic: { gate: 25, inn: 15, yamen: 20, dock: 35, temple: 45, clinic: 0 },
};

export function estimateTravel(state: GameState, destinationId: LocationId): TravelEstimate {
  const baseMinutes = baseTravelMinutes[state.locationId][destinationId];
  const weatherMinutes = /雨|风|云/.test(getLocation(state.locationId).weather) && baseMinutes > 0 ? 5 : 0;
  const injuryMinutes = state.player.injury === '重伤' ? 15 : state.player.injury === '轻伤' ? 5 : 0;
  const rawFatiguePenalty = state.player.fatigue >= 85 ? 2 : state.player.fatigue >= 65 ? 1 : 0;
  const fatiguePenalty = hasGrowthNode(state, 'step-breath') ? Math.max(0, rawFatiguePenalty - 1) : rawFatiguePenalty;
  const effectiveAgility = Math.max(0, state.player.abilities.agility - fatiguePenalty);
  const agilityMinutes = baseMinutes > 0 ? -Math.min(5, Math.max(0, effectiveAgility - 2) * 2) - (baseMinutes > 0 && hasGrowthNode(state, 'step-foundation') ? 2 : 0) : 0;
  return { originId: state.locationId, destinationId, baseMinutes, weatherMinutes, injuryMinutes, agilityMinutes, totalMinutes: Math.max(1, baseMinutes + weatherMinutes + injuryMinutes + agilityMinutes) };
}

export function movePlayer(state: GameState, destination: LocationId): GameState {
  if (['questioning', 'answered', 'disputed'].includes(state.dayOne.review)) return state;
  if (!state.player.alive || gameEnded(state) || state.campaign?.finale || state.gatePhase === 'detained' || state.locationId === destination || !state.knownLocationIds.includes(destination)) return state;
  if (state.locationId === 'gate' && destination !== 'gate' && !state.gateAccess) return state;
  const target = getLocation(destination);
  if (!target) return state;
  const estimate = estimateTravel(state, destination);
  const advanced = advanceGameTime(state, estimate.totalMinutes);
  if (!advanced.player.alive || gameEnded(advanced)) return advanced;
  const next = discoverPresentNpcs({ ...advanced, dayOne: { ...advanced.dayOne, menu: false, gatePosition: 'line' }, dayTwo: { ...advanced.dayTwo, menu: false }, growth: { ...advanced.growth, menu: false }, locationId: destination, selectedNpcId: destination === 'yamen' ? 'ning-buping' : destination === 'dock' && (advanced.dayTwo.departurePlan === 'night-ferry' || advanced.dayTwo.brokerContact === 'offered') ? null : target.npcIds[0] ?? null });
  const additions = [line('旁白', target.arrival, 'narration')];
  if (!campaignActive(state) && destination === 'clinic' && !state.npcKnowledge['shen-yanqiu'].observed) additions.push(line(getNpcDisplayName(next, 'shen-yanqiu'), '“什么兵器伤的，在哪里受伤？记不清也可直说。检查范围和布条归属，先由你决定。”', 'npc'));
  return observeCampaignAftermath(advanceCargo(observeLocalWorldEvent({ ...next, ...(campaignActive(next) ? { selectedNpcId: null, campaign: { ...next.campaign, activeEvent: null } } : {}), dialogue: [...advanced.dialogue, ...additions], logs: [...advanced.logs, log(next, 'move', `前往${target.name}，耗时${estimate.totalMinutes}分钟。`)] })));
}

/** 规则事务是唯一写入口；AIProposal 中不存在任何数值、物品、地点或知识字段。 */
export function applyInteractionResult(state: GameState, request: InteractionRequest, proposal: AIInteractionProposal): GameState {
  if (request.actionId.startsWith('journey-')) return request.npcId === state.selectedNpcId && request.mode === 'action' ? applyCampaignAction(state, request.actionId) : state;
  const resolution = resolveInteraction(state, request, proposal);
  if (!resolution) return state;
  const input = request.input.trim().slice(0, 500);
  const npcId = request.npcId;
  if (npcId && !presentNpcIds(state).includes(npcId)) return state;
  if (request.actionId === 'open-dayone' || request.actionId === 'close-dayone') return applyDayOne(state, state, request);
  if (request.actionId === 'open-daytwo' || request.actionId === 'close-daytwo') return applyDayTwo(state, request);
  const advanced = resolution.timeCostMinutes === 0 ? state : advanceGameTime(state, resolution.timeCostMinutes);
  if (!advanced.player.alive) {
    return { ...advanced, player: { ...advanced.player, money: state.player.money + Math.min(0, resolution.moneyDelta ?? 0) },
      dialogue: [...state.dialogue, line(state.player.name, input, 'player'), ...advanced.dialogue.slice(state.dialogue.length)],
      lodgingRecords: resolution.lodgingRecord ? [...state.lodgingRecords, { locationId: 'inn', registeredName: state.dayOne.registeredName ?? state.player.name, atMinutes: state.worldMinutes }] : state.lodgingRecords };
  }
  const speaker = npcId ? getNpcDisplayName(state, npcId) : '旁白';
  const additions: DialogueLine[] = [line(state.player.name, input, 'player')];
  if (resolution.dialogue && npcId) additions.push(line(speaker, resolution.dialogue, 'npc'));
  if (resolution.narration) additions.push(line('旁白', resolution.narration, 'narration'));

  const validLocationIds = new Set(locations.map((item) => item.id));
  const validFactIds = new Set(knownFacts.map((item) => item.id));
  const validClueIds = new Set(clues.map((item) => item.id));
  const validItemIds = new Set(inventoryItems.map((item) => item.id));
  const discoveredLocations = (resolution.discoveredLocationIds ?? []).filter((id) => validLocationIds.has(id));
  const discoveredFacts = (resolution.discoveredFactIds ?? []).filter((id) => validFactIds.has(id));
  const discoveredClues = (resolution.discoveredClueIds ?? []).filter((id) => validClueIds.has(id));
  const discoveredItems = (resolution.discoveredItemIds ?? []).filter((id) => validItemIds.has(id));
  const newLocations = discoveredLocations.filter((id) => !state.knownLocationIds.includes(id));
  const newFacts = discoveredFacts.filter((id) => !state.playerKnownFactIds.includes(id));
  const newClues = discoveredClues.filter((id) => !state.knownClueIds.includes(id));
  const newItems = discoveredItems.filter((id) => !state.inventoryItemIds.includes(id));

  const npcKnowledge = { ...state.npcKnowledge };
  if (npcId && resolution.npcLearnedFact) {
    npcKnowledge[npcId] = { ...npcKnowledge[npcId], learnedFacts: [...new Set([...npcKnowledge[npcId].learnedFacts, resolution.npcLearnedFact])] };
  }
  if (npcId && (resolution.learnedNpcName || resolution.learnedNpcIdentity)) {
    const previous = npcKnowledge[npcId];
    npcKnowledge[npcId] = { ...previous, observed: true, matched: true, knownName: resolution.learnedNpcName ?? previous.knownName, knownIdentity: resolution.learnedNpcIdentity ?? previous.knownIdentity };
  }
  const npcStates = { ...state.npcStates };
  if (npcId && resolution.npcStatePatch) npcStates[npcId] = { ...npcStates[npcId], ...resolution.npcStatePatch };
  const playerClaims = [...state.playerClaims];
  if (resolution.claim) {
    const { belief, ...claim } = resolution.claim;
    playerClaims.push({ ...claim, atMinutes: state.worldMinutes });
    npcStates[claim.toldNpcId] = { ...npcStates[claim.toldNpcId], claimBeliefs: { ...npcStates[claim.toldNpcId].claimBeliefs, [claim.id]: belief } };
  }
  const conversationTurns = npcId && resolution.dialogue ? { ...state.conversationTurns, [npcId]: (state.conversationTurns[npcId] ?? 0) + 1 } : state.conversationTurns;

  const health = clamp(advanced.player.health + (resolution.healthDelta ?? 0), 0, advanced.player.maxHealth);
  const injury = resolution.injuryAfter ?? advanced.player.injury;
  const alive = health > 0;
  const player = {
    ...advanced.player,
    health,
    fatigue: clamp(advanced.player.fatigue + (resolution.fatigueDelta ?? 0), 0, advanced.player.maxFatigue),
    money: advanced.player.money + (resolution.moneyDelta ?? 0),
    injury,
    poison: resolution.poisonAfter ?? advanced.player.poison,
    woundUntreatedMinutes: injury === '无' ? 0 : advanced.player.woundUntreatedMinutes,
    alive,
    deathCause: alive ? advanced.player.deathCause : (advanced.player.deathCause ?? '气血耗尽。'),
  };
  if (player.money < 0) return state;

  const knownWorldEventIds = [...new Set([...advanced.knownWorldEventIds, ...(resolution.knownWorldEventIds ?? [])])];
  let next: GameState = {
    ...advanced,
    player,
    dialogue: [...state.dialogue, ...additions, ...advanced.dialogue.slice(state.dialogue.length)],
    knownLocationIds: [...new Set([...state.knownLocationIds, ...newLocations])],
    playerKnownFactIds: [...new Set([...advanced.playerKnownFactIds, ...newFacts])],
    knownClueIds: [...new Set([...state.knownClueIds, ...newClues])],
    inventoryItemIds: [...new Set([...state.inventoryItemIds, ...newItems])].filter((id) => !resolution.removedItemIds?.includes(id)),
    knownWorldEventIds,
    npcKnowledge,
    npcStates,
    playerClaims,
    conversationTurns,
    gatePhase: resolution.gatePhase ?? advanced.gatePhase,
    gateAccess: resolution.gateAccess ?? advanced.gateAccess,
    lodgingRecords: resolution.lodgingRecord ? [...state.lodgingRecords, { locationId: 'inn', registeredName: state.dayOne.registeredName ?? state.player.name, atMinutes: advanced.worldMinutes }] : state.lodgingRecords,
  };
  const logs = [...advanced.logs, log(next, 'dialogue', npcId ? `与${speaker}产生交互。` : '尝试与场景互动。')];
  for (const id of newLocations) logs.push(log(next, 'discovery', `得知去处：${getLocation(id).name}。`));
  for (const id of newFacts as KnownFactId[]) logs.push(log(next, 'discovery', `记下见闻：${getKnownFact(id).text}`));
  for (const id of newClues) logs.push(log(next, 'discovery', `留意到：${getClue(id).title}。`));
  for (const id of newItems) logs.push(log(next, 'discovery', `收入行囊：${getInventoryItem(id).name}。`));
  if (resolution.dangerLog) logs.push(log(next, 'danger', resolution.dangerLog));
  next = rememberNpcInteraction(state, { ...next, logs }, request);
  next = applyPrologue(next, state, request);
  return applyGrowth(state, applyEconomy(applyDayTwo(applyDayOne(state, next, request), request), request), request);
}

export function selectNpc(state: GameState, npcId: string): GameState {
  if (['questioning', 'answered', 'disputed'].includes(state.dayOne.review)) return state;
  if (!state.player.alive || gameEnded(state) || campaignActive(state) || state.gatePhase === 'detained' || (state.locationId === 'yamen' && npcId !== 'ning-buping')) return state;
  if (!getLocation(state.locationId).npcIds.includes(npcId)) return state;
  return { ...state, selectedNpcId: npcId, dayOne: { ...state.dayOne, menu: false }, dayTwo: { ...state.dayTwo, menu: false }, growth: { ...state.growth, menu: false } };
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}小时${minutes ? `${minutes}分钟` : ''}`;
}

export function formatWorldTime(totalMinutes: number): string {
  const day = Math.floor(totalMinutes / 1440);
  const hour = Math.floor((totalMinutes % 1440) / 60);
  const minute = totalMinutes % 60;
  const periods = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const period = periods[Math.floor(((hour + 1) % 24) / 2)];
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const month = 6 + Math.floor(Math.max(0, day - 1) / 30);
  const date = Math.max(0, day - 1) % 30 + 1;
  return `江湖历十三年 ${month}月${date}日 · ${period}时（${clock}）`;
}
