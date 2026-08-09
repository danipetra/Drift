import dotGothic16Url from "../assets/fonts/DotGothic16-Regular.ttf";
import jacquard12Url from "../assets/fonts/Jacquard12-Regular.ttf";
import jacquard24Url from "../assets/fonts/Jacquard24-Regular.ttf";

/** Titoli, voci di menu, nomi carta e scelte principali (nodi torre, pulsanti dei pannelli modali). */
export const FONT_DISPLAY = "Jacquard12";
/** Stessa famiglia di FONT_DISPLAY, tagliata per corpi grandi: solo per il titolo "DRIFT" in home. */
export const FONT_DISPLAY_LARGE = "Jacquard24";
/**
 * Tutto il resto: statistiche, descrizioni, HUD, log. Non Pixelify Sans (primo tentativo): le sue
 * cifre stilizzate rendono "2" indistinguibile da "8" e "5" da "S" già a 15px — inaccettabile in un
 * gioco dove i numeri sulle carte contano. DotGothic16 (dot-matrix) mantiene cifre e lettere chiare.
 */
export const FONT_BODY = "DotGothic16";

/**
 * Pixi.js disegna il testo su canvas: se il font non è ancora pronto quando viene creato un `Text`,
 * il canvas viene rasterizzato subito con un fallback e non si ridisegna da solo quando il font
 * arriva — va quindi atteso qui, prima di montare qualunque scena (stesso principio di
 * `preloadCardTextures`). `document.fonts.add` rende il font disponibile anche al CSS del DOM
 * (HUD), quindi non serve una dichiarazione `@font-face` separata in `style.css`.
 */
export async function preloadFonts(): Promise<void> {
  const faces = [
    new FontFace(FONT_DISPLAY, `url(${jacquard12Url})`),
    new FontFace(FONT_DISPLAY_LARGE, `url(${jacquard24Url})`),
    new FontFace(FONT_BODY, `url(${dotGothic16Url})`),
  ];
  const loaded = await Promise.all(faces.map((face) => face.load()));
  for (const face of loaded) document.fonts.add(face);
}
