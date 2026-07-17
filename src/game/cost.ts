import { Modifier, type CardData } from "../types/card";

const MODIFIER_COST: Record<Modifier, number> = {
  [Modifier.Guard]: 1,
  [Modifier.Flying]: 1,
  [Modifier.Deadly]: 2,
  [Modifier.Stealth]: 2,
  [Modifier.FirstStrike]: 1,
};

/** Costo approssimato: media di attacco/difesa (arrotondata per eccesso) + bonus per modificatore. */
export function computeCardCost(data: CardData): number {
  const attack = parseInt(data.attack, 10);
  const defense = parseInt(data.defense, 10);
  const base = Math.ceil((attack + defense) / 2);
  const modifierCost = data.modifiers.reduce((sum, modifier) => sum + MODIFIER_COST[modifier], 0);
  return base + modifierCost;
}
