import { Text } from "pixi.js";
import { getCardById } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { TowerRun } from "../../game/TowerRun";
import { resolveNode, type TowerNode } from "../../game/towerMap";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { layoutCardGrid } from "../../render/cardGrid";
import { BaseScene } from "./BaseScene";
import { TowerMapScene } from "./TowerMapScene";

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
  private readonly node: TowerNode;

  constructor(run: TowerRun, incomingCardId: string, node: TowerNode) {
    super();
    this.run = run;
    this.incomingCardId = incomingCardId;
    this.node = node;
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
    this.refuseText.on("pointertap", () => this.returnToMap());
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
    this.returnToMap();
  }

  private returnToMap(): void {
    resolveNode(this.run, this.node);
    this.context.goTo(() => new TowerMapScene(this.run));
  }

  protected layout(): void {
    const { width } = this.context.app.screen;
    this.titleText.position.set((width - this.titleText.width) / 2, 20);

    const startY = 70;
    const { slots, gridHeight } = layoutCardGrid(
      this.cardViews.length,
      width,
      COLUMNS,
      CARD_WIDTH * CARD_SCALE,
      CARD_HEIGHT * CARD_SCALE,
      GRID_GAP,
      startY,
    );
    this.cardViews.forEach((view, i) => {
      view.scale.set(CARD_SCALE * slots[i].scale);
      view.position.set(slots[i].x, slots[i].y);
    });

    this.refuseText.position.set((width - this.refuseText.width) / 2, startY + gridHeight + 24);
  }
}
