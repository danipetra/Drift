import { Container, Graphics } from "pixi.js";
import { CARD_WIDTH, CARD_HEIGHT, CardView } from "../render/CardView";
import type { CardData } from "../types/card";

const SLOT_GAP = 12;

export type LaneRole = "ranged" | "melee";
export type LaneOwner = "player" | "opponent";

export class Lane extends Container {
  readonly role: LaneRole;
  readonly owner: LaneOwner;
  readonly slotCount: number;
  private background: Graphics;
  private cardViews: (CardView | undefined)[];

  constructor(owner: LaneOwner, role: LaneRole, slotCount = 4) {
    super();
    this.owner = owner;
    this.role = role;
    this.slotCount = slotCount;
    this.cardViews = new Array(slotCount);

    this.background = new Graphics();
    this.addChild(this.background);
    this.drawBackground(this.laneWidth());
  }

  laneWidth(): number {
    return this.slotCount * CARD_WIDTH + (this.slotCount - 1) * SLOT_GAP;
  }

  laneHeight(): number {
    return CARD_HEIGHT;
  }

  private drawBackground(width: number): void {
    this.background.clear();
    this.background
      .roundRect(-8, -8, width + 16, CARD_HEIGHT + 16, 8)
      .fill({ color: 0xffffff, alpha: 0.04 });
  }

  setCard(slot: number, data: CardData | undefined): void {
    const existing = this.cardViews[slot];
    if (existing) {
      this.removeChild(existing);
      existing.destroy();
    }

    if (!data) {
      this.cardViews[slot] = undefined;
      return;
    }

    const view = new CardView(data);
    view.position.set(slot * (CARD_WIDTH + SLOT_GAP), 0);
    this.cardViews[slot] = view;
    this.addChild(view);
  }
}
