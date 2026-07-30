import { MAX_DECK_SIZE } from "./deckRules";
import { getPlayerProfile } from "./PlayerProfile";

export { MAX_DECK_SIZE };

/** Stato che attraversa più piani della Scalata della Torre: punteggio e mazzo del giocatore, che evolve piano dopo piano. */
export class TowerRun {
  score = 0;
  deckIds: string[];

  /** Di default parte da un'istantanea del mazzo che il giocatore ha costruito: la run poi
   *  evolve per conto suo (ricompense/scarti) senza scrivere di nuovo sul mazzo permanente. */
  constructor(startingDeckIds: string[] = [...getPlayerProfile().deck]) {
    this.deckIds = startingDeckIds;
  }
}
