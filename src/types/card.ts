export type CardType = "beast" | "robot";

export const Modifier = {
  Flying: "FLYING",
  Deadly: "DEADLY",
  Guard: "GUARD",
  Stealth: "STEALTH",
  FirstStrike: "FIRST_STRIKE",
} as const;

export type Modifier = (typeof Modifier)[keyof typeof Modifier];

export const MODIFIER_LABELS: Record<Modifier, string> = {
  [Modifier.Flying]: "Volare",
  [Modifier.Deadly]: "Tocco letale",
  [Modifier.Guard]: "Guardia",
  [Modifier.Stealth]: "Furtivo",
  [Modifier.FirstStrike]: "Attacco rapido",
};

export interface CardData {
  id: string;
  name: string;
  type: CardType;
  attack: string;
  defense: string;
  modifiers: Modifier[];
}
