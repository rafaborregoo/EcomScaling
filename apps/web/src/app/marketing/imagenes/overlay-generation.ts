/** Progress is retained by the caller across transport errors and later retries. */
export async function generateOverlaySlides<T>(indices: number[], completed: Set<number>, generate: (index: number) => Promise<T | null>, apply: (index: number, result: T) => void) {
  for (const index of indices) {
    if (completed.has(index)) continue;
    const result = await generate(index);
    if (result === null) return false;
    apply(index, result);
    completed.add(index);
  }
  return true;
}
