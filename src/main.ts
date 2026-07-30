import "./style.css";
import { SceneManager } from "./app/SceneManager";
import { MainMenuScene } from "./app/scenes/MainMenuScene";
import { MatchScene } from "./app/scenes/MatchScene";

const appContainer = document.querySelector<HTMLDivElement>("#app")!;
const hudRoot = document.querySelector<HTMLDivElement>("#hud-root")!;
const manager = new SceneManager(hudRoot);
void manager.init(
  appContainer,
  () =>
    new MatchScene({
      playerDeckIds: ["beast_lizard", "robot_selfrepair", "beast_lizard", "robot_selfrepair"],
      enemyDeckIds: ["beast_wolf", "beast_wolf", "beast_wolf", "beast_wolf"],
    }),
);
void MainMenuScene;
