import type { BattleState } from './battle.ts';
import type { ArtsState } from './arts-content.ts';
import type { CampaignState } from './campaign-types.ts';
export type LocationId = 'gate' | 'inn' | 'yamen' | 'dock' | 'temple' | 'clinic';
export type FactionId = 'yamen' | 'river-gang' | 'qingyue';
export type InteractionMode = 'auto' | 'speech' | 'action';
export type GatePhase = 'questioning' | 'explaining' | 'searched' | 'cleared' | 'detained';

export type ClueId =
  | 'attack-phrase'
  | 'abnormal-wound'
  | 'ding17-fragment'
  | 'black-scale-wax'
  | 'matching-corpse-wound';
export type InventoryItemId = 'ding17-fragment' | 'temporary-stay-permit' | 'evidence-receipt' | 'blood-cloth';
export type KnownFactId =
  | 'cart-mark' | 'cheng-identity' | 'medical-report' | 'cargo-schedule' | 'ning-referral' | 'cart-verified' | 'ledger-verified' | 'sealed-case'
  | 'gate-selective-inspection'
  | 'guard-search-threat'
  | 'ma-public-bribe-caution'
  | 'ma-private-bribe-signal'
  | 'ma-cart-deflection'
  | 'ma-ding17-reaction'
  | 'doctor-wound-residue'
  | 'clinic-corpse-details'
  | 'corpse-wound-link'
  | 'inn-corpse-rumor'
  | 'baggage-watch-mark'
  | 'inn-arrival-inquiry'
  | 'day-end-watch-rumor'
  | 'next-morning-moving-lead'
  | 'dock-salt-movement'
  | 'clinic-routine'
  | 'day2-public-notice'
  | 'public-yamen-role'
  | 'public-river-gang-role'
  | 'public-qingyue-role'
  | 'act-one-surface-conflict'
  | 'act-one-involvement';
export type WorldEventId =
  | 'roadside-ambush'
  | 'nameless-corpse'
  | 'ding17-ship-arrives'
  | 'yue-hansheng-hides'
  | 'magistrate-assassination'
  | 'qingyue-leader-dies'
  | 'dock-ledger-fire'
  | 'county-lockdown';

export type LimitedActionId =
  | `journey-${string}`
  | 'open-dayone' | 'close-dayone' | 'tell-amnesia' | 'tell-confused-origin' | 'ask-exempt-cart'
  | 'step-aside' | 'wait-at-gate' | 'reapproach-gate' | 'request-review' | 'review-confirm' | 'review-deny' | 'review-correct' | 'review-release'
  | 'register-true' | 'register-alias' | 'register-refuse' | 'reconsider-registration' | 'share-gate-statement' | 'ask-companion' | 'show-fragment'
  | 'lu-cart' | 'lu-stance' | 'lu-test-lie' | 'listen-guests'
  | 'medical-truth' | 'medical-lie' | 'medical-refuse' | 'medical-fee' | 'consent-exam' | 'consent-basic' | 'refuse-exam'
  | 'retain-cloth' | 'keep-cloth' | 'return-cloth' | 'pay-basic' | 'reopen-exam' | 'medical-leave' | 'request-privacy' | 'authorize-report' | 'request-medical-debt'
  | 'identify-roster' | 'identify-memory' | 'request-medical-report' | 'ask-ning-referral'
  | 'report-salt-case' | 'await-cargo' | 'inspect-cargo' | 'check-release-ledger' | 'seal-salt-evidence'
  | 'open-daytwo' | 'close-daytwo' | 'gate-echo' | 'inn-echo' | 'clinic-echo' | 'lu-echo'
  | 'decline-report' | 'accept-broker-contact' | 'wait-night-ferry' | 'take-night-ferry' | 'transfer-fragment'
  | 'cheap-rest' | 'inn-work' | 'medical-credit' | 'basic-on-credit' | 'pharmacy-work' | 'treat-with-credit' | 'settle-medical-debt'
  | 'open-growth' | 'close-growth' | 'practice-lu' | 'study-shen'
  | 'spend-step-foundation' | 'spend-step-breath' | 'spend-medicine-diagnosis' | 'spend-medicine-bandage'
  | 'tell-attack'
  | 'tell-pass-lost'
  | 'ask-guard-name'
  | 'stay-silent'
  | 'ask-lodging'
  | 'ask-clinic'
  | 'mention-ding17'
  | 'challenge-search'
  | 'offer-bribe'
  | 'request-entry'
  | 'show-gate-fragment'
  | 'present-gate-document'
  | 'submit-search'
  | 'inspect-wound'
  | 'inspect-bag'
  | 'inspect-fragment'
  | 'observe-gate'
  | 'ask-name'
  | 'ask-news'
  | 'observe-inn'
  | 'request-room'
  | 'rest-night'
  | 'request-treatment'
  | 'observe-clinic'
  | 'ask-corpse'
  | 'compare-corpse-wound'
  | 'ask-local-news'
  | 'observe-scene'
  | 'leave-conversation';

