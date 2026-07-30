/** Fino a `count` id di carte distinte, pescati a caso dal mazzo (nemico) appena sconfitto. */
export function pickRewardChoices(deckIds: string[], count = 3): string[] {
  const uniqueIds = [...new Set(deckIds)];
  for (let i = uniqueIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueIds[i], uniqueIds[j]] = [uniqueIds[j], uniqueIds[i]];
  }
  return uniqueIds.slice(0, Math.min(count, uniqueIds.length));
}
