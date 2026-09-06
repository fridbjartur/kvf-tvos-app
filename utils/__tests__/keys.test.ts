import { withListKeys } from "../keys";

interface Item {
  slug: string | null;
  name: string;
}

describe("withListKeys", () => {
  it("uses the natural id when unique", () => {
    const items: Item[] = [
      { slug: "a", name: "A" },
      { slug: "b", name: "B" },
    ];
    const keyed = withListKeys(items, (i) => i.slug);
    expect(keyed.map((i) => i.listKey)).toEqual(["a", "b"]);
  });

  it("deduplicates repeated ids with a counter suffix", () => {
    const items: Item[] = [
      { slug: "a", name: "first" },
      { slug: "a", name: "second" },
      { slug: "a", name: "third" },
    ];
    const keyed = withListKeys(items, (i) => i.slug);
    expect(keyed.map((i) => i.listKey)).toEqual(["a", "a-2", "a-3"]);
  });

  it("generates unique keys for missing/empty ids", () => {
    const items: Item[] = [
      { slug: null, name: "no slug" },
      { slug: "", name: "empty slug" },
      { slug: "   ", name: "blank slug" },
    ];
    const keyed = withListKeys(items, (i) => i.slug);
    const keys = keyed.map((i) => i.listKey);
    expect(new Set(keys).size).toBe(3);
    keys.forEach((k) => expect(k).toMatch(/^gen-/));
  });

  it("does not mutate the input items", () => {
    const items: Item[] = [{ slug: "a", name: "A" }];
    withListKeys(items, (i) => i.slug);
    expect(items[0]).toEqual({ slug: "a", name: "A" });
  });

  it("preserves item fields and order", () => {
    const items: Item[] = [
      { slug: "z", name: "Z" },
      { slug: "y", name: "Y" },
    ];
    const keyed = withListKeys(items, (i) => i.slug);
    expect(keyed[0]).toMatchObject({ slug: "z", name: "Z" });
    expect(keyed[1]).toMatchObject({ slug: "y", name: "Y" });
  });
});
