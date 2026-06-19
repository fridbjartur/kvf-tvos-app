/**
 * Justified grid packing.
 *
 * Packs a flat list of items into rows of uniform height. Each card keeps its
 * source aspect ratio, so its width = rowHeight * ratio. Cards are placed left
 * to right until the next one would overflow the container, then a new row
 * starts. Row height is constant (no per-row scaling), so the right edge is
 * ragged but every row aligns vertically. This keeps `getItemLayout` exact and
 * preserves FlatList virtualization at the row level.
 */

export interface JustifiedCard<T> {
  item: T;
  /** Original flat index, used for focus order, image priority, recycling keys. */
  index: number;
  /** Laid-out image width in px. */
  width: number;
  /** Laid-out image height in px (equals rowHeight). */
  height: number;
}

export interface JustifiedRow<T> {
  key: string;
  items: JustifiedCard<T>[];
}

export interface PackRowsOptions<T> {
  /** Inner width available for cards (container minus horizontal padding). */
  containerWidth: number;
  /** Fixed height every card/row uses. */
  rowHeight: number;
  /** Horizontal gap between adjacent cards in a row. */
  gap: number;
  /** Aspect ratio (width / height) for an item, or undefined if unknown. */
  getAspectRatio: (item: T) => number | undefined;
  /** Ratio used when an item has none (portrait poster, e.g. 2/3). */
  fallbackRatio: number;
  /** Stable key for an item (used to derive the row key). */
  getKey: (item: T, index: number) => string;
  /** Lower clamp for ratio (default 0.5). */
  minRatio?: number;
  /** Upper clamp for ratio (default 2). */
  maxRatio?: number;
}

export function packRows<T>(items: readonly T[], options: PackRowsOptions<T>): JustifiedRow<T>[] {
  const { containerWidth, rowHeight, gap, getAspectRatio, fallbackRatio, getKey, minRatio = 0.5, maxRatio = 2 } = options;

  if (containerWidth <= 0 || rowHeight <= 0 || items.length === 0) {
    return [];
  }

  const rows: JustifiedRow<T>[] = [];
  let current: JustifiedCard<T>[] = [];
  let currentWidth = 0;

  const pushRow = () => {
    if (current.length === 0) return;
    const first = current[0];
    rows.push({ key: getKey(first.item, first.index), items: current });
    current = [];
    currentWidth = 0;
  };

  items.forEach((item, index) => {
    let ratio = getAspectRatio(item);
    if (ratio === undefined || !Number.isFinite(ratio) || ratio <= 0) {
      ratio = fallbackRatio;
    }
    ratio = Math.min(maxRatio, Math.max(minRatio, ratio));

    const cardWidth = Math.round(rowHeight * ratio);
    const need = cardWidth + (current.length > 0 ? gap : 0);

    if (current.length > 0 && currentWidth + need > containerWidth) {
      pushRow();
      current.push({ item, index, width: cardWidth, height: rowHeight });
      currentWidth = cardWidth;
    } else {
      current.push({ item, index, width: cardWidth, height: rowHeight });
      currentWidth += need;
    }
  });

  pushRow();
  return rows;
}
