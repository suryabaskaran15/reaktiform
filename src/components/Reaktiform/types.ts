import type { useReaktiform } from "../../hooks/useReaktiform";

// Internal-only alias for the real (non-erased) return type of
// useReaktiform, used to type the `grid` prop threaded into the
// toolbar-family components split out of Reaktiform.tsx. Deliberately NOT
// the public UseReaktiformReturn type (src/types/config.ts) — that type is
// a loose `Record<string, any>` documentation placeholder and would erase
// type-checking on every grid.* access in these files.
export type GridApi<TData = Record<string, unknown>> = ReturnType<
  typeof useReaktiform<TData>
>;
