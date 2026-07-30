import gsap from "gsap";
import { Application, Container, Graphics } from "pixi.js";
import { Board } from "../../board/Board";
import { Lane } from "../../board/Lane";
import { pickRandomEnemyDeckIds } from "../../data/enemyDecks";
import { aiChooseAttackers, aiPlayCards, aiReinforce } from "../../game/ai";
import { BoardState, laneRoleOf, lanesOfSide, sideOf, type RowKey, type Side } from "../../game/BoardState";
import { CardInstance } from "../../game/CardInstance";
import {
  applyTurnRegeneration,
  canTargetWithRanged,
  meleeTargetFor,
  resolveCombat,
  wouldKill,
  type AttackDeclaration,
  type AttackTarget,
  type CombatEvent,
} from "../../game/combat";
import { Deck } from "../../game/Deck";
import { getPlayerProfile } from "../../game/PlayerProfile";
import { HandView, HAND_SCALE } from "../../hand/HandView";
import { dealCardFlight, fadeOut, lungeToward, popDamageNumber, rangedRecoil, shake, travelStreak } from "../../render/animations";
import { preloadCardTextures } from "../../render/cardAssets";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "../../render/CardView";
import { OverlayPanel } from "../../render/OverlayPanel";
import type { Scene, SceneContext } from "../SceneManager";
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

export class MatchScene implements Scene {
  private context!: SceneContext;
  private app!: Application;
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
  private gameOver = false;
  /** Vero mentre un replay animato (combattimento o piazzamento) è in corso: blocca i click, non il long-press. */
  private isReplaying = false;

  private playerDeck: Deck;
  private enemyDeck: Deck;
  private onMatchEnd?: (result: MatchResult, context: SceneContext) => void;
  private playerHand: CardInstance[] = [];
  private enemyHand: CardInstance[] = [];
  private handView = new HandView();

  private playerMana = 0;
  private playerTurnsTaken = 0;
  private enemyMana = 0;
  private enemyTurnsTaken = 0;
  private manaEl!: HTMLDivElement;

  private overlayContainer = new Container();
  /** Carta "fissata" in anteprima (es. armata dalla mano): resta visibile finché non si cambia stato. */
  private pinnedPreview: { card: CardInstance; side: Side } | null = null;

  private modalContainer = new Container();
  private activeModal: OverlayPanel | null = null;

  constructor(config: MatchSceneConfig = {}) {
    this.playerDeck = new Deck(config.playerDeckIds ?? [...getPlayerProfile().deck]);
    this.enemyDeck = new Deck(config.enemyDeckIds ?? pickRandomEnemyDeckIds());
    this.onMatchEnd = config.onMatchEnd;
  }

  async mount(context: SceneContext): Promise<void> {
    this.context = context;
    this.app = context.app;
    await preloadCardTextures();

    this.board = new Board(SLOT_COUNT);
    this.app.stage.addChild(this.board);
    this.lanes = {
      opponentRanged: this.board.opponentRanged,
      opponentMelee: this.board.opponentMelee,
      playerMelee: this.board.playerMelee,
      playerRanged: this.board.playerRanged,
    };

    this.updateHealthDisplay();
    this.board.setPlayerDeckCount(this.playerDeck.remaining);
    this.board.setOpponentDeckCount(this.enemyDeck.remaining);
    this.app.stage.addChild(this.handView);
    this.app.stage.addChild(this.overlayContainer);
    this.app.stage.addChild(this.modalContainer);

    this.buildHud(context.hudRoot);

    // Il renderer è già stato dimensionato una volta dallo SceneManager prima
    // che questa scena montasse: nessun nuovo evento "resize" nativo scatterà
    // per noi, quindi il primo layout va richiesto esplicitamente qui.
    this.app.renderer.on("resize", this.handleResize);
    this.handleResize();

    // `startAttackPhase` pesca automaticamente una carta a inizio turno: si
    // pesca una in meno qui per non sballare la dimensione della mano di
    // apertura, dato che il primo turno la completa.
    for (let i = 0; i < INITIAL_HAND_SIZE - 1; i++) {
      await this.drawPlayerCard();
      await this.drawEnemyCard();
    }

    await this.startAttackPhase("player");
  }

