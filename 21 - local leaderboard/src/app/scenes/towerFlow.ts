import { generateRandomEnemyDeck } from "../../data/enemyDecks";
import { TowerRun } from "../../game/TowerRun";
import { computeFloorScore } from "../../game/towerScoring";
import type { Scene } from "../SceneManager";
import { MatchScene } from "./MatchScene";
import { TowerGameOverScene } from "./TowerGameOverScene";
import { TowerRewardScene } from "./TowerRewardScene";

/**
 * Un piano della Scalata della Torre: una `MatchScene` contro un avversario generato al volo,
 * il cui esito viene smistato verso la ricompensa (vittoria) o il game over con punteggio
 * (sconfitta/pareggio) invece del pannello predefinito di `MatchScene`.
 */
export function createTowerFloorScene(run: TowerRun): Scene {
  const enemyDeckIds = generateRandomEnemyDeck();
  return new MatchScene({
    playerDeckIds: run.deckIds,
    enemyDeckIds,
    onMatchEnd: (result, context) => {
      if (result.won) {
        run.score += computeFloorScore(result.turnsTaken, result.playerHealth, result.opponentHealth);
        run.floorsCleared += 1;
        context.goTo(() => new TowerRewardScene(run, enemyDeckIds));
      } else {
        context.goTo(() => new TowerGameOverScene(run));
      }
    },
  });
}

/** Punto d'ingresso da usare dal menu principale: sempre una nuova run, dal mazzo di partenza standard. */
export function startNewTowerRun(): Scene {
  return createTowerFloorScene(new TowerRun());
}
