export interface GridSlot {
  x: number;
  y: number;
  scale: number;
}

export interface CardGridLayout {
  slots: GridSlot[];
  gridHeight: number;
}

/**
 * Layout a colonne fisse per una griglia di `CardView` (riusato da tutte le schermate di
 * scelta-carta della Scalata della Torre): adatta la griglia alla larghezza disponibile e
 * restituisce anche l'altezza totale occupata, utile per posizionare elementi sotto (es. "Salta").
 */
export function layoutCardGrid(
  count: number,
  screenWidth: number,
  columns: number,
  cardWidth: number,
  cardHeight: number,
  gap: number,
  startY: number,
): CardGridLayout {
  const rows = Math.ceil(count / columns);
  const gridWidth = columns * cardWidth + (columns - 1) * gap;
  const scale = Math.min(1, (screenWidth - 32) / gridWidth);
  const startX = (screenWidth - gridWidth * scale) / 2;

  const slots: GridSlot[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    slots.push({
      x: startX + col * (cardWidth + gap) * scale,
      y: startY + row * (cardHeight + gap) * scale,
      scale,
    });
  }

  const gridHeight = rows * cardHeight * scale + Math.max(0, rows - 1) * gap * scale;
  return { slots, gridHeight };
}
