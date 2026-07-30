import { Container } from "pixi.js";
import { TowerRun } from "../../game/TowerRun";
import { OverlayPanel } from "../../render/OverlayPanel";
import type { Scene, SceneContext } from "../SceneManager";
import { MainMenuScene } from "./MainMenuScene";
import { createTowerFloorScene } from "./towerFlow";

/** Fine di una run in torre (sconfitta o pareggio): punteggio finale + ricomincia/menu. */
export class TowerGameOverScene implements Scene {
  private context!: SceneContext;
  private readonly container = new Container();
  private panel!: OverlayPanel;
  private readonly run: TowerRun;

  constructor(run: TowerRun) {
    this.run = run;
  }

  mount(context: SceneContext): void {
    this.context = context;
    context.app.stage.addChild(this.container);

    this.panel = new OverlayPanel({
      title: "Hai perso!",
      subtitle: `Punteggio finale: ${this.run.score}`,
      buttons: [
        {
          label: "Nuova Scalata",
          emphasis: "primary",
          onClick: () => context.goTo(() => createTowerFloorScene(new TowerRun())),
        },
        {
          label: "Menu Principale",
          emphasis: "secondary",
          onClick: () => context.goTo(() => new MainMenuScene()),
        },
      ],
    });
    this.container.addChild(this.panel);

    context.app.renderer.on("resize", this.layout);
    this.layout();
  }

  unmount(): void {
    this.context.app.renderer.off("resize", this.layout);
    this.context.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private layout = (): void => {
    this.panel.layout(this.context.app.screen.width, this.context.app.screen.height);
  };
}
