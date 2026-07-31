import { recordRun } from "../../game/Leaderboard";
import { TowerRun } from "../../game/TowerRun";
import { OverlayPanel } from "../../render/OverlayPanel";
import { BaseScene } from "./BaseScene";
import { LeaderboardScene } from "./LeaderboardScene";
import { MainMenuScene } from "./MainMenuScene";
import { createTowerFloorScene } from "./towerFlow";

/** Fine di una run in torre (sconfitta o pareggio): punteggio finale + ricomincia/menu. */
export class TowerGameOverScene extends BaseScene {
  private panel!: OverlayPanel;
  private readonly run: TowerRun;

  constructor(run: TowerRun) {
    super();
    this.run = run;
  }

  protected onMount(): void {
    recordRun(this.run.score, this.run.floorsCleared);

    this.panel = new OverlayPanel({
      title: "Hai perso!",
      subtitle: `Punteggio finale: ${this.run.score} — ${this.run.floorsCleared} piani superati`,
      buttons: [
        {
          label: "Nuova Scalata",
          emphasis: "primary",
          onClick: () => this.context.goTo(() => createTowerFloorScene(new TowerRun())),
        },
        {
          label: "Classifica",
          emphasis: "secondary",
          onClick: () => this.context.goTo(() => new LeaderboardScene()),
        },
        {
          label: "Menu Principale",
          emphasis: "secondary",
          onClick: () => this.context.goTo(() => new MainMenuScene()),
        },
      ],
    });
    this.container.addChild(this.panel);
  }

  protected layout(): void {
    this.panel.layout(this.context.app.screen.width, this.context.app.screen.height);
  }
}
