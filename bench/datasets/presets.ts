// Named row-count presets per the requested target scale.
export const ROW_PRESETS = {
  TINY: 100,
  SMALL: 500,
  MEDIUM: 1_000,
  LARGE: 5_000,
  XLARGE: 10_000,
  HUGE: 50_000,
  STRESS: 100_000,
  EXTREME: 1_000_000,
} as const;

export type RowPresetName = keyof typeof ROW_PRESETS;

export function resolveRowCount(preset: RowPresetName | number): number {
  if (typeof preset === "number") return preset;
  return ROW_PRESETS[preset];
}

export const DEFAULT_SEED = 42;
export const DEFAULT_COLUMN_COUNT = 20;
