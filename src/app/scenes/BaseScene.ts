import { Container, Sprite, Texture } from "pixi.js";
import { preloadSceneBackground } from "../../render/sceneBackgrounds";
import type { Scene, SceneContext } from "../SceneManager";

/**
 * Fattorizza il boilerplate ripetuto in ogni scena: montare/smontare il container principale
 * sullo stage, registrare/deregistrare il resize del renderer, e ripulire l'hudRoot condiviso
 * (per contratto del `SceneManager`, ogni scena deve ripulire quello che ha aggiunto). Le
 * sottoclassi implementano solo `onMount`/`layout` (e opzionalmente `onUnmount` per pulizia extra).
 */
export abstract class BaseScene implements Scene {
  protected context!: SceneContext;
  protected readonly container = new Container();
  private backgroundSprite: Sprite | null = null;

  async mount(context: SceneContext): Promise<void> {
    this.context = context;
    context.app.stage.addChild(this.container);
    await this.onMount();
    context.app.renderer.on("resize", this.handleResize);
    this.layout();
  }

  unmount(): void {
    this.context.app.renderer.off("resize", this.handleResize);
    // Prima della distruzione: `onUnmount()` (es. `gsap.killTweensOf` in `MatchScene`) deve poter
    // ancora leggere riferimenti validi ai figli del container, altrimenti troverebbe un albero
    // già svuotato e non ucciderebbe nulla.
    this.onUnmount();
    this.context.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
    this.context.hudRoot.innerHTML = "";
  }

  private readonly handleResize = (): void => {
    this.fitBackground();
    this.layout();
  };

  /** Costruisce i contenuti della scena (container Pixi, HUD in `context.hudRoot`, listener). */
  protected onMount(): void | Promise<void> {}

  /** Pulizia extra oltre a quella già gestita dalla base (es. fermare animazioni in corso). */
  protected onUnmount(): void {}

  /** Riposiziona/ridimensiona i contenuti per lo schermo corrente; chiamata al mount e a ogni resize. */
  protected abstract layout(): void;

  /**
   * Sfondo dedicato della scena, se `src/assets/ui/backgrounds/<key>.png` esiste — ogni scena ha
   * la sua chiave, così ognuna può avere un'immagine diversa (o nessuna). Va chiamato da `onMount`;
   * resta sotto a tutto il resto perché è il primo figlio del container, e si adatta da solo allo
   * schermo (modalità "cover": riempie senza deformarsi, ritagliando l'eccesso) a ogni resize.
   */
  protected async setBackground(key: string): Promise<void> {
    const path = await preloadSceneBackground(key);
    if (!path) return;
    this.backgroundSprite?.destroy();
    this.backgroundSprite = new Sprite(Texture.from(path));
    this.container.addChildAt(this.backgroundSprite, 0);
    this.fitBackground();
  }

  private fitBackground(): void {
    if (!this.backgroundSprite) return;
    const { width, height } = this.context.app.screen;
    const texture = this.backgroundSprite.texture;
    const scale = Math.max(width / texture.width, height / texture.height);
    this.backgroundSprite.width = texture.width * scale;
    this.backgroundSprite.height = texture.height * scale;
    this.backgroundSprite.position.set(
      (width - this.backgroundSprite.width) / 2,
      (height - this.backgroundSprite.height) / 2,
    );
  }
}
