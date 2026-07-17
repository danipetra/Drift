import { Modifier } from "../types/card";
import { laneRoleOf, ROW_KEYS, type BoardState, type RowKey, type Side } from "./BoardState";
import type { CardInstance } from "./CardInstance";

export interface AttackDeclaration {
  row: RowKey;
  slot: number;
}

export interface BlockDeclaration {
  attackerRow: RowKey;
  attackerSlot: number;
  blockerRow: RowKey;
  blockerSlot: number;
}

export interface CombatEvent {
  type: "attack" | "death" | "face-damage";
  message: string;
}

/** Una carta può bloccare un attacco solo se: stessa corsia (melee/ranged), non è già impegnata,
 * l'attaccante non è furtivo, e se l'attaccante vola anche la bloccante deve volare. */
export function canBlock(
  state: BoardState,
  attackerRow: RowKey,
  attackerSlot: number,
  blockerRow: RowKey,
  blockerSlot: number,
): boolean {
  const attacker = state.getCard(attackerRow, attackerSlot);
  const blocker = state.getCard(blockerRow, blockerSlot);
  if (!attacker || !blocker || blocker.tapped) return false;
  if (laneRoleOf(attackerRow) !== laneRoleOf(blockerRow)) return false;
  if (attacker.hasModifier(Modifier.Stealth)) return false;
  if (attacker.hasModifier(Modifier.Flying) && !blocker.hasModifier(Modifier.Flying)) return false;
  return true;
}

/** Una carta Guardia disponibile e con almeno un bersaglio legale deve comparire tra i blocchi. */
export function guardObligationsSatisfied(
  state: BoardState,
  defendingRows: RowKey[],
  attackers: AttackDeclaration[],
  blocks: BlockDeclaration[],
): boolean {
  for (const row of defendingRows) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const guard = state.getCard(row, slot);
      if (!guard || guard.tapped || !guard.hasModifier(Modifier.Guard)) continue;
      const hasLegalTarget = attackers.some((a) => canBlock(state, a.row, a.slot, row, slot));
      if (!hasLegalTarget) continue;
      const isUsed = blocks.some((b) => b.blockerRow === row && b.blockerSlot === slot);
      if (!isUsed) return false;
    }
  }
  return true;
}

export function resolveCombat(
  state: BoardState,
  attackingSide: Side,
  attackers: AttackDeclaration[],
  blocks: BlockDeclaration[],
): CombatEvent[] {
  const events: CombatEvent[] = [];
  const defendingSide: Side = attackingSide === "player" ? "opponent" : "player";

  interface Duel {
    attacker: CardInstance;
    blocker?: CardInstance;
  }

  const duels: Duel[] = [];
  for (const ref of attackers) {
    const attacker = state.getCard(ref.row, ref.slot);
    if (!attacker) continue;
    attacker.tapped = true;
    const block = blocks.find((b) => b.attackerRow === ref.row && b.attackerSlot === ref.slot);
    const blocker = block ? state.getCard(block.blockerRow, block.blockerSlot) : undefined;
    duels.push({ attacker, blocker });
  }

  for (const duel of duels) {
    if (!duel.blocker) {
      const amount = duel.attacker.currentAttack;
      if (defendingSide === "player") state.playerHealth -= amount;
      else state.opponentHealth -= amount;
      events.push({
        type: "face-damage",
        message: `${duel.attacker.data.name} colpisce direttamente per ${amount}`,
      });
    }
  }

  const engaged = duels.filter((d): d is Duel & { blocker: CardInstance } => Boolean(d.blocker));

  // Il danno di ogni fase è simultaneo: si calcola l'ammontare per tutti i
  // partecipanti ancora vivi PRIMA di applicarlo, così un difensore ucciso
  // dall'attaccante infligge comunque il contraccolpo nella stessa fase
  // (a meno che non fosse già morto in una fase precedente).
  const strikeSimultaneously = (pairs: { from: CardInstance; to: CardInstance }[]) => {
    const prepared = pairs
      .filter((p) => !p.from.isDead && !p.to.isDead)
      .map((p) => ({ from: p.from, to: p.to, amount: p.from.currentAttack }));
    for (const p of prepared) {
      p.to.currentDefense -= p.amount;
      if (p.from.hasModifier(Modifier.Deadly) && p.amount > 0) p.to.currentDefense = 0;
      events.push({ type: "attack", message: `${p.from.data.name} infligge ${p.amount} a ${p.to.data.name}` });
    }
  };

  strikeSimultaneously(
    engaged
      .filter((d) => d.attacker.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.blocker }))
      .concat(
        engaged
          .filter((d) => d.blocker.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.blocker, to: d.attacker })),
      ),
  );

  strikeSimultaneously(
    engaged
      .filter((d) => !d.attacker.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.blocker }))
      .concat(
        engaged
          .filter((d) => !d.blocker.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.blocker, to: d.attacker })),
      ),
  );

  for (const row of ROW_KEYS) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const card = state.getCard(row, slot);
      if (card?.isDead) {
        events.push({ type: "death", message: `${card.data.name} muore` });
        state.setCard(row, slot, undefined);
      }
    }
  }

  return events;
}
