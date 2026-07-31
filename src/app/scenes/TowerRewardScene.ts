import { Text } from "pixi.js";
import { getCardById } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { getPlayerProfile } from "../../game/PlayerProfile";
import { MAX_DECK_SIZE, TowerRun } from "../../game/TowerRun";
import { pickRewardChoices } from "../../game/towerRewards";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { BaseScene } from "./BaseScene";
import { TowerDiscardScene } from "./TowerDiscardScene";
import { createTowerFloorScene } from "./towerFlow";

const CARD_SCALE = 0.85;
const CARD_GAP = 24;

/** Dopo una vittoria in torre: scegli 1 di 3 carte dal mazzo del nemico appena sconfitto, o salta. */
export class TowerRewardScene extends BaseScene {
  private readonly titleText: Text;
  private readonly subtitleText: Text;
  private readonly skipText: Text;
  private readonly cardViews: CardView[] = [];
  private readonly run: TowerRun;
  private readonly enemyDeckIds: string[];

  constructor(run: TowerRun, enemyDeckIds: string[]) {
    super();
    this.run = run;
    this.enemyDeckIds = enemyDeckIds;
    this.titleText = new Text({
      text: `Piano superato! Punteggio: ${run.score}`,
      style: { fontFamily: "sans-serif", fontSize: 24, fontWeight: "bold", fill: 0xffffff, align: "center" },
    });
    this.subtitleText = new Text({
      text: "Scegli una carta da aggiungere al mazzo",
      style: { fontFamily: "sans-serif", fontSize: 14, fill: 0xb0bec5, align: "center" },
    });
    this.skipText = new Text({
      text: "Salta ricompensa",
      style: { fontFamily: "sans-serif", fontSize: 13, fill: 0x8a919a, align: "center" },
    });
    this.container.addChild(this.titleText, this.subtitleText, this.skipText);
  }

  protected onMount(): void {
    this.buildChoices();
    this.skipText.eventMode = "static";
    this.skipText.cursor = "pointer";
    this.skipText.on("pointertap", () => this.goToNextFloor());
  }

  private buildChoices(): void {
    const choiceIds = pickRewardChoices(this.enemyDeckIds, 3);
    for (const id of choiceIds) {
      const data = getCardById(id);
      if (!data) continue;
      const view = new CardView(new CardInstance(data));
      view.scale.set(CARD_SCALE);
      view.setInteractive(() => this.chooseCard(id));
      this.cardViews.push(view);
      this.container.addChild(view);
    }
  }

  private chooseCard(cardId: string): void {
    // Permanente e indipendente dalla run: la carta resta sbloccata anche se questa run finisce.
    getPlayerProfile().unlock(cardId);
    if (this.run.deckIds.length < MAX_DECK_SIZE) {
      this.run.deckIds.push(cardId);
      this.goToNextFloor();
    } else {
      this.context.goTo(() => new TowerDiscardScene(this.run, cardId));
    }
  }

  private goToNextFloor(): void {
    this.context.goTo(() => createTowerFloorScene(this.run));
  }

  protected layout(): void {
    const { width, height } = this.context.app.screen;

    this.titleText.position.set((width - this.titleText.width) / 2, height * 0.12);
    this.subtitleText.position.set(
      (width - this.subtitleText.width) / 2,
      height * 0.12 + this.titleText.height + 10,
    );

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
