import { useState } from "react";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  CREATABLE FILTER — type and add custom values to filter set
// ─────────────────────────────────────────────────────────────
export function CreatableFilter({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [input, setInput] = useState("");
  const T = {
    border: "var(--rf-border)",
    bg: "var(--rf-bg)",
    text1: "var(--rf-text-1)",
    text2: "var(--rf-text-2)",
    accent: "var(--rf-accent)",
    accentHov: "var(--rf-accent-hover)",
  };
  const add = () => {
    const v = input.trim();
    if (v) {
      onToggle(v);
      setInput("");
    }
  };

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
        Filter by value
      </label>
      <div style={{ display: "flex" }}>
        <input
          value={input}
          autoFocus
          placeholder="Type a value…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 12.5,
            border: `1px solid ${T.border}`,
            borderRight: "none",
            borderRadius: "7px 0 0 7px",
            background: T.bg,
            color: T.text1,
            outline: "none",
            fontFamily: "Inter,system-ui,sans-serif",
          }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            padding: "6px 12px",
            background: T.accent,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${T.accent}`,
            borderRadius: "0 7px 7px 0",
            cursor: "pointer",
            fontFamily: "Inter,system-ui,sans-serif",
          }}
        >
          Add
        </button>
      </div>
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
              {val} <X style={{ width: 10, height: 10 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
