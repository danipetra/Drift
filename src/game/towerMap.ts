import type { TowerRun } from "./TowerRun";

export type TowerNodeType = "fight" | "empowered" | "boss" | "add_card" | "sacrifice" | "fusion";

export interface TowerNode {
  id: string;
  type: TowerNodeType;
  layer: number;
  lane: number;
  /** Id dei nodi raggiungibili da qui, nel layer successivo. */
  next: string[];
}

export interface TowerMap {
  /** Id dei nodi raggruppati per layer; l'ultimo layer è sempre `[bossNodeId]`. */
  layers: string[][];
  nodes: Record<string, TowerNode>;
  bossNodeId: string;
}

const LAYER_COUNT = 4;
const LANE_COUNT = 3;

const NODE_TYPE_WEIGHTS: { type: TowerNodeType; weight: number }[] = [
  { type: "fight", weight: 40 },
  { type: "empowered", weight: 15 },
  { type: "add_card", weight: 20 },
  { type: "sacrifice", weight: 12 },
  { type: "fusion", weight: 13 },
];

function pickNodeType(): TowerNodeType {
  const total = NODE_TYPE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of NODE_TYPE_WEIGHTS) {
    if (roll < entry.weight) return entry.type;
    roll -= entry.weight;
  }
  return "fight";
}

/**
 * Mappa a griglia fissa (layer × corsia), sempre connessa per costruzione: ogni nodo si
 * collega sempre al nodo nella stessa corsia del layer successivo, e con probabilità 50%
 * anche a una corsia adiacente — niente nodi orfani da "riparare" dopo il fatto. L'ultimo
 * layer di contenuto confluisce tutto in un unico nodo boss finale.
 */
export function generateTowerMap(): TowerMap {
  const nodes: Record<string, TowerNode> = {};
  const layers: string[][] = [];

  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    const laneIds: string[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const id = `L${layer}-${lane}`;
      nodes[id] = { id, type: pickNodeType(), layer, lane, next: [] };
      laneIds.push(id);
    }
    layers.push(laneIds);
  }

  const bossNodeId = "boss";
  nodes[bossNodeId] = {
    id: bossNodeId,
    type: "boss",
    layer: LAYER_COUNT,
    lane: Math.floor(LANE_COUNT / 2),
    next: [],
  };
  layers.push([bossNodeId]);

  for (let layer = 0; layer < LAYER_COUNT - 1; layer++) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const node = nodes[`L${layer}-${lane}`];
      node.next.push(`L${layer + 1}-${lane}`);
      if (Math.random() < 0.5) {
        const adjacentLane = lane + (Math.random() < 0.5 ? -1 : 1);
        if (adjacentLane >= 0 && adjacentLane < LANE_COUNT) {
          node.next.push(`L${layer + 1}-${adjacentLane}`);
        }
      }
    }
  }
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    nodes[`L${LAYER_COUNT - 1}-${lane}`].next.push(bossNodeId);
  }

  return { layers, nodes, bossNodeId };
}

/**
 * Chiamata da ogni scena che risolve un nodo: lo segna visitato e avanza la posizione. Sconfitto
 * il boss, la run continua su una mappa del tutto nuova invece di fermarsi (stessa scalata
 * "senza fine finché non perdi" di prima, solo suddivisa in mappe).
 */
export function resolveNode(run: TowerRun, node: TowerNode): void {
  run.visitedNodeIds.add(node.id);
  if (node.id === run.map.bossNodeId) {
    run.map = generateTowerMap();
    run.currentNodeId = null;
    run.visitedNodeIds = new Set();
  } else {
    run.currentNodeId = node.id;
  }
}
