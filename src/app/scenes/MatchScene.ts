import gsap from "gsap";
import { Application, Container } from "pixi.js";
import { Board } from "../../board/Board";
import { Lane } from "../../board/Lane";
import { getCardById } from "../../data/cardLoader";
import { pickRandomEnemyDeckIds } from "../../data/enemyDecks";
import { aiChooseAttackers, aiPlayCards, aiReinforce } from "../../game/ai";
import { BoardState, lanesOfSide, sideOf, type RowKey, type Side } from "../../game/BoardState";
import { CardInstance } from "../../game/CardInstance";
import {
  applyEmpowermentOnPlay,
  applyTurnRegeneration,
  resolveCombat,
  type AttackDeclaration,
  type AttackTarget,
} from "../../game/combat";
import { Deck } from "../../game/Deck";
import { getPlayerProfile } from "../../game/PlayerProfile";
import { HandView, HAND_SCALE } from "../../hand/HandView";
import { dealCardFlight } from "../../render/animations";
import { preloadCardTextures } from "../../render/cardAssets";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { OverlayPanel } from "../../render/OverlayPanel";
import type { SceneContext } from "../SceneManager";
import { Modifier } from "../../types/card";
import { BaseScene } from "./BaseScene";
import { BoardInteractionController, type BoardInteractionHost } from "./BoardInteractionController";
import { CombatAnimator } from "./CombatAnimator";
import { MainMenuScene } from "./MainMenuScene";

const SLOT_COUNT = 4;
const INITIAL_HAND_SIZE = 3;
const HAND_MARGIN = 20;

export interface MatchResult {
  won: boolean;
  playerHealth: number;
  opponentHealth: number;
  turnsTaken: number;
}

export interface MatchSceneConfig {
  /** Di default il mazzo che il giocatore ha costruito; usato dalla Scalata della Torre per passare il mazzo evoluto tra i piani. */
  playerDeckIds?: string[];
  enemyDeckIds?: string[];
  /**
   * Se presente, sostituisce il pannello di fine partita predefinito (Rivincita/Menu Principale):
   * chi possiede questa scena decide cosa succede dopo (es. la Scalata della Torre mostra la
   * ricompensa o il game over con punteggio). Riceve anche il `SceneContext` di questa scena,
   * dato che il chiamante l'ha definito prima che esistesse.
   */
  onMatchEnd?: (result: MatchResult, context: SceneContext) => void;
}

/**
 * Coordina una partita: possiede lo stato del turno e i nodi Pixi/HUD, e delega a
 * `BoardInteractionController` cosa evidenziare/rendere cliccabile e a `CombatAnimator` la
 * riproduzione animata degli eventi di combattimento. Implementa `BoardInteractionHost` così
 * il controller può leggere il proprio stato di selezione senza duplicarlo.
 */
export class MatchScene extends BaseScene implements BoardInteractionHost {
  app!: Application;
  board!: Board;
  state = new BoardState(SLOT_COUNT);
  lanes!: Record<RowKey, Lane>;
  actionButton!: HTMLButtonElement;
  backButton!: HTMLButtonElement;
  private statusEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;

  activeSide: Side = "player";
  selectedAttackers: AttackDeclaration[] = [];
  armedRangedAttacker: { row: RowKey; slot: number } | null = null;
  armedHandIndex: number | null = null;
  gameOver = false;
  /** Vero mentre un replay animato (combattimento o piazzamento) è in corso: blocca i click, non il long-press. */
  isReplaying = false;

  private playerDeck: Deck;
  private enemyDeck: Deck;
  private onMatchEnd?: (result: MatchResult, context: SceneContext) => void;
  playerHand: CardInstance[] = [];
  private enemyHand: CardInstance[] = [];
  handView = new HandView();

  playerMana = 0;
  private playerTurnsTaken = 0;
  private enemyMana = 0;
  private enemyTurnsTaken = 0;
  private manaEl!: HTMLDivElement;

  private readonly overlayContainer = new Container();
  private readonly modalContainer = new Container();
  private activeModal: OverlayPanel | null = null;

