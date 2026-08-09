import { generateBossEnemyDeck, generateEmpoweredEnemyDeck, generateRandomEnemyDeck } from "../../data/enemyDecks";
import { TowerRun } from "../../game/TowerRun";
import { resolveNode, type TowerNode } from "../../game/towerMap";
import { computeFloorScore } from "../../game/towerScoring";
import type { Scene } from "../SceneManager";
import { MatchScene } from "./MatchScene";
import { TowerGameOverScene } from "./TowerGameOverScene";
import { TowerMapScene } from "./TowerMapScene";

/**
 * Uno scontro della Scalata della Torre: una `MatchScene` contro un avversario generato al volo
 * (mazzo/difficoltà in base al tipo di nodo), il cui esito viene smistato verso la mappa
 * (vittoria: nodo risolto, si torna a scegliere il prossimo) o il game over (sconfitta/pareggio).
 */
export function createTowerFightScene(run: TowerRun, node: TowerNode): Scene {
  const enemyDeckIds =
    node.type === "boss"
      ? generateBossEnemyDeck()
      : node.type === "empowered"
        ? generateEmpoweredEnemyDeck()
        : generateRandomEnemyDeck();
  const scoreMultiplier = node.type === "boss" ? 2 : node.type === "empowered" ? 1.5 : 1;

  return new MatchScene({
    playerDeckIds: run.deckIds,
    enemyDeckIds,
    onMatchEnd: (result, context) => {
      if (result.won) {
        run.score += Math.round(
          computeFloorScore(result.turnsTaken, result.playerHealth, result.opponentHealth) * scoreMultiplier,
        );
        run.floorsCleared += 1;
        resolveNode(run, node);
        context.goTo(() => new TowerMapScene(run));
      } else {
        context.goTo(() => new TowerGameOverScene(run));
      }
    },
  });
}

/** Punto d'ingresso da usare dal menu principale (o da una nuova run dopo un game over): sempre una nuova run, sulla mappa. */
export function startNewTowerRun(): Scene {
  return new TowerMapScene(new TowerRun());
}
