import { Text } from "pixi.js";
import { getCardById } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { TowerRun } from "../../game/TowerRun";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { BaseScene } from "./BaseScene";
import { createTowerFloorScene } from "./towerFlow";

const CARD_SCALE = 0.4;
const COLUMNS = 5;
const GRID_GAP = 12;

/** Mazzo già a 20 carte: scegli una delle carte attuali da scartare per fare posto alla nuova, o rifiuta. */
export class TowerDiscardScene extends BaseScene {
  private readonly titleText: Text;
  private readonly refuseText: Text;
  private readonly cardViews: CardView[] = [];
  private readonly run: TowerRun;
  private readonly incomingCardId: string;

  constructor(run: TowerRun, incomingCardId: string) {
    super();
    this.run = run;
    this.incomingCardId = incomingCardId;
    this.titleText = new Text({
      text: "Mazzo pieno: scegli una carta da scartare",
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
        wordWrap: true,
        wordWrapWidth: 420,
      },
    });
    this.refuseText = new Text({
      text: "Rifiuta (non cambiare il mazzo)",
      style: { fontFamily: "sans-serif", fontSize: 14, fill: 0xff8a65, align: "center" },
    });
    this.container.addChild(this.titleText, this.refuseText);
  }

  protected onMount(): void {
    this.buildGrid();
    this.refuseText.eventMode = "static";
    this.refuseText.cursor = "pointer";
    this.refuseText.on("pointertap", () => this.goToNextFloor());
  }

  private buildGrid(): void {
    this.run.deckIds.forEach((cardId, index) => {
      const data = getCardById(cardId);
      if (!data) return;
      const view = new CardView(new CardInstance(data));
      view.scale.set(CARD_SCALE);
      view.setInteractive(() => this.discardAndReplace(index));
      this.cardViews.push(view);
      this.container.addChild(view);
    });
  }

  private discardAndReplace(index: number): void {
    this.run.deckIds.splice(index, 1, this.incomingCardId);
    this.goToNextFloor();
  }

  private goToNextFloor(): void {
    this.context.goTo(() => createTowerFloorScene(this.run));
  }

  protected layout(): void {
    const { width } = this.context.app.screen;
    this.titleText.position.set((width - this.titleText.width) / 2, 20);

    const cardWidth = CARD_WIDTH * CARD_SCALE;
    const cardHeight = CARD_HEIGHT * CARD_SCALE;
    const rows = Math.ceil(this.cardViews.length / COLUMNS);
    const gridWidth = COLUMNS * cardWidth + (COLUMNS - 1) * GRID_GAP;
    const scale = Math.min(1, (width - 32) / gridWidth);
    const startX = (width - gridWidth * scale) / 2;
    const startY = 70;

    this.cardViews.forEach((view, i) => {
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      view.scale.set(CARD_SCALE * scale);
      view.position.set(
        startX + col * (cardWidth + GRID_GAP) * scale,
        startY + row * (cardHeight + GRID_GAP) * scale,
      );
    });

    const gridHeight = rows * cardHeight * scale + Math.max(0, rows - 1) * GRID_GAP * scale;
    this.refuseText.position.set((width - this.refuseText.width) / 2, startY + gridHeight + 24);
  }
}
