import playerDeckIds from "../data/decks/playerDeck.json";
import { MAX_COPIES_PER_CARD, MAX_DECK_SIZE } from "./deckRules";

const COLLECTION_KEY = "drowning.collection.v1";
const DECK_KEY = "drowning.deck.v1";

interface SaveShape {
  counts: Record<string, number>;
  deckIds: string[];
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage non disponibile (es. navigazione privata): si prosegue solo in memoria.
  }
}

function defaultSave(): SaveShape {
  const starterDeck = [...(playerDeckIds as string[])];
  const counts: Record<string, number> = {};
  for (const id of starterDeck) counts[id] = Math.min(MAX_COPIES_PER_CARD, (counts[id] ?? 0) + 1);
  return { counts, deckIds: starterDeck };
}

/** Collezione di carte sbloccate (fino a 3 copie ciascuna) e il mazzo attuale costruito a partire da esse. */
export class PlayerProfile {
  private counts: Record<string, number>;
  private deckIds: string[];

  private constructor(save: SaveShape) {
    this.counts = save.counts;
    this.deckIds = save.deckIds;
  }

  static load(): PlayerProfile {
    const counts = readJSON<Record<string, number>>(COLLECTION_KEY);
    const deckIds = readJSON<string[]>(DECK_KEY);
    if (counts && deckIds) return new PlayerProfile({ counts, deckIds });

    const fresh = defaultSave();
    writeJSON(COLLECTION_KEY, fresh.counts);
    writeJSON(DECK_KEY, fresh.deckIds);
    return new PlayerProfile(fresh);
  }

  private persistCollection(): void {
    writeJSON(COLLECTION_KEY, this.counts);
  }

  private persistDeck(): void {
    writeJSON(DECK_KEY, this.deckIds);
  }

  copiesOwned(cardId: string): number {
    return this.counts[cardId] ?? 0;
  }

  unlockedCardIds(): string[] {
    return Object.keys(this.counts).filter((id) => this.counts[id] > 0);
  }

  /** Sblocca (o aggiunge) una copia, fino al tetto. Ritorna true se qualcosa è davvero cambiato. */
  unlock(cardId: string): boolean {
    const current = this.copiesOwned(cardId);
    if (current >= MAX_COPIES_PER_CARD) return false;
    this.counts[cardId] = current + 1;
    this.persistCollection();
    return true;
  }

  get deck(): readonly string[] {
    return this.deckIds;
  }

  countInDeck(cardId: string): number {
    return this.deckIds.filter((id) => id === cardId).length;
  }

  addToDeck(cardId: string): boolean {
    if (this.deckIds.length >= MAX_DECK_SIZE) return false;
    if (this.countInDeck(cardId) >= this.copiesOwned(cardId)) return false;
    this.deckIds.push(cardId);
    this.persistDeck();
    return true;
  }

  removeFromDeck(cardId: string): boolean {
    const index = this.deckIds.lastIndexOf(cardId);
    if (index === -1) return false;
    this.deckIds.splice(index, 1);
    this.persistDeck();
    return true;
  }

  exportSave(): string {
    return JSON.stringify({ counts: this.counts, deckIds: this.deckIds }, null, 2);
  }

  /** Importa un salvataggio esportato in precedenza: valida in modo permissivo e rispetta comunque i tetti. */
  static importSave(json: string): void {
    const parsed = JSON.parse(json) as Partial<SaveShape>;
    const counts: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed.counts ?? {})) {
      if (typeof value === "number" && value > 0) counts[id] = Math.min(MAX_COPIES_PER_CARD, Math.floor(value));
    }
    const deckIds = Array.isArray(parsed.deckIds) ? parsed.deckIds.slice(0, MAX_DECK_SIZE) : [];
    writeJSON(COLLECTION_KEY, counts);
    writeJSON(DECK_KEY, deckIds);
    instance = new PlayerProfile({ counts, deckIds });
  }
}

let instance: PlayerProfile | null = null;

export function getPlayerProfile(): PlayerProfile {
  if (!instance) instance = PlayerProfile.load();
  return instance;
}
