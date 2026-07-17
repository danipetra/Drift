import { Application, Container, Graphics } from "pixi.js";
import { Board } from "../board/Board";
import { Lane } from "../board/Lane";
import { getCardsByType } from "../data/cardLoader";
import enemyDeckIds from "../data/decks/enemyDeck.json";
import playerDeckIds from "../data/decks/playerDeck.json";
import { aiChooseAttackers, aiPlayCards, aiReinforce } from "../game/ai";
import { BoardState, laneRoleOf, lanesOfSide, sideOf, type RowKey, type Side } from "../game/BoardState";
import { CardInstance } from "../game/CardInstance";
import {
  canTargetWithRanged,
  resolveCombat,
  type AttackDeclaration,
  type AttackTarget,
  type CombatEvent,
} from "../game/combat";
import { Deck } from "../game/Deck";
import { HandView } from "../hand/HandView";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../render/CardView";
import type { CardData } from "../types/card";

const SLOT_COUNT = 4;
const INITIAL_HAND_SIZE = 3;
const HAND_MARGIN = 20;

export class Game {
  private app = new Application();
  private board!: Board;
  private state = new BoardState(SLOT_COUNT);
  private lanes!: Record<RowKey, Lane>;
  private actionButton!: HTMLButtonElement;
  private backButton!: HTMLButtonElement;
  private targetFaceButton!: HTMLButtonElement;
  private statusEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;

  private activeSide: Side = "player";
  private selectedAttackers: AttackDeclaration[] = [];
  private armedRangedAttacker: { row: RowKey; slot: number } | null = null;
  private armedHandIndex: number | null = null;
  private confirmingAttack = false;
  private gameOver = false;

  private playerDeck = new Deck(playerDeckIds as string[]);
  private enemyDeck = new Deck(enemyDeckIds as string[]);
  private playerHand: CardInstance[] = [];
  private enemyHand: CardInstance[] = [];
  private handView = new HandView();

  private playerMana = 0;
  private playerTurnsTaken = 0;
  private enemyMana = 0;
  private enemyTurnsTaken = 0;
  private manaEl!: HTMLDivElement;

  private previewContainer = new Container();

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
    this.app.stage.addChild(this.previewContainer);

