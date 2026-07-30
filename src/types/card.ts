export type CardType = "beast" | "robot";

export const Modifier = {
  Flying: "FLYING",
  Deadly: "DEADLY",
  Guard: "GUARD",
  Stealth: "STEALTH",
  FirstStrike: "FIRST_STRIKE",
  Regeneration: "REGENERATION",
  Resilience: "RESILIENCE",
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
};

export interface CardData {
  id: string;
  name: string;
  type: CardType;
  attack: string;
  defense: string;
  modifiers: Modifier[];
}
