import { Text } from "pixi.js";
import { getCardById, registerCustomCard } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { TowerRun } from "../../game/TowerRun";
import { resolveNode, type TowerNode } from "../../game/towerMap";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import type { CardData } from "../../types/card";
import { BaseScene } from "./BaseScene";
import { TowerMapScene } from "./TowerMapScene";

const CARD_SCALE = 0.85;
const CARD_GAP = 24;

let customCardCounter = 0;

/** Nodo "fusione": unisce due copie identiche presenti nel mazzo in una sola carta più forte. */
export class TowerFusionScene extends BaseScene {
  private readonly run: TowerRun;
  private readonly node: TowerNode;
  private readonly titleText: Text;
  private readonly skipText: Text;
  private readonly cardViews: CardView[] = [];

  constructor(run: TowerRun, node: TowerNode) {
    super();
    this.run = run;
    this.node = node;
    this.titleText = new Text({
      text: "Fusione: scegli quale coppia fondere",
      style: { fontFamily: "sans-serif", fontSize: 20, fontWeight: "bold", fill: 0xffffff, align: "center" },
    });
    this.skipText = new Text({
      text: "Salta",
      style: { fontFamily: "sans-serif", fontSize: 13, fill: 0x8a919a, align: "center" },
    });
    this.container.addChild(this.titleText, this.skipText);
  }

  protected onMount(): void {
    this.buildChoices();
    this.skipText.eventMode = "static";
    this.skipText.cursor = "pointer";
    this.skipText.on("pointertap", () => this.returnToMap());
  }

  private buildChoices(): void {
    const counts = new Map<string, number>();
    for (const id of this.run.deckIds) counts.set(id, (counts.get(id) ?? 0) + 1);

    for (const [id, count] of counts) {
      if (count < 2) continue;
      const data = getCardById(id);
      if (!data) continue;
      const view = new CardView(new CardInstance(data));
      view.scale.set(CARD_SCALE);
      view.setInteractive(() => this.fuse(id));
      this.cardViews.push(view);
      this.container.addChild(view);
    }
  }

  private fuse(cardId: string): void {
    const data = getCardById(cardId)!;
    const fusedData: CardData = {
      ...data,
      id: `fuse:${customCardCounter++}`,
      name: `Fusione: ${data.name}`,
      attack: String(parseInt(data.attack, 10) * 2),
      defense: String(parseInt(data.defense, 10) * 2),
      cost: String(parseInt(data.cost, 10) + 1),
    };
    registerCustomCard(fusedData);

    let removed = 0;
    for (let i = this.run.deckIds.length - 1; i >= 0 && removed < 2; i--) {
      if (this.run.deckIds[i] === cardId) {
        this.run.deckIds.splice(i, 1);
        removed++;
      }
    }
    this.run.deckIds.push(fusedData.id);
    this.returnToMap();
  }

  private returnToMap(): void {
    resolveNode(this.run, this.node);
    this.context.goTo(() => new TowerMapScene(this.run));
  }

  protected layout(): void {
    const { width, height } = this.context.app.screen;
    this.titleText.position.set((width - this.titleText.width) / 2, height * 0.12);

    const cardWidth = CARD_WIDTH * CARD_SCALE;
    const cardHeight = CARD_HEIGHT * CARD_SCALE;
    const rawWidth = this.cardViews.length * cardWidth + Math.max(0, this.cardViews.length - 1) * CARD_GAP;
    const scale = Math.min(1, (width - 32) / rawWidth);
    const totalWidth = rawWidth * scale;
    const startX = (width - totalWidth) / 2;
    const cardY = height * 0.32;
    this.cardViews.forEach((view, index) => {
      view.scale.set(CARD_SCALE * scale);
      view.position.set(startX + index * (cardWidth + CARD_GAP) * scale, cardY);
    });

    this.skipText.position.set((width - this.skipText.width) / 2, cardY + cardHeight * scale + 30);
  }
}