  private interactions!: BoardInteractionController;
  private animator!: CombatAnimator;

  constructor(config: MatchSceneConfig = {}) {
    super();
    this.playerDeck = new Deck(config.playerDeckIds ?? [...getPlayerProfile().deck]);
    this.enemyDeck = new Deck(config.enemyDeckIds ?? pickRandomEnemyDeckIds());
    this.onMatchEnd = config.onMatchEnd;
  }

  protected async onMount(): Promise<void> {
    this.app = this.context.app;
    await preloadCardTextures();

    this.board = new Board(SLOT_COUNT);
    this.container.addChild(this.board);
    this.lanes = {
      opponentRanged: this.board.opponentRanged,
      opponentMelee: this.board.opponentMelee,
      playerMelee: this.board.playerMelee,
      playerRanged: this.board.playerRanged,
    };

    this.updateHealthDisplay();
    this.board.setPlayerDeckCount(this.playerDeck.remaining);
    this.board.setOpponentDeckCount(this.enemyDeck.remaining);
    this.container.addChild(this.handView);
    // Solo visivo (anteprime, numeri di danno, tracce ranged, carte in volo): non deve mai
    // intercettare i click destinati al tabellone sotto, altrimenti un'anteprima fissata a
    // sinistra blocca il piazzamento nella colonna sinistra.
    this.overlayContainer.eventMode = "none";
    this.container.addChild(this.overlayContainer);
    this.container.addChild(this.modalContainer);

    this.interactions = new BoardInteractionController(this, this.overlayContainer, this.app);
    this.animator = new CombatAnimator(this.lanes, this.board, this.overlayContainer, (message) =>
      this.appendLog(message),
    );

    this.buildHud(this.context.hudRoot);

    // Il renderer è già stato dimensionato una volta dallo SceneManager prima
    // che questa scena montasse: nessun nuovo evento "resize" nativo scatterà
    // per noi, quindi il primo layout va richiesto esplicitamente qui.
    this.layout();

    // `startAttackPhase` pesca automaticamente una carta a inizio turno: si
    // pesca una in meno qui per non sballare la dimensione della mano di
    // apertura, dato che il primo turno la completa.
    for (let i = 0; i < INITIAL_HAND_SIZE - 1; i++) {
      await this.drawPlayerCard();
      await this.drawEnemyCard();
    }

    await this.startAttackPhase("player");
  }

  protected onUnmount(): void {
    // `popDamageNumber` è volutamente "fire-and-forget" (non atteso): se il
    // giocatore chiude la partita mentre un numero di danno sta ancora
    // animandosi, il tween GSAP continuerebbe a scrivere su un oggetto appena
    // distrutto. Va ucciso esplicitamente prima che la base distrugga il container.
    gsap.killTweensOf(this.overlayContainer.children);
  }

  /** Costruisce l'HUD (stato/mana/pulsanti/log) dentro il div fornito dalla scena, e ne salva i riferimenti. */
  private buildHud(hudRoot: HTMLElement): void {
    hudRoot.innerHTML = `
      <div id="hud-top">
        <div id="info">
          <div id="status"></div>
          <div id="mana"></div>
        </div>
        <div id="button-row">
          <button id="back-button" type="button" style="display: none">Annulla</button>
          <button id="action-button" type="button">Attacca</button>
        </div>
      </div>
      <div id="log"></div>
    `;
    this.actionButton = hudRoot.querySelector<HTMLButtonElement>("#action-button")!;
    this.backButton = hudRoot.querySelector<HTMLButtonElement>("#back-button")!;
    this.statusEl = hudRoot.querySelector<HTMLDivElement>("#status")!;
    this.manaEl = hudRoot.querySelector<HTMLDivElement>("#mana")!;
    this.logEl = hudRoot.querySelector<HTMLDivElement>("#log")!;
  }

  // ---- Mazzo e mano ----