  unmount(): void {
    this.app.renderer.off("resize", this.handleResize);
    // `popDamageNumber` è volutamente "fire-and-forget" (non atteso): se il
    // giocatore chiude la partita mentre un numero di danno sta ancora
    // animandosi, il tween GSAP continuerebbe a scrivere su un oggetto appena
    // distrutto. Va ucciso esplicitamente prima di distruggere il container.
    gsap.killTweensOf(this.overlayContainer.children);
    this.app.stage.removeChild(this.board);
    this.app.stage.removeChild(this.handView);
    this.app.stage.removeChild(this.overlayContainer);
    this.app.stage.removeChild(this.modalContainer);
    this.board.destroy({ children: true });
    this.handView.destroy({ children: true });
    this.overlayContainer.destroy({ children: true });
    this.modalContainer.destroy({ children: true });
    this.context.hudRoot.innerHTML = "";
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
          <button id="target-face-button" type="button" style="display: none">Colpisci il volto</button>
          <button id="action-button" type="button">Attacca</button>
        </div>
      </div>
      <div id="log"></div>
    `;
    this.actionButton = hudRoot.querySelector<HTMLButtonElement>("#action-button")!;
    this.backButton = hudRoot.querySelector<HTMLButtonElement>("#back-button")!;
    this.targetFaceButton = hudRoot.querySelector<HTMLButtonElement>("#target-face-button")!;
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
    this.handleResize();
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
    this.targetFaceButton.style.display = "none";
    this.untapSide(side);
    applyTurnRegeneration(this.state, side);
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
      this.refreshBoardInteractivity();
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
    this.refreshBoardInteractivity();
  }

  private confirmPlayerAttackers(): void {
    void this.resolveAndAdvance("player", [...this.selectedAttackers]);
  }

  private toggleMeleeAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) this.selectedAttackers.splice(idx, 1);
    else this.selectedAttackers.push({ row, slot });
    this.refreshBoardInteractivity();
  }

  /** Annulla lo stato "carta in mano armata" e la sua anteprima fissata, se presenti. */
  private clearArmedHand(): void {
    this.armedHandIndex = null;
    this.pinnedPreview = null;
    this.hideCardPreview();
  }

  private armRangedAttacker(row: RowKey, slot: number): void {
    const idx = this.selectedAttackers.findIndex((a) => a.row === row && a.slot === slot);
    if (idx >= 0) {
      this.selectedAttackers.splice(idx, 1);
      this.refreshBoardInteractivity();
      return;
    }
    this.clearArmedHand();
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
    if (armedCard) {
      this.pinnedPreview = { card: armedCard, side: "player" };
      this.showCardPreview(armedCard, "player");
    } else {
      this.pinnedPreview = null;
      this.hideCardPreview();
    }

    this.statusEl.textContent = !armedCard
      ? "Il tuo turno: scegli le carte che attaccano"
      : armedCard.cost > this.playerMana
        ? `Mana insufficiente per ${armedCard.data.name} (costa ${armedCard.cost}, hai ${this.playerMana})`
        : "Scegli uno slot libero per giocare la carta";
  }

  private async placeHandCard(row: RowKey, slot: number): Promise<void> {
    if (this.armedHandIndex === null) return;
    const instance = this.playerHand[this.armedHandIndex];
    if (!instance || instance.cost > this.playerMana) return;

    const source = this.handView.getCardGlobalCenter(this.armedHandIndex);

    this.playerHand.splice(this.armedHandIndex, 1);
    this.playerMana -= instance.cost;
    // Appena giocata: non può ancora attaccare, come una carta tappata.
    instance.tapped = true;
    this.clearArmedHand();
    this.updateHandDisplay();
    this.updateManaDisplay();
    this.isReplaying = true;
    this.refreshBoardInteractivity();

    if (source) {
      await this.dealCardToSlot(instance, row, slot, { ...source, scale: HAND_SCALE });
    } else {
      this.state.setCard(row, slot, instance);
      this.lanes[row].setCard(slot, instance);
    }

    this.isReplaying = false;
    this.refreshBoardInteractivity();
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
    this.state.setCard(row, slot, instance);
    this.lanes[row].setCard(slot, instance);
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

  private async resolveAndAdvance(attackingSide: Side, attacks: AttackDeclaration[]): Promise<void> {
    this.isReplaying = true;
    this.actionButton.disabled = true;
    this.refreshBoardInteractivity(); // pulisce le azioni di click, il long-press resta attivo

    const events = resolveCombat(this.state, attackingSide, attacks);
    await this.playCombatReplay(events);

    this.isReplaying = false;
    this.syncBoardView();
    this.updateHealthDisplay();
    if (this.checkGameOver()) return;
    const nextSide: Side = attackingSide === "player" ? "opponent" : "player";
    await this.startAttackPhase(nextSide);
  }

  /** Rigioca gli eventi di combattimento in ordine, con animazione, aggiungendoli al log man mano. */
  private async playCombatReplay(events: CombatEvent[]): Promise<void> {
    for (const event of events) {
      await this.playCombatEvent(event);
      this.appendLog(event.message);
    }
  }

  private async playCombatEvent(event: CombatEvent): Promise<void> {
    switch (event.type) {
      case "attack": {
        if (!event.from || !event.to) return;
        const fromView = this.lanes[event.from.row].getCardView(event.from.slot);
        const toView = this.lanes[event.to.row].getCardView(event.to.slot);
        if (!fromView || !toView) return;
        const fromCenter = this.lanes[event.from.row].getSlotGlobalCenter(event.from.slot);
        const toCenter = this.lanes[event.to.row].getSlotGlobalCenter(event.to.slot);

        if (event.kind === "ranged") {
          const dx = Math.sign(toCenter.x - fromCenter.x || 1) * 10;
          await Promise.all([
            rangedRecoil(fromView, dx),
            travelStreak(this.overlayContainer, fromCenter, toCenter, 0xff8a65).then(() => shake(toView)),
          ]);
        } else {
          const dx = (toCenter.x - fromCenter.x) * 0.18;
          const dy = (toCenter.y - fromCenter.y) * 0.18;
          await Promise.all([lungeToward(fromView, dx, dy), this.delay(60).then(() => shake(toView))]);
        }

        if (event.amount) void popDamageNumber(this.overlayContainer, toCenter.x, toCenter.y - 30, event.amount);
        break;
      }
      case "death": {
        if (!event.to) return;
        const view = this.lanes[event.to.row].getCardView(event.to.slot);
        if (view) await fadeOut(view);
        break;
      }
      case "face-damage": {
        if (!event.face) return;
        const center = this.board.getHealthGlobalCenter(event.face);
        await this.board.punchHealth(event.face);
        if (event.amount) void popDamageNumber(this.overlayContainer, center.x, center.y - 24, event.amount);
        break;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    this.targetFaceButton.style.display = "none";
    const result =
      this.state.playerHealth <= 0 && this.state.opponentHealth <= 0
        ? "Pareggio!"
        : this.state.opponentHealth <= 0
          ? "Hai vinto!"
          : "Hai perso!";
    this.statusEl.textContent = result;
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
    this.overlayContainer.removeChildren();

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

    this.overlayContainer.addChild(wrapper);
  }

  /** Nasconde l'anteprima transitoria (long-press); se c'è una carta "fissata" (es. armata dalla mano), la ripristina. */
  private hideCardPreview(): void {
    this.overlayContainer.removeChildren();
    if (this.pinnedPreview) this.showCardPreview(this.pinnedPreview.card, this.pinnedPreview.side);
  }

  // ---- Interattività ----

  private refreshBoardInteractivity(): void {
    for (const row of Object.keys(this.lanes) as RowKey[]) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.lanes[row].setInteractive(slot, null);
        this.lanes[row].setOutline(slot, null);
        this.lanes[row].setPlaceholderInteractive(slot, null);
        this.lanes[row].setPlaceholderHighlight(slot, null);
        this.lanes[row].setDeathMarker(slot, false);
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.handView.setInteractive(i, null);
      this.handView.setOutline(i, null);
    }
    this.targetFaceButton.style.display = "none";
    this.backButton.style.display = "none";

    // L'anteprima a pressione prolungata resta sempre disponibile su ogni carta in campo e in mano.
    for (const row of Object.keys(this.lanes) as RowKey[]) {
      for (let slot = 0; slot < this.state.slotCount; slot++) {
        this.wireCard(row, slot, null);
      }
    }
    for (let i = 0; i < this.playerHand.length; i++) {
      this.wireHandCard(i, null);
    }

    if (this.isReplaying || this.gameOver || this.activeSide !== "player") return;

    this.backButton.style.display = this.selectedAttackers.length > 0 ? "" : "none";

    // Mostra comunque le carte già selezionate, anche mentre si sceglie un bersaglio ranged.
    for (const a of this.selectedAttackers) {
      this.lanes[a.row].setOutline(a.slot, 0xffd54f);
    }

    if (this.armedRangedAttacker) {
      const armedCard = this.state.getCard(this.armedRangedAttacker.row, this.armedRangedAttacker.slot);
      this.actionButton.disabled = true;
      const armed = this.armedRangedAttacker;
      this.lanes[armed.row].setOutline(armed.slot, 0xff8a65);
      this.wireCard(armed.row, armed.slot, () => this.cancelRangedArm());

      for (const row of lanesOfSide("opponent")) {
        for (let slot = 0; slot < this.state.slotCount; slot++) {
          if (!canTargetWithRanged(this.state, row, slot)) continue;
          this.lanes[row].setOutline(slot, 0xff8a65);
          this.wireCard(row, slot, () => this.assignRangedTarget({ type: "card", row, slot }));
          const target = this.state.getCard(row, slot);
          if (armedCard && target) this.lanes[row].setDeathMarker(slot, wouldKill(armedCard, target));
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
            if (isSelected) {
              const target = meleeTargetFor(this.state, row, slot);
              if (target) this.lanes[target.row].setDeathMarker(target.slot, wouldKill(card, target.card));
            }
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
    this.activeModal?.layout(this.app.screen.width, this.app.screen.height);
  };
}
