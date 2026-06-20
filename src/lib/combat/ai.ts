// Battle AI (v5) — chooses a move from the attacker's IDENTITY + TEMPERAMENT. NOT pure-random, and
// deliberately NOT a min-max solver: a challenger leads with its signature, a sleepy mon dawdles, a
// proud/aloof mon leans on its own move over the matchup, a playful one is unpredictable. Reads
// `speciesIdentity` (identity) + the type chart's `effectiveness` (sim) to DECIDE; the damage CALC
// stays in battle.ts (`calcTurn`) and the FX in the director — decision ≠ simulation ≠ presentation.
// Soul: a battle is a characterful auto-spar to watch, never an optimal tryhard solver.
import { movesFor, signatureMove, type Move } from "../attackfx";
import { effectiveness } from "../battle";
import { speciesIdentity } from "./identity";

/** Pick the attacker's next move, coloured by who it IS. `foeType` = defender's primary type. */
export function chooseMove(dexId: number, foeType: string, selfHpFrac = 1): Move {
  const moves = movesFor(dexId);
  if (!moves.length) return signatureMove(dexId);
  const id = speciesIdentity(dexId);
  const has = (t: string) => id.temperament.includes(t);
  const challenger = has("challenger");
  const aloof = has("aloof");
  const playful = has("playful");
  const sleepy = has("sleepy");
  const steady = has("protective") || has("loyal") || has("calm");

  // a sleepy mon sometimes just loafs — the weakest move, a dawdle rather than a strike
  if (sleepy && Math.random() < 0.3) {
    return moves.reduce((a, b) => (b.power < a.power ? b : a));
  }

  const scored = moves.map((m) => {
    let s = 1;
    const dmg = m.cls !== 1;
    s += dmg ? 1.5 + (m.power / 120) * 2 : 0.3; // damaging favoured; raw power matters
    if (dmg) {
      const eff = effectiveness(m.type, foeType); // smart play — reads the chart, not the stats
      s *= eff === 0 ? 0.05 : 0.6 + eff * 0.5; // super-effective up; an immune move almost never
      if (m.type === id.t1 || m.type === id.t2) s += 0.6; // STAB — its own element
      if (id.bias === "phys" && m.cls === 2) s += 0.5; // play to the stronger attacking stat
      if (id.bias === "spec" && m.cls === 3) s += 0.5;
    }
    if (m.name === id.signature) s += challenger || aloof ? 1.6 : 0.7; // the iconic move
    if (challenger) s += (m.power / 120) * 1.2; // wants the biggest hit
    if (aloof) s *= m.name === id.signature ? 1.4 : 0.8; // proud → leans on its own move
    if (steady && selfHpFrac < 0.4 && m.cls === 1) s += 1.2; // hurt → may steady itself first
    if (playful) s *= 0.6 + Math.random() * 0.9; // unpredictable
    s *= 0.85 + Math.random() * 0.3; // never deterministic — keeps it feeling alive
    return { m, s };
  });

  // weighted pick from the top few (not strict argmax → variety + soul, not a solver)
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 3);
  const sum = top.reduce((t, x) => t + Math.max(0.01, x.s), 0);
  let r = Math.random() * sum;
  for (const x of top) {
    r -= Math.max(0.01, x.s);
    if (r <= 0) return x.m;
  }
  return top[0].m;
}
