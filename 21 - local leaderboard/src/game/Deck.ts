import { getCardById } from "../data/cardLoader";
import type { CardData } from "../types/card";

export class Deck {
  private cards: CardData[];

  constructor(cardIds: string[]) {
    this.cards = cardIds.map((id) => {
      const card = getCardById(id);
      if (!card) throw new Error(`Carta sconosciuta nel mazzo: ${id}`);
      return card;
    });
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  get remaining(): number {
    return this.cards.length;
  }

  draw(): CardData | undefined {
    return this.cards.pop();
  }
}
