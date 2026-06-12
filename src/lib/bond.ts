// Bond Depth — the doc's relationship arc. Not a friendship meter, not a
// score on screen. It deepens with time *and* genuine interaction, slowly.
//   Stranger → Familiar → Trusted Friend → Companion → Partner → Lifetime Companion

export interface BondStage {
  label: string;
  minDays: number;
  minInteractions: number;
}

export const BOND_STAGES: BondStage[] = [
  { label: "Stranger", minDays: 0, minInteractions: 0 },
  { label: "Familiar", minDays: 3, minInteractions: 6 },
  { label: "Trusted Friend", minDays: 14, minInteractions: 25 },
  { label: "Companion", minDays: 45, minInteractions: 70 },
  { label: "Partner", minDays: 120, minInteractions: 160 },
  { label: "Lifetime Companion", minDays: 365, minInteractions: 400 }
];

export function daysTogether(firstMetIso: string | null): number {
  if (!firstMetIso) return 0;
  const ms = Date.now() - new Date(firstMetIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function bondStage(days: number, interactions: number): BondStage {
  let stage = BOND_STAGES[0];
  for (const s of BOND_STAGES) {
    if (days >= s.minDays && interactions >= s.minInteractions) stage = s;
  }
  return stage;
}
