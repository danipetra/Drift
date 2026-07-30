import { DEFAULT_STARTING_HEALTH } from "./BoardState";

const BASE_FLOOR_SCORE = 500;
const TURN_PENALTY = 12;
const DAMAGE_TAKEN_PENALTY = 8;
const OVERKILL_BONUS = 3;
const MIN_FLOOR_SCORE = 50;

/**
 * Punteggio di un piano: parte da una base fissa e viene eroso da quanto ci sei messo e da
 * quanto danno hai incassato, con un piccolo bonus se hai chiuso il conto con un margine netto
 * (vita dell'avversario finita ben sotto zero). Mai sotto un minimo, per non azzerare l'impegno.
 */
export function computeFloorScore(turnsTaken: number, playerHealth: number, opponentHealth: number): number {
  const damageTaken = DEFAULT_STARTING_HEALTH - Math.max(0, playerHealth);
  const overkill = Math.max(0, -opponentHealth);
  const raw = BASE_FLOOR_SCORE - turnsTaken * TURN_PENALTY - damageTaken * DAMAGE_TAKEN_PENALTY + overkill * OVERKILL_BONUS;
  return Math.max(MIN_FLOOR_SCORE, Math.round(raw));
}
