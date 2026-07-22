import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  ASYNC SELECT FILTER — search box calling loadOptions
//  Used inside FilterPanel for async/creatable columns
// ─────────────────────────────────────────────────────────────
export function AsyncSelectFilter({
  loadOptions,
  selected,
  isCreatable,
  onToggle,
}: {
  loadOptions: (input: string) => Promise<import("../../types").SelectOption[]>;
  selected: string[];
  isCreatable: boolean;
  onToggle: (val: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<import("../../types").SelectOption[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const T = {
    border: "var(--rf-border)",
    bg: "var(--rf-bg)",
    text1: "var(--rf-text-1)",
    text2: "var(--rf-text-2)",
    text3: "var(--rf-text-3)",
    accent: "var(--rf-accent)",
    accentBg: "var(--rf-accent-bg)",
    rowHover: "var(--rf-row-hover)",
  };
  const iStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12.5,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    background: T.bg,
    color: T.text1,
    outline: "none",
    fontFamily: "Inter,system-ui,sans-serif",
    boxSizing: "border-box",
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const opts = await loadOptions(query);
        setResults(opts);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadOptions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: T.text2,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        Search to filter
      </label>
      <input
        style={iStyle}
        value={query}
        autoFocus
        placeholder="Type to search options…"
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onToggle(val)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 20,
                background: T.accent,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {results.find((o) => o.value === val)?.label ?? val}
              <X style={{ width: 10, height: 10 }} />
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          maxHeight: 140,
          overflowY: "auto",
          borderRadius: 7,
          border: `1px solid ${T.border}`,
          background: T.bg,
        }}
      >
        {loading && (
          <div
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: T.text3,
              fontStyle: "italic",
            }}
          >
            Loading…
          </div>
        )}
        {!loading && results.length === 0 && query && (
          <div
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: T.text3,
              fontStyle: "italic",
            }}
          >
            No results
          </div>
        )}
        {!loading &&
          results.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  fontSize: 12.5,
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  background: isSel ? T.accentBg : "transparent",
                  color: isSel ? T.accent : T.text1,
                  fontWeight: isSel ? 600 : 400,
                  fontFamily: "Inter,system-ui,sans-serif",
                }}
              >
                {opt.label}
                {isSel && <span style={{ color: T.accent }}>✓</span>}
              </button>
            );
          })}
        {isCreatable && query && !results.find((o) => o.label === query) && (
          <button
            type="button"
            onClick={() => {
              onToggle(query);
              setQuery("");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontSize: 12.5,
              textAlign: "left",
              border: "none",
              borderTop: `1px solid ${T.border}`,
              cursor: "pointer",
              background: "transparent",
              color: T.text2,
              fontFamily: "Inter,system-ui,sans-serif",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: T.accent,
              }}
            >
              + Create
            </span>
            &ldquo;{query}&rdquo;
          </button>
        )}
      </div>
    </div>
  );
}
