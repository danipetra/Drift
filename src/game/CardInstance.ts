import type { CardData, Modifier } from "../types/card";

let nextInstanceId = 0;

export class CardInstance {
  readonly instanceId: number;
  readonly data: CardData;
  readonly cost: number;
  /** Difesa di base, per sapere se la carta è danneggiata: il danno subito è permanente, non si resetta mai da solo. */
  readonly maxDefense: number;
  currentAttack: number;
  currentDefense: number;
  tapped = false;

  constructor(data: CardData) {
    this.instanceId = nextInstanceId++;
    this.data = data;
    this.cost = parseInt(data.cost, 10);
    this.currentAttack = parseInt(data.attack, 10);
    this.currentDefense = parseInt(data.defense, 10);
    this.maxDefense = this.currentDefense;
  }

  hasModifier(modifier: Modifier): boolean {
    return this.data.modifiers.includes(modifier);
  }

  get isDead(): boolean {
    return this.currentDefense <= 0;
  }

  get isDamaged(): boolean {
    return this.currentDefense < this.maxDefense;
  }

  get attackText(): string {
    return String(this.currentAttack);
  }

  get defenseText(): string {
    return String(this.currentDefense);
  }
}
