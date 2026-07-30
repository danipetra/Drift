/** Regole condivise di composizione mazzo: vivono qui, senza dipendenze, per evitare cicli
 *  di import tra `PlayerProfile` (collezione + mazzo persistiti) e `TowerRun` (una singola run). */
export const MAX_DECK_SIZE = 20;
export const MAX_COPIES_PER_CARD = 3;
