import { Application, Container } from "pixi.js";
import type { Lane } from "../../board/Lane";
import { lanesOfSide, laneRoleOf, sideOf, type BoardState, type RowKey, type Side } from "../../game/BoardState";
import {
  canTargetWithRanged,
  laneIsEmpty,
  meleeTargetColumns,
  meleeTargetFor,
  wouldKill,
  type AttackDeclaration,
  type AttackTarget,
} from "../../game/combat";
import type { CardInstance } from "../../game/CardInstance";
import type { HandView } from "../../hand/HandView";
import { createCardPreview } from "../../render/cardPreview";

/** Tutto ciò che il controller legge dalla scena ospitante per decidere cosa evidenziare/rendere
 *  cliccabile; le azioni dell'utente tornano alla scena tramite queste callback, mai mutando `host` direttamente. */
export interface BoardInteractionHost {
  readonly state: BoardState;
  readonly lanes: Record<RowKey, Lane>;
  readonly handView: HandView;
  readonly playerHand: CardInstance[];
  readonly actionButton: HTMLButtonElement;
  readonly backButton: HTMLButtonElement;
  readonly selectedAttackers: AttackDeclaration[];
  readonly armedRangedAttacker: { row: RowKey; slot: number } | null;
  readonly armedHandIndex: number | null;
  readonly playerMana: number;
  readonly isReplaying: boolean;
  readonly gameOver: boolean;
  readonly activeSide: Side;
  toggleMeleeAttacker(row: RowKey, slot: number): void;
  armRangedAttacker(row: RowKey, slot: number): void;
  cancelRangedArm(): void;
  assignRangedTarget(target: AttackTarget): void;
  toggleArmedHandCard(index: number): void;
  placeHandCard(row: RowKey, slot: number): void;
  moveReserveForward(row: RowKey, slot: number): void;
}

/**
 * Decide cosa sul tabellone/mano è cliccabile e come evidenziarlo, in base allo stato corrente
 * della scena ospitante, e gestisce l'anteprima a pressione prolungata (transitoria, o "fissata"
 * quando una carta in mano è armata).
 */
export class BoardInteractionController {
  private pinnedPreview: { card: CardInstance; side: Side } | null = null;
  private readonly host: BoardInteractionHost;
  private readonly overlayContainer: Container;
  private readonly app: Application;

  constructor(host: BoardInteractionHost, overlayContainer: Container, app: Application) {
    this.host = host;
    this.overlayContainer = overlayContainer;
    this.app = app;
  }

  /** "Fissa" un'anteprima (es. carta in mano armata): resta visibile finché non viene tolta con `unpin`. */
  pin(card: CardInstance, side: Side): void {
    this.pinnedPreview = { card, side };
    this.showPreview(card, side);
  }

  unpin(): void {
    this.pinnedPreview = null;
    this.hidePreview();
  }

  showPreview(card: CardInstance, side: Side): void {
    this.overlayContainer.removeChildren();

    const wrapper = createCardPreview(card);
    const margin = 16;
    wrapper.position.set(
      side === "player" ? margin : this.app.screen.width - wrapper.width - margin,
      Math.max(margin, (this.app.screen.height - wrapper.height) / 2),
    );

    this.overlayContainer.addChild(wrapper);
  }

  /** Nasconde l'anteprima transitoria (long-press); se c'è una carta "fissata", la ripristina. */
  hidePreview(): void {
    this.overlayContainer.removeChildren();
    if (this.pinnedPreview) this.showPreview(this.pinnedPreview.card, this.pinnedPreview.side);
  }

