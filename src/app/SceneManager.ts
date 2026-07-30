import { Application } from "pixi.js";

export interface SceneContext {
  app: Application;
  /** Div vuoto che una scena può riempire con i propri controlli HUD (DOM). */
  hudRoot: HTMLElement;
  /** Richiede il passaggio a un'altra scena. */
  goTo(factory: () => Scene): void;
}

export interface Scene {
  mount(context: SceneContext): void | Promise<void>;
  unmount(): void;
}

/**
 * Possiede l'unica `Application` Pixi e il montaggio/smontaggio delle scene.
 * Il contratto è semplice: quello che una scena aggiunge in `mount` (container
 * Pixi sullo stage, nodi DOM in `hudRoot`, listener di resize) deve rimuoverlo
 * in `unmount`. Il manager non tocca `hudRoot` direttamente: si fida che ogni
 * scena ripulisca da sola, così le scene restano indipendenti l'una dall'altra.
 */
export class SceneManager {
  readonly app = new Application();
  private current: Scene | null = null;
  private readonly context: SceneContext;

  constructor(hudRoot: HTMLElement) {
    this.context = {
      app: this.app,
      hudRoot,
      goTo: (factory) => {
        void this.switchTo(factory);
      },
    };
  }

  async init(appContainer: HTMLElement, first: () => Scene): Promise<void> {
    await this.app.init({
      background: "#101418",
      antialias: true,
    });
    appContainer.appendChild(this.app.canvas);

    this.app.renderer.resize(appContainer.clientWidth, appContainer.clientHeight);
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.app.renderer.resize(width, height);
    }).observe(appContainer);

    await this.switchTo(first);
  }

  private async switchTo(factory: () => Scene): Promise<void> {
    this.current?.unmount();
    const next = factory();
    this.current = next;
    await next.mount(this.context);
  }
}
