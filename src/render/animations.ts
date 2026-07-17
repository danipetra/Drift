import gsap from "gsap";
import { Container, Graphics, Text } from "pixi.js";

/** GSAP è thenable ma il tipo del suo `.then` non collabora bene con `Promise<void>`: si avvolge a mano. */
function awaitTimeline(tl: gsap.core.Timeline): Promise<void> {
  return new Promise((resolve) => {
    tl.eventCallback("onComplete", () => resolve());
  });
}

/** Piccolo scatto in avanti verso il bersaglio e ritorno: per un attacco melee (corpo a corpo). */
export function lungeToward(view: Container, dx: number, dy: number): Promise<void> {
  const originalX = view.x;
  const originalY = view.y;
  const tl = gsap.timeline();
  tl.to(view, { x: originalX + dx, y: originalY + dy, duration: 0.12, ease: "power2.out" }).to(view, {
    x: originalX,
    y: originalY,
    duration: 0.18,
    ease: "power2.in",
  });
  return awaitTimeline(tl);
}

/** Rinculo sul posto: per un attacco ranged (a distanza), da abbinare a `travelStreak`. */
export function rangedRecoil(view: Container, dx: number): Promise<void> {
  const originalX = view.x;
  const tl = gsap.timeline();
  tl.to(view, { x: originalX - dx, duration: 0.06, ease: "power2.out" }).to(view, {
    x: originalX,
    duration: 0.22,
    ease: "elastic.out(1, 0.5)",
  });
  return awaitTimeline(tl);
}

/** Traccia luminosa che viaggia dall'attaccante al bersaglio (o al volto): il "colpo" ranged. */
export function travelStreak(
  layer: Container,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: number,
): Promise<void> {
  const dot = new Graphics().circle(0, 0, 6).fill({ color, alpha: 0.9 });
  dot.position.set(from.x, from.y);
  layer.addChild(dot);

  const tl = gsap.timeline({
    onComplete: () => {
      layer.removeChild(dot);
      dot.destroy();
    },
  });
  tl.to(dot, { x: to.x, y: to.y, duration: 0.16, ease: "power1.in" }).to(dot, { alpha: 0, duration: 0.12 });
  return awaitTimeline(tl);
}

/** Scossa laterale: subire danno. */
export function shake(view: Container): Promise<void> {
  const originalX = view.x;
  const tl = gsap.timeline();
  tl.to(view, { x: originalX - 7, duration: 0.05 })
    .to(view, { x: originalX + 7, duration: 0.06 })
    .to(view, { x: originalX - 5, duration: 0.06 })
    .to(view, { x: originalX + 4, duration: 0.06 })
    .to(view, { x: originalX, duration: 0.05 });
  return awaitTimeline(tl);
}

/** Dissolvenza + rimpicciolimento: distruzione della carta. */
export function fadeOut(view: Container): Promise<void> {
  const tl = gsap.timeline();
  tl.to(view, { alpha: 0, duration: 0.35, ease: "power1.in" }).to(
    view.scale,
    { x: view.scale.x * 0.7, y: view.scale.y * 0.7, duration: 0.35, ease: "power1.in" },
    "<",
  );
  return awaitTimeline(tl);
}

/** "Punch" di scala: per segnalare un colpo su un testo (es. la Vita) senza doverne interpolare il colore. */
export function punchScale(view: Container): Promise<void> {
  const originalScale = view.scale.x;
  const tl = gsap.timeline();
  tl.to(view.scale, { x: originalScale * 1.35, y: originalScale * 1.35, duration: 0.1, ease: "power2.out" }).to(
    view.scale,
    { x: originalScale, y: originalScale, duration: 0.3, ease: "elastic.out(1, 0.4)" },
  );
  return awaitTimeline(tl);
}

/** Numero di danno che sale e svanisce, posizionato in coordinate globali (stage). */
export function popDamageNumber(
  layer: Container,
  x: number,
  y: number,
  amount: number,
  color = 0xff5252,
): Promise<void> {
  const text = new Text({
    text: `-${amount}`,
    style: {
      fontFamily: "sans-serif",
      fontSize: 26,
      fontWeight: "bold",
      fill: color,
      stroke: { color: 0x000000, width: 4 },
    },
  });
  text.anchor.set(0.5);
  text.position.set(x, y);
  layer.addChild(text);

  const tl = gsap.timeline({
    onComplete: () => {
      layer.removeChild(text);
      text.destroy();
    },
  });
  tl.to(text, { y: y - 44, duration: 0.6, ease: "power1.out" }).to(text, { alpha: 0, duration: 0.25 }, "-=0.25");
  return awaitTimeline(tl);
}

/**
 * Volo di una carta da una posizione/scala di partenza a una di arrivo, con una rotazione
 * completa a metà strada: il "gesto" di dare/schierare una carta sul tavolo.
 */
export function dealCardFlight(
  view: Container,
  from: { x: number; y: number; scale: number },
  to: { x: number; y: number; scale: number },
): Promise<void> {
  view.position.set(from.x, from.y);
  view.scale.set(from.scale);
  const tl = gsap.timeline();
  tl.to(view, { x: to.x, y: to.y, duration: 0.35, ease: "power2.inOut" })
    .to(view.scale, { x: to.scale, y: to.scale, duration: 0.35, ease: "power2.inOut" }, "<")
    .to(view, { rotation: Math.PI * 2, duration: 0.35, ease: "power1.inOut" }, "<");
  return awaitTimeline(tl);
}
