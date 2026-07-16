import { Modifier } from "../types/card";
import { laneRoleOf, lanesOfSide, type BoardState, type Side } from "./BoardState";
import { canBlock, type AttackDeclaration, type BlockDeclaration } from "./combat";

/** IA elementare: attacca con tutto ciò che è disponibile. */
export function aiChooseAttackers(state: BoardState, side: Side): AttackDeclaration[] {
  const attackers: AttackDeclaration[] = [];
  for (const row of lanesOfSide(side)) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const card = state.getCard(row, slot);
      if (card && !card.tapped && !card.isDead) attackers.push({ row, slot });
    }
  }
  return attackers;
}

/** IA elementare: prima soddisfa gli obblighi di Guardia, poi blocca a raffica ciò che può. */
export function aiChooseBlocks(
  state: BoardState,
  defendingSide: Side,
  attackers: AttackDeclaration[],
): BlockDeclaration[] {
  const blocks: BlockDeclaration[] = [];
  const usedBlockers = new Set<string>();
  const rows = lanesOfSide(defendingSide);

  const isAttackerTaken = (ref: AttackDeclaration) =>
    blocks.some((b) => b.attackerRow === ref.row && b.attackerSlot === ref.slot);

  for (const row of rows) {
    for (let slot = 0; slot < state.slotCount; slot++) {
      const guard = state.getCard(row, slot);
      if (!guard || guard.tapped || !guard.hasModifier(Modifier.Guard)) continue;
      const target = attackers.find((a) => !isAttackerTaken(a) && canBlock(state, a.row, a.slot, row, slot));
      if (target) {
        blocks.push({ attackerRow: target.row, attackerSlot: target.slot, blockerRow: row, blockerSlot: slot });
        usedBlockers.add(`${row}:${slot}`);
      }
    }
  }

  for (const ref of attackers) {
    if (isAttackerTaken(ref)) continue;
    const defenderRow = rows.find((r) => laneRoleOf(r) === laneRoleOf(ref.row))!;
    for (let slot = 0; slot < state.slotCount; slot++) {
      const key = `${defenderRow}:${slot}`;
      if (usedBlockers.has(key)) continue;
      if (canBlock(state, ref.row, ref.slot, defenderRow, slot)) {
        blocks.push({ attackerRow: ref.row, attackerSlot: ref.slot, blockerRow: defenderRow, blockerSlot: slot });
        usedBlockers.add(key);
        break;
      }
    }
  }

  return blocks;
}

