import { MAX_DECK_SIZE } from "./deckRules";
import { getPlayerProfile } from "./PlayerProfile";
import { generateTowerMap, type TowerMap } from "./towerMap";

export { MAX_DECK_SIZE };

/** Stato che attraversa più piani della Scalata della Torre: punteggio e mazzo del giocatore, che evolve piano dopo piano. */
export class TowerRun {
  score = 0;
  floorsCleared = 0;
  deckIds: string[];
  map: TowerMap;
  /** `null` finché il giocatore non entra nella mappa: in quel caso il layer 0 è raggiungibile. */
  currentNodeId: string | null = null;
  visitedNodeIds = new Set<string>();

  /** Di default parte da un'istantanea del mazzo che il giocatore ha costruito: la run poi
   *  evolve per conto suo (ricompense/scarti) senza scrivere di nuovo sul mazzo permanente. */
  constructor(startingDeckIds: string[] = [...getPlayerProfile().deck]) {
    this.deckIds = startingDeckIds;
    this.map = generateTowerMap();
  }
}
