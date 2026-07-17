import type { CardData, Modifier } from "../types/card";
import { computeCardCost } from "./cost";

let nextInstanceId = 0;

export class CardInstance {
  readonly instanceId: number;
  readonly data: CardData;
  readonly cost: number;
  currentAttack: number;
  currentDefense: number;
  tapped = false;

  constructor(data: CardData) {
    this.instanceId = nextInstanceId++;
    this.data = data;
    this.cost = computeCardCost(data);
    this.currentAttack = parseInt(data.attack, 10);
    this.currentDefense = parseInt(data.defense, 10);
  }

  hasModifier(modifier: Modifier): boolean {
    return this.data.modifiers.includes(modifier);
  }

  get isDead(): boolean {
    return this.currentDefense <= 0;
  }

  get attackText(): string {
    return String(this.currentAttack);
  }

  get defenseText(): string {
    return String(this.currentDefense);
  }
}