  /** Ricalcola cosa è cliccabile/evidenziato sul tabellone e in mano, in base allo stato di `host`. */
  refresh(): void {
    const { host } = this;
    for (const row of Object.keys(host.lanes) as RowKey[]) {
      for (let slot = 0; slot < host.state.slotCount; slot++) {
        host.lanes[row].setInteractive(slot, null);
        host.lanes[row].setOutline(slot, null);
        host.lanes[row].setPlaceholderInteractive(slot, null);
        host.lanes[row].setPlaceholderHighlight(slot, null);
        host.lanes[row].setDeathMarker(slot, false);
      }
      host.lanes[row].setLaneInteractive(null);
      host.lanes[row].setLaneHighlight(null);
    }
    for (let i = 0; i < host.playerHand.length; i++) {
      host.handView.setInteractive(i, null);
      host.handView.setOutline(i, null);
    }
    host.backButton.style.display = "none";

    // L'anteprima a pressione prolungata resta sempre disponibile su ogni carta in campo e in mano.
    for (const row of Object.keys(host.lanes) as RowKey[]) {
      for (let slot = 0; slot < host.state.slotCount; slot++) {
        this.wireCard(row, slot, null);
      }
    }
    for (let i = 0; i < host.playerHand.length; i++) {
      this.wireHandCard(i, null);
    }

    if (host.isReplaying || host.gameOver || host.activeSide !== "player") return;

    host.backButton.style.display = host.selectedAttackers.length > 0 ? "" : "none";

    // Mostra comunque le carte già selezionate, anche mentre si sceglie un bersaglio ranged.
    for (const a of host.selectedAttackers) {
      host.lanes[a.row].setOutline(a.slot, 0xffd54f);
    }

    if (host.armedRangedAttacker) {
      const armed = host.armedRangedAttacker;
      const armedCard = host.state.getCard(armed.row, armed.slot);
      host.actionButton.disabled = true;
      host.lanes[armed.row].setOutline(armed.slot, 0xff8a65);
      this.wireCard(armed.row, armed.slot, () => host.cancelRangedArm());

      for (const row of lanesOfSide("opponent")) {
        if (laneIsEmpty(host.state, row)) {
          // Corsia interamente vuota: si seleziona come un unico bersaglio (colpisce il volto),
          // non slot per slot — niente da colpire lì dentro, quindi niente scacchiera vuota da mostrare.
          host.lanes[row].setLaneHighlight(0xff8a65);
          host.lanes[row].setLaneInteractive(() => host.assignRangedTarget({ type: "face" }));
          continue;
        }
        for (let slot = 0; slot < host.state.slotCount; slot++) {
          const target = host.state.getCard(row, slot);
          if (!target || !canTargetWithRanged(host.state, row, slot)) continue;
          host.lanes[row].setOutline(slot, 0xff8a65);
          this.wireCard(row, slot, () => host.assignRangedTarget({ type: "card", row, slot }));
          if (armedCard) host.lanes[row].setDeathMarker(slot, wouldKill(armedCard, target));
        }
      }

      return;
    }

    host.actionButton.disabled = false;
    const [playerMeleeRow, playerRangedRow] = lanesOfSide("player");

    for (const row of lanesOfSide("player")) {
      for (let slot = 0; slot < host.state.slotCount; slot++) {
        const card = host.state.getCard(row, slot);
        if (card) {
          if (card.tapped) continue;
          const isSelected = host.selectedAttackers.some((a) => a.row === row && a.slot === slot);
          host.lanes[row].setOutline(slot, isSelected ? 0xffd54f : null);
          if (laneRoleOf(row) === "melee") {
            this.wireCard(row, slot, () => host.toggleMeleeAttacker(row, slot));
            if (isSelected) {
              for (const targetSlot of meleeTargetColumns(card, slot, host.state.slotCount)) {
                const target = meleeTargetFor(host.state, row, slot, targetSlot);
                if (target) host.lanes[target.row].setDeathMarker(target.slot, wouldKill(card, target.card));
              }
            }
          } else {
            this.wireCard(row, slot, () => host.armRangedAttacker(row, slot));
          }
        } else if (host.armedHandIndex !== null && host.playerHand[host.armedHandIndex].cost <= host.playerMana) {
          host.lanes[row].setPlaceholderHighlight(slot, 0x66bb6a);
          host.lanes[row].setPlaceholderInteractive(slot, () => host.placeHandCard(row, slot));
        } else if (row === playerMeleeRow && host.state.getCard(playerRangedRow, slot)) {
          host.lanes[row].setPlaceholderHighlight(slot, 0x9575cd);
          host.lanes[row].setPlaceholderInteractive(slot, () => host.moveReserveForward(row, slot));
        }
      }
    }

    host.playerHand.forEach((card, index) => {
      const isArmed = index === host.armedHandIndex;
      const isAffordable = card.cost <= host.playerMana;
      host.handView.setOutline(index, isArmed ? 0xffd54f : isAffordable ? 0x4fc3f7 : null);
      this.wireHandCard(index, () => host.toggleArmedHandCard(index));
    });
  }

  /** Agancia il click di gioco (se presente) mantenendo sempre attiva l'anteprima a pressione prolungata. */
  private wireCard(row: RowKey, slot: number, onClick: (() => void) | null): void {
    const card = this.host.state.getCard(row, slot);
    if (!card) return;
    this.host.lanes[row].setInteractive(
      slot,
      onClick,
      () => this.showPreview(card, sideOf(row)),
      () => this.hidePreview(),
    );
  }

  /** Come `wireCard`, ma per le carte in mano (sempre lato "player"). */
  private wireHandCard(index: number, onClick: (() => void) | null): void {
    const card = this.host.playerHand[index];
    if (!card) return;
    this.host.handView.setInteractive(
      index,
      onClick,
      () => this.showPreview(card, "player"),
      () => this.hidePreview(),
    );
  }
}
