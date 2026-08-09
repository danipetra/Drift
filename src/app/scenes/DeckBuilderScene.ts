import { Container, Text } from "pixi.js";
import { getCardById, getCardsByType } from "../../data/cardLoader";
import { CardInstance } from "../../game/CardInstance";
import { MAX_DECK_SIZE } from "../../game/deckRules";
import { getPlayerProfile, PlayerProfile } from "../../game/PlayerProfile";
import { createCardPreview } from "../../render/cardPreview";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { FRAME_STYLES } from "../../render/frames";
import type { CardData, CardType } from "../../types/card";
import { BaseScene } from "./BaseScene";
import { MainMenuScene } from "./MainMenuScene";

const CARD_SCALE = 0.55;
const COLUMNS = 4;
const GRID_GAP = 12;
const TILE_CAPTION_HEIGHT = 26;
const CARD_TYPES = Object.keys(FRAME_STYLES) as CardType[];

interface TabView {
  type: CardType;
  view: Text;
}

/** Collezione sbloccata (fino a 3 copie a carta) + mazzo attuale (fino a 20 carte), editabile qui. */
export class DeckBuilderScene extends BaseScene {
  private readonly headerText: Text;
  private readonly tabViews: TabView[] = [];
  private readonly collectionSectionLabel: Text;
  private readonly deckSectionLabel: Text;
  private readonly profile: PlayerProfile;
  private activeType: CardType = CARD_TYPES[0];

  private collectionViews: Container[] = [];
  private deckViews: Container[] = [];
  // Solo visivo (anteprima a pressione prolungata): non deve intercettare i click destinati alle
  // carte sotto, altrimenti bloccherebbe il tocco successivo su un'altra tessera.
  private readonly overlayContainer = new Container();

  constructor() {
    super();
    this.profile = getPlayerProfile();
    this.headerText = new Text({
      text: "Il Tuo Mazzo",
      style: { fontFamily: "sans-serif", fontSize: 24, fontWeight: "bold", fill: 0xffffff, align: "center" },
    });
    this.collectionSectionLabel = new Text({
      text: "La tua collezione",
      style: { fontFamily: "sans-serif", fontSize: 13, fill: 0xb0bec5 },
    });
    this.deckSectionLabel = new Text({
      text: "Nel mazzo",
      style: { fontFamily: "sans-serif", fontSize: 13, fill: 0xb0bec5 },
    });
    this.overlayContainer.eventMode = "none";
    this.container.addChild(this.headerText, this.collectionSectionLabel, this.deckSectionLabel, this.overlayContainer);
  }

  protected async onMount(): Promise<void> {
    await this.setBackground("deck-builder");
    this.buildTabs();
    this.rebuildGrids();
    this.buildHud(this.context.hudRoot);
  }

  private buildHud(hudRoot: HTMLElement): void {
    // Layout su misura invece delle regole condivise di MatchScene: qui servono 3 pulsanti
    // più un messaggio di stato, che nella riga singola di #hud-top non ci stanno a 480px.
    hudRoot.innerHTML = `
      <div id="deck-builder-hud" style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;">
        <div id="status" style="font-size: 12px; color: #d8d8d8;"></div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="import-button" type="button" style="height: 40px; padding: 0 14px; font-size: 13px; font-weight: bold; color: #d8d8d8; background: transparent; border: 1px solid #d8d8d8; border-radius: 6px; cursor: pointer;">Importa salvataggio</button>
          <button id="export-button" type="button" style="height: 40px; padding: 0 14px; font-size: 13px; font-weight: bold; color: #d8d8d8; background: transparent; border: 1px solid #d8d8d8; border-radius: 6px; cursor: pointer;">Esporta salvataggio</button>
          <button id="action-button" type="button">Torna al Menu</button>
        </div>
      </div>
      <input id="import-input" type="file" accept="application/json" style="display: none" />
    `;
    const statusEl = hudRoot.querySelector<HTMLDivElement>("#status")!;
    statusEl.textContent = "Tocca una carta della collezione per aggiungerla, una del mazzo per toglierla.";

    hudRoot.querySelector<HTMLButtonElement>("#action-button")!.onclick = () =>
      this.context.goTo(() => new MainMenuScene());

    hudRoot.querySelector<HTMLButtonElement>("#export-button")!.onclick = () => this.exportSave();

    const importInput = hudRoot.querySelector<HTMLInputElement>("#import-input")!;
    hudRoot.querySelector<HTMLButtonElement>("#import-button")!.onclick = () => importInput.click();
    importInput.onchange = () => this.importSave(importInput, statusEl);
  }

  private exportSave(): void {
    const blob = new Blob([this.profile.exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "drift-save.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  private importSave(input: HTMLInputElement, statusEl: HTMLDivElement): void {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        PlayerProfile.importSave(text);
        this.context.goTo(() => new DeckBuilderScene());
      })
      .catch(() => {
        statusEl.textContent = "Salvataggio non valido, nessuna modifica applicata.";
      })
      .finally(() => {
        input.value = "";
      });
  }

