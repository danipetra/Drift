import type { CardInstance } from "./CardInstance";

export type RowKey = "opponentRanged" | "opponentMelee" | "playerMelee" | "playerRanged";

export const ROW_KEYS: RowKey[] = ["opponentRanged", "opponentMelee", "playerMelee", "playerRanged"];

export class BoardState {
  readonly slotCount: number;
  playerHealth: number;
  opponentHealth: number;
  readonly rows: Record<RowKey, (CardInstance | undefined)[]>;

  constructor(slotCount = 4, startingHealth = 20) {
    this.slotCount = slotCount;
    this.playerHealth = startingHealth;
    this.opponentHealth = startingHealth;
    this.rows = {
      opponentRanged: new Array(slotCount),
      opponentMelee: new Array(slotCount),
      playerMelee: new Array(slotCount),
      playerRanged: new Array(slotCount),
    };
  }

  setCard(row: RowKey, slot: number, card: CardInstance | undefined): void {
    this.rows[row][slot] = card;
  }

  getCard(row: RowKey, slot: number): CardInstance | undefined {
    return this.rows[row][slot];
  }
}
