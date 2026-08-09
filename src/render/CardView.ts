import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { MODIFIER_LABELS } from "../types/card";
import type { CardInstance } from "../game/CardInstance";
import { getCardArt, getCardFrame } from "./cardAssets";
import { FRAME_STYLES } from "./frames";

export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 200;
const LONG_PRESS_MS = 450;
const CARD_CORNER_RADIUS = 10;

/** Stessa sagoma arrotondata della cornice/dell'outline: senza maschera l'arte "cover" (rettangolare, angoli scuri per il vignette) sporgerebbe oltre gli angoli tondi mostrando pixel neri invece della trasparenza verso lo sfondo del lane. */
function createCardMask(): Graphics {
  return new Graphics().roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS).fill(0xffffff);
}

/**
 * Le nuove cornici sono illustrazioni a piena carta con una finestra trasparente ritagliata al
 * centro (forma libera, non un rettangolo): l'arte sotto viene "mascherata" gratis dalle parti
 * opache della cornice sopra di essa, quindi qui basta coprire l'intera carta in "cover" (scala
 * uniforme, nessuno stiracchiamento) invece di adattarsi a un rettangolo fisso — quel che sporge
 * oltre la finestra viene semplicemente coperto dal bordo dipinto sopra.
 */
function fitArtCover(sprite: Sprite, texture: Texture): void {
  const scale = Math.max(CARD_WIDTH / texture.width, CARD_HEIGHT / texture.height);
  sprite.width = texture.width * scale;
  sprite.height = texture.height * scale;
  sprite.position.set((CARD_WIDTH - sprite.width) / 2, (CARD_HEIGHT - sprite.height) / 2);
}

/** Alone nero morbido dietro al testo: lo rende leggibile sopra l'illustrazione a piena carta senza pannelli opachi. */
const TEXT_SHADOW = { color: 0x000000, blur: 3, distance: 0, alpha: 0.9 } as const;

export class CardView extends Container {
  readonly instance: CardInstance;
  private readonly outline: Graphics;
  private readonly deathMarker: Container;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(instance: CardInstance) {
    super();
    this.instance = instance;
    const data = instance.data;

    const style = FRAME_STYLES[data.type];

    const artPath = getCardArt(data.id);
    if (artPath) {
      const texture = Texture.from(artPath);
      const art = new Sprite(texture);
      fitArtCover(art, texture);
      // La maschera va aggiunta come figlio (non solo assegnata a `.mask`): da sola, senza un
      // genitore proprio, la sua trasformazione non segue in modo affidabile la scala di `CardView`
      // fuori dal caso semplice (es. nell'anteprima carta ingrandita 1.8x) — Pixi non ridisegna un
      // figlio usato come maschera del suo stesso genitore, quindi non compare come rettangolo bianco.
      const artMask = createCardMask();
      art.mask = artMask;
      this.addChild(art, artMask);
    }

    const framePath = getCardFrame(data.type);
    if (framePath) {
      const frame = new Sprite(Texture.from(framePath));
      frame.width = CARD_WIDTH;
      frame.height = CARD_HEIGHT;
      this.addChild(frame);
    } else {
      const frame = new Graphics()
        .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS)
        .fill(style.fill)
        .stroke({ width: 3, color: style.stroke });
      this.addChild(frame);
    }

    // Angolo in alto a sinistra: sulle nuove cornici è un ornamento (viticci/innesto), simmetrico
    // al distintivo del costo sull'altro angolo — nessun pannello piatto sotto, quindi testo con
    // alone invece di sfondo pieno.
    const typeLabel = new Text({
      text: style.label,
      style: { fontFamily: "sans-serif", fontSize: 10, fill: style.stroke, dropShadow: TEXT_SHADOW },
    });
    typeLabel.position.set(10, 9);
    this.addChild(typeLabel);

    // Angolo in alto a destra: sulla cornice robot è proprio l'incasso circolare previsto per un
    // gemma/distintivo; sulla cornice bestia è il nodo dei rovi, stesso posto funziona comunque.
    const costBadge = new Graphics()
      .circle(CARD_WIDTH - 18, 22, 13)
      .fill({ color: 0x111318, alpha: 0.9 })
      .stroke({ width: 2, color: 0xffe082 });
    this.addChild(costBadge);

    const costText = new Text({
      text: String(instance.cost),
      style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", fill: 0xffe082 },
    });
    costText.anchor.set(0.5);
    costText.position.set(CARD_WIDTH - 18, 22);
    this.addChild(costText);

    // Nome ed eventuali modificatori vivono ora sopra l'illustrazione a piena carta, appena sopra
    // la fascia inferiore dove la cornice si richiude nel gioiello a diamante: fuori da quella zona
    // decorativa, ma ancora dentro la finestra "aperta" dell'illustrazione.
    const name = new Text({
      text: data.name,
      style: {
        fontFamily: "sans-serif",
        fontSize: 13,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
        wordWrap: true,
        wordWrapWidth: CARD_WIDTH - 20,
        dropShadow: TEXT_SHADOW,
      },
    });
    name.position.set((CARD_WIDTH - name.width) / 2, 148);
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
          align: "center",
          wordWrap: true,
          wordWrapWidth: CARD_WIDTH - 20,
          dropShadow: TEXT_SHADOW,
        },
      });
      modifiers.position.set((CARD_WIDTH - modifiers.width) / 2, name.position.y - modifiers.height - 2);
      this.addChild(modifiers);
    }

    // Attacco/difesa negli angoli inferiori: sulla cornice robot cadono sugli incassi circolari,
    // sulla bestia sul nodo di rovi — stessi angoli usati sopra per costo/tipo.
    const attack = new Text({
      text: instance.attackText,
      style: { fontFamily: "sans-serif", fontSize: 18, fontWeight: "bold", fill: 0xff8a65, dropShadow: TEXT_SHADOW },
    });
    attack.position.set(14, CARD_HEIGHT - 30);
    this.addChild(attack);

    const defense = new Text({
      text: instance.defenseText,
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        fontWeight: "bold",
        fill: instance.isDamaged ? 0xff5252 : 0x81d4fa,
        dropShadow: TEXT_SHADOW,
      },
    });
    defense.position.set(CARD_WIDTH - 14 - defense.width, CARD_HEIGHT - 30);
    this.addChild(defense);

    this.outline = new Graphics();
    this.addChild(this.outline);

    // Placeholder testuale: da rifare con un'icona quando ci saranno gli asset.
    this.deathMarker = new Container();
    this.deathMarker.visible = false;
    const deathBackdrop = new Graphics()
      .roundRect(0, CARD_HEIGHT / 2 - 22, CARD_WIDTH, 44, 6)
      .fill({ color: 0x000000, alpha: 0.72 });
    this.deathMarker.addChild(deathBackdrop);
    const deathText = new Text({
      text: "💀 KO",
      style: { fontFamily: "sans-serif", fontSize: 20, fontWeight: "bold", fill: 0xff5252 },
    });
    deathText.anchor.set(0.5);
    deathText.position.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.deathMarker.addChild(deathText);
    this.addChild(this.deathMarker);

    this.setTapped(instance.tapped);
  }

  setTapped(tapped: boolean): void {
    this.alpha = tapped ? 0.45 : 1;
  }

  setDeathMarker(active: boolean): void {
    this.deathMarker.visible = active;
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
