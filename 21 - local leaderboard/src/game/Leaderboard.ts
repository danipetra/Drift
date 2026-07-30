const STORAGE_KEY = "drowning.leaderboard.v1";
const MAX_ENTRIES = 10;

export interface LeaderboardEntry {
  score: number;
  floorsCleared: number;
  date: string;
}

function readEntries(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage non disponibile: la run resta comunque conclusa, semplicemente non si registra.
  }
}

export function getLeaderboard(): LeaderboardEntry[] {
  return readEntries();
}

/** Registra la run conclusa e tiene solo le migliori `MAX_ENTRIES`, in ordine di punteggio. */
export function recordRun(score: number, floorsCleared: number): void {
  const entries = readEntries();
  entries.push({ score, floorsCleared, date: new Date().toISOString() });
  entries.sort((a, b) => b.score - a.score);
  entries.splice(MAX_ENTRIES);
  writeEntries(entries);
}
