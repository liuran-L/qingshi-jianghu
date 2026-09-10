import { artSpent } from './arts.ts';
import type { GameState } from './types.ts';
import { lifeRoutes, dayAt, campaignDay } from './campaign.ts';
import { coreNames, evidenceNames, firstActPreludes, storyEvents } from './campaign-content.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
const finalFlags = ['xia-victory', 'xia-defeat', 'xia-escort', 'public-truth', 'trade-public', 'trade-monopoly', 'shadow-public', 'shadow-rich', 'partial-trial', 'office-compromise', 'healer-clinic', 'healer-travel'];
const flags = new Set([...storyEvents.flatMap(e => [...e.choices.flatMap(c => c.effect.flags ?? []), ...(e.missed.effect.flags ?? [])]), ...firstActPreludes.flatMap(item => item.flags ?? []), ...finalFlags]);

/** v7 只校验当前快照，绝不补字段、推进或重播世界。 */
export function decodeCampaign(s: GameState | null): GameState | null {
  if (!s) return null;
  if (!Object.hasOwn(s, 'campaign')) return null;
  const c = s.campaign;
  if (!record(c) || c.schema !== 1) return null;
  if (!record(c.extraLessons) || Object.keys(c.extraLessons).length !== 2 || ![0, 1].includes(c.extraLessons.step) || ![0, 1].includes(c.extraLessons.medicine)) return null;
  if (![null, 'sealed-salt', 'night-ferry', 'fragment-transferred', 'missed'].includes(c.origin) || ![null, ...lifeRoutes].includes(c.pledge) || ![null, ...lifeRoutes].includes(c.finale) || ![null, ...lifeRoutes, 'retired', 'away', 'prison', 'dead'].includes(c.ending)) return null;
  if (!integer(c.wanted, 0, 10) || !integer(c.debt) || !integer(c.finaleStep, 0, 2)) return null;
  for (const key of ['scores', 'experience', 'trained'] as const) {
    const values = c[key];
    if (!record(values) || Object.keys(values).length !== lifeRoutes.length || !lifeRoutes.every(route => integer(values[route], 0, key === 'trained' ? 3 : 10000))) return null;
  }
  for (const route of lifeRoutes) if (c.experience[route] + c.trained[route] * 2 + artSpent(s, route) !== c.scores[route]) return null;
  if (!strings(c.flags) || !c.flags.every(f => flags.has(f)) || !strings(c.evidence) || !c.evidence.every(e => Object.hasOwn(evidenceNames, e))) return null;
  if (!record(c.npcAlive) || Object.keys(c.npcAlive).length !== Object.keys(coreNames).length || !Object.keys(coreNames).every(id => typeof c.npcAlive[id] === 'boolean')) return null;
  for (const key of ['startedAt', 'endedAt'] as const) if (c[key] !== null && !integer(c[key], s.storyStartedAtMinutes, s.worldMinutes)) return null;
  for (const key of ['lastWorkDay', 'lastTrainDay'] as const) if (c[key] !== null && !integer(c[key], 1, campaignDay(s))) return null;
  if (!record(c.resolved) || !Array.isArray(c.journal)) return null;
  for (const [id, r] of Object.entries(c.resolved)) {
    const e = storyEvents.find(event => event.id === id);
    if (!e || !record(r) || !integer(r.at, Math.min(c.startedAt ?? Infinity, dayAt(s, e.day)), s.worldMinutes) || !['missed', ...e.choices.map(o => o.id)].includes(r.choice) || typeof r.text !== 'string' || typeof r.witnessed !== 'boolean') return null;
    const expected = r.choice === 'missed' ? e.missed.text : e.choices.find(o => o.id === r.choice)!.reply;
    if (r.text !== expected) return null;
  }
  const earned = Object.entries(c.resolved).map(([id, r]) => {
    const event = storyEvents.find(e => e.id === id)!;
    return r.choice === 'missed' ? event.missed.effect : event.choices.find(o => o.id === r.choice)!.effect;
  });
  const earnedFlags = new Set(earned.flatMap(e => e.flags ?? []));
  for (const entry of c.journal) {
    if (!record(entry) || typeof entry.action !== 'string') continue;
    const prelude = firstActPreludes.find(item => entry.action === `scout:${item.eventId}`);
    for (const flag of prelude?.flags ?? []) earnedFlags.add(flag);
  }
  const earnedEvidence = new Set<string>();
  for (const [id,r] of Object.entries(c.resolved).sort((a,b)=>a[1].at-b[1].at)) {
    const e=storyEvents.find(e=>e.id===id)!;
    const effect=r.choice==='missed'?e.missed.effect:e.choices.find(o=>o.id===r.choice)!.effect;
    for(const evidence of effect.evidence??[]) earnedEvidence.add(evidence);
    for(const battle of s.battles?.records??[]) if(battle.event===id) for(const lost of battle.lostEvidence) earnedEvidence.delete(lost);
  }
  for(const battle of s.battles?.records??[]) if(battle.event==='finale') for(const lost of battle.lostEvidence) earnedEvidence.delete(lost);
  if (c.evidence.length !== earnedEvidence.size || !c.evidence.every(e => earnedEvidence.has(e))) return null;
  if (!c.flags.every(f => earnedFlags.has(f) || finalFlags.includes(f) && c.finale !== null && c.finaleStep >= 1) || ![...earnedFlags].every(f => c.flags.includes(f))) return null;
  let at = s.storyStartedAtMinutes;
  const seenPreludes = new Set<string>();
  for (const entry of c.journal) {
    if (!record(entry) || !integer(entry.at, at, s.worldMinutes) || typeof entry.action !== 'string' || typeof entry.text !== 'string' || !integer(entry.money, -100000, 100000) || !integer(entry.debt, -100000, 100000)) return null;
    if (entry.action.startsWith('scout:')) {
      if (!firstActPreludes.some(item => entry.action === `scout:${item.eventId}`) || seenPreludes.has(entry.action)) return null;
      seenPreludes.add(entry.action);
    }
    at = entry.at;
  }
  if (c.activeEvent !== null && (typeof c.activeEvent !== 'string' || !storyEvents.some(e => e.id === c.activeEvent && dayAt(s, e.day) <= s.worldMinutes && e.location === s.locationId) || !!c.resolved[c.activeEvent])) return null;
  if (c.startedAt === null) return c.origin === null && c.prologueRecord === null && c.pledge === null && c.finale === null && c.finaleStep === 0 && c.ending === null && c.endedAt === null && c.activeEvent === null && c.lastWorkDay === null && c.lastTrainDay === null && c.wanted === 0 && c.debt === 0 && c.extraLessons.step === 0 && c.extraLessons.medicine === 0 && c.flags.length === 0 && c.evidence.length === 0 && c.journal.length === 0 && Object.keys(c.resolved).length === 0 && Object.values(c.npcAlive).every(Boolean) && lifeRoutes.every(route => c.scores[route] === 0 && c.trained[route] === 0) ? s : null;
  if (c.origin === null || s.prologueEnding || c.startedAt < s.storyStartedAtMinutes || c.startedAt > s.worldMinutes || !s.gateAccess) return null;
  const archive = c.prologueRecord;
  if (!record(archive) || ![null, 'sealed-salt', 'night-ferry', 'fragment-transferred'].includes(archive.ending) || !['pending', 'unloading', 'sealed', 'departed'].includes(archive.cargoStatus) || (archive.ending ?? 'missed') !== c.origin) return null;
  if (archive.endedAt !== null && !integer(archive.endedAt, s.storyStartedAtMinutes, c.startedAt)) return null;
  if (archive.ending === null ? archive.endedAt !== null || archive.stayPermitUntil !== null : archive.endedAt !== c.startedAt) return null;
  if (archive.ending === 'sealed-salt' ? archive.cargoStatus !== 'sealed' || archive.stayPermitUntil !== archive.endedAt! + 4320 : archive.stayPermitUntil !== null) return null;
  if (c.finale && s.worldMinutes < dayAt(s, 58) || !c.finale && c.finaleStep !== 0 || c.finale && c.activeEvent) return null;
  if ((c.ending === null) !== (c.endedAt === null) || c.endedAt !== null && c.endedAt !== s.worldMinutes || c.ending && c.activeEvent) return null;
  if (c.ending === 'dead' ? s.player.alive : !s.player.alive) return null;
  if (lifeRoutes.includes(c.ending as never) && (c.finale !== c.ending || c.finaleStep !== 2 || s.worldMinutes < dayAt(s, 60))) return null;
  return s;
}
