import { Container, Graphics } from "pixi.js";
import type { CardInstance } from "../game/CardInstance";
import { CARD_HEIGHT, CARD_WIDTH, CardView } from "./CardView";

export const CARD_PREVIEW_SCALE = 1.8;

/**
 * Carta ingrandita su uno sfondo scuro, usata per l'anteprima a pressione prolungata sia in
 * partita (`BoardInteractionController`) sia nel Deck Builder. Le dimensioni del contenitore
 * risultante includono già il margine dello sfondo, utile per centrarlo/posizionarlo con
 * `wrapper.width`/`wrapper.height` senza ricalcolare la scala a mano.
 */
export function createCardPreview(card: CardInstance, scale = CARD_PREVIEW_SCALE): Container {
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

  return wrapper;
}
