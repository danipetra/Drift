import { Modifier } from "../types/card";
import type { BoardState, RowKey } from "./BoardState";
import type { CardInstance } from "./CardInstance";

interface AttackPair {
  attackerRow: RowKey;
  defenderRow: RowKey;
  defenderFace: "player" | "opponent";
}

const ATTACK_PAIRS: AttackPair[] = [
  { attackerRow: "playerMelee", defenderRow: "opponentMelee", defenderFace: "opponent" },
  { attackerRow: "playerRanged", defenderRow: "opponentRanged", defenderFace: "opponent" },
  { attackerRow: "opponentMelee", defenderRow: "playerMelee", defenderFace: "player" },
  { attackerRow: "opponentRanged", defenderRow: "playerRanged", defenderFace: "player" },
];

export interface CombatEvent {
  type: "attack" | "miss" | "death" | "face-damage";
  message: string;
}

export function resolveCombatRound(state: BoardState): CombatEvent[] {
  const events: CombatEvent[] = [];

  for (const pair of ATTACK_PAIRS) resolvePairAttacks(state, pair, events, true);
  removeDeadCards(state, events);

  for (const pair of ATTACK_PAIRS) resolvePairAttacks(state, pair, events, false);
  removeDeadCards(state, events);

  return events;
}

function resolvePairAttacks(
  state: BoardState,
  pair: AttackPair,
  events: CombatEvent[],
  firstStrikePhase: boolean,
): void {
  for (let slot = 0; slot < state.slotCount; slot++) {
    const attacker = state.getCard(pair.attackerRow, slot);
    if (!attacker || attacker.isDead) continue;

    const isFirstStrike = attacker.hasModifier(Modifier.FirstStrike);
    if (firstStrikePhase !== isFirstStrike) continue;

    resolveSingleAttack(state, pair, slot, attacker, events);
  }
}

function resolveSingleAttack(
  state: BoardState,
  pair: AttackPair,
  slot: number,
  attacker: CardInstance,
  events: CombatEvent[],
): void {
  let defender = state.getCard(pair.defenderRow, slot);
  if (defender?.hasModifier(Modifier.Stealth)) {
    defender = undefined;
  }

  const target = defender ?? findGuard(state, pair.defenderRow);

  if (!target) {
    const amount = attacker.currentAttack;
    if (pair.defenderFace === "player") state.playerHealth -= amount;
    else state.opponentHealth -= amount;
    events.push({
      type: "face-damage",
      message: `${attacker.data.name} colpisce direttamente per ${amount}`,
    });
    return;
  }

  if (target.hasModifier(Modifier.Flying) && !attacker.hasModifier(Modifier.Flying)) {
    events.push({
      type: "miss",
      message: `${attacker.data.name} manca ${target.data.name} (volare)`,
    });
    return;
  }

  const amount = attacker.currentAttack;
  target.currentDefense -= amount;
  if (attacker.hasModifier(Modifier.Deadly) && amount > 0) {
    target.currentDefense = 0;
  }
  events.push({
    type: "attack",
    message: `${attacker.data.name} infligge ${amount} a ${target.data.name}`,
  });
}

function findGuard(state: BoardState, row: RowKey): CardInstance | undefined {
  return state.rows[row].find((card) => card && !card.isDead && card.hasModifier(Modifier.Guard));
}

function removeDeadCards(state: BoardState, events: CombatEvent[]): void {
  for (const row of Object.keys(state.rows) as RowKey[]) {
    const slots = state.rows[row];
    for (let slot = 0; slot < slots.length; slot++) {
      const card = slots[slot];
      if (card?.isDead) {
        events.push({ type: "death", message: `${card.data.name} muore` });
        state.setCard(row, slot, undefined);
      }
    }
  }
}
