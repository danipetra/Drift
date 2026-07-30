import { Container, Graphics, Text } from "pixi.js";
import { punchScale } from "../render/animations";
import { Lane } from "./Lane";

const LANE_GAP = 20;
const CENTER_GAP = 60;
const HP_MARGIN = 40;
const DECK_PILE_WIDTH = 26;
const DECK_PILE_HEIGHT = 32;

interface DeckPile {
  container: Container;
  countText: Text;
}

/** Piccola pila di carte coperte (stilizzata) con il conteggio delle carte rimaste accanto. */
function createDeckPile(): DeckPile {
  const container = new Container();
  for (let i = 2; i >= 0; i--) {
    const card = new Graphics()
      .roundRect(i * 2, i * -2, DECK_PILE_WIDTH, DECK_PILE_HEIGHT, 4)
      .fill({ color: 0x2a2f36 })
      .stroke({ width: 1.5, color: 0x6b7280 });
    container.addChild(card);
  }
  const countText = new Text({
    text: "0",
    style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", fill: 0xd8d8d8 },
  });
  countText.position.set(DECK_PILE_WIDTH + 8, DECK_PILE_HEIGHT / 2 - countText.height / 2 - 2);
  container.addChild(countText);
  return { container, countText };
}

export class Board extends Container {
  readonly opponentRanged: Lane;
  readonly opponentMelee: Lane;
  readonly playerMelee: Lane;
  readonly playerRanged: Lane;
  private readonly opponentHealthText: Text;
  private readonly playerHealthText: Text;
  private readonly opponentDeckPile: DeckPile;
  private readonly playerDeckPile: DeckPile;
  private readonly opponentHandIndicator: DeckPile;

  constructor(slotsPerLane = 4) {
    super();

    this.opponentRanged = new Lane("opponent", "ranged", slotsPerLane);
    this.opponentMelee = new Lane("opponent", "melee", slotsPerLane);
    this.playerMelee = new Lane("player", "melee", slotsPerLane);
    this.playerRanged = new Lane("player", "ranged", slotsPerLane);

    this.opponentHealthText = new Text({
      text: "Vita: 20",
      style: { fontFamily: "sans-serif", fontSize: 20, fontWeight: "bold", fill: 0xffffff },
    });
    this.playerHealthText = new Text({
      text: "Vita: 20",
      style: { fontFamily: "sans-serif", fontSize: 20, fontWeight: "bold", fill: 0xffffff },
    });

    this.opponentDeckPile = createDeckPile();
    this.playerDeckPile = createDeckPile();
    this.opponentHandIndicator = createDeckPile();

    this.addChild(
      this.opponentRanged,
      this.opponentMelee,
      this.playerMelee,
      this.playerRanged,
      this.opponentHealthText,
      this.playerHealthText,
      this.opponentDeckPile.container,
      this.playerDeckPile.container,
      this.opponentHandIndicator.container,
    );
    this.layoutLanes();
  }

  private layoutLanes(): void {
    const laneWidth = this.opponentRanged.laneWidth();
    const laneHeight = this.opponentRanged.laneHeight();

    const centerX = (lane: Lane) => (laneWidth - lane.laneWidth()) / 2;

    let y = HP_MARGIN;
    this.opponentRanged.position.set(centerX(this.opponentRanged), y);
    y += laneHeight + LANE_GAP;
    this.opponentMelee.position.set(centerX(this.opponentMelee), y);
    y += laneHeight + CENTER_GAP;
    this.playerMelee.position.set(centerX(this.playerMelee), y);
    y += laneHeight + LANE_GAP;
    this.playerRanged.position.set(centerX(this.playerRanged), y);

    this.opponentHealthText.position.set((laneWidth - this.opponentHealthText.width) / 2, 6);
    this.playerHealthText.position.set(
      (laneWidth - this.playerHealthText.width) / 2,
      y + laneHeight + 8,
    );

    this.opponentDeckPile.container.position.set(laneWidth - this.opponentDeckPile.container.width - 4, 6);
    this.playerDeckPile.container.position.set(
      laneWidth - this.playerDeckPile.container.width - 4,
      y + laneHeight + 8,
    );

    this.opponentHandIndicator.container.position.set(4, 6);
  }

