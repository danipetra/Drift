import { Modifier } from "../types/card";
import { lanesOfSide, ROW_KEYS, type BoardState, type RowKey, type Side } from "./BoardState";
import type { CardInstance } from "./CardInstance";

export type AttackTarget = { type: "face" } | { type: "card"; row: RowKey; slot: number };

export interface AttackDeclaration {
  row: RowKey;
  slot: number;
  /** Richiesto per gli attaccanti ranged (bersaglio libero); ignorato per i melee (colonna fissa). */
  target?: AttackTarget;
}

export interface CombatEvent {
  type: "attack" | "death" | "face-damage";
  message: string;
}

/** Un bersaglio ranged dev'essere vivo e non protetto da Guardia. */
export function canTargetWithRanged(state: BoardState, row: RowKey, slot: number): boolean {
  const card = state.getCard(row, slot);
  return !!card && !card.isDead && !card.hasModifier(Modifier.Guard);
}

function meleeColumnEvades(attacker: CardInstance, defender: CardInstance | undefined): boolean {
  if (attacker.hasModifier(Modifier.Stealth)) return true;
  if (attacker.hasModifier(Modifier.Flying) && !defender?.hasModifier(Modifier.Flying)) return true;
  return false;
}

export function resolveCombat(state: BoardState, attackingSide: Side, attacks: AttackDeclaration[]): CombatEvent[] {
  const events: CombatEvent[] = [];
  const defendingSide: Side = attackingSide === "player" ? "opponent" : "player";
  const [attackerMeleeRow, attackerRangedRow] = lanesOfSide(attackingSide);
  const [defenderMeleeRow] = lanesOfSide(defendingSide);

  const dealFaceDamage = (attacker: CardInstance) => {
    const amount = attacker.currentAttack;
    if (defendingSide === "player") state.playerHealth -= amount;
    else state.opponentHealth -= amount;
    events.push({ type: "face-damage", message: `${attacker.data.name} colpisce direttamente per ${amount}` });
  };

  const strike = (from: CardInstance, to: CardInstance) => {
    if (from.isDead || to.isDead) return;
    const amount = from.currentAttack;
    to.currentDefense -= amount;
    if (from.hasModifier(Modifier.Deadly) && amount > 0) to.currentDefense = 0;
    events.push({ type: "attack", message: `${from.data.name} infligge ${amount} a ${to.data.name}` });
  };

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

  // ---- Melee: fisso per colonna, combattimento reciproco ----
  interface MeleeDuel {
    attacker: CardInstance;
    defender: CardInstance;
  }
  const meleeDuels: MeleeDuel[] = [];

  for (const decl of attacks) {
    if (decl.row !== attackerMeleeRow) continue;
    const attacker = state.getCard(decl.row, decl.slot);
    if (!attacker) continue;
    attacker.tapped = true;

    const defender = state.getCard(defenderMeleeRow, decl.slot);
    if (!defender || meleeColumnEvades(attacker, defender)) {
      dealFaceDamage(attacker);
    } else {
      meleeDuels.push({ attacker, defender });
    }
  }

  strikeSimultaneously(
    meleeDuels
      .filter((d) => d.attacker.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.defender }))
      .concat(
        meleeDuels
          .filter((d) => d.defender.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.defender, to: d.attacker })),
      ),
  );

  strikeSimultaneously(
    meleeDuels
      .filter((d) => !d.attacker.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.defender }))
      .concat(
        meleeDuels
          .filter((d) => !d.defender.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.defender, to: d.attacker })),
      ),
  );

  removeDeadCards(state, events);

  // ---- Ranged: bersaglio libero, danno a senso unico (nessun contrattacco) ----
  for (const decl of attacks) {
    if (decl.row !== attackerRangedRow) continue;
    const attacker = state.getCard(decl.row, decl.slot);
    if (!attacker || attacker.isDead) continue;
    attacker.tapped = true;

    if (!decl.target || decl.target.type === "face") {
      dealFaceDamage(attacker);
      continue;
    }

    const target = state.getCard(decl.target.row, decl.target.slot);
    if (!target || target.isDead) continue; // bersaglio già eliminato, colpo sprecato
    strike(attacker, target);
  }

  removeDeadCards(state, events);

  return events;
}

function removeDeadCards(state: BoardState, events: CombatEvent[]): void {
  for (const row of ROW_KEYS) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const card = state.getCard(row, slot);
      if (card?.isDead) {
        events.push({ type: "death", message: `${card.data.name} muore` });
        state.setCard(row, slot, undefined);
      }
    }
  }
}
