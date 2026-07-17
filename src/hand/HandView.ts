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

  setOutline(index: number, color: number | null): void {
    this.cardViews[index]?.setOutline(color);
  }

  setInteractive(
    index: number,
    onClick: (() => void) | null,
    onLongPress?: () => void,
    onLongPressEnd?: () => void,
  ): void {
    this.cardViews[index]?.setInteractive(onClick, onLongPress, onLongPressEnd);
  }

  /** Centro della carta in coordinate globali (stage), per far partire da lì l'animazione di piazzamento. */
  getCardGlobalCenter(index: number): { x: number; y: number } | undefined {
    const view = this.cardViews[index];
    if (!view) return undefined;
    const point = view.toGlobal({ x: CARD_WIDTH / 2, y: CARD_HEIGHT / 2 });
    return { x: point.x, y: point.y };
  }
}
