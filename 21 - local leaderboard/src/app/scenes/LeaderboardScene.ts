import { Container, Text } from "pixi.js";
import { getLeaderboard } from "../../game/Leaderboard";
import type { Scene, SceneContext } from "../SceneManager";
import { MainMenuScene } from "./MainMenuScene";

const ROW_GAP = 8;

/** Classifica locale delle run della Scalata della Torre, in ordine di punteggio. */
export class LeaderboardScene implements Scene {
  private context!: SceneContext;
  private readonly container = new Container();
  private readonly titleText: Text;
  private readonly rowTexts: Text[] = [];

  constructor() {
    this.titleText = new Text({
      text: "Classifica",
      style: { fontFamily: "sans-serif", fontSize: 28, fontWeight: "bold", fill: 0xffffff, align: "center" },
    });
    this.container.addChild(this.titleText);
  }

  mount(context: SceneContext): void {
    this.context = context;
    context.app.stage.addChild(this.container);
    this.buildRows();
    this.buildHud(context.hudRoot);
    context.app.renderer.on("resize", this.layout);
    this.layout();
  }

  unmount(): void {
    this.context.app.renderer.off("resize", this.layout);
    this.context.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
    this.context.hudRoot.innerHTML = "";
  }

  private buildHud(hudRoot: HTMLElement): void {
    hudRoot.innerHTML = `
      <div id="hud-top">
        <div id="info"><div id="status"></div></div>
        <div id="button-row">
          <button id="action-button" type="button">Torna al Menu</button>
        </div>
      </div>
    `;
    hudRoot.querySelector<HTMLDivElement>("#status")!.textContent = "Le migliori 10 scalate, in ordine di punteggio.";
    hudRoot.querySelector<HTMLButtonElement>("#action-button")!.onclick = () =>
      this.context.goTo(() => new MainMenuScene());
  }

  private buildRows(): void {
    const entries = getLeaderboard();

    if (entries.length === 0) {
      const empty = new Text({
        text: "Nessuna scalata completata ancora.",
        style: { fontFamily: "sans-serif", fontSize: 14, fill: 0x8a919a },
      });
      this.rowTexts.push(empty);
      this.container.addChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const date = new Date(entry.date).toLocaleDateString();
      const row = new Text({
        text: `${index + 1}.  ${entry.score} punti  —  ${entry.floorsCleared} piani  —  ${date}`,
        style: {
          fontFamily: "sans-serif",
          fontSize: 15,
          fontWeight: index === 0 ? "bold" : "normal",
          fill: index === 0 ? 0xffe082 : 0xd8d8d8,
        },
      });
      this.rowTexts.push(row);
      this.container.addChild(row);
    });
  }

  private layout = (): void => {
    const { width, height } = this.context.app.screen;

    this.titleText.position.set((width - this.titleText.width) / 2, height * 0.12);

    let y = height * 0.12 + this.titleText.height + 40;
    for (const row of this.rowTexts) {
      row.position.set((width - row.width) / 2, y);
      y += row.height + ROW_GAP;
    }
  };
}
