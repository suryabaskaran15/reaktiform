// Deterministic dataset generator: given the same (seed, rowCount,
// columnCount, features) tuple, always produces byte-identical output. This
// is what every benchmark scenario/dataset size is built from — see
// generator.determinism.test.ts for the golden-hash regression guard.
import type { RowComment, RowAttachment } from "../../src/types";
import { createPrng, pick, intBetween, type Prng } from "./prng";
import {
  generateColumns,
  generateLargeFormColumns,
  type ColumnFeatureFlags,
} from "./columns";
import { DEFAULT_COLUMN_COUNT, DEFAULT_SEED } from "./presets";

export type DatasetFeatures = {
  editableRatio?: number; // default 0.7 — 70% of columns editable
  validation?: boolean; // default true
  selection?: boolean; // default true — stable row ids, no generator effect beyond that
  /**
   * ⚠️ Flagged gap (see docs in the plan): Phase 1's audit found `groupByCol`
   * (flat data grouped by a column's value) but no parent/child hierarchical
   * row structure anywhere in reaktiform's audited types. This flag
   * currently produces `groupable`-flagged flat data — the closest
   * confirmed-real analog — as an explicit placeholder, NOT true nested/tree
   * rows. Do not treat this as validating nested-row support; confirm with
   * the codebase owner before building a real nested-row generator path.
   */
  nested?: boolean;
  detailPanel?: boolean; // default true — attach RowComment[]/RowAttachment[] fixtures
}

export type DatasetConfig = {
  seed?: number;
  rowCount: number;
  columnCount?: number;
  features?: DatasetFeatures;
};

export type GeneratedRow = Record<string, unknown> & { id: string };

export type GeneratedDataset = {
  columns: ReturnType<typeof generateColumns<GeneratedRow>>;
  data: GeneratedRow[];
};

const FIRST_NAMES = ["Alex", "Sam", "Jordan", "Priya", "Wei", "Fatima", "Liam", "Noor", "Diego", "Yuki"];
const LAST_NAMES = ["Tan", "Silva", "Khan", "Nguyen", "Garcia", "Ahmad", "Kim", "Brown", "Ali", "Rossi"];
const DOMAINS = ["example.com", "corp.test", "mail.dev"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function randomDate(rng: Prng): string {
  const year = intBetween(rng, 2023, 2026);
  const month = intBetween(rng, 1, 12);
  const day = intBetween(rng, 1, 28);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function randomTime(rng: Prng): string {
  return `${pad2(intBetween(rng, 0, 23))}:${pad2(intBetween(rng, 0, 59))}`;
}

function valueForColumn(
  rng: Prng,
  colType: string,
  rowIndex: number,
  options: { value: string; label: string }[] | undefined,
): unknown {
  switch (colType) {
    case "text": {
      const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      return `${name} #${rowIndex}`;
    }
    case "number":
      return intBetween(rng, 0, 10_000);
    case "select":
      return options ? pick(rng, options).value : "default";
    case "multiselect": {
      if (!options) return [];
      const count = intBetween(rng, 1, Math.min(3, options.length));
      const chosen = new Set<string>();
      while (chosen.size < count) chosen.add(pick(rng, options).value);
      return Array.from(chosen);
    }
    case "date":
      return randomDate(rng);
    case "time":
      return randomTime(rng);
    case "checkbox":
      return rng() > 0.5;
    case "email": {
      const local = `${pick(rng, FIRST_NAMES).toLowerCase()}.${pick(rng, LAST_NAMES).toLowerCase()}${rowIndex}`;
      return `${local}@${pick(rng, DOMAINS)}`;
    }
    case "url":
      return `https://example.com/records/${rowIndex}`;
    case "currency":
      return Math.round(rng() * 1_000_00) / 100;
    case "percentage":
      return Math.round(rng() * 10000) / 100;
    case "rating":
      return intBetween(rng, 0, 5);
    case "badge":
      return options ? pick(rng, options).value : "default";
    case "progress":
      return intBetween(rng, 0, 100);
    default:
      return null;
  }
}

function generateComments(rng: Prng, rowIndex: number): RowComment[] {
  const count = intBetween(rng, 0, 3);
  return Array.from({ length: count }, (_, i) => ({
    id: `comment_${rowIndex}_${i}`,
    author: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
    text: `Fixture comment ${i} on row ${rowIndex}.`,
    createdAt: randomDate(rng),
  }));
}

function generateAttachments(rng: Prng, rowIndex: number): RowAttachment[] {
  const count = intBetween(rng, 0, 2);
  const types = ["pdf", "xlsx", "png"] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `attachment_${rowIndex}_${i}`,
    name: `file_${rowIndex}_${i}.${pick(rng, types)}`,
    size: `${intBetween(rng, 10, 900)} KB`,
    type: pick(rng, types),
  }));
}

export function generateDataset(config: DatasetConfig): GeneratedDataset {
  const seed = config.seed ?? DEFAULT_SEED;
  const columnCount = config.columnCount ?? DEFAULT_COLUMN_COUNT;
  const features: Required<DatasetFeatures> = {
    editableRatio: config.features?.editableRatio ?? 0.7,
    validation: config.features?.validation ?? true,
    selection: config.features?.selection ?? true,
    nested: config.features?.nested ?? false,
    detailPanel: config.features?.detailPanel ?? true,
  };

  const columnFeatures: ColumnFeatureFlags = {
    editableRatio: features.editableRatio,
    validation: features.validation,
    groupable: features.nested, // see the flagged-gap comment on DatasetFeatures.nested
  };
  const columns = generateColumns<GeneratedRow>(columnCount, columnFeatures);

  // Single PRNG instance walked sequentially row-by-row, column-by-column —
  // this order must never change, or determinism breaks for existing golden
  // hashes even with the same seed/config.
  const rng = createPrng(seed);
  const data: GeneratedRow[] = [];
  for (let r = 0; r < config.rowCount; r++) {
    const row: GeneratedRow = { id: `row_${r}` };
    for (const col of columns) {
      row[col.key as string] = valueForColumn(
        rng,
        col.type,
        r,
        col.options as { value: string; label: string }[] | undefined,
      );
    }
    if (features.detailPanel) {
      row._comments = generateComments(rng, r);
      row._attachments = generateAttachments(rng, r);
    }
    data.push(row);
  }

  return { columns, data };
}

export function generateLargeFormDataset(seed = DEFAULT_SEED, fieldCount = 60) {
  const columns = generateLargeFormColumns<GeneratedRow>(fieldCount);
  const rng = createPrng(seed);
  const row: GeneratedRow = { id: "row_0" };
  for (const col of columns) {
    row[col.key as string] = col.type === "number" ? intBetween(rng, 0, 1000) : `Value for ${col.label}`;
  }
  return { columns, data: [row] };
}
