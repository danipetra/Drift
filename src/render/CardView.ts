import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { MODIFIER_LABELS } from "../types/card";
import type { CardInstance } from "../game/CardInstance";
import { getCardArt, getCardFrame } from "./cardAssets";
import { FRAME_STYLES } from "./frames";

export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 200;
/** Rettangolo riservato all'illustrazione centrale, nelle stesse unità della carta (base 140×200). */
export const ART_WINDOW = { x: 8, y: 58, width: 124, height: 86 };
const LONG_PRESS_MS = 450;

export class CardView extends Container {
  readonly instance: CardInstance;
  private readonly outline: Graphics;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(instance: CardInstance) {
    super();
    this.instance = instance;
    const data = instance.data;

    const style = FRAME_STYLES[data.type];

    const artPath = getCardArt(data.id);
    if (artPath) {
      const art = new Sprite(Texture.from(artPath));
      art.position.set(ART_WINDOW.x, ART_WINDOW.y);
      art.width = ART_WINDOW.width;
      art.height = ART_WINDOW.height;
      this.addChild(art);
    }

    const framePath = getCardFrame(data.type);
    if (framePath) {
      const frame = new Sprite(Texture.from(framePath));
      frame.width = CARD_WIDTH;
      frame.height = CARD_HEIGHT;
      this.addChild(frame);
    } else {
      const frame = new Graphics()
        .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 10)
        .fill(style.fill)
        .stroke({ width: 3, color: style.stroke });
      this.addChild(frame);
    }

    const typeLabel = new Text({
      text: style.label,
      style: { fontFamily: "sans-serif", fontSize: 10, fill: style.stroke },
    });
    typeLabel.position.set(8, 6);
    this.addChild(typeLabel);

    const costBadge = new Graphics()
      .circle(CARD_WIDTH - 16, 16, 13)
      .fill({ color: 0x111318, alpha: 0.9 })
      .stroke({ width: 2, color: 0xffe082 });
    this.addChild(costBadge);

    const costText = new Text({
      text: String(instance.cost),
      style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", fill: 0xffe082 },
    });
    costText.anchor.set(0.5);
    costText.position.set(CARD_WIDTH - 16, 16);
    this.addChild(costText);

    const name = new Text({
      text: data.name,
      style: {
        fontFamily: "sans-serif",
        fontSize: 14,
        fontWeight: "bold",
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: CARD_WIDTH - 16,
      },
    });
    name.position.set(8, 22);
    this.addChild(name);

    if (data.modifiers.length > 0) {
      const modifiersText = data.modifiers
        .map((modifier) => MODIFIER_LABELS[modifier])
        .join(" · ");
      const modifiers = new Text({
        text: modifiersText,
        style: {
          fontFamily: "sans-serif",
          fontSize: 9,
          fill: 0xd8d8d8,
          wordWrap: true,
          wordWrapWidth: CARD_WIDTH - 16,
        },
      });
      modifiers.position.set(8, CARD_HEIGHT - 54);
      this.addChild(modifiers);
    }

    const attack = new Text({
      text: instance.attackText,
      style: { fontFamily: "sans-serif", fontSize: 18, fontWeight: "bold", fill: 0xff8a65 },
    });
    attack.position.set(10, CARD_HEIGHT - 26);
    this.addChild(attack);

    const defense = new Text({
      text: instance.defenseText,
      style: { fontFamily: "sans-serif", fontSize: 18, fontWeight: "bold", fill: 0x81d4fa },
    });
    defense.position.set(CARD_WIDTH - 10 - defense.width, CARD_HEIGHT - 26);
    this.addChild(defense);

    this.outline = new Graphics();
    this.addChild(this.outline);

    this.setTapped(instance.tapped);
  }

  setTapped(tapped: boolean): void {
    this.alpha = tapped ? 0.45 : 1;
  }

  setOutline(color: number | null): void {
    this.outline.clear();
    if (color !== null) {
      this.outline.roundRect(-4, -4, CARD_WIDTH + 8, CARD_HEIGHT + 8, 12).stroke({ width: 4, color });
    }
  }

  /**
   * `onLongPress`/`onLongPressEnd` implementano un gesto di pressione prolungata
   * (mostra/nascondi un'anteprima) senza far scattare anche `onClick` al rilascio:
   * "pointertap" di Pixi non distingue tap brevi da pressioni lunghe, quindi qui
   * il tap normale è reimplementato a mano su pointerdown/pointerup.
   */
  setInteractive(onClick: (() => void) | null, onLongPress?: () => void, onLongPressEnd?: () => void): void {
    this.removeAllListeners("pointertap");
    this.removeAllListeners("pointerdown");
    this.removeAllListeners("pointerup");
    this.removeAllListeners("pointerupoutside");
    this.removeAllListeners("pointercancel");
    this.clearLongPressTimer();

    if (!onClick && !onLongPress) {
      this.eventMode = "none";
      this.cursor = "default";
      return;
    }

    this.eventMode = "static";
    this.cursor = "pointer";

    if (!onLongPress) {
      if (onClick) this.on("pointertap", onClick);
      return;
    }

    let longPressFired = false;
    const endLongPress = () => {
      this.clearLongPressTimer();
      if (longPressFired) onLongPressEnd?.();
    };

    this.on("pointerdown", () => {
      longPressFired = false;
      this.clearLongPressTimer();
      this.longPressTimer = setTimeout(() => {
        longPressFired = true;
        onLongPress();
      }, LONG_PRESS_MS);
    });
    this.on("pointerup", () => {
      const wasLongPress = longPressFired;
      endLongPress();
      if (!wasLongPress) onClick?.();
    });
    this.on("pointerupoutside", endLongPress);
    this.on("pointercancel", endLongPress);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
