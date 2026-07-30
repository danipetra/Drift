import playerDeckIds from "../data/decks/playerDeck.json";

export const MAX_DECK_SIZE = 20;

/** Stato che attraversa più piani della Scalata della Torre: punteggio e mazzo del giocatore, che evolve piano dopo piano. */
export class TowerRun {
  score = 0;
  deckIds: string[];

  constructor(startingDeckIds: string[] = [...(playerDeckIds as string[])]) {
    this.deckIds = startingDeckIds;
  }
}
