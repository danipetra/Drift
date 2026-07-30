export type CardType = "beast" | "robot";

export const Modifier = {
  Flying: "FLYING",
  Deadly: "DEADLY",
  Guard: "GUARD",
  Stealth: "STEALTH",
  FirstStrike: "FIRST_STRIKE",
  Regeneration: "REGENERATION",
  Resilience: "RESILIENCE",
  Spawn: "SPAWN",
  DoubleAttack: "DOUBLE_ATTACK",
  TripleAttack: "TRIPLE_ATTACK",
} as const;

export type Modifier = (typeof Modifier)[keyof typeof Modifier];

export const MODIFIER_LABELS: Record<Modifier, string> = {
  [Modifier.Flying]: "Volare",
  [Modifier.Deadly]: "Tocco letale",
  [Modifier.Guard]: "Guardia",
  [Modifier.Stealth]: "Furtivo",
  [Modifier.FirstStrike]: "Attacco rapido",
  [Modifier.Regeneration]: "Rigenerazione",
  [Modifier.Resilience]: "Resilienza",
  [Modifier.Spawn]: "Genera",
  [Modifier.DoubleAttack]: "Attacco doppio",
  [Modifier.TripleAttack]: "Attacco triplo",
};

export interface CardData {
  id: string;
  name: string;
  type: CardType;
  attack: string;
  defense: string;
  /** Costo in mana, scritto a mano per carta (non più derivato da statistiche/modificatori): così il bilanciamento resta sotto controllo diretto. */
  cost: string;
  modifiers: Modifier[];
  /** Richiesto dal modificatore Genera: l'id della carta che questa copia in mazzo a ogni turno del proprietario. */
  spawnCardId?: string;
}
