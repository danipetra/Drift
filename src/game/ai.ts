import type { CardInstance } from "./CardInstance";
import { lanesOfSide, type BoardState, type RowKey, type Side } from "./BoardState";
import { canTargetWithRanged, type AttackDeclaration, type AttackTarget } from "./combat";

/** Se lo slot melee di una colonna è vuoto e c'è una ranged in retrovia, la porta avanti. */
export function aiReinforce(state: BoardState, side: Side): void {
  const [meleeRow, rangedRow] = lanesOfSide(side);
  for (let slot = 0; slot < state.slotCount; slot++) {
    if (state.getCard(meleeRow, slot)) continue;
    const reserve = state.getCard(rangedRow, slot);
    if (!reserve) continue;
    state.setCard(meleeRow, slot, reserve);
    state.setCard(rangedRow, slot, undefined);
  }
}

export interface AiPlayResult {
  remainingMana: number;
  played: CardInstance[];
}

/**
 * IA elementare: gioca dalla mano le carte più economiche per prime, riempiendo
 * gli slot liberi (prima melee poi ranged) finché il mana lo consente. Muta sia
 * `state` che `hand`.
 */
export function aiPlayCards(state: BoardState, side: Side, hand: CardInstance[], mana: number): AiPlayResult {
  const [meleeRow, rangedRow] = lanesOfSide(side);
  const emptySlots: { row: RowKey; slot: number }[] = [];
  for (const row of [meleeRow, rangedRow]) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      if (!state.getCard(row, slot)) emptySlots.push({ row, slot });
    }
  }

  let remainingMana = mana;
  const played: CardInstance[] = [];
  const cheapestFirst = [...hand].sort((a, b) => a.cost - b.cost);

  for (const card of cheapestFirst) {
    if (emptySlots.length === 0) break;
    if (card.cost > remainingMana) break; // le successive costano uguale o di più

    const target = emptySlots.shift()!;
    card.tapped = true;
    state.setCard(target.row, target.slot, card);
    remainingMana -= card.cost;
    played.push(card);

    const handIndex = hand.indexOf(card);
    if (handIndex >= 0) hand.splice(handIndex, 1);
  }

  return { remainingMana, played };
}

/** IA elementare: attacca con tutto ciò che è disponibile; i ranged mirano al bersaglio più debole rimasto. */
export function aiChooseAttackers(state: BoardState, side: Side): AttackDeclaration[] {
  const [meleeRow, rangedRow] = lanesOfSide(side);
  const attackers: AttackDeclaration[] = [];

  for (let slot = 0; slot < state.slotCount; slot++) {
    const meleeCard = state.getCard(meleeRow, slot);
    if (meleeCard && !meleeCard.tapped && !meleeCard.isDead) {
      attackers.push({ row: meleeRow, slot });
    }
  }

  const opponentSide: Side = side === "player" ? "opponent" : "player";
  const [opponentMeleeRow, opponentRangedRow] = lanesOfSide(opponentSide);
  const candidates: { row: typeof opponentMeleeRow; slot: number }[] = [];
  for (const row of [opponentMeleeRow, opponentRangedRow]) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      if (canTargetWithRanged(state, row, slot)) candidates.push({ row, slot });
    }
  }
  candidates.sort(
    (a, b) => state.getCard(a.row, a.slot)!.currentDefense - state.getCard(b.row, b.slot)!.currentDefense,
  );

  for (let slot = 0; slot < state.slotCount; slot++) {
    const rangedCard = state.getCard(rangedRow, slot);
    if (!rangedCard || rangedCard.tapped || rangedCard.isDead) continue;
    const chosen = candidates.shift();
    const target: AttackTarget = chosen ? { type: "card", row: chosen.row, slot: chosen.slot } : { type: "face" };
    attackers.push({ row: rangedRow, slot, target });
  }

  return attackers;
}