  private buildTabs(): void {
    for (const type of CARD_TYPES) {
      const view = new Text({
        text: FRAME_STYLES[type].label,
        style: { fontFamily: "sans-serif", fontSize: 15, fontWeight: "bold", fill: 0x6b7280 },
      });
      view.eventMode = "static";
      view.cursor = "pointer";
      view.on("pointertap", () => {
        this.activeType = type;
        this.rebuildGrids();
        this.layout();
      });
      this.tabViews.push({ type, view });
      this.container.addChild(view);
    }
  }

  private rebuildGrids(): void {
    for (const view of this.collectionViews) view.destroy();
    for (const view of this.deckViews) view.destroy();
    this.collectionViews = [];
    this.deckViews = [];

    for (const tab of this.tabViews) {
      tab.view.style.fill = tab.type === this.activeType ? 0x4fc3f7 : 0x6b7280;
    }

    const unlockedIds = new Set(this.profile.unlockedCardIds());
    for (const data of getCardsByType(this.activeType)) {
      if (!unlockedIds.has(data.id)) continue;
      const owned = this.profile.copiesOwned(data.id);
      const tile = this.createTile(data, `posseduto: ${owned}/3`, () => this.addCard(data.id));
      this.collectionViews.push(tile);
      this.container.addChild(tile);
    }

    const distinctDeckIds = [...new Set(this.profile.deck)];
    for (const cardId of distinctDeckIds) {
      const data = getCardById(cardId);
      if (!data) continue;
      const count = this.profile.countInDeck(cardId);
      const tile = this.createTile(data, `x${count}`, () => this.removeCard(cardId));
      this.deckViews.push(tile);
      this.container.addChild(tile);
    }

    this.headerText.text = `Il Tuo Mazzo — ${this.profile.deck.length}/${MAX_DECK_SIZE} carte`;
    // Le tessere appena create finiscono in cima allo stack: l'overlay dell'anteprima va rimesso
    // sopra di loro, altrimenti da qui in poi resterebbe coperto.
    this.container.addChild(this.overlayContainer);
  }

  private createTile(data: CardData, caption: string, onClick: () => void): Container {
    const tile = new Container();
    const cardView = new CardView(new CardInstance(data));
    cardView.setInteractive(
      onClick,
      () => this.showPreview(cardView.instance),
      () => this.hidePreview(),
    );
    tile.addChild(cardView);

    const label = new Text({
      text: caption,
      style: { fontFamily: "sans-serif", fontSize: 15, fontWeight: "bold", fill: 0xffe082, align: "center" },
    });
    label.position.set((CARD_WIDTH - label.width) / 2, CARD_HEIGHT + 6);
    tile.addChild(label);

    return tile;
  }

  /** Anteprima ingrandita a pressione prolungata, centrata sullo schermo (qui non c'è un "lato" come in partita). */
  private showPreview(card: CardInstance): void {
    this.overlayContainer.removeChildren();
    const wrapper = createCardPreview(card);
    const { width, height } = this.context.app.screen;
    wrapper.position.set((width - wrapper.width) / 2, (height - wrapper.height) / 2);
    this.overlayContainer.addChild(wrapper);
  }

  private hidePreview(): void {
    this.overlayContainer.removeChildren();
  }

  private addCard(cardId: string): void {
    this.profile.addToDeck(cardId);
    this.rebuildGrids();
    this.layout();
  }

  private removeCard(cardId: string): void {
    this.profile.removeFromDeck(cardId);
    this.rebuildGrids();
    this.layout();
  }

  private layoutGrid(tiles: Container[], startY: number, width: number): number {
    const tileWidth = CARD_WIDTH * CARD_SCALE;
    const tileHeight = (CARD_HEIGHT + TILE_CAPTION_HEIGHT) * CARD_SCALE;
    if (tiles.length === 0) return startY;

    const rows = Math.ceil(tiles.length / COLUMNS);
    const gridWidth = COLUMNS * tileWidth + (COLUMNS - 1) * GRID_GAP;
    const scale = Math.min(1, (width - 32) / gridWidth);
    const startX = (width - gridWidth * scale) / 2;

    tiles.forEach((tile, i) => {
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      tile.scale.set(CARD_SCALE * scale);
      tile.position.set(startX + col * (tileWidth + GRID_GAP) * scale, startY + row * (tileHeight + GRID_GAP) * scale);
    });

    return startY + rows * tileHeight * scale + (rows - 1) * GRID_GAP * scale;
  }

  protected layout(): void {
    const { width } = this.context.app.screen;

    this.headerText.position.set((width - this.headerText.width) / 2, 16);

    const tabGap = 24;
    const tabsWidth =
      this.tabViews.reduce((sum, tab) => sum + tab.view.width, 0) + tabGap * (this.tabViews.length - 1);
    let tabX = (width - tabsWidth) / 2;
    const tabY = 56;
    for (const tab of this.tabViews) {
      tab.view.position.set(tabX, tabY);
      tabX += tab.view.width + tabGap;
    }

    let y = tabY + 32;
    this.collectionSectionLabel.position.set(16, y);
    y += this.collectionSectionLabel.height + 6;
    y = this.layoutGrid(this.collectionViews, y, width) + 24;

    this.deckSectionLabel.position.set(16, y);
    y += this.deckSectionLabel.height + 6;
    this.layoutGrid(this.deckViews, y, width);
  }
}