  setOpponentHealth(value: number): void {
    this.opponentHealthText.text = `Vita: ${value}`;
    this.opponentHealthText.position.x = (this.boardWidth - this.opponentHealthText.width) / 2;
  }

  setPlayerHealth(value: number): void {
    this.playerHealthText.text = `Vita: ${value}`;
    this.playerHealthText.position.x = (this.boardWidth - this.playerHealthText.width) / 2;
  }

  /** Scossa/"punch" sul testo Vita colpito, per far sentire il colpo diretto. */
  punchHealth(side: "player" | "opponent"): Promise<void> {
    return punchScale(side === "player" ? this.playerHealthText : this.opponentHealthText);
  }

  /** Centro del testo Vita in coordinate globali (stage), per far comparire lì il numero di danno. */
  getHealthGlobalCenter(side: "player" | "opponent"): { x: number; y: number } {
    const text = side === "player" ? this.playerHealthText : this.opponentHealthText;
    const point = text.toGlobal({ x: text.width / 2, y: text.height / 2 });
    return { x: point.x, y: point.y };
  }

  setOpponentDeckCount(value: number): void {
    this.setDeckCount(this.opponentDeckPile, value, "right");
  }

  setPlayerDeckCount(value: number): void {
    this.setDeckCount(this.playerDeckPile, value, "right");
  }

  /** Le pile a destra restano ancorate al proprio bordo destro (il testo cresce verso sinistra); quella
   * della mano rivale, a sinistra, resta ancorata al bordo sinistro (il testo cresce verso destra). */
  private setDeckCount(pile: DeckPile, value: number, anchor: "left" | "right"): void {
    if (anchor === "left") {
      pile.countText.text = String(value);
      return;
    }
    const rightEdge = pile.container.x + pile.container.width;
    pile.countText.text = String(value);
    pile.container.position.x = rightEdge - pile.container.width;
  }

  /** Centro della pila (retro carte) in coordinate globali, punto di partenza dell'animazione di pescata. */
  getOpponentDeckGlobalCenter(): { x: number; y: number } {
    return this.deckPileGlobalCenter(this.opponentDeckPile);
  }

  getPlayerDeckGlobalCenter(): { x: number; y: number } {
    return this.deckPileGlobalCenter(this.playerDeckPile);
  }

  private deckPileGlobalCenter(pile: DeckPile): { x: number; y: number } {
    const point = pile.container.toGlobal({ x: DECK_PILE_WIDTH / 2, y: DECK_PILE_HEIGHT / 2 });
    return { x: point.x, y: point.y };
  }

  /** Piccolo "battito" sulla pila, a mostrare che il rivale ha pescato (non ha una mano visibile da animare). */
  pulseOpponentDeck(): Promise<void> {
    return punchScale(this.opponentDeckPile.container);
  }

  /** Stessa resa grafica della pila di pesca: retro carte + conteggio, ma per la mano del rivale. */
  setOpponentHandCount(value: number): void {
    this.setDeckCount(this.opponentHandIndicator, value, "left");
  }

  get boardWidth(): number {
    return this.opponentRanged.laneWidth();
  }

  get boardHeight(): number {
    const laneHeight = this.opponentRanged.laneHeight();
    return laneHeight * 4 + LANE_GAP * 2 + CENTER_GAP + HP_MARGIN * 2;
  }

  /** Scala e centra il board per adattarlo allo schermo, ottimizzato per portrait. */
  fitToScreen(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(
      screenWidth / this.boardWidth,
      screenHeight / this.boardHeight,
    );
    this.scale.set(scale);
    this.position.set(
      (screenWidth - this.boardWidth * scale) / 2,
      (screenHeight - this.boardHeight * scale) / 2,
    );
  }
}