  /** Vola dalla pila del giocatore fino al nuovo slot in mano, poi la mostra a riposo. */
  private async drawPlayerCard(): Promise<void> {
    const data = this.playerDeck.draw();
    if (!data) return;
    this.board.setPlayerDeckCount(this.playerDeck.remaining);

    const instance = new CardInstance(data);
    const source = this.board.getPlayerDeckGlobalCenter();
    this.playerHand.push(instance);
    this.updateHandDisplay();

    const newIndex = this.playerHand.length - 1;
    const dest = this.handView.getCardGlobalCenter(newIndex);
    if (!dest) return;

    this.handView.setCardVisible(newIndex, false);
    const flying = new CardView(instance);
    flying.pivot.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.overlayContainer.addChild(flying);
    await dealCardFlight(flying, { ...source, scale: this.board.scale.x }, { ...dest, scale: HAND_SCALE });
    this.overlayContainer.removeChild(flying);
    flying.destroy();
    this.handView.setCardVisible(newIndex, true);
  }

  /** Non c'è una mano nemica visibile: si vede solo la pila "battere" e il contatore scendere. */
  private async drawEnemyCard(): Promise<void> {
    const data = this.enemyDeck.draw();
    if (!data) return;
    this.enemyHand.push(new CardInstance(data));
    this.board.setOpponentDeckCount(this.enemyDeck.remaining);
    this.board.setOpponentHandCount(this.enemyHand.length);
    await this.board.pulseOpponentDeck();
  }

  private updateHandDisplay(): void {
    this.handView.setCards(this.playerHand);
    this.layout();
  }

  private updateManaDisplay(): void {
    this.manaEl.textContent = `Mana: ${this.playerMana}`;
  }

  // ---- Turno ----

  private async startAttackPhase(side: Side): Promise<void> {
    if (this.gameOver) return;
    this.activeSide = side;
    this.selectedAttackers = [];
    this.armedRangedAttacker = null;
    this.clearArmedHand();
    this.backButton.style.display = "none";
    this.untapSide(side);
    applyTurnRegeneration(this.state, side);
    this.applyTurnSpawns(side);
    this.syncBoardView();

    if (side === "player") {
      this.playerTurnsTaken++;
      // Il mana riparte sempre dal conteggio dei turni, non da quanto è
      // avanzato dopo aver speso: spendere questo turno non "abbassa" la
      // crescita dei turni successivi.
      this.playerMana = this.playerTurnsTaken - 1;
      this.updateManaDisplay();
      await this.drawPlayerCard();
      this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
      this.actionButton.textContent = "Attacca";
      this.actionButton.disabled = false;
      this.actionButton.onclick = () => this.confirmPlayerAttackers();
      this.backButton.onclick = () => this.cancelSelection();
      this.interactions.refresh();
    } else {
      this.enemyTurnsTaken++;
      this.enemyMana = this.enemyTurnsTaken - 1;
      await this.drawEnemyCard();
      aiReinforce(this.state, "opponent");
      this.syncBoardView(); // riflette subito il rinforzo (non animato: fuori scope per ora)

      const { remainingMana, played } = aiPlayCards(this.state, "opponent", this.enemyHand, this.enemyMana);
      this.enemyMana = remainingMana;
      this.board.setOpponentHandCount(this.enemyHand.length);
      for (const { card, row, slot } of played) {
        const dest = this.lanes[row].getSlotGlobalCenter(slot);
        const dropHeight = CARD_HEIGHT * this.board.scale.x + 40;
        await this.dealCardToSlot(card, row, slot, { x: dest.x, y: dest.y - dropHeight, scale: this.board.scale.x });
        this.appendLog(`Il nemico gioca ${card.data.name}`);
      }

      const attacks = aiChooseAttackers(this.state, "opponent");
      this.statusEl.textContent = "Il nemico attacca...";
      await this.resolveAndAdvance("opponent", attacks);
    }
  }

  /** "Annulla": pulisce la selezione corrente senza toccare carte già piazzate/tappate questo turno. */
  private cancelSelection(): void {
    this.selectedAttackers = [];
    this.armedRangedAttacker = null;
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.interactions.refresh();
  }

  private confirmPlayerAttackers(): void {
    void this.resolveAndAdvance("player", [...this.selectedAttackers]);
  }

  toggleMeleeAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) this.selectedAttackers.splice(idx, 1);
    else this.selectedAttackers.push({ row, slot });
    this.interactions.refresh();
  }

  /** Annulla lo stato "carta in mano armata" e la sua anteprima fissata, se presente. */
  private clearArmedHand(): void {
    this.armedHandIndex = null;
    this.interactions.unpin();
  }

  armRangedAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) {
      this.selectedAttackers.splice(idx, 1);
      this.interactions.refresh();
      return;
    }
    this.clearArmedHand();
    this.armedRangedAttacker = { row, slot };
    this.statusEl.textContent = "Scegli il bersaglio per l'attacco a distanza, oppure colpisci il volto";
    this.interactions.refresh();
  }

  cancelRangedArm(): void {
    this.armedRangedAttacker = null;
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.interactions.refresh();
  }

  assignRangedTarget(target: AttackTarget): void {
    if (!this.armedRangedAttacker) return;
    this.selectedAttackers.push({ ...this.armedRangedAttacker, target });
    this.armedRangedAttacker = null;
    this.statusEl.textContent = "Il tuo turno: scegli le carte che attaccano";
    this.interactions.refresh();
  }

  toggleArmedHandCard(index: number): void {
    this.armedRangedAttacker = null;
    this.armedHandIndex = this.armedHandIndex === index ? null : index;
    this.interactions.refresh();

    const armedCard = this.armedHandIndex !== null ? this.playerHand[this.armedHandIndex] : undefined;
    if (armedCard) {
      this.interactions.pin(armedCard, "player");
    } else {
      this.interactions.unpin();
    }

    this.statusEl.textContent = !armedCard
      ? "Il tuo turno: scegli le carte che attaccano"
      : armedCard.cost > this.playerMana
        ? `Mana insufficiente per ${armedCard.data.name} (costa ${armedCard.cost}, hai ${this.playerMana})`
        : "Scegli uno slot libero per giocare la carta";
  }

  async placeHandCard(row: RowKey, slot: number): Promise<void> {
    if (this.armedHandIndex === null) return;
    const instance = this.playerHand[this.armedHandIndex];
    if (!instance || instance.cost > this.playerMana) return;

    const source = this.handView.getCardGlobalCenter(this.armedHandIndex);

    this.playerHand.splice(this.armedHandIndex, 1);
    this.playerMana -= instance.cost;
    // Appena giocata non può ancora attaccare, come una carta tappata — a meno che non abbia
    // Attacco rapido, che le permette di agire nello stesso turno in cui viene schierata.
    instance.tapped = !instance.hasModifier(Modifier.FirstStrike);
    this.clearArmedHand();
    this.updateHandDisplay();
    this.updateManaDisplay();
    this.isReplaying = true;
    this.interactions.refresh();

    if (source) {
      await this.dealCardToSlot(instance, row, slot, { ...source, scale: HAND_SCALE });
    } else {
      applyEmpowermentOnPlay(this.state, sideOf(row), instance);
      this.state.setCard(row, slot, instance);
      this.lanes[row].setCard(slot, instance);
    }

    this.isReplaying = false;
    this.interactions.refresh();
  }

  /** Anima una carta "in volo" da `source` (posizione/scala globali) fino allo slot, poi la posiziona a riposo. */
  private async dealCardToSlot(
    instance: CardInstance,
    row: RowKey,
    slot: number,
    source: { x: number; y: number; scale: number },
  ): Promise<void> {
    const dest = this.lanes[row].getSlotGlobalCenter(slot);
    const flying = new CardView(instance);
    flying.pivot.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.overlayContainer.addChild(flying);

    await dealCardFlight(flying, source, { x: dest.x, y: dest.y, scale: this.board.scale.x });

    this.overlayContainer.removeChild(flying);
    flying.destroy();
    applyEmpowermentOnPlay(this.state, sideOf(row), instance);
    this.state.setCard(row, slot, instance);
    this.lanes[row].setCard(slot, instance);
  }

  moveReserveForward(meleeRow: RowKey, slot: number): void {
    const rangedRow = lanesOfSide("player")[1];
    const reserve = this.state.getCard(rangedRow, slot);
    if (!reserve) return;
    this.state.setCard(meleeRow, slot, reserve);
    this.state.setCard(rangedRow, slot, undefined);
    this.lanes[meleeRow].setCard(slot, reserve);
    this.lanes[rangedRow].setCard(slot, undefined);
    this.interactions.refresh();
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

  /** A inizio turno: ogni carta con Genera aggiunge una copia della carta indicata al mazzo del suo proprietario. */
  private applyTurnSpawns(side: Side): void {
    const deck = side === "player" ? this.playerDeck : this.enemyDeck;
    for (const row of lanesOfSide(side)) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        const card = this.state.getCard(row, slot);
        if (!card?.hasModifier(Modifier.Spawn) || !card.data.spawnCardId) continue;
        const spawnData = getCardById(card.data.spawnCardId);
        if (spawnData) deck.addCard(spawnData);
      }
    }
    this.board.setPlayerDeckCount(this.playerDeck.remaining);
    this.board.setOpponentDeckCount(this.enemyDeck.remaining);
  }

  // ---- Risoluzione ----

  private async resolveAndAdvance(attackingSide: Side, attacks: AttackDeclaration[]): Promise<void> {
    this.isReplaying = true;
    this.actionButton.disabled = true;
    this.interactions.refresh(); // pulisce le azioni di click, il long-press resta attivo

    const events = resolveCombat(this.state, attackingSide, attacks);
    await this.animator.playReplay(events);

    this.isReplaying = false;
    this.syncBoardView();
    this.updateHealthDisplay();
    if (this.checkGameOver()) return;
    const nextSide: Side = attackingSide === "player" ? "opponent" : "player";
    await this.startAttackPhase(nextSide);
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

  private checkGameOver(): boolean {
    if (this.state.playerHealth > 0 && this.state.opponentHealth > 0) return false;

    this.gameOver = true;
    this.actionButton.disabled = true;
    this.backButton.style.display = "none";
    const result =
      this.state.playerHealth <= 0 && this.state.opponentHealth <= 0
        ? "Pareggio!"
        : this.state.opponentHealth <= 0
          ? "Hai vinto!"
          : "Hai perso!";
    this.statusEl.textContent = result;
    // `gameOver` è ormai vero: rifà il wiring, che con la partita finita si ferma dopo aver
    // lasciato attiva solo l'anteprima a pressione prolungata su ogni carta in campo e in mano.
    this.interactions.refresh();
    if (this.onMatchEnd) {
      this.onMatchEnd(
        {
          won: result === "Hai vinto!",
          playerHealth: this.state.playerHealth,
          opponentHealth: this.state.opponentHealth,
          turnsTaken: this.playerTurnsTaken,
        },
        this.context,
      );
    } else {
      this.showGameOverModal(result);
    }
    return true;
  }

  /** Pannello di fine partita: il tabellone finale resta visibile e dimmerato sotto. */
  private showGameOverModal(title: string): void {
    const panel = new OverlayPanel({
      title,
      buttons: [
        { label: "Rivincita", emphasis: "primary", onClick: () => this.context.goTo(() => new MatchScene()) },
        { label: "Menu Principale", emphasis: "secondary", onClick: () => this.context.goTo(() => new MainMenuScene()) },
      ],
    });
    this.activeModal = panel;
    this.modalContainer.addChild(panel);
    panel.layout(this.app.screen.width, this.app.screen.height);
  }

  protected layout(): void {
    const handHeight = this.handView.handHeight();
    const reserved = handHeight + HAND_MARGIN * 2;
    this.board.fitToScreen(this.app.screen.width, this.app.screen.height - reserved);
    this.handView.position.set(
      (this.app.screen.width - this.handView.handWidth()) / 2,
      this.app.screen.height - handHeight - HAND_MARGIN,
    );
    this.activeModal?.layout(this.app.screen.width, this.app.screen.height);
  }
}
