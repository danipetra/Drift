import { Assets } from "pixi.js";

// Stesso approccio data-driven di `cardAssets.ts`: basta aggiungere un file con il nome giusto
// (uno per scena, es. `match.png`) in questa cartella, senza toccare il codice.
const backgroundModules = import.meta.glob<{ default: string }>("../assets/ui/backgrounds/*.png", { eager: true });

function lookup(key: string): string | undefined {
  return backgroundModules[`../assets/ui/backgrounds/${key}.png`]?.default;
}

/** Sfondo di una scena (per chiave, es. "match"). Nessuno sfondo dedicato: la scena resta sul colore di base dell'app. */
export function getSceneBackground(key: string): string | undefined {
  return lookup(key);
}

/** Come `preloadCardTextures`: `Texture.from` non carica da solo un URL non ancora registrato. */
export async function preloadSceneBackground(key: string): Promise<string | undefined> {
  const path = lookup(key);
  if (path) await Assets.load(path);
  return path;
}
