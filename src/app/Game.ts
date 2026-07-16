import { Application } from "pixi.js";
import { Board } from "../board/Board";
import { getCardsByType } from "../data/cardLoader";

export class Game {
  private app = new Application();
  private board!: Board;

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: "#101418",
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    this.board = new Board();
    this.app.stage.addChild(this.board);
    this.populateDemoCards();

    this.handleResize();
    this.app.renderer.on("resize", this.handleResize);
  }

  private populateDemoCards(): void {
    const beasts = getCardsByType("beast");
    const robots = getCardsByType("robot");

    this.board.opponentRanged.setCard(1, robots[1]);
    this.board.opponentMelee.setCard(1, beasts[1]);
    this.board.opponentMelee.setCard(2, robots[0]);
    this.board.playerMelee.setCard(1, beasts[0]);
    this.board.playerRanged.setCard(2, beasts[2]);
    this.board.playerRanged.setCard(1, robots[2]);
  }

  private handleResize = (): void => {
    this.board.fitToScreen(this.app.screen.width, this.app.screen.height);
  };
}
