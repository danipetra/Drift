import { Application } from "pixi.js";
import { Board } from "../board/Board";
import { Lane } from "../board/Lane";
import { getCardsByType } from "../data/cardLoader";
import enemyDeckIds from "../data/decks/enemyDeck.json";
import playerDeckIds from "../data/decks/playerDeck.json";
import { aiChooseAttackers, aiChooseBlocks } from "../game/ai";
import { BoardState, lanesOfSide, type RowKey, type Side } from "../game/BoardState";
import { CardInstance } from "../game/CardInstance";
import {
  canBlock,
  guardObligationsSatisfied,
  resolveCombat,
  type AttackDeclaration,
  type BlockDeclaration,
  type CombatEvent,
} from "../game/combat";
import { Deck } from "../game/Deck";
import { HandView } from "../hand/HandView";
import type { CardData } from "../types/card";

const SLOT_COUNT = 4;
const INITIAL_HAND_SIZE = 3;
const HAND_MARGIN = 20;

type Phase = "attack" | "block";

export class Game {
  private app = new Application();
  private board!: Board;
  private state = new BoardState(SLOT_COUNT);
  private lanes!: Record<RowKey, Lane>;
  private actionButton!: HTMLButtonElement;
  private statusEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;

  private activeSide: Side = "player";
  private phase: Phase = "attack";
  private selectedAttackers: AttackDeclaration[] = [];
  private declaredAttackers: AttackDeclaration[] = [];
  private declaredBlocks: BlockDeclaration[] = [];
  private armedAttacker: AttackDeclaration | null = null;
  private armedHandIndex: number | null = null;
  private gameOver = false;

  private playerDeck = new Deck(playerDeckIds as string[]);
  private enemyDeck = new Deck(enemyDeckIds as string[]);
  private playerHand: CardInstance[] = [];
  private enemyHandCount = 0;
  private handView = new HandView();

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
    this.app.stage.addChild(this.handView);

    this.actionButton = document.querySelector<HTMLButtonElement>("#action-button")!;
    this.statusEl = document.querySelector<HTMLDivElement>("#status")!;
    this.logEl = document.querySelector<HTMLDivElement>("#log")!;

    // `startAttackPhase` pesca automaticamente una carta a inizio turno: si
    // pesca una in meno qui per non sballare la dimensione della mano di
    // apertura, dato che il primo turno la completa.
    for (let i = 0; i < INITIAL_HAND_SIZE - 1; i++) {
      this.drawPlayerCard();
      this.drawEnemyCard();
    }

    this.startAttackPhase("player");

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

  // ---- Mazzo e mano ----

  private drawPlayerCard(): void {
    const data = this.playerDeck.draw();
    if (!data) return;
    this.playerHand.push(new CardInstance(data));
    this.updateHandDisplay();
  }

  private drawEnemyCard(): void {
    if (this.enemyDeck.draw()) this.enemyHandCount++;
  }

  private updateHandDisplay(): void {
    this.handView.setCards(this.playerHand);
    this.handleResize();
  }

  // ---- Fase di attacco ----

  private startAttackPhase(side: Side): void {
    if (this.gameOver) return;
    this.activeSide = side;
    this.phase = "attack";
    this.selectedAttackers = [];
    this.untapSide(side);

    if (side === "player") {
      this.drawPlayerCard();
      this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
      this.actionButton.textContent = "Dichiara attacco";
      this.actionButton.disabled = false;
      this.actionButton.onclick = () => this.confirmPlayerAttackers();
      this.refreshBoardInteractivity();
    } else {
      this.drawEnemyCard();
      this.statusEl.textContent = "Il nemico attacca...";
      const attackers = aiChooseAttackers(this.state, "opponent");
      this.beginBlockPhase("opponent", attackers);
    }
  }

  private confirmPlayerAttackers(): void {
    this.beginBlockPhase("player", [...this.selectedAttackers]);
  }

