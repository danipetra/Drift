import { getAllCards } from "./cardLoader";
import defaultEnemyDeck from "./decks/enemyDeck.json";

/** Un solo mazzo nemico per ora: la scelta casuale è già cablata, pronta per quando se ne aggiungeranno altri. */
const ENEMY_DECKS: string[][] = [defaultEnemyDeck as string[]];

export function pickRandomEnemyDeckIds(): string[] {
  return ENEMY_DECKS[Math.floor(Math.random() * ENEMY_DECKS.length)];
}

/** Mazzo nemico generato pescando a caso dall'intero pool di carte: usato dalla Scalata della
 * Torre per garantire un avversario diverso a ogni piano, senza bisogno di mazzi pre-autorati. */
export function generateRandomEnemyDeck(size = 12): string[] {
  const pool = getAllCards().map((card) => card.id);
  const deck: string[] = [];
  for (let i = 0; i < size; i++) {
    deck.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return deck;
}

/** Nodo "scontro potenziato": stesso pool, mazzo più grande per una presenza sul campo maggiore. */
export function generateEmpoweredEnemyDeck(size = 16): string[] {
  return generateRandomEnemyDeck(size);
}

/** Nodo "boss": pesca solo dalle carte di costo più alto (fallback all'intero pool se ce ne sono ancora poche). */
export function generateBossEnemyDeck(size = 14): string[] {
  const strong = getAllCards()
    .filter((card) => parseInt(card.cost, 10) >= 5)
    .map((card) => card.id);
  const pool = strong.length > 0 ? strong : getAllCards().map((card) => card.id);
  const deck: string[] = [];
  for (let i = 0; i < size; i++) {
    deck.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return deck;
}
