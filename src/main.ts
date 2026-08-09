import "./style.css";
import { SceneManager } from "./app/SceneManager";
import { MainMenuScene } from "./app/scenes/MainMenuScene";
import { preloadCardTextures } from "./render/cardAssets";

const appContainer = document.querySelector<HTMLDivElement>("#app")!;
const hudRoot = document.querySelector<HTMLDivElement>("#hud-root")!;
const manager = new SceneManager(hudRoot);

// Precaricate una volta qui, non per-scena: `Texture.from` non avvia da solo il caricamento di un
// URL non ancora registrato (vedi `cardAssets.ts`), e più scene creano `CardView` senza mai
// precaricare (DeckBuilder, ricompense torre...). Farlo qui garantisce che ogni `CardView`, ovunque
// nell'app, trovi già pronte le texture di arte/cornici.
void preloadCardTextures().then(() => manager.init(appContainer, () => new MainMenuScene()));
