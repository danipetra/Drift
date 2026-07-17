import { Container } from "pixi.js";
import { CARD_WIDTH, CARD_HEIGHT, CardView } from "../render/CardView";
import type { CardInstance } from "../game/CardInstance";

const CARD_GAP = 10;
export const HAND_SCALE = 0.55;

export class HandView extends Container {
  private cardViews: CardView[] = [];

  setCards(cards: CardInstance[]): void {
    for (const view of this.cardViews) {
      this.removeChild(view);
      view.destroy();
    }

    this.cardViews = cards.map((card, index) => {
      const view = new CardView(card);
      view.scale.set(HAND_SCALE);
      view.position.set(index * (CARD_WIDTH * HAND_SCALE + CARD_GAP), 0);
      this.addChild(view);
      return view;
    });
  }

  handWidth(): number {
    if (this.cardViews.length === 0) return 0;
    return this.cardViews.length * (CARD_WIDTH * HAND_SCALE + CARD_GAP) - CARD_GAP;
  }

  handHeight(): number {
    return CARD_HEIGHT * HAND_SCALE;
  }
}
