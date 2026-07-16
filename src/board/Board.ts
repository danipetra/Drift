import { Container } from "pixi.js";
import { Lane } from "./Lane";

const LANE_GAP = 20;
const CENTER_GAP = 60;

export class Board extends Container {
  readonly opponentRanged: Lane;
  readonly opponentMelee: Lane;
  readonly playerMelee: Lane;
  readonly playerRanged: Lane;

  constructor(slotsPerLane = 4) {
    super();

    this.opponentRanged = new Lane("opponent", "ranged", slotsPerLane);
    this.opponentMelee = new Lane("opponent", "melee", slotsPerLane);
    this.playerMelee = new Lane("player", "melee", slotsPerLane);
    this.playerRanged = new Lane("player", "ranged", slotsPerLane);

    this.addChild(this.opponentRanged, this.opponentMelee, this.playerMelee, this.playerRanged);
    this.layoutLanes();
  }

  private layoutLanes(): void {
    const laneWidth = this.opponentRanged.laneWidth();
    const laneHeight = this.opponentRanged.laneHeight();

    const centerX = (lane: Lane) => (laneWidth - lane.laneWidth()) / 2;

    let y = 0;
    this.opponentRanged.position.set(centerX(this.opponentRanged), y);
    y += laneHeight + LANE_GAP;
    this.opponentMelee.position.set(centerX(this.opponentMelee), y);
    y += laneHeight + CENTER_GAP;
    this.playerMelee.position.set(centerX(this.playerMelee), y);
    y += laneHeight + LANE_GAP;
    this.playerRanged.position.set(centerX(this.playerRanged), y);
  }

  get boardWidth(): number {
    return this.opponentRanged.laneWidth();
  }

  get boardHeight(): number {
    const laneHeight = this.opponentRanged.laneHeight();
    return laneHeight * 4 + LANE_GAP * 2 + CENTER_GAP;
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
