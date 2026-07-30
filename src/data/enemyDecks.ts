import defaultEnemyDeck from "./decks/enemyDeck.json";

/** Un solo mazzo nemico per ora: la scelta casuale è già cablata, pronta per quando se ne aggiungeranno altri. */
const ENEMY_DECKS: string[][] = [defaultEnemyDeck as string[]];

export function pickRandomEnemyDeckIds(): string[] {
  return ENEMY_DECKS[Math.floor(Math.random() * ENEMY_DECKS.length)];
}
