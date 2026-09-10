import type { GameState } from './types.ts';

export function decodeEconomy(state: GameState | null): GameState | null {
  if (!state) return null;
  if (!Object.hasOwn(state, 'economy')) return null;
  const e = state.economy;
  if (!e || typeof e !== 'object' || e.schema !== 1 || ![0, 2].includes(e.innCredit) || ![0, 2].includes(e.medicalCredit) || ![0, 3].includes(e.medicalDebt) || !Array.isArray(e.transactions)) return null;
  if (!['innWorkAt', 'cheapLodgingAt', 'medicalWorkAt', 'medicalDebtAt'].every((key) => e[key as keyof typeof e] === null || Number.isFinite(e[key as keyof typeof e]))) return null;
  const ids = ['inn-work', 'cheap-rest', 'medical-credit', 'basic-on-credit', 'pharmacy-work', 'treat-with-credit', 'settle-medical-debt'];
  if (!e.transactions.every((t) => t && ids.includes(t.id) && Number.isFinite(t.atMinutes) && t.atMinutes >= state.storyStartedAtMinutes && t.atMinutes <= state.worldMinutes && Number.isFinite(t.moneyDelta) && Number.isFinite(t.debtDelta) && Number.isFinite(t.creditDelta)) || new Set(e.transactions.map((t) => t.id)).size !== e.transactions.length) return null;
  if ((e.innWorkAt !== null) !== e.transactions.some((t) => t.id === 'inn-work') || (e.medicalWorkAt !== null) !== e.transactions.some((t) => t.id === 'pharmacy-work') || (e.medicalDebt === 3) !== (e.medicalDebtAt !== null) || e.transactions.some((t) => t.id === 'settle-medical-debt') && e.medicalDebt !== 0) return null;
  const tx = (id: string) => e.transactions.find((t) => t.id === id);
  if (e.innWorkAt !== null && tx('inn-work')?.atMinutes !== e.innWorkAt || e.cheapLodgingAt !== null && tx('cheap-rest')?.atMinutes !== e.cheapLodgingAt || e.medicalWorkAt !== null && tx('pharmacy-work')?.atMinutes !== e.medicalWorkAt || e.medicalDebtAt !== null && !['medical-credit', 'basic-on-credit'].some((id) => tx(id)?.atMinutes === e.medicalDebtAt)) return null;
  if (e.innCredit === 2 && !tx('inn-work') || e.innCredit === 0 && tx('inn-work') && !state.lodgingRecords.some((record) => record.atMinutes >= (e.innWorkAt ?? Infinity)) || e.medicalCredit === 2 && !tx('pharmacy-work') || e.medicalCredit === 0 && tx('treat-with-credit') && !tx('pharmacy-work')) return null;
  return state;
}
