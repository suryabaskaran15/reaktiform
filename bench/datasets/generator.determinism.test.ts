import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateDataset } from "./generator";

// Regression guard against silent generator drift: the same (seed, rowCount,
// columnCount, features) tuple must always produce byte-identical output.
// If this test ever fails after an intentional generator change, update the
// golden hash below in the same commit — a silent change here would make
// every historical benchmark report non-comparable to new ones.
function hashOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("dataset generator determinism", () => {
  it("produces byte-identical output for the same config across repeated calls", () => {
    const a = generateDataset({ seed: 42, rowCount: 50, columnCount: 10 });
    const b = generateDataset({ seed: 42, rowCount: 50, columnCount: 10 });
    expect(hashOf(a)).toBe(hashOf(b));
  });

  it("matches the committed golden hash (fails loudly on unintentional drift)", () => {
    const dataset = generateDataset({ seed: 42, rowCount: 50, columnCount: 10 });
    expect(hashOf(dataset)).toBe(
      "e0feff0506302c8b8eff961c81ab9ee3f2d858ee80f07b7d0afa34bde076e025",
    );
  });

  it("produces different output for a different seed", () => {
    const a = generateDataset({ seed: 1, rowCount: 20, columnCount: 5 });
    const b = generateDataset({ seed: 2, rowCount: 20, columnCount: 5 });
    expect(hashOf(a)).not.toBe(hashOf(b));
  });

  it("row count and column count match the request", () => {
    const { columns, data } = generateDataset({
      seed: 7,
      rowCount: 123,
      columnCount: 8,
    });
    expect(data).toHaveLength(123);
    expect(columns).toHaveLength(8);
  });

  it("every row has a unique, stable id", () => {
    const { data } = generateDataset({ seed: 7, rowCount: 200 });
    const ids = new Set(data.map((r) => r.id));
    expect(ids.size).toBe(200);
  });
});
