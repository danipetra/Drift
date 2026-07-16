import { Container, Graphics, Text } from "pixi.js";
import { MODIFIER_LABELS } from "../types/card";
import type { CardInstance } from "../game/CardInstance";
import { FRAME_STYLES } from "./frames";

export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 200;

export class CardView extends Container {
  readonly instance: CardInstance;

  constructor(instance: CardInstance) {
    super();
    this.instance = instance;
    const data = instance.data;

    const style = FRAME_STYLES[data.type];

    const frame = new Graphics()
      .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 10)
      .fill(style.fill)
      .stroke({ width: 3, color: style.stroke });
    this.addChild(frame);

    const typeLabel = new Text({
      text: style.label,
      style: { fontFamily: "sans-serif", fontSize: 10, fill: style.stroke },
    });
    typeLabel.position.set(8, 6);
    this.addChild(typeLabel);

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
  }
}
