import { Container } from "pixi.js";
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

  private readonly handleResize = (): void => this.layout();

  /** Costruisce i contenuti della scena (container Pixi, HUD in `context.hudRoot`, listener). */
  protected onMount(): void | Promise<void> {}

  /** Pulizia extra oltre a quella già gestita dalla base (es. fermare animazioni in corso). */
  protected onUnmount(): void {}

  /** Riposiziona/ridimensiona i contenuti per lo schermo corrente; chiamata al mount e a ogni resize. */
  protected abstract layout(): void;
}
