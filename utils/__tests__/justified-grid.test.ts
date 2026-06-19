import { packRows } from "../justified-grid";

interface TestItem {
  id: string;
  ratio?: number;
}

const FALLBACK = 2 / 3;

function pack(items: TestItem[], opts: Partial<Parameters<typeof packRows<TestItem>>[1]> = {}) {
  return packRows<TestItem>(items, {
    containerWidth: 1000,
    rowHeight: 300,
    gap: 0,
    getAspectRatio: (i) => i.ratio,
    fallbackRatio: FALLBACK,
    getKey: (i) => i.id,
    ...opts,
  });
}

describe("packRows", () => {
  it("returns no rows for empty input or invalid dimensions", () => {
    expect(pack([])).toEqual([]);
    expect(pack([{ id: "a" }], { containerWidth: 0 })).toEqual([]);
    expect(pack([{ id: "a" }], { rowHeight: 0 })).toEqual([]);
  });

  it("makes portrait cards narrower than their height", () => {
    const [row] = pack([{ id: "a", ratio: 2 / 3 }]);
    const card = row.items[0];
    expect(card.height).toBe(300);
    expect(card.width).toBe(200); // 300 * 2/3
    expect(card.width).toBeLessThan(card.height);
  });

  it("makes landscape cards wider than their height", () => {
    const [row] = pack([{ id: "a", ratio: 16 / 9 }]);
    const card = row.items[0];
    expect(card.height).toBe(300);
    expect(card.width).toBe(533); // round(300 * 16/9)
    expect(card.width).toBeGreaterThan(card.height);
  });

  it("uses the fallback ratio when an item has none", () => {
    const [row] = pack([{ id: "a" }]);
    expect(row.items[0].width).toBe(Math.round(300 * FALLBACK));
  });

  it("clamps extreme ratios to the min/max bounds", () => {
    const ultraWide = pack([{ id: "a", ratio: 10 }])[0].items[0];
    const ultraTall = pack([{ id: "b", ratio: 0.05 }])[0].items[0];
    expect(ultraWide.width).toBe(300 * 2); // clamped to maxRatio 2
    expect(ultraTall.width).toBe(300 * 0.5); // clamped to minRatio 0.5
  });

  it("wraps items into multiple rows once a row fills the container width", () => {
    // 6 portrait cards (width 200) into a 1000px container, gap 0 => 5 per row.
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, ratio: 2 / 3 }));
    const rows = pack(items);
    expect(rows).toHaveLength(2);
    expect(rows[0].items).toHaveLength(5);
    expect(rows[1].items).toHaveLength(1);
  });

  it("keeps every row at or below the container width", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, ratio: i % 2 === 0 ? 16 / 9 : 2 / 3 }));
    const gap = 24;
    const rows = pack(items, { gap });
    for (const row of rows) {
      const used = row.items.reduce((sum, c) => sum + c.width, 0) + gap * (row.items.length - 1);
      expect(used).toBeLessThanOrEqual(1000);
    }
  });

  it("places a single over-wide card alone rather than dropping it", () => {
    const rows = pack([{ id: "huge", ratio: 2 }], { containerWidth: 100 });
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].items[0].width).toBe(600);
  });

  it("preserves the original flat index on each card", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, ratio: 2 / 3 }));
    const rows = pack(items);
    const flat = rows.flatMap((r) => r.items);
    expect(flat.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("keys each row by its first item", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, ratio: 2 / 3 }));
    const rows = pack(items);
    expect(rows[0].key).toBe("i0");
    expect(rows[1].key).toBe("i5");
  });
});
