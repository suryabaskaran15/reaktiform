import { useCallback } from "react";
import { useGridStore } from "../store";
import type { CFResult, Row } from "../types";

export function useConditionalFormat<TData = Record<string, unknown>>() {
  const cfRules = useGridStore((s) => s.cfRules);

  // ── Evaluate all rules against a row — returns first match
  const evalCF = useCallback(
    (row: Row<TData>): CFResult => {
      for (const rule of cfRules) {
        if (!rule.enabled) continue;

        const results = rule.conditions.map((cond) => {
          // Get value — prefer draft over committed
          const v =
            row._draft && cond.field in row._draft
              ? row._draft[cond.field]
              : (row as Record<string, unknown>)[cond.field];

          const cv = cond.value;
          const strV = String(v ?? "");
          const numV = parseFloat(strV);

          switch (cond.op) {
            case "eq":
              return strV === cv;
            case "neq":
              return strV !== cv;
            case "gt":
              return numV > parseFloat(cv);
            case "lt":
              return numV < parseFloat(cv);
            case "gte":
              return numV >= parseFloat(cv);
            case "lte":
              return numV <= parseFloat(cv);
            case "contains":
              return strV.toLowerCase().includes(cv.toLowerCase());
            case "in":
              return cv
                .split(",")
                .map((s) => s.trim())
                .includes(strV);
            default:
              return false;
          }
        });

        const matched =
          rule.logic === "AND" ? results.every(Boolean) : results.some(Boolean);

        if (matched) {
          return {
            backgroundColor: rule.backgroundColor,
            textColor: rule.textColor,
          };
        }
      }

      return null;
    },
    [cfRules],
  );

  return { cfRules, evalCF };
}
