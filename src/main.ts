import "./style.css";
import { SceneManager } from "./app/SceneManager";
import { MainMenuScene } from "./app/scenes/MainMenuScene";

const appContainer = document.querySelector<HTMLDivElement>("#app")!;
const hudRoot = document.querySelector<HTMLDivElement>("#hud-root")!;
const manager = new SceneManager(hudRoot);
void manager.init(appContainer, () => new MainMenuScene());