  private toggleSelectedAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) this.selectedAttackers.splice(idx, 1);
    else this.selectedAttackers.push({ row, slot });
    this.refreshBoardInteractivity();
  }

  private toggleArmedHandCard(index: number): void {
    this.armedHandIndex = this.armedHandIndex === index ? null : index;
    this.refreshBoardInteractivity();
  }

  private placeHandCard(row: RowKey, slot: number): void {
    if (this.armedHandIndex === null) return;
    const [instance] = this.playerHand.splice(this.armedHandIndex, 1);
    if (!instance) return;
    // Appena giocata: non può ancora attaccare né bloccare, come una carta tappata.
    instance.tapped = true;
    this.state.setCard(row, slot, instance);
    this.lanes[row].setCard(slot, instance);
    this.armedHandIndex = null;
    this.updateHandDisplay();
    this.refreshBoardInteractivity();
  }

  private untapSide(side: Side): void {
    for (const row of lanesOfSide(side)) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        const card = this.state.getCard(row, slot);
        if (!card) continue;
        card.tapped = false;
        this.lanes[row].setTapped(slot, false);
      }
    }
  }

  // ---- Fase di blocco ----

  private beginBlockPhase(attackingSide: Side, attackers: AttackDeclaration[]): void {
    this.phase = "block";
    this.declaredAttackers = attackers;
    this.declaredBlocks = [];
    this.armedAttacker = null;
    const defendingSide: Side = attackingSide === "player" ? "opponent" : "player";

    if (defendingSide === "player") {
      this.statusEl.textContent = "Il nemico attacca: scegli con chi bloccare";
      this.actionButton.textContent = "Conferma blocchi";
      this.actionButton.onclick = () => this.confirmBlocks(attackingSide);
      this.refreshBoardInteractivity();
      this.updateConfirmBlocksEnabled();
    } else {
      const blocks = aiChooseBlocks(this.state, "opponent", attackers);
      this.resolveAndAdvance(attackingSide, attackers, blocks);
    }
  }

  private armAttacker(ref: AttackDeclaration): void {
    this.armedAttacker = ref;
    this.refreshBoardInteractivity();

    const attacker = this.state.getCard(ref.row, ref.slot);
    const hasLegalBlocker = lanesOfSide("player").some((row) =>
      Array.from({ length: this.state.slotCount }, (_, slot) => slot).some((slot) =>
        canBlock(this.state, ref.row, ref.slot, row, slot),
      ),
    );
    this.statusEl.textContent =
      attacker && !hasLegalBlocker
        ? `${attacker.data.name} non è bloccabile (vola o è furtivo): scegli un altro attaccante o conferma`
        : "Il nemico attacca: scegli con chi bloccare";
  }

  private assignBlocker(row: RowKey, slot: number): void {
    if (!this.armedAttacker) return;
    const armed = this.armedAttacker;
    this.declaredBlocks = this.declaredBlocks.filter(
      (b) =>
        !(b.attackerRow === armed.row && b.attackerSlot === armed.slot) &&
        !(b.blockerRow === row && b.blockerSlot === slot),
    );
    this.declaredBlocks.push({
      attackerRow: armed.row,
      attackerSlot: armed.slot,
      blockerRow: row,
      blockerSlot: slot,
    });
    this.armedAttacker = null;
    this.refreshBoardInteractivity();
    this.updateConfirmBlocksEnabled();
  }

  private unassignBlocker(row: RowKey, slot: number): void {
    this.declaredBlocks = this.declaredBlocks.filter((b) => !(b.blockerRow === row && b.blockerSlot === slot));
    this.refreshBoardInteractivity();
    this.updateConfirmBlocksEnabled();
  }

  private confirmBlocks(attackingSide: Side): void {
    this.resolveAndAdvance(attackingSide, this.declaredAttackers, this.declaredBlocks);
  }

  private updateConfirmBlocksEnabled(): void {
    if (this.phase !== "block") return;
    const defendingSide: Side = this.activeSide === "player" ? "opponent" : "player";
    if (defendingSide !== "player") return;
    this.actionButton.disabled = !guardObligationsSatisfied(
      this.state,
      lanesOfSide("player"),
      this.declaredAttackers,
      this.declaredBlocks,
    );
  }

  // ---- Risoluzione ----

  private resolveAndAdvance(attackingSide: Side, attackers: AttackDeclaration[], blocks: BlockDeclaration[]): void {
    const events = resolveCombat(this.state, attackingSide, attackers, blocks);
    this.syncBoardView();
    this.updateHealthDisplay();
    this.logEvents(events);
    if (this.checkGameOver()) return;
    const nextSide: Side = attackingSide === "player" ? "opponent" : "player";
    this.startAttackPhase(nextSide);
  }

  private syncBoardView(): void {
    for (const row of Object.keys(this.lanes) as RowKey[]) {
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

  private checkGameOver(): boolean {
    if (this.state.playerHealth > 0 && this.state.opponentHealth > 0) return false;

    this.gameOver = true;
    this.actionButton.disabled = true;
    this.statusEl.textContent =
      this.state.playerHealth <= 0 && this.state.opponentHealth <= 0
        ? "Pareggio!"
        : this.state.opponentHealth <= 0
          ? "Hai vinto!"
          : "Hai perso!";
    for (const row of Object.keys(this.lanes) as RowKey[]) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.lanes[row].setInteractive(slot, null);
        this.lanes[row].setOutline(slot, null);
        this.lanes[row].setPlaceholderInteractive(slot, null);
        this.lanes[row].setPlaceholderHighlight(slot, null);
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.handView.setInteractive(i, null);
      this.handView.setOutline(i, null);
    }
    return true;
  }

  // ---- Interattività ----

  private refreshBoardInteractivity(): void {
    for (const row of Object.keys(this.lanes) as RowKey[]) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.lanes[row].setInteractive(slot, null);
        this.lanes[row].setOutline(slot, null);
        this.lanes[row].setPlaceholderInteractive(slot, null);
        this.lanes[row].setPlaceholderHighlight(slot, null);
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.handView.setInteractive(i, null);
      this.handView.setOutline(i, null);
    }

    if (this.phase === "attack" && this.activeSide === "player") {
      for (const row of lanesOfSide("player")) {
        for (let slot = 0; slot < this.state.slotCount; slot++) {
          const card = this.state.getCard(row, slot);
          if (card) {
            if (card.tapped) continue;
            const isSelected = this.selectedAttackers.some((a) => a.row === row && a.slot === slot);
            this.lanes[row].setOutline(slot, isSelected ? 0xffd54f : null);
            this.lanes[row].setInteractive(slot, () => this.toggleSelectedAttacker(row, slot));
          } else if (this.armedHandIndex !== null) {
            this.lanes[row].setPlaceholderHighlight(slot, 0x66bb6a);
            this.lanes[row].setPlaceholderInteractive(slot, () => this.placeHandCard(row, slot));
          }
        }
      }

      this.playerHand.forEach((_, index) => {
        this.handView.setOutline(index, index === this.armedHandIndex ? 0xffd54f : null);
        this.handView.setInteractive(index, () => this.toggleArmedHandCard(index));
      });

      return;
    }

    if (this.phase === "block") {
      const defendingSide: Side = this.activeSide === "player" ? "opponent" : "player";

      for (const ref of this.declaredAttackers) {
        const isArmed = this.armedAttacker?.row === ref.row && this.armedAttacker?.slot === ref.slot;
        this.lanes[ref.row].setOutline(ref.slot, isArmed ? 0xff8a65 : 0xffd54f);
      }

      if (defendingSide !== "player") return;

      for (const ref of this.declaredAttackers) {
        this.lanes[ref.row].setInteractive(ref.slot, () => this.armAttacker(ref));
      }

      for (const row of lanesOfSide("player")) {
        for (let slot = 0; slot < this.state.slotCount; slot++) {
          const card = this.state.getCard(row, slot);
          if (!card || card.tapped) continue;
          const assignment = this.declaredBlocks.find((b) => b.blockerRow === row && b.blockerSlot === slot);
          if (assignment) {
            this.lanes[row].setOutline(slot, 0x66bb6a);
            this.lanes[row].setInteractive(slot, () => this.unassignBlocker(row, slot));
          } else if (
            this.armedAttacker &&
            canBlock(this.state, this.armedAttacker.row, this.armedAttacker.slot, row, slot)
          ) {
            this.lanes[row].setInteractive(slot, () => this.assignBlocker(row, slot));
          }
        }
      }
    }
  }

  private handleResize = (): void => {
    const handHeight = this.handView.handHeight();
    const reserved = handHeight + HAND_MARGIN * 2;
    this.board.fitToScreen(this.app.screen.width, this.app.screen.height - reserved);
    this.handView.position.set(
      (this.app.screen.width - this.handView.handWidth()) / 2,
      this.app.screen.height - handHeight - HAND_MARGIN,
    );
  };
}
