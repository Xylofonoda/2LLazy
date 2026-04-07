/**
 * Runs `fn` over all items in sequential batches of `batchSize`.
 * Items within a batch run concurrently; batches run one after another.
 * Null / rejected results are silently dropped.
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const settled = await Promise.allSettled(
      items.slice(i, i + batchSize).map(fn),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value !== null) results.push(r.value);
    }
  }
  return results;
}
