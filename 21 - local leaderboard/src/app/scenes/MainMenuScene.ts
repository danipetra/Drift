import { Container, Graphics, Text } from "pixi.js";
import type { Scene, SceneContext } from "../SceneManager";
import { DeckBuilderScene } from "./DeckBuilderScene";
import { LeaderboardScene } from "./LeaderboardScene";
import { MatchScene } from "./MatchScene";
import { startNewTowerRun } from "./towerFlow";

const SECONDARY_LINK_GAP = 32;

const TILE_WIDTH = 150;
const TILE_HEIGHT = 210;
const TILE_GAP = 24;

interface TileConfig {
  title: string;
  subtitle: string;
  enabled: boolean;
  onClick?: () => void;
}

/** Schermata iniziale: titolo + 3 carte-bottone affiancate, una per modalità di gioco. */
export class MainMenuScene implements Scene {
  private context!: SceneContext;
  private readonly container = new Container();
  private readonly titleText: Text;
  private readonly secondaryLinks: Text[] = [];
  private readonly tileViews: Container[] = [];

  constructor() {
    this.titleText = new Text({
      text: "DROWNING",
      style: { fontFamily: "sans-serif", fontSize: 40, fontWeight: "bold", fill: 0xd8d8d8, letterSpacing: 4 },
    });
    this.container.addChild(this.titleText);

    this.secondaryLinks.push(
      this.createSecondaryLink("Il Tuo Mazzo", () => this.context.goTo(() => new DeckBuilderScene())),
      this.createSecondaryLink("Classifica", () => this.context.goTo(() => new LeaderboardScene())),
    );
  }

  private createSecondaryLink(label: string, onClick: () => void): Text {
    const link = new Text({
      text: label,
      style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", fill: 0x4fc3f7 },
    });
    link.eventMode = "static";
    link.cursor = "pointer";
    link.on("pointertap", onClick);
    this.container.addChild(link);
    return link;
  }

  mount(context: SceneContext): void {
    this.context = context;
    context.app.stage.addChild(this.container);
    this.buildTiles();
    context.app.renderer.on("resize", this.layout);
    this.layout();
  }

  unmount(): void {
    this.context.app.renderer.off("resize", this.layout);
    this.context.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private buildTiles(): void {
    const configs: TileConfig[] = [
      {
        title: "Partita Singola",
        subtitle: "Sfida un mazzo nemico casuale",
        enabled: true,
        onClick: () => this.context.goTo(() => new MatchScene()),
      },
      {
        title: "Scalata della Torre",
        subtitle: "Sali di piano in piano, il mazzo cresce con te",
        enabled: true,
        onClick: () => this.context.goTo(() => startNewTowerRun()),
      },
      {
        title: "???",
        subtitle: "Prossimamente",
        enabled: false,
      },
    ];

    for (const config of configs) {
      const tile = this.createTile(config);
      this.tileViews.push(tile);
      this.container.addChild(tile);
    }
  }

  private createTile(config: TileConfig): Container {
    const tile = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, TILE_WIDTH, TILE_HEIGHT, 12)
      .fill({ color: config.enabled ? 0x1c232b : 0x171b1f })
      .stroke({ width: 2, color: config.enabled ? 0x4fc3f7 : 0x3a3f45 });
    tile.addChild(bg);

    const title = new Text({
      text: config.title,
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        fontWeight: "bold",
        fill: config.enabled ? 0xffffff : 0x6b7280,
        align: "center",
        wordWrap: true,
        wordWrapWidth: TILE_WIDTH - 20,
      },
    });
    title.position.set((TILE_WIDTH - title.width) / 2, 24);
    tile.addChild(title);

    const subtitle = new Text({
      text: config.subtitle,
      style: {
        fontFamily: "sans-serif",
        fontSize: 12,
        fill: config.enabled ? 0xb0bec5 : 0x565c63,
        align: "center",
        wordWrap: true,
        wordWrapWidth: TILE_WIDTH - 20,
      },
    });
    subtitle.position.set((TILE_WIDTH - subtitle.width) / 2, TILE_HEIGHT - 40);
    tile.addChild(subtitle);

    if (config.enabled && config.onClick) {
      tile.eventMode = "static";
      tile.cursor = "pointer";
      tile.on("pointertap", config.onClick);
    }

    return tile;
  }

  private layout = (): void => {
    const { width, height } = this.context.app.screen;

    const titleScale = Math.min(1, (width * 0.9) / this.titleText.width);
    this.titleText.scale.set(titleScale);
    this.titleText.position.set((width - this.titleText.width * titleScale) / 2, height * 0.28);

    const sideMargin = 16;
    const rawWidth = this.tileViews.length * TILE_WIDTH + (this.tileViews.length - 1) * TILE_GAP;
    const scale = Math.min(1, (width - sideMargin * 2) / rawWidth);
    const totalWidth = rawWidth * scale;
    const startX = (width - totalWidth) / 2;
    const tileY = height * 0.42;
    this.tileViews.forEach((tile, index) => {
      tile.scale.set(scale);
      tile.position.set(startX + index * (TILE_WIDTH + TILE_GAP) * scale, tileY);
    });

    const linksWidth =
      this.secondaryLinks.reduce((sum, link) => sum + link.width, 0) +
      SECONDARY_LINK_GAP * (this.secondaryLinks.length - 1);
    let linkX = (width - linksWidth) / 2;
    const linkY = tileY + TILE_HEIGHT * scale + 28;
    for (const link of this.secondaryLinks) {
      link.position.set(linkX, linkY);
      linkX += link.width + SECONDARY_LINK_GAP;
    }
  };
}
