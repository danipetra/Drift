import { Application } from "pixi.js";
import { Board } from "../board/Board";
import { Lane } from "../board/Lane";
import { getCardsByType } from "../data/cardLoader";
import { BoardState, ROW_KEYS, type RowKey } from "../game/BoardState";
import { CardInstance } from "../game/CardInstance";
import { resolveCombatRound, type CombatEvent } from "../game/combat";
import type { CardData } from "../types/card";

const SLOT_COUNT = 4;

export class Game {
  private app = new Application();
  private board!: Board;
  private state = new BoardState(SLOT_COUNT);
  private lanes!: Record<RowKey, Lane>;
  private endTurnButton!: HTMLButtonElement;
  private logEl!: HTMLDivElement;

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      background: "#101418",
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    this.board = new Board(SLOT_COUNT);
    this.app.stage.addChild(this.board);
    this.lanes = {
      opponentRanged: this.board.opponentRanged,
      opponentMelee: this.board.opponentMelee,
      playerMelee: this.board.playerMelee,
      playerRanged: this.board.playerRanged,
    };

    this.populateDemoCards();
    this.updateHealthDisplay();

    this.endTurnButton = document.querySelector<HTMLButtonElement>("#end-turn")!;
    this.logEl = document.querySelector<HTMLDivElement>("#log")!;
    this.endTurnButton.addEventListener("click", () => this.endTurn());

    // `resizeTo` in Pixi only reacts to window resize events, not to layout
    // shifts of its own container (e.g. the HUD growing when log lines are
    // added). A ResizeObserver on the container catches both cases.
    this.app.renderer.on("resize", this.handleResize);
    this.app.renderer.resize(container.clientWidth, container.clientHeight);
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.app.renderer.resize(width, height);
    }).observe(container);
  }

  private placeCard(row: RowKey, slot: number, data: CardData): void {
    const instance = new CardInstance(data);
    this.state.setCard(row, slot, instance);
    this.lanes[row].setCard(slot, instance);
  }

  private populateDemoCards(): void {
    const beasts = getCardsByType("beast");
    const robots = getCardsByType("robot");

    this.placeCard("opponentRanged", 1, robots[1]);
    this.placeCard("opponentMelee", 1, beasts[1]);
    this.placeCard("opponentMelee", 2, robots[0]);
    this.placeCard("playerMelee", 1, beasts[0]);
    this.placeCard("playerRanged", 2, beasts[2]);
    this.placeCard("playerRanged", 1, robots[2]);
  }

  private endTurn(): void {
    const events = resolveCombatRound(this.state);
    this.syncBoardView();
    this.updateHealthDisplay();
    this.logEvents(events);
    this.checkGameOver();
  }

  private syncBoardView(): void {
    for (const row of ROW_KEYS) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.lanes[row].setCard(slot, this.state.getCard(row, slot));
      }
    }
  }

  private updateHealthDisplay(): void {
    this.board.setOpponentHealth(this.state.opponentHealth);
    this.board.setPlayerHealth(this.state.playerHealth);
  }

  private logEvents(events: CombatEvent[]): void {
    for (const event of events) {
      const line = document.createElement("p");
      line.textContent = event.message;
      this.logEl.appendChild(line);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private checkGameOver(): void {
    if (this.state.playerHealth <= 0 || this.state.opponentHealth <= 0) {
      this.endTurnButton.disabled = true;
      const line = document.createElement("p");
      line.textContent =
        this.state.playerHealth <= 0 && this.state.opponentHealth <= 0
          ? "Pareggio!"
          : this.state.opponentHealth <= 0
            ? "Hai vinto!"
            : "Hai perso!";
      this.logEl.appendChild(line);
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }

  private handleResize = (): void => {
    this.board.fitToScreen(this.app.screen.width, this.app.screen.height);
  };
}
