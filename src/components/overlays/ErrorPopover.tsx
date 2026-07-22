import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../utils";
import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  ERROR POPOVER — rendered via React Portal into document.body
//  This is the ONLY reliable way to escape:
//  - overflow:hidden/auto on the scroll container
//  - position:relative stacking contexts on parent elements
//  - z-index battles with sticky thead
//  The popover measures its trigger button's position via
//  getBoundingClientRect() and positions itself relative to the viewport.
// ─────────────────────────────────────────────────────────────
export function ErrorPopover({
  rowId,
  errors,
  saveError,
  columns,
  onClose,
  isDark,
}: {
  rowId: string;
  errors: Record<string, string>;
  saveError?: string | undefined; // API error message from last failed save
  columns: ColumnDef[];
  onClose: () => void;
  isDark: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(
      `[data-error-dot="${rowId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: Math.min(rect.bottom + 6, window.innerHeight - 300),
      left: rect.right + 8,
    });
  }, [rowId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!pos) return null;

  const errorEntries = Object.entries(errors);
  const hasValidation = errorEntries.length > 0;
  const totalProblems = errorEntries.length + (saveError ? 1 : 0);

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
        onClick={onClose}
      />
      <div
        data-reaktiform
        className={cn(isDark && "dark")}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          zIndex: 99999,
          background: "var(--rf-surface)",
          border: "1px solid var(--rf-err-br)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(220,38,38,.20)",
          padding: "10px 14px",
          minWidth: 240,
          maxWidth: 360,
          fontFamily: "var(--rf-font-sans)",
          fontSize: 13,
          color: "var(--rf-text-1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle
              style={{
                width: 12,
                height: 12,
                color: "var(--rf-err)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: "var(--rf-err)",
              }}
            >
              {totalProblems} {totalProblems === 1 ? "Error" : "Errors"}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--rf-text-3)",
              padding: 2,
              display: "flex",
            }}
          >
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* API save error — shown at the top, most important */}
        {saveError && (
          <div
            style={{
              marginBottom: hasValidation ? 10 : 0,
              paddingBottom: hasValidation ? 10 : 0,
              borderBottom: hasValidation
                ? "1px solid var(--rf-err-br)"
                : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  color: "var(--rf-text-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--rf-err)",
                    flexShrink: 0,
                  }}
                />
                API Error
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--rf-err)",
                  lineHeight: 1.5,
                  background: "var(--rf-err-bg)",
                  borderRadius: 6,
                  padding: "5px 8px",
                  wordBreak: "break-word",
                }}
              >
                {saveError}
              </span>
            </div>
          </div>
        )}

        {/* Validation errors */}
        {hasValidation && (
          <>
            {saveError && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  color: "var(--rf-text-3)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Validation
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {errorEntries.map(([key, msg]) => {
                const col = columns.find((c) => c.key === key);
                return (
                  <div
                    key={key}
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                        color: "var(--rf-text-3)",
                      }}
                    >
                      {col?.label ?? key}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--rf-err)",
                        lineHeight: 1.4,
                      }}
                    >
                      {msg}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer hint */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--rf-err-br)",
            fontSize: 10.5,
            color: "var(--rf-text-3)",
          }}
        >
          {hasValidation
            ? "Click any highlighted cell to fix"
            : "Fix the issue and retry saving"}
        </div>
      </div>
    </>,
    document.body,
  );
}
