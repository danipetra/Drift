import type { CardType } from "../types/card";

export interface FrameStyle {
  fill: number;
  stroke: number;
  label: string;
}

export const FRAME_STYLES: Record<CardType, FrameStyle> = {
  beast: { fill: 0x2f4a2f, stroke: 0x8fbc8f, label: "Bestia" },
  robot: { fill: 0x2f3a4a, stroke: 0x8fa8bc, label: "Robot" },
};
