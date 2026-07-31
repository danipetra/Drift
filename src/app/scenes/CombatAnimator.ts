import type { Container } from "pixi.js";
import type { Board } from "../../board/Board";
import type { Lane } from "../../board/Lane";
import type { CombatEvent } from "../../game/combat";
import type { RowKey } from "../../game/BoardState";
import { fadeOut, lungeToward, popDamageNumber, rangedRecoil, shake, travelStreak } from "../../render/animations";

/** Rigioca una sequenza di `CombatEvent` con animazione, un evento alla volta. */
export class CombatAnimator {
  constructor(
    private readonly lanes: Record<RowKey, Lane>,
    private readonly board: Board,
    private readonly overlayContainer: Container,
    private readonly onEvent: (message: string) => void,
  ) {}

  async playReplay(events: CombatEvent[]): Promise<void> {
    for (const event of events) {
      await this.playEvent(event);
      this.onEvent(event.message);
    }
  }

  private async playEvent(event: CombatEvent): Promise<void> {
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
}
