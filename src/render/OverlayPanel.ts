import { Container, Graphics, Text } from "pixi.js";
import { FONT_BODY, FONT_DISPLAY } from "./fonts";

export interface OverlayButtonConfig {
  label: string;
  onClick: () => void;
  emphasis?: "primary" | "secondary";
}

export interface OverlayPanelConfig {
  title: string;
  subtitle?: string;
  buttons: OverlayButtonConfig[];
}

const PANEL_WIDTH = 280;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 44;
const BUTTON_GAP = 12;

/**
 * Pannello modale generico (titolo + sottotitolo opzionale + pulsanti), pensato per essere
 * riusato ovunque serva interrompere una scena con un messaggio e delle scelte: fine partita
 * oggi, in futuro anche cose come la ricompensa di piano nella Scalata della Torre. Si aggiunge
 * sopra il contenuto della scena chiamante, che lo posiziona/ridimensiona via `layout()`.
 */
export class OverlayPanel extends Container {
  private readonly backdrop: Graphics;
  private readonly panelBox: Container;
  private readonly panelHeight: number;

  constructor(config: OverlayPanelConfig) {
    super();

    this.backdrop = new Graphics();
    this.addChild(this.backdrop);

    this.panelBox = new Container();
    this.addChild(this.panelBox);

    const panelBg = new Graphics();
    this.panelBox.addChild(panelBg);

    let y = 28;
    const title = new Text({
      text: config.title,
      style: {
        fontFamily: FONT_DISPLAY,
        fontSize: 28,
        fill: 0xffffff,
        align: "center",
        wordWrap: true,
        wordWrapWidth: PANEL_WIDTH - 32,
      },
    });
    title.position.set((PANEL_WIDTH - title.width) / 2, y);
    this.panelBox.addChild(title);
    y += title.height + 12;

    if (config.subtitle) {
      const subtitle = new Text({
        text: config.subtitle,
        style: {
          fontFamily: FONT_BODY,
          fontSize: 14,
          fill: 0xb0bec5,
          align: "center",
          wordWrap: true,
          wordWrapWidth: PANEL_WIDTH - 32,
        },
      });
      subtitle.position.set((PANEL_WIDTH - subtitle.width) / 2, y);
      this.panelBox.addChild(subtitle);
      y += subtitle.height + 20;
    } else {
      y += 12;
    }

    for (const button of config.buttons) {
      const view = this.createButton(button);
      view.position.set((PANEL_WIDTH - BUTTON_WIDTH) / 2, y);
      this.panelBox.addChild(view);
      y += BUTTON_HEIGHT + BUTTON_GAP;
    }

    this.panelHeight = y - BUTTON_GAP + 28;
    panelBg
      .roundRect(0, 0, PANEL_WIDTH, this.panelHeight, 16)
      .fill({ color: 0x181c22 })
      .stroke({ width: 2, color: 0x3a3f45 });
  }

  private createButton(config: OverlayButtonConfig): Container {
    const button = new Container();
    const isPrimary = config.emphasis !== "secondary";
    const bg = new Graphics()
      .roundRect(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 8)
      .fill({ color: isPrimary ? 0x4fc3f7 : 0x262b31 })
      .stroke({ width: isPrimary ? 0 : 1.5, color: 0x565c63 });
    button.addChild(bg);

    const label = new Text({
      text: config.label,
      style: { fontFamily: FONT_DISPLAY, fontSize: 15, fill: isPrimary ? 0x101418 : 0xd8d8d8 },
    });
    label.position.set((BUTTON_WIDTH - label.width) / 2, (BUTTON_HEIGHT - label.height) / 2);
    button.addChild(label);

    button.eventMode = "static";
    button.cursor = "pointer";
    button.on("pointertap", config.onClick);
    return button;
  }

  /** Ricentra il pannello e ridisegna il backdrop per la dimensione corrente dello schermo. */
  layout(screenWidth: number, screenHeight: number): void {
    this.backdrop.clear().rect(0, 0, screenWidth, screenHeight).fill({ color: 0x000000, alpha: 0.65 });
    this.panelBox.position.set((screenWidth - PANEL_WIDTH) / 2, (screenHeight - this.panelHeight) / 2);
  }
}
