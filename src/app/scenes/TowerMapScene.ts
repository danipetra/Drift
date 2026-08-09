import { Container, Graphics, Text } from "pixi.js";
import { TowerRun } from "../../game/TowerRun";
import type { TowerNode, TowerNodeType } from "../../game/towerMap";
import { BaseScene } from "./BaseScene";
import { TowerFusionScene } from "./TowerFusionScene";
import { TowerRewardScene } from "./TowerRewardScene";
import { TowerSacrificeScene } from "./TowerSacrificeScene";
import { createTowerFightScene } from "./towerFlow";

const NODE_TYPE_LABELS: Record<TowerNodeType, string> = {
  fight: "Scontro",
  empowered: "Scontro forte",
  boss: "Boss",
  add_card: "Nuova carta",
  sacrifice: "Sacrificio",
  fusion: "Fusione",
};

const COLUMNS = 5; // 4 layer di contenuto + il boss
const ROWS = 3;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 64;
const COLUMN_GAP = 46;
const ROW_GAP = 30;
const HEADER_HEIGHT = 70;

type NodeStatus = "reachable" | "visited" | "locked";

const STATUS_COLORS: Record<NodeStatus, { fill: number; stroke: number; label: number }> = {
  reachable: { fill: 0x1c232b, stroke: 0x4fc3f7, label: 0xffffff },
  visited: { fill: 0x16241a, stroke: 0x2e7d32, label: 0x9ccc9c },
  locked: { fill: 0x171b1f, stroke: 0x3a3f45, label: 0x6b7280 },
};

/** Mappa a nodi della Scalata della Torre: si sceglie il prossimo nodo da affrontare tra quelli raggiungibili dalla posizione attuale. */
export class TowerMapScene extends BaseScene {
  private readonly run: TowerRun;
  private readonly headerText: Text;
  private readonly edgesGraphics = new Graphics();
  private readonly nodeViews = new Map<string, Container>();

  constructor(run: TowerRun) {
    super();
    this.run = run;
    this.headerText = new Text({
      text: `Punteggio: ${run.score} — Piani superati: ${run.floorsCleared}`,
      style: { fontFamily: "sans-serif", fontSize: 18, fontWeight: "bold", fill: 0xffffff, align: "center" },
    });
    this.container.addChild(this.edgesGraphics, this.headerText);
  }

  protected async onMount(): Promise<void> {
    await this.setBackground("board");
    this.buildNodes();
  }

  private get reachableIds(): Set<string> {
    if (this.run.currentNodeId === null) return new Set(this.run.map.layers[0]);
    return new Set(this.run.map.nodes[this.run.currentNodeId].next);
  }

  private statusOf(nodeId: string): NodeStatus {
    if (this.run.visitedNodeIds.has(nodeId)) return "visited";
    if (this.reachableIds.has(nodeId)) return "reachable";
    return "locked";
  }

  private buildNodes(): void {
    for (const node of Object.values(this.run.map.nodes)) {
      const view = this.createNodeView(node);
      this.nodeViews.set(node.id, view);
      this.container.addChild(view);
    }
  }

  private createNodeView(node: TowerNode): Container {
    const palette = STATUS_COLORS[this.statusOf(node.id)];

    const view = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, NODE_WIDTH, NODE_HEIGHT, 10)
      .fill({ color: palette.fill })
      .stroke({ width: 2, color: palette.stroke });
    view.addChild(bg);

    const label = new Text({
      text: NODE_TYPE_LABELS[node.type],
      style: {
        fontFamily: "sans-serif",
        fontSize: 13,
        fontWeight: "bold",
        fill: palette.label,
        align: "center",
        wordWrap: true,
        wordWrapWidth: NODE_WIDTH - 16,
      },
    });
    label.position.set((NODE_WIDTH - label.width) / 2, (NODE_HEIGHT - label.height) / 2);
    view.addChild(label);

    if (this.statusOf(node.id) === "reachable") {
      view.eventMode = "static";
      view.cursor = "pointer";
      view.on("pointertap", () => this.handleNodeTap(node));
    }

    return view;
  }

  private handleNodeTap(node: TowerNode): void {
    switch (node.type) {
      case "fight":
      case "empowered":
      case "boss":
        this.context.goTo(() => createTowerFightScene(this.run, node));
        break;
      case "add_card":
        this.context.goTo(() => new TowerRewardScene(this.run, node));
        break;
      case "sacrifice":
        this.context.goTo(() => new TowerSacrificeScene(this.run, node));
        break;
      case "fusion":
        this.context.goTo(() => new TowerFusionScene(this.run, node));
        break;
    }
  }

  protected layout(): void {
    const { width, height } = this.context.app.screen;
    this.headerText.position.set((width - this.headerText.width) / 2, 20);

    const rawWidth = COLUMNS * NODE_WIDTH + (COLUMNS - 1) * COLUMN_GAP;
    const rawHeight = ROWS * NODE_HEIGHT + (ROWS - 1) * ROW_GAP;
    const availableHeight = height - HEADER_HEIGHT - 20;
    const scale = Math.min(1, (width - 32) / rawWidth, availableHeight / rawHeight);

    const startX = (width - rawWidth * scale) / 2;
    const startY = HEADER_HEIGHT + (availableHeight - rawHeight * scale) / 2;

    const positionOf = (layer: number, lane: number) => ({
      x: startX + layer * (NODE_WIDTH + COLUMN_GAP) * scale,
      y: startY + lane * (NODE_HEIGHT + ROW_GAP) * scale,
    });

    for (const node of Object.values(this.run.map.nodes)) {
      const view = this.nodeViews.get(node.id);
      if (!view) continue;
      const { x, y } = positionOf(node.layer, node.lane);
      view.scale.set(scale);
      view.position.set(x, y);
    }

    this.edgesGraphics.clear();
    for (const node of Object.values(this.run.map.nodes)) {
      const from = positionOf(node.layer, node.lane);
      for (const nextId of node.next) {
        const nextNode = this.run.map.nodes[nextId];
        const to = positionOf(nextNode.layer, nextNode.lane);
        this.edgesGraphics
          .moveTo(from.x + (NODE_WIDTH * scale) / 2, from.y + (NODE_HEIGHT * scale) / 2)
          .lineTo(to.x + (NODE_WIDTH * scale) / 2, to.y + (NODE_HEIGHT * scale) / 2)
          .stroke({ width: 2, color: 0x3a3f45 });
      }
    }
  }
}
