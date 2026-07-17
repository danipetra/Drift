import { Container, Graphics, Rectangle } from "pixi.js";
import { CARD_WIDTH, CARD_HEIGHT, CardView } from "../render/CardView";
import type { CardInstance } from "../game/CardInstance";

const SLOT_GAP = 12;

export type LaneRole = "ranged" | "melee";
export type LaneOwner = "player" | "opponent";

export class Lane extends Container {
  readonly role: LaneRole;
  readonly owner: LaneOwner;
  readonly slotCount: number;
  private background: Graphics;
  private cardViews: (CardView | undefined)[];
  private placeholders: Graphics[];

  constructor(owner: LaneOwner, role: LaneRole, slotCount = 4) {
    super();
    this.owner = owner;
    this.role = role;
    this.slotCount = slotCount;
    this.cardViews = new Array(slotCount);

    this.background = new Graphics();
    this.addChild(this.background);
    this.drawBackground(this.laneWidth());

    this.placeholders = [];
    for (let slot = 0; slot < slotCount; slot++) {
      const placeholder = new Graphics();
      placeholder.position.set(slot * (CARD_WIDTH + SLOT_GAP), 0);
      placeholder.hitArea = new Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT);
      this.addChild(placeholder);
      this.placeholders.push(placeholder);
    }
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

  setCard(slot: number, instance: CardInstance | undefined): void {
    const existing = this.cardViews[slot];
    if (existing) {
      this.removeChild(existing);
      existing.destroy();
    }

    if (!instance) {
      this.cardViews[slot] = undefined;
      return;
    }

    const view = new CardView(instance);
    view.position.set(slot * (CARD_WIDTH + SLOT_GAP), 0);
    this.cardViews[slot] = view;
    this.addChild(view);
  }

  setOutline(slot: number, color: number | null): void {
    this.cardViews[slot]?.setOutline(color);
  }

  setInteractive(slot: number, onClick: (() => void) | null, onLongPress?: () => void, onLongPressEnd?: () => void): void {
    this.cardViews[slot]?.setInteractive(onClick, onLongPress, onLongPressEnd);
  }

  setTapped(slot: number, tapped: boolean): void {
    this.cardViews[slot]?.setTapped(tapped);
  }

  /** Evidenzia uno slot vuoto come bersaglio valido per il piazzamento di una carta dalla mano. */
  setPlaceholderHighlight(slot: number, color: number | null): void {
    const placeholder = this.placeholders[slot];
    placeholder.clear();
    if (color !== null) {
      placeholder
        .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 10)
        .fill({ color, alpha: 0.12 })
        .stroke({ width: 3, color, alpha: 0.8 });
    }
  }

  setPlaceholderInteractive(slot: number, onClick: (() => void) | null): void {
    const placeholder = this.placeholders[slot];
    placeholder.removeAllListeners("pointertap");
    if (onClick) {
      placeholder.eventMode = "static";
      placeholder.cursor = "pointer";
      placeholder.on("pointertap", onClick);
    } else {
      placeholder.eventMode = "none";
      placeholder.cursor = "default";
    }
  }
}
