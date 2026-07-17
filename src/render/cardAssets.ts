import { Assets } from "pixi.js";
import type { CardType } from "../types/card";

// `import.meta.glob` con `eager: true` risolve i path a build-time: basta
// aggiungere un file con il nome giusto nella cartella giusta e viene raccolto
// automaticamente, senza toccare il codice — stesso spirito data-driven dei
// file JSON in `src/data/cards`.
const backModules = import.meta.glob<{ default: string }>("../assets/cards/backs/*.png", { eager: true });
const frameModules = import.meta.glob<{ default: string }>("../assets/cards/frames/*.png", { eager: true });
const artModules = import.meta.glob<{ default: string }>("../assets/cards/art/*.png", { eager: true });

function lookup(modules: Record<string, { default: string }>, dir: string, key: string): string | undefined {
  return modules[`../assets/cards/${dir}/${key}.png`]?.default;
}

/** Retro della carta (per tipo). Non ancora usato a schermo: nessuna vista mostra carte coperte oggi. */
export function getCardBack(type: CardType): string | undefined {
  return lookup(backModules, "backs", type);
}

/** Cornice/sfondo della carta (per tipo). */
export function getCardFrame(type: CardType): string | undefined {
  return lookup(frameModules, "frames", type);
}

/** Illustrazione centrale (per singola carta, chiave = id completo, es. "beast_wolf"). */
export function getCardArt(cardId: string): string | undefined {
  return lookup(artModules, "art", cardId);
}

/**
 * `Texture.from(url)` non avvia da solo il caricamento di un URL non registrato:
 * va precaricato una volta con `Assets.load` prima di creare qualunque `CardView`.
 */
export async function preloadCardTextures(): Promise<void> {
  const allPaths = [
    ...Object.values(backModules).map((m) => m.default),
    ...Object.values(frameModules).map((m) => m.default),
    ...Object.values(artModules).map((m) => m.default),
  ];
  if (allPaths.length > 0) await Assets.load(allPaths);
}
