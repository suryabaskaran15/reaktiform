// Deterministic seeded PRNG (mulberry32). NOT Math.random() — given the same
// seed, this produces the exact same sequence in every environment, which is
// the whole point of the benchmark dataset generator (reproducible runs).
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Prng = ReturnType<typeof createPrng>;

export function pick<T>(rng: Prng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick() called with empty array");
  return item;
}

export function intBetween(rng: Prng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