export type InteractionIntent =
  | 'state-claim'
  | 'ask-information'
  | 'observe'
  | 'inspect'
  | 'provoke'
  | 'bribe'
  | 'request-service'
  | 'wait';

export interface Abilities {
  martial: number;
  agility: number;
  insight: number;
  eloquence: number;
  vigilance: number;
  medicine: number;
}

export interface PlayerState {
  name: string;
  abilities: Abilities;
  health: number;
  maxHealth: number;
  qi: number;
  maxQi: number;
  injury: '无' | '轻伤' | '重伤';
  poison: '无' | '未确认' | '不明残毒';
  fatigue: number;
  maxFatigue: number;
  woundUntreatedMinutes: number;
  hasRoadPass: boolean;
  money: number;
  reputation: number;
  chivalry: number;
  infamy: number;
  alive: boolean;
  deathCause: string | null;
}

export interface LocationDefinition {
  id: LocationId;
  name: string;
  shortName: string;
  description: string;
  arrival: string;
  weather: string;
  npcIds: string[];
  mapPosition: { x: number; y: number };
}

/** 页面可以安全读取的 NPC 观察数据。 */
export interface NPCPublicDefinition {
  id: string;
  observedLabel: string;
  observation: string;
}

/** 仅供规则内容与未来 Tauri/服务端上下文构建使用。 */
export interface NPCPrivateDefinition {
  id: string;
  name: string;
  identity: string;
  factionId: FactionId;
  personality: string;
  goal: string;
  weakness: string;
  secret: string;
  knownFacts: string[];
  unknownFacts: string[];
  initialAttitude: string;
  speechStyle: string;
  combatLevel: number;
  boundaries: string[];
  dangerousActions: string[];
}

export interface NpcKnowledge {
  observed: boolean;
  matched: boolean;
  knownName: string | null;
  knownIdentity: string | null;
  learnedFacts: string[];
}

export interface NpcRuntimeState {
  trust: number;
  favor: number;
  memory: NpcMemory;
  attitude: number;
  suspicion: number;
  hostility: number;
  informedRiverGang: boolean;
  searchedPlayer: boolean;
  detainedPlayer: boolean;
  claimBeliefs: Record<string, number>;
}

export interface TopicMemory {
  status: 'answered' | 'refused' | 'locked';
  atMinutes: number;
  attempts: number;
  day: number;
  evidence: string[];
  respected: boolean;
}
export interface NpcStatement {
  id: string;
  subject: string;
  value: string;
  text: string;
  atMinutes: number;
  truth: 'unknown' | 'verified' | 'false';
  contradicts: string[];
}
export interface NpcMemory {
  topics: Partial<Record<LimitedActionId, TopicMemory>>;
  statements: NpcStatement[];
  evidence: string[];
  appliedEvents: string[];
}

export interface PlayerClaim {
  id: string;
  text: string;
  toldNpcId: string;
  atMinutes: number;
}

export interface LodgingRecord {
  locationId: 'inn';
  registeredName: string;
  atMinutes: number;
}

export interface DialogueLine {
  portraitId?: string;
  tone?: string;
  id: string;
  speaker: string;
  text: string;
  kind: 'narration' | 'npc' | 'player';
}

export interface EventLogEntry {
  id: string;
  atMinutes: number;
  type: 'system' | 'move' | 'dialogue' | 'discovery' | 'save' | 'danger';
  text: string;
}

export interface GameState {
  campaign: CampaignState;
  arts: ArtsState;
  battles: BattleState;
  version: 7;
  dayOne: DayOneState;
  dayTwo: DayTwoState;
  economy: EconomyState;
  growth: GrowthState;
  prologueSchema: 1;
  chengShouyiIdentified: boolean;
  poisonWoundLinked: boolean;
  cartMarkObserved: boolean;
  evidenceCustody: Record<'fragment' | 'medical' | 'cart' | 'identity', 'unknown' | 'player' | 'shen' | 'ma' | 'broker' | 'yamen'>;
  day3CargoStatus: 'pending' | 'unloading' | 'sealed' | 'departed';
  prologueEnding: 'sealed-salt' | 'night-ferry' | 'fragment-transferred' | null;
  saltCase: {
    identitySource: 'roster' | 'recollection' | null;
    reported: boolean;
    submittedSources: string[];
    cartChecked: boolean;
    ledgerChecked: boolean;
    endedAt: number | null;
    stayPermitUntil: number | null;
  };
  started: boolean;
  player: PlayerState;
  locationId: LocationId;
  worldMinutes: number;
  dialogue: DialogueLine[];
  logs: EventLogEntry[];
  selectedNpcId: string | null;
  knownLocationIds: LocationId[];
  npcKnowledge: Record<string, NpcKnowledge>;
  npcStates: Record<string, NpcRuntimeState>;
  playerKnownFactIds: KnownFactId[];
  playerClaims: PlayerClaim[];
  lodgingRecords: LodgingRecord[];
  conversationTurns: Record<string, number>;
  storyStartedAtMinutes: number;
  gatePhase: GatePhase;
  gateAccess: boolean;
  knownClueIds: ClueId[];
  inventoryItemIds: InventoryItemId[];
  triggeredWorldEventIds: WorldEventId[];
  knownWorldEventIds: WorldEventId[];
  worldEventOutcomes: Partial<Record<WorldEventId, string>>;
}