    this.actionButton = document.querySelector<HTMLButtonElement>("#action-button")!;
    this.backButton = document.querySelector<HTMLButtonElement>("#back-button")!;
    this.targetFaceButton = document.querySelector<HTMLButtonElement>("#target-face-button")!;
    this.statusEl = document.querySelector<HTMLDivElement>("#status")!;
    this.manaEl = document.querySelector<HTMLDivElement>("#mana")!;
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
    const data = this.enemyDeck.draw();
    if (!data) return;
    this.enemyHand.push(new CardInstance(data));
  }

  private updateHandDisplay(): void {
    this.handView.setCards(this.playerHand);
    this.handleResize();
  }

  private updateManaDisplay(): void {
    this.manaEl.textContent = `Mana: ${this.playerMana}`;
  }

  // ---- Turno ----

  private startAttackPhase(side: Side): void {
    if (this.gameOver) return;
    this.activeSide = side;
    this.selectedAttackers = [];
    this.armedRangedAttacker = null;
    this.confirmingAttack = false;
    this.backButton.style.display = "none";
    this.targetFaceButton.style.display = "none";
    this.untapSide(side);

    if (side === "player") {
      if (this.playerTurnsTaken > 0) this.playerMana++;
      this.playerTurnsTaken++;
      this.updateManaDisplay();
      this.drawPlayerCard();
      this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
      this.actionButton.textContent = "Dichiara attacco";
      this.actionButton.disabled = false;
      this.actionButton.onclick = () => this.beginAttackConfirmation();
      this.refreshBoardInteractivity();
    } else {
      if (this.enemyTurnsTaken > 0) this.enemyMana++;
      this.enemyTurnsTaken++;
      this.drawEnemyCard();
      aiReinforce(this.state, "opponent");
      const { remainingMana, played } = aiPlayCards(this.state, "opponent", this.enemyHand, this.enemyMana);
      this.enemyMana = remainingMana;
      for (const card of played) this.appendLog(`Il nemico gioca ${card.data.name}`);

      const attacks = aiChooseAttackers(this.state, "opponent");
      this.statusEl.textContent = "Il nemico attacca...";
      this.resolveAndAdvance("opponent", attacks);
    }
  }

  private beginAttackConfirmation(): void {
    this.confirmingAttack = true;
    this.refreshBoardInteractivity();

    const count = this.selectedAttackers.length;
    this.statusEl.textContent =
      count === 0
        ? "Confermi di non attaccare questo turno?"
        : `Confermi l'attacco con ${count} cart${count === 1 ? "a" : "e"}?`;
    this.actionButton.textContent = "Conferma attacco";
    this.actionButton.onclick = () => this.confirmPlayerAttackers();
    this.backButton.style.display = "";
    this.backButton.onclick = () => this.cancelAttackConfirmation();
  }

  private cancelAttackConfirmation(): void {
    this.confirmingAttack = false;
    this.backButton.style.display = "none";
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.actionButton.textContent = "Dichiara attacco";
    this.actionButton.onclick = () => this.beginAttackConfirmation();
    this.refreshBoardInteractivity();
  }

  private confirmPlayerAttackers(): void {
    this.confirmingAttack = false;
    this.backButton.style.display = "none";
    this.resolveAndAdvance("player", [...this.selectedAttackers]);
  }

  private toggleMeleeAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) this.selectedAttackers.splice(idx, 1);
    else this.selectedAttackers.push({ row, slot });
    this.refreshBoardInteractivity();
  }

  private armRangedAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) {
      this.selectedAttackers.splice(idx, 1);
      this.refreshBoardInteractivity();
      return;
    }
    this.armedHandIndex = null;
    this.armedRangedAttacker = { row, slot };
    this.statusEl.textContent = "Scegli il bersaglio per l'attacco a distanza, oppure colpisci il volto";
    this.refreshBoardInteractivity();
  }

  private cancelRangedArm(): void {
    this.armedRangedAttacker = null;
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.refreshBoardInteractivity();
  }

  private assignRangedTarget(target: AttackTarget): void {
    if (!this.armedRangedAttacker) return;
    this.selectedAttackers.push({ ...this.armedRangedAttacker, target });
    this.armedRangedAttacker = null;
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.refreshBoardInteractivity();
  }

  private toggleArmedHandCard(index: number): void {
    this.armedRangedAttacker = null;
    this.armedHandIndex = this.armedHandIndex === index ? null : index;
    this.refreshBoardInteractivity();

    const armedCard = this.armedHandIndex !== null ? this.playerHand[this.armedHandIndex] : undefined;
    this.statusEl.textContent = !armedCard
      ? "Il tuo turno: scegli le carte che attaccano"
      : armedCard.cost > this.playerMana
        ? `Mana insufficiente per ${armedCard.data.name} (costa ${armedCard.cost}, hai ${this.playerMana})`
        : "Scegli uno slot libero per giocare la carta";
  }

  private placeHandCard(row: RowKey, slot: number): void {
    if (this.armedHandIndex === null) return;
    const instance = this.playerHand[this.armedHandIndex];
    if (!instance || instance.cost > this.playerMana) return;

    this.playerHand.splice(this.armedHandIndex, 1);
    this.playerMana -= instance.cost;
    // Appena giocata: non può ancora attaccare, come una carta tappata.
    instance.tapped = true;
    this.state.setCard(row, slot, instance);
    this.lanes[row].setCard(slot, instance);
    this.armedHandIndex = null;
    this.updateHandDisplay();
    this.updateManaDisplay();
    this.refreshBoardInteractivity();
  }

  private moveReserveForward(meleeRow: RowKey, slot: number): void {
    const rangedRow = lanesOfSide("player")[1];
    const reserve = this.state.getCard(rangedRow, slot);
    if (!reserve) return;
    this.state.setCard(meleeRow, slot, reserve);
    this.state.setCard(rangedRow, slot, undefined);
    this.lanes[meleeRow].setCard(slot, reserve);
    this.lanes[rangedRow].setCard(slot, undefined);
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

  // ---- Risoluzione ----

  private resolveAndAdvance(attackingSide: Side, attacks: AttackDeclaration[]): void {
    const events = resolveCombat(this.state, attackingSide, attacks);
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

  private appendLog(message: string): void {
    const line = document.createElement("p");
    line.textContent = message;
    this.logEl.appendChild(line);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private logEvents(events: CombatEvent[]): void {
    for (const event of events) this.appendLog(event.message);
  }

  private checkGameOver(): boolean {
    if (this.state.playerHealth > 0 && this.state.opponentHealth > 0) return false;

    this.gameOver = true;
    this.actionButton.disabled = true;
    this.backButton.style.display = "none";
    this.targetFaceButton.style.display = "none";
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
        this.wireCard(row, slot, null); // l'anteprima resta consultabile anche a partita finita
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.handView.setInteractive(i, null);
      this.handView.setOutline(i, null);
      this.wireHandCard(i, null); // l'anteprima resta consultabile anche a partita finita
    }
    return true;
  }

  // ---- Anteprima con pressione prolungata ----

  /** Agancia il click di gioco (se presente) mantenendo sempre attiva l'anteprima a pressione prolungata. */
  private wireCard(row: RowKey, slot: number, onClick: (() => void) | null): void {
    const card = this.state.getCard(row, slot);
    if (!card) return;
    this.lanes[row].setInteractive(
      slot,
      onClick,
      () => this.showCardPreview(card, sideOf(row)),
      () => this.hideCardPreview(),
    );
  }

  /** Come `wireCard`, ma per le carte in mano (sempre lato "player"). */
  private wireHandCard(index: number, onClick: (() => void) | null): void {
    const card = this.playerHand[index];
    if (!card) return;
    this.handView.setInteractive(
      index,
      onClick,
      () => this.showCardPreview(card, "player"),
      () => this.hideCardPreview(),
    );
  }

  private showCardPreview(card: CardInstance, side: Side): void {
    this.hideCardPreview();

    const scale = 1.8;
    const width = CARD_WIDTH * scale;
    const height = CARD_HEIGHT * scale;
    const wrapper = new Container();

    const backdrop = new Graphics()
      .roundRect(-10, -10, width + 20, height + 20, 16)
      .fill({ color: 0x000000, alpha: 0.6 });
    wrapper.addChild(backdrop);

    const view = new CardView(card);
    view.scale.set(scale);
    wrapper.addChild(view);

    const margin = 16;
    wrapper.position.set(
      side === "player" ? margin : this.app.screen.width - width - 20 - margin,
      Math.max(margin, (this.app.screen.height - height - 20) / 2),
    );

    this.previewContainer.addChild(wrapper);
  }

  private hideCardPreview(): void {
    this.previewContainer.removeChildren();
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
    this.targetFaceButton.style.display = "none";

    // L'anteprima a pressione prolungata resta sempre disponibile su ogni carta in campo e in mano.
    for (const row of Object.keys(this.lanes) as RowKey[]) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.wireCard(row, slot, null);
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.wireHandCard(i, null);
    }

    if (this.gameOver || this.activeSide !== "player") return;
    if (this.confirmingAttack) return; // nessuna modifica ammessa in fase di conferma

    // Mostra comunque le carte già selezionate, anche mentre si sceglie un bersaglio ranged.
    for (const a of this.selectedAttackers) {
      this.lanes[a.row].setOutline(a.slot, 0xffd54f);
    }

    if (this.armedRangedAttacker) {
      this.actionButton.disabled = true;
      const armed = this.armedRangedAttacker;
      this.lanes[armed.row].setOutline(armed.slot, 0xff8a65);
      this.wireCard(armed.row, armed.slot, () => this.cancelRangedArm());

      for (const row of lanesOfSide("opponent")) {
        for (let slot = 0; slot < this.state.slotCount; slot++) {
          if (!canTargetWithRanged(this.state, row, slot)) continue;
          this.lanes[row].setOutline(slot, 0xff8a65);
          this.wireCard(row, slot, () => this.assignRangedTarget({ type: "card", row, slot }));
        }
      }

      this.targetFaceButton.style.display = "";
      this.targetFaceButton.onclick = () => this.assignRangedTarget({ type: "face" });
      return;
    }

    this.actionButton.disabled = false;
    const [playerMeleeRow, playerRangedRow] = lanesOfSide("player");

    for (const row of lanesOfSide("player")) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        const card = this.state.getCard(row, slot);
        if (card) {
          if (card.tapped) continue;
          const isSelected = this.selectedAttackers.some((a) => a.row === row && a.slot === slot);
          this.lanes[row].setOutline(slot, isSelected ? 0xffd54f : null);
          if (laneRoleOf(row) === "melee") {
            this.wireCard(row, slot, () => this.toggleMeleeAttacker(row, slot));
          } else {
            this.wireCard(row, slot, () => this.armRangedAttacker(row, slot));
          }
        } else if (this.armedHandIndex !== null && this.playerHand[this.armedHandIndex].cost <= this.playerMana) {
          this.lanes[row].setPlaceholderHighlight(slot, 0x66bb6a);
          this.lanes[row].setPlaceholderInteractive(slot, () => this.placeHandCard(row, slot));
        } else if (row === playerMeleeRow && this.state.getCard(playerRangedRow, slot)) {
          this.lanes[row].setPlaceholderHighlight(slot, 0x9575cd);
          this.lanes[row].setPlaceholderInteractive(slot, () => this.moveReserveForward(row, slot));
        }
      }
    }

    this.playerHand.forEach((card, index) => {
      const isArmed = index === this.armedHandIndex;
      const isAffordable = card.cost <= this.playerMana;
      this.handView.setOutline(index, isArmed ? 0xffd54f : isAffordable ? 0x4fc3f7 : null);
      this.wireHandCard(index, () => this.toggleArmedHandCard(index));
    });
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
