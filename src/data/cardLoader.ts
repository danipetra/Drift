import type { CardData, CardType } from "../types/card";
import beastCards from "./cards/beast.json";
import robotCards from "./cards/robot.json";

const CARD_SETS: Record<CardType, CardData[]> = {
  beast: beastCards as CardData[],
  robot: robotCards as CardData[],
};

export function getAllCards(): CardData[] {
  return Object.values(CARD_SETS).flat();
}

export function getCardsByType(type: CardType): CardData[] {
  return CARD_SETS[type];
}

/** Carte sintetiche generate a runtime (sacrificio/fusione in torre): non fanno parte del
 * catalogo statico, vivono e muoiono con la run, non vengono mai sbloccate permanentemente. */
const customCards = new Map<string, CardData>();

export function registerCustomCard(data: CardData): void {
  customCards.set(data.id, data);
}

export function getCardById(id: string): CardData | undefined {
  return customCards.get(id) ?? getAllCards().find((card) => card.id === id);
}
