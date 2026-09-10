import type { LocationId } from './types.ts';

export type LifeRoute = 'xia' | 'trade' | 'shadow' | 'office' | 'healer';
export type LifeEnding = LifeRoute | 'retired' | 'away' | 'prison' | 'dead';
export interface CampaignState {
  schema: 1;
  startedAt: number | null;
  origin: 'sealed-salt' | 'night-ferry' | 'fragment-transferred' | 'missed' | null;
  prologueRecord: { ending: 'sealed-salt' | 'night-ferry' | 'fragment-transferred' | null; endedAt: number | null; stayPermitUntil: number | null; cargoStatus: 'pending' | 'unloading' | 'sealed' | 'departed' } | null;
  extraLessons: { step: 0 | 1; medicine: 0 | 1 };
  scores: Record<LifeRoute, number>;
  experience: Record<LifeRoute, number>;
  trained: Record<LifeRoute, number>;
  pledge: LifeRoute | null;
  wanted: number;
  debt: number;
  flags: string[];
  evidence: string[];
  npcAlive: Record<string, boolean>;
  resolved: Record<string, { choice: string; at: number; text: string; witnessed: boolean }>;
  activeEvent: string | null;
  lastWorkDay: number | null;
  lastTrainDay: number | null;
  finale: LifeRoute | null;
  finaleStep: number;
  ending: LifeEnding | null;
  endedAt: number | null;
  journal: { at: number; action: string; money: number; debt: number; text: string }[];
}
export interface StoryEffect {
  route?: LifeRoute;
  money?: number;
  wanted?: number;
  flags?: string[];
  evidence?: string[];
  dead?: string[];
  help?: string;
  harm?: string;
  pass?: boolean;
}
export interface StoryChoice {
  id: string;
  label: string;
  /** 只写当场取舍；属于显示派生，不进入事件结算或存档。 */
  hint?: string;
  reply: string;
  effect: StoryEffect;
  need?: { ally?: string; node?: string; money?: number; flag?: string; evidence?: string; route?: LifeRoute; score?: number };
}
export interface StoryEvent {
  id: string;
  day: number;
  title: string;
  location: LocationId;
  speaker: string;
  opening: string[];
  choices: StoryChoice[];
  missed: { text: string; effect: StoryEffect };
}
