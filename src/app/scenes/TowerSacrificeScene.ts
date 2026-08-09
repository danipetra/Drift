import { Text } from "pixi.js";
import { getCardById, registerCustomCard } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { TowerRun } from "../../game/TowerRun";
import { resolveNode, type TowerNode } from "../../game/towerMap";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { layoutCardGrid } from "../../render/cardGrid";
import { MODIFIER_LABELS, type CardData, type Modifier } from "../../types/card";
import { BaseScene } from "./BaseScene";
import { TowerMapScene } from "./TowerMapScene";

const CARD_SCALE = 0.5;
const COLUMNS = 4;
const GRID_GAP = 16;
const GRID_START_Y = 100;

let customCardCounter = 0;

interface DeckSlot {
  index: number;
  data: CardData;
}

/** Nodo "sacrificio": sacrifica una carta del mazzo per trasferire uno dei suoi bonus a un'altra. */
export class TowerSacrificeScene extends BaseScene {
  private readonly run: TowerRun;
  private readonly node: TowerNode;
  private titleText!: Text;
  private skipText!: Text;
  private cardViews: CardView[] = [];
  private modifierTexts: Text[] = [];
  private donorIndex: number | null = null;

  constructor(run: TowerRun, node: TowerNode) {
    super();
    this.run = run;
    this.node = node;
  }

  protected onMount(): void {
    this.showDonorStep();
  }

  private deckSlots(filter: (data: CardData) => boolean = () => true): DeckSlot[] {
    return this.run.deckIds
      .map((id, index) => ({ index, data: getCardById(id) }))
      .filter((slot): slot is DeckSlot => !!slot.data && filter(slot.data));
  }

  private clear(): void {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    this.cardViews = [];
    this.modifierTexts = [];
  }

  private buildHeader(title: string): void {
    this.titleText = new Text({
      text: title,
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
    this.skipText = new Text({
      text: "Salta",
      style: { fontFamily: "sans-serif", fontSize: 14, fill: 0xff8a65, align: "center" },
    });
    this.skipText.eventMode = "static";
    this.skipText.cursor = "pointer";
    this.skipText.on("pointertap", () => this.returnToMap());
    this.container.addChild(this.titleText, this.skipText);
  }

  private showDonorStep(): void {
    this.clear();
    this.buildHeader("Sacrificio: scegli una carta da sacrificare");
    const donors = this.deckSlots((data) => data.modifiers.length > 0);
    for (const slot of donors) {
      const view = new CardView(new CardInstance(slot.data));
      view.scale.set(CARD_SCALE);
      view.setInteractive(() => this.pickDonor(slot.index));
      this.cardViews.push(view);
      this.container.addChild(view);
    }
    this.layout();
  }

  private pickDonor(index: number): void {
    this.donorIndex = index;
    const data = getCardById(this.run.deckIds[index])!;
    if (data.modifiers.length === 1) {
      this.showRecipientStep(data.modifiers[0]);
    } else {
      this.showModifierStep(data.modifiers);
    }
  }

  private showModifierStep(modifiers: Modifier[]): void {
    this.clear();
    this.buildHeader("Quale bonus vuoi trasferire?");
    for (const modifier of modifiers) {
      const text = new Text({
        text: MODIFIER_LABELS[modifier],
        style: { fontFamily: "sans-serif", fontSize: 16, fontWeight: "bold", fill: 0x4fc3f7, align: "center" },
      });
      text.eventMode = "static";
      text.cursor = "pointer";
      text.on("pointertap", () => this.showRecipientStep(modifier));
      this.modifierTexts.push(text);
      this.container.addChild(text);
    }
    this.layout();
  }

  private showRecipientStep(modifier: Modifier): void {
    this.clear();
    this.buildHeader("Scegli chi riceve il bonus");
    const recipients = this.deckSlots().filter((slot) => slot.index !== this.donorIndex);
    for (const slot of recipients) {
      const view = new CardView(new CardInstance(slot.data));
      view.scale.set(CARD_SCALE);
      view.setInteractive(() => this.applySacrifice(slot.index, modifier));
      this.cardViews.push(view);
      this.container.addChild(view);
    }
    this.layout();
  }

  private applySacrifice(recipientIndex: number, modifier: Modifier): void {
    const donorIndex = this.donorIndex;
    if (donorIndex === null) return;

    const recipientData = getCardById(this.run.deckIds[recipientIndex])!;
    const newData: CardData = {
      ...recipientData,
      id: `sac:${customCardCounter++}`,
      name: `${recipientData.name} (Potenziata)`,
      modifiers: recipientData.modifiers.includes(modifier)
        ? recipientData.modifiers
        : [...recipientData.modifiers, modifier],
    };
    registerCustomCard(newData);

    // La sostituzione non cambia la lunghezza dell'array, quindi `donorIndex` resta valido per la rimozione successiva.
    this.run.deckIds.splice(recipientIndex, 1, newData.id);
    this.run.deckIds.splice(donorIndex, 1);
    this.returnToMap();
  }

  private returnToMap(): void {
    resolveNode(this.run, this.node);
    this.context.goTo(() => new TowerMapScene(this.run));
  }

  protected layout(): void {
    const { width } = this.context.app.screen;
    this.titleText.position.set((width - this.titleText.width) / 2, 20);

    if (this.cardViews.length > 0) {
      const { slots, gridHeight } = layoutCardGrid(
        this.cardViews.length,
        width,
        COLUMNS,
        CARD_WIDTH * CARD_SCALE,
        CARD_HEIGHT * CARD_SCALE,
        GRID_GAP,
        GRID_START_Y,
      );
      this.cardViews.forEach((view, i) => {
        view.scale.set(CARD_SCALE * slots[i].scale);
        view.position.set(slots[i].x, slots[i].y);
      });
      this.skipText.position.set((width - this.skipText.width) / 2, GRID_START_Y + gridHeight + 24);
    } else if (this.modifierTexts.length > 0) {
      let y = GRID_START_Y;
      for (const text of this.modifierTexts) {
        text.position.set((width - text.width) / 2, y);
        y += text.height + 16;
      }
      this.skipText.position.set((width - this.skipText.width) / 2, y + 12);
    } else {
      this.skipText.position.set((width - this.skipText.width) / 2, GRID_START_Y);
    }
  }
}
