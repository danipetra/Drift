import { Container, Text } from "pixi.js";
import { punchScale } from "../render/animations";
import { Lane } from "./Lane";

const LANE_GAP = 20;
const CENTER_GAP = 60;
const HP_MARGIN = 40;

export class Board extends Container {
  readonly opponentRanged: Lane;
  readonly opponentMelee: Lane;
  readonly playerMelee: Lane;
  readonly playerRanged: Lane;
  private readonly opponentHealthText: Text;
  private readonly playerHealthText: Text;

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

    this.addChild(
      this.opponentRanged,
      this.opponentMelee,
      this.playerMelee,
      this.playerRanged,
      this.opponentHealthText,
      this.playerHealthText,
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
