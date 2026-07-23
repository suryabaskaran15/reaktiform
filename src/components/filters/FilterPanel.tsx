import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../utils";
import { useAnchoredPosition } from "../overlays/useAnchoredPosition";
import { AsyncSelectFilter } from "./AsyncSelectFilter";
import { CreatableFilter } from "./CreatableFilter";
import type { ColumnDef, FilterValue } from "../../types";

// ─────────────────────────────────────────────────────────────
//  FILTER PANEL — positions below the column filter button
// ─────────────────────────────────────────────────────────────
export function FilterPanel({
  col,
  current,
  anchor,
  onApply,
  onClear,
  onClose,
  isDark,
}: {
  col: ColumnDef;
  current: FilterValue | undefined;
  anchor: DOMRect | null;
  onApply: (val: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const [textVal, setTextVal] = useState(
    current?.type === "text" ? current.value : "",
  );
  const [numMin, setNumMin] = useState(
    current?.type === "number" ? String(current.min ?? "") : "",
  );
  const [numMax, setNumMax] = useState(
    current?.type === "number" ? String(current.max ?? "") : "",
  );
  const [dateFrom, setDateFrom] = useState(
    current?.type === "date" ? (current.from ?? "") : "",
  );
  const [dateTo, setDateTo] = useState(
    current?.type === "date" ? (current.to ?? "") : "",
  );
  const [timeFrom, setTimeFrom] = useState(
    current?.type === "time" ? (current.from ?? "") : "",
  );
  const [timeTo, setTimeTo] = useState(
    current?.type === "time" ? (current.to ?? "") : "",
  );
  const [selVals, setSelVals] = useState<string[]>(
    current?.type === "select" ? current.values : [],
  );
  const [boolVal, setBoolVal] = useState<boolean | null>(
    current?.type === "checkbox" ? current.value : null,
  );
  // Rating filter — min/max star range
  const [ratingMin, setRatingMin] = useState<number>(
    current?.type === "number" ? (current.min ?? 0) : 0,
  );
  const [ratingMax, setRatingMax] = useState<number>(
    current?.type === "number" ? (current.max ?? 5) : 5,
  );

  const handleApply = () => {
    // ── text-like types: contains search
    if (col.type === "text" || col.type === "email" || col.type === "url") {
      onApply({ type: "text", value: textVal });

      // ── number-like types: min/max range
    } else if (
      col.type === "number" ||
      col.type === "currency" ||
      col.type === "percentage" ||
      col.type === "progress"
    ) {
      onApply({
        type: "number",
        ...(numMin !== "" && { min: Number(numMin) }),
        ...(numMax !== "" && { max: Number(numMax) }),
      });

      // ── rating: star range stored as number filter
    } else if (col.type === "rating") {
      onApply({
        type: "number",
        ...(ratingMin > 0 && { min: ratingMin }),
        ...(ratingMax < (col.ratingMax ?? 5) && { max: ratingMax }),
      });

      // ── date
    } else if (col.type === "date") {
      onApply({
        type: "date",
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });

      // ── time
    } else if (col.type === "time") {
      onApply({
        type: "time",
        ...(timeFrom && { from: timeFrom }),
        ...(timeTo && { to: timeTo }),
      });

      // ── select / multiselect / badge: pill toggles
    } else if (
      col.type === "select" ||
      col.type === "multiselect" ||
      col.type === "badge"
    ) {
      const hasStaticOptions = (col.options?.length ?? 0) > 0;
      const isAsync = !!col.loadOptions;
      if (!hasStaticOptions && !isAsync && textVal) {
        onApply({ type: "text", value: textVal });
      } else {
        onApply({ type: "select", values: selVals });
      }

      // ── checkbox
    } else if (col.type === "checkbox") {
      onApply({ type: "checkbox", value: boolVal });
    }
  };

  // const inp = cn(
  //   "w-full px-2.5 py-1.5 text-[12.5px] border border-rf-border rounded-rf-md",
  //   "bg-rf-bg text-rf-text-1 outline-none",
  //   "focus:border-rf-accent focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  // );

  const PANEL_WIDTH = 288;
  const PANEL_HEIGHT = 420;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelPos = useAnchoredPosition(
    anchor,
    panelRef,
    PANEL_WIDTH,
    PANEL_HEIGHT,
  );

  // Themed tokens — scoped via data-reaktiform on the portal root below,
  // so these resolve to the correct light/dark CSS variable value.
  const FS = {
    surface: "var(--rf-surface)",
    header: "var(--rf-header)",
    bg: "var(--rf-bg)",
    border: "var(--rf-border)",
    text1: "var(--rf-text-1)",
    text2: "var(--rf-text-2)",
    text3: "var(--rf-text-3)",
    accent: "var(--rf-accent)",
    accentBg: "var(--rf-accent-bg)",
    accentBr: "var(--rf-accent-br)",
    err: "var(--rf-err)",
    radiusMd: "7px",
    radiusLg: "10px",
  };
  const fInp: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12.5,
    border: `1px solid ${FS.border}`,
    borderRadius: FS.radiusMd,
    background: FS.bg,
    color: FS.text1,
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
  };
  const fLabel: React.CSSProperties = {
    display: "block",
    fontSize: 10.5,
    fontWeight: 700,
    color: FS.text2,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    marginBottom: 6,
  };

  return createPortal(
    <div
      data-reaktiform
      className={cn(isDark && "dark")}
      style={{ position: "fixed", inset: 0, zIndex: 999 }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        style={{
          ...panelPos,
          width: PANEL_WIDTH,
          maxHeight: PANEL_HEIGHT,
          overflowY: "auto",
          background: FS.surface,
          border: `1px solid ${FS.border}`,
          borderRadius: FS.radiusLg,
          boxShadow: "0 8px 32px rgba(15,23,42,.2)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: `1px solid ${FS.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: FS.text3,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Filter
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: FS.text1,
                marginTop: 1,
              }}
            >
              {col.label}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: FS.text3,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── Body */}
        <div
          style={{
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Text / Email / URL */}
          {(col.type === "text" ||
            col.type === "email" ||
            col.type === "url") && (
            <div>
              <label style={fLabel}>
                {col.type === "email"
                  ? "Email contains"
                  : col.type === "url"
                    ? "URL contains"
                    : "Contains"}
              </label>
              <input
                style={fInp}
                value={textVal}
                autoFocus
                placeholder={
                  col.type === "email"
                    ? "e.g. @gmail.com"
                    : col.type === "url"
                      ? "e.g. github.com"
                      : `Search ${col.label.toLowerCase()}…`
                }
                onChange={(e) => setTextVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApply();
                }}
              />
            </div>
          )}

          {/* Number / Currency / Percentage / Progress range */}
          {(col.type === "number" ||
            col.type === "currency" ||
            col.type === "percentage" ||
            col.type === "progress") && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>
                  {col.type === "percentage" || col.type === "progress"
                    ? "Min %"
                    : `Min ${col.currency ?? ""}`}
                </label>
                <input
                  style={fInp}
                  type="number"
                  value={numMin}
                  placeholder="0"
                  onChange={(e) => setNumMin(e.target.value)}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>
                  {col.type === "percentage" || col.type === "progress"
                    ? "Max %"
                    : `Max ${col.currency ?? ""}`}
                </label>
                <input
                  style={fInp}
                  type="number"
                  value={numMax}
                  placeholder="∞"
                  onChange={(e) => setNumMax(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Rating — star range */}
          {col.type === "rating" &&
            (() => {
              const maxStars = col.ratingMax ?? 5;
              return (
                <div>
                  <label style={fLabel}>Minimum rating</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      marginBottom: 12,
                    }}
                  >
                    {Array.from({ length: maxStars }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRatingMin(i + 1)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 22,
                          lineHeight: 1,
                          padding: "0 2px",
                          color: i < ratingMin ? "#F59E0B" : FS.border,
                          transform: i < ratingMin ? "scale(1.1)" : "scale(1)",
                          transition: "all 80ms",
                        }}
                      >
                        ★
                      </button>
                    ))}
                    {ratingMin > 0 && (
                      <button
                        type="button"
                        onClick={() => setRatingMin(0)}
                        style={{
                          fontSize: 11,
                          color: FS.text3,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          marginLeft: 4,
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <label style={fLabel}>Maximum rating</label>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 2 }}
                  >
                    {Array.from({ length: maxStars }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRatingMax(i + 1)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 22,
                          lineHeight: 1,
                          padding: "0 2px",
                          color: i < ratingMax ? "#F59E0B" : FS.border,
                          transform: i < ratingMax ? "scale(1.1)" : "scale(1)",
                          transition: "all 80ms",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: FS.text3, marginTop: 6 }}>
                    Showing {ratingMin}★ – {ratingMax}★
                  </div>
                </div>
              );
            })()}

          {/* Date range */}
          {col.type === "date" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>From</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>To</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Time range */}
          {col.type === "time" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>From</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={fLabel}>To</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Select / Multiselect / Badge */}
          {(col.type === "select" ||
            col.type === "multiselect" ||
            col.type === "badge") &&
            (() => {
              const hasStaticOptions = (col.options?.length ?? 0) > 0;
              const isAsync = !!col.loadOptions;
              const isCreatable = !!col.onCreateOption;

              if (hasStaticOptions && !isAsync)
                return (
                  <div>
                    <label style={fLabel}>Include any of</label>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        maxHeight: 180,
                        overflowY: "auto",
                      }}
                    >
                      {(col.options ?? []).map((opt) => {
                        const isSel = selVals.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setSelVals(
                                isSel
                                  ? selVals.filter((v) => v !== opt.value)
                                  : [...selVals, opt.value],
                              )
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 500,
                              padding: "4px 10px",
                              borderRadius: 20,
                              border: `1px solid ${isSel ? FS.accent : FS.border}`,
                              background: isSel ? FS.accent : FS.header,
                              color: isSel ? "#fff" : FS.text2,
                              cursor: "pointer",
                              transition: "all 120ms",
                            }}
                          >
                            {isSel && <span>✓</span>}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );

              if (isAsync)
                return (
                  <AsyncSelectFilter
                    loadOptions={col.loadOptions!}
                    selected={selVals}
                    isCreatable={isCreatable}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );

              if (isCreatable)
                return (
                  <CreatableFilter
                    selected={selVals}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );

              return (
                <div>
                  <label style={fLabel}>Contains</label>
                  <input
                    style={fInp}
                    value={textVal}
                    autoFocus
                    placeholder="Filter value…"
                    onChange={(e) => setTextVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApply();
                    }}
                  />
                </div>
              );
            })()}

          {/* Checkbox */}
          {col.type === "checkbox" && (
            <div>
              <label style={fLabel}>Value</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([null, true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setBoolVal(v)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: FS.radiusMd,
                      border: `1px solid ${boolVal === v ? FS.accent : FS.border}`,
                      background: boolVal === v ? FS.accent : FS.surface,
                      color: boolVal === v ? "#fff" : FS.text2,
                      cursor: "pointer",
                      transition: "all 120ms",
                    }}
                  >
                    {v === null ? "All" : v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer */}
        <div style={{ display: "flex", gap: 8, padding: "0 14px 14px" }}>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: "7px 0",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: FS.radiusMd,
              border: "none",
              background: FS.accent,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Apply
          </button>
          <button
            onClick={onClear}
            style={{
              padding: "7px 16px",
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: FS.radiusMd,
              border: `1px solid ${FS.border}`,
              background: FS.surface,
              color: FS.text2,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
