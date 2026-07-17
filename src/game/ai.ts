import { lanesOfSide, type BoardState, type Side } from "./BoardState";
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
