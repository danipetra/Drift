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

export function getCardById(id: string): CardData | undefined {
  return getAllCards().find((card) => card.id === id);
}
