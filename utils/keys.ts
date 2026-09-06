/**
 * Stable, unique render keys for API-sourced lists.
 *
 * The KVF API can return items with duplicate or missing ids/slugs, which
 * triggers React "two children with the same key" / "missing key" warnings.
 * `withListKeys` attaches a `listKey` to every item:
 *   - the item's natural id when present and unique
 *   - `<id>-2`, `<id>-3`, … for repeated ids (deterministic within the list)
 *   - a generated unique id when the natural id is missing/empty
 *
 * Keys are computed once per API response (in kvfApi), so they stay stable
 * across re-renders of the same data.
 */

export type Keyed<T> = T & { listKey: string };

let uniqueCounter = 0;

function nextGeneratedId(): string {
  uniqueCounter += 1;
  return `gen-${Date.now().toString(36)}-${uniqueCounter}`;
}

export function withListKeys<T>(items: T[], idOf: (item: T) => string | null | undefined): Keyed<T>[] {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const naturalId = idOf(item)?.trim();
    const base = naturalId || nextGeneratedId();
    const timesSeen = (seen.get(base) ?? 0) + 1;
    seen.set(base, timesSeen);
    return { ...item, listKey: timesSeen === 1 ? base : `${base}-${timesSeen}` };
  });
}
