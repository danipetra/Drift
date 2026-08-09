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
  private readonly laneTarget: Graphics;

  constructor(owner: LaneOwner, role: LaneRole, slotCount = 4) {
    super();
    this.owner = owner;
    this.role = role;
    this.slotCount = slotCount;
    this.cardViews = new Array(slotCount);

    this.background = new Graphics();
    this.addChild(this.background);
    this.drawBackground(this.laneWidth());

    // Bersaglio ranged per l'intera corsia (usato solo quando è completamente vuota: si seleziona
    // come un unico bersaglio invece che slot per slot). Stessa geometria dello sfondo della corsia.
    this.laneTarget = new Graphics();
    this.laneTarget.hitArea = new Rectangle(-8, -8, this.laneWidth() + 16, CARD_HEIGHT + 16);
    this.addChild(this.laneTarget);

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

  setDeathMarker(slot: number, active: boolean): void {
    this.cardViews[slot]?.setDeathMarker(active);
  }

  getCardView(slot: number): CardView | undefined {
    return this.cardViews[slot];
  }

  /** Centro dello slot in coordinate globali (stage), utile per animazioni che attraversano container diversi. */
  getSlotGlobalCenter(slot: number): { x: number; y: number } {
    const local = { x: slot * (CARD_WIDTH + SLOT_GAP) + CARD_WIDTH / 2, y: CARD_HEIGHT / 2 };
    const point = this.toGlobal(local);
    return { x: point.x, y: point.y };
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

  /** Evidenzia l'intera corsia come bersaglio ranged valido (solo quando è completamente vuota). */
  setLaneHighlight(color: number | null): void {
    this.laneTarget.clear();
    if (color !== null) {
      this.laneTarget
        .roundRect(-8, -8, this.laneWidth() + 16, CARD_HEIGHT + 16, 8)
        .fill({ color, alpha: 0.12 })
        .stroke({ width: 3, color, alpha: 0.8 });
    }
  }

  setLaneInteractive(onClick: (() => void) | null): void {
    this.laneTarget.removeAllListeners("pointertap");
    if (onClick) {
      this.laneTarget.eventMode = "static";
      this.laneTarget.cursor = "pointer";
      this.laneTarget.on("pointertap", onClick);
    } else {
      this.laneTarget.eventMode = "none";
      this.laneTarget.cursor = "default";
    }
  }
}