export interface DayOneState {
  schema: 1;
  menu: boolean;
  gatePosition: 'line' | 'aside';
  review: 'none' | 'questioning' | 'answered' | 'disputed' | 'cleared';
  returnReceipt: { atMinutes: number; from: 'ma'; to: 'player' } | null;
  gateName: string | null;
  registration: 'none' | 'true' | 'alias' | 'refused';
  registeredName: string | null;
  registrationDiscrepancy: boolean;
  interview: 'none' | 'truth' | 'lie' | 'refused';
  consent: 'none' | 'exam' | 'basic' | 'refused';
  cloth: 'undecided' | 'retain' | 'keep' | 'player' | 'doctor';
  privateCare: boolean;
  reportAuthorized: boolean;
  bleedingGraceMinutes: number;
  guidanceSeed: boolean;
  companionLead: boolean;
}

/** 第二日只保存已经实际发生的回声和路线承诺，不替 NPC 补写未知事实。 */
export interface DayTwoState {
  schema: 1;
  menu: boolean;
  gateEchoSeen: boolean;
  innEchoSeen: boolean;
  clinicEchoSeen: boolean;
  luEchoSeen: boolean;
  departurePlan: 'none' | 'night-ferry';
  brokerContact: 'none' | 'offered';
}

export interface EconomyTransaction {
  id: 'inn-work' | 'cheap-rest' | 'medical-credit' | 'basic-on-credit' | 'pharmacy-work' | 'treat-with-credit' | 'settle-medical-debt';
  atMinutes: number;
  moneyDelta: number;
  debtDelta: number;
  creditDelta: number;
}
export interface EconomyState {
  schema: 1;
  innWorkAt: number | null;
  innCredit: 0 | 2;
  cheapLodgingAt: number | null;
  medicalWorkAt: number | null;
  medicalCredit: 0 | 2;
  medicalDebt: 0 | 3;
  medicalDebtAt: number | null;
  transactions: EconomyTransaction[];
}

export type GrowthNodeId = 'step-foundation' | 'step-breath' | 'medicine-diagnosis' | 'medicine-bandage';
export interface GrowthTreeState {
  unlocked: boolean;
  unlockedAt: number | null;
  pointAwardedAt: number | null;
  availablePoints: 0 | 1;
  nodes: GrowthNodeId[];
}
/** 独立成长账本：点数只能来自一次实际训练或学习，节点不修改基础能力值。 */
export interface GrowthState {
  schema: 1;
  menu: boolean;
  step: GrowthTreeState;
  medicine: GrowthTreeState;
}

export interface ClueDefinition {
  id: ClueId;
  title: string;
  description: string;
}

export interface KnownFactDefinition {
  id: KnownFactId;
  text: string;
}

export interface InventoryItemDefinition {
  id: InventoryItemId;
  name: string;
  description: string;
}

export interface WorldEventDefinition {
  id: WorldEventId;
  storyDay: number;
  offsetMinutes: number;
  title: string;
  hiddenSummary: string;
}

export interface InteractionRequest {
  actionId: LimitedActionId;
  input: string;
  mode: InteractionMode;
  npcId: string | null;
}

/** AI/Mock 只能提出表达候选，不包含任何可写入状态的字段。 */
export interface AIInteractionProposal {
  intent: InteractionIntent;
  dialogue?: string;
  narration?: string;
  riskTags?: string[];
}

export interface InteractionView {
  locationId: LocationId;
  worldMinutes: number;
  npc: NPCPublicDefinition | null;
  npcDisplayName: string | null;
  conversationTurns: number;
  player: Pick<PlayerState, 'injury' | 'fatigue' | 'money' | 'hasRoadPass'>;
  knownFactIds: KnownFactId[];
  knownClueIds: ClueId[];
  inventoryItemIds: InventoryItemId[];
  sceneSignals: string[];
}

export interface TravelEstimate {
  originId: LocationId;
  destinationId: LocationId;
  baseMinutes: number;
  weatherMinutes: number;
  injuryMinutes: number;
  agilityMinutes: number;
  totalMinutes: number;
}
