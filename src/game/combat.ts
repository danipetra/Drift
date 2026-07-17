import { Modifier } from "../types/card";
import { lanesOfSide, ROW_KEYS, sideOf, type BoardState, type RowKey, type Side } from "./BoardState";
import type { CardInstance } from "./CardInstance";

export type AttackTarget = { type: "face" } | { type: "card"; row: RowKey; slot: number };

export interface AttackDeclaration {
  row: RowKey;
  slot: number;
  /** Richiesto per gli attaccanti ranged (bersaglio libero); ignorato per i melee (colonna fissa). */
  target?: AttackTarget;
}

export interface CardRef {
  row: RowKey;
  slot: number;
}

export interface CombatEvent {
  type: "attack" | "death" | "face-damage";
  message: string;
  /** Chi ha agito — assente solo per un "death" causato indirettamente (mai il caso oggi, ma resta opzionale). */
  from?: CardRef;
  /** Bersaglio carta colpita ("attack"/"death"); assente per "face-damage". */
  to?: CardRef;
  amount?: number;
  /** Per "face-damage": quale lato ha subito il colpo. */
  face?: Side;
  /** Per "attack": che tipo di scatto animare. */
  kind?: "melee" | "ranged";
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

/** Il danno di `attacker` basterebbe da solo a eliminare `target` (Tocco letale conta come letale a prescindere dal numero). */
export function wouldKill(attacker: CardInstance, target: CardInstance): boolean {
  if (attacker.hasModifier(Modifier.Deadly) && attacker.currentAttack > 0) return true;
  return attacker.currentAttack >= target.currentDefense;
}

/** Bersaglio automatico di un attaccante melee (stessa colonna), o `undefined` se la colonna è vuota o l'attacco la scavalca. */
export function meleeTargetFor(
  state: BoardState,
  attackerRow: RowKey,
  attackerSlot: number,
): { row: RowKey; slot: number; card: CardInstance } | undefined {
  const attacker = state.getCard(attackerRow, attackerSlot);
  if (!attacker) return undefined;

  const defenderSide: Side = sideOf(attackerRow) === "player" ? "opponent" : "player";
  const [defenderMeleeRow] = lanesOfSide(defenderSide);

  const defender = state.getCard(defenderMeleeRow, attackerSlot);
  if (!defender || meleeColumnEvades(attacker, defender)) return undefined;
  return { row: defenderMeleeRow, slot: attackerSlot, card: defender };
}

export function resolveCombat(state: BoardState, attackingSide: Side, attacks: AttackDeclaration[]): CombatEvent[] {
  const events: CombatEvent[] = [];
  const defendingSide: Side = attackingSide === "player" ? "opponent" : "player";
  const [attackerMeleeRow, attackerRangedRow] = lanesOfSide(attackingSide);
  const [defenderMeleeRow] = lanesOfSide(defendingSide);

  const dealFaceDamage = (attacker: CardInstance, attackerRef: CardRef) => {
    const amount = attacker.currentAttack;
    if (defendingSide === "player") state.playerHealth -= amount;
    else state.opponentHealth -= amount;
    events.push({
      type: "face-damage",
      message: `${attacker.data.name} colpisce direttamente per ${amount}`,
      from: attackerRef,
      amount,
      face: defendingSide,
    });
  };

  interface Combatant {
    card: CardInstance;
    ref: CardRef;
  }

  const strike = (from: Combatant, to: Combatant, kind: "melee" | "ranged") => {
    if (from.card.isDead || to.card.isDead) return;
    const amount = from.card.currentAttack;
    to.card.currentDefense -= amount;
    if (from.card.hasModifier(Modifier.Deadly) && amount > 0) to.card.currentDefense = 0;
    events.push({
      type: "attack",
      message: `${from.card.data.name} infligge ${amount} a ${to.card.data.name}`,
      from: from.ref,
      to: to.ref,
      amount,
      kind,
    });
  };

  const strikeSimultaneously = (pairs: { from: Combatant; to: Combatant; kind: "melee" | "ranged" }[]) => {
    const prepared = pairs
      .filter((p) => !p.from.card.isDead && !p.to.card.isDead)
      .map((p) => ({ ...p, amount: p.from.card.currentAttack }));
    for (const p of prepared) {
      p.to.card.currentDefense -= p.amount;
      if (p.from.card.hasModifier(Modifier.Deadly) && p.amount > 0) p.to.card.currentDefense = 0;
      events.push({
        type: "attack",
        message: `${p.from.card.data.name} infligge ${p.amount} a ${p.to.card.data.name}`,
        from: p.from.ref,
        to: p.to.ref,
        amount: p.amount,
        kind: p.kind,
      });
    }
  };

  // ---- Melee: fisso per colonna, combattimento reciproco ----
  interface MeleeDuel {
    attacker: Combatant;
    defender: Combatant;
  }
  const meleeDuels: MeleeDuel[] = [];

  for (const decl of attacks) {
    if (decl.row !== attackerMeleeRow) continue;
    const attackerCard = state.getCard(decl.row, decl.slot);
    if (!attackerCard) continue;
    attackerCard.tapped = true;
    const attacker: Combatant = { card: attackerCard, ref: { row: decl.row, slot: decl.slot } };

    const defenderCard = state.getCard(defenderMeleeRow, decl.slot);
    if (!defenderCard || meleeColumnEvades(attackerCard, defenderCard)) {
      dealFaceDamage(attackerCard, attacker.ref);
    } else {
      meleeDuels.push({
        attacker,
        defender: { card: defenderCard, ref: { row: defenderMeleeRow, slot: decl.slot } },
      });
    }
  }

  strikeSimultaneously(
    meleeDuels
      .filter((d) => d.attacker.card.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.defender, kind: "melee" as const }))
      .concat(
        meleeDuels
          .filter((d) => d.defender.card.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.defender, to: d.attacker, kind: "melee" as const })),
      ),
  );

  strikeSimultaneously(
    meleeDuels
      .filter((d) => !d.attacker.card.hasModifier(Modifier.FirstStrike))
      .map((d) => ({ from: d.attacker, to: d.defender, kind: "melee" as const }))
      .concat(
        meleeDuels
          .filter((d) => !d.defender.card.hasModifier(Modifier.FirstStrike))
          .map((d) => ({ from: d.defender, to: d.attacker, kind: "melee" as const })),
      ),
  );

  removeDeadCards(state, events);

  // ---- Ranged: bersaglio libero, danno a senso unico (nessun contrattacco) ----
  for (const decl of attacks) {
    if (decl.row !== attackerRangedRow) continue;
    const attackerCard = state.getCard(decl.row, decl.slot);
    if (!attackerCard || attackerCard.isDead) continue;
    attackerCard.tapped = true;
    const attacker: Combatant = { card: attackerCard, ref: { row: decl.row, slot: decl.slot } };

    if (!decl.target || decl.target.type === "face") {
      dealFaceDamage(attackerCard, attacker.ref);
      continue;
    }

    const targetCard = state.getCard(decl.target.row, decl.target.slot);
    if (!targetCard || targetCard.isDead) continue; // bersaglio già eliminato, colpo sprecato
    strike(attacker, { card: targetCard, ref: { row: decl.target.row, slot: decl.target.slot } }, "ranged");
  }

  removeDeadCards(state, events);

  return events;
}

function removeDeadCards(state: BoardState, events: CombatEvent[]): void {
  for (const row of ROW_KEYS) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const card = state.getCard(row, slot);
      if (card?.isDead) {
        events.push({ type: "death", message: `${card.data.name} muore`, to: { row, slot } });
        state.setCard(row, slot, undefined);
      }
    }
  }
}
