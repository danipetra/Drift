import "./style.css";
import { Game } from "./app/Game";

const container = document.querySelector<HTMLDivElement>("#app")!;
const game = new Game();
game.init(container);
