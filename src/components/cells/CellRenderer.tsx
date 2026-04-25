import React, { useState } from "react";
import { resolveConstraint } from "../../utils";
import { OptionBadge } from "../primitives/Badge";
import { TextCellRead, TextCellEdit } from "./TextCell";
import { NumberCellRead, NumberCellEdit } from "./NumberCell";
import { SelectCellRead, SelectCellEdit } from "./SelectCell";
import { MultiSelectCellRead, MultiSelectCellEdit } from "./MultiSelectCell";
import {
  DateCellRead,
  DateCellEdit,
  TimeCellRead,
  TimeCellEdit,
} from "./DateCell";
import { CheckboxCell } from "./CheckboxCell";
import { ComputedCell } from "./ComputedCell";
import type { ColumnDef, Row } from "../../types";

type CellRendererProps<TData> = {
  row: Row<TData>;
  colDef: ColumnDef<TData>;
  value: unknown;
  computedValue?: unknown;
  isEditing: boolean;
  isError: boolean;
  errorMessage?: string | undefined;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  className?: string | undefined;
};

// ── Merge base row with its draft values for constraint resolution.
// Constraint functions like (row) => row.rfqDate must read the CURRENT
// edited value, not the last-saved server value. _draft holds pending
// changes — merging gives us the effective row the user sees.
function mergedRow<TData>(row: Row<TData>): Row<TData> {
  const draft = row["_draft"] as Record<string, unknown> | null | undefined;
  if (!draft) return row;
  return { ...row, ...draft };
}

// ── Error tooltip wrapper — shows tooltip on hover only
function WithErrorTooltip({
  isError,
  errorMessage,
  children,
}: {
  isError: boolean;
  errorMessage?: string | undefined;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  if (!isError || !errorMessage) {
    return <div className="rf-relative rf-h-full">{children}</div>;
  }

  return (
    <div
      className="rf-relative rf-h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip — only rendered when hovered to keep DOM clean */}
      {hovered && (
        <div
          style={
            {
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "8px",
              background: "#1E293B",
              color: "#F8FAFC",
              fontSize: 11,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              zIndex: 9999,
              pointerEvents: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,.2)",
              maxWidth: 260,
              whiteSpaceSafe: "normal",
            } as React.CSSProperties
          }
        >
          {errorMessage}
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 12,
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid #1E293B",
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}

export function CellRenderer<TData = Record<string, unknown>>({
  row,
  colDef,
  value,
  computedValue,
  isEditing,
  isError,
  errorMessage,
  onCommit,
  onCancel,
  className,
}: CellRendererProps<TData>) {
  // ── Custom render override
  if (isEditing && colDef.renderEditCell) {
    return (
      <div
        style={{ height: "100%", overflow: "visible" }}
        className={className}
      >
        {colDef.renderEditCell(
          value,
          row as unknown as TData,
          onCommit,
          onCancel,
        )}
      </div>
    );
  }
  if (!isEditing && colDef.renderCell) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          padding: "0 10px",
          fontSize: 12.5,
          color: "var(--rf-text-1)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        className={className}
      >
        {colDef.renderCell(value, row as unknown as TData)}
      </div>
    );
  }

  // ── Computed column
  // If editableWhenComputed=true, allow edit mode — formula still auto-calculates
  // when dependencies change, but user can manually override the value.
  if (colDef.computed && !(colDef.editableWhenComputed && isEditing)) {
    return (
      <ComputedCell
        value={computedValue}
        colDef={colDef as ColumnDef}
        {...(className !== undefined && { className })}
      />
    );
  }

  // ── Cell by type — all non-editing variants wrapped in WithErrorTooltip
  switch (colDef.type) {
    case "text":
      return isEditing ? (
        <TextCellEdit
          value={String(value ?? "")}
          placeholder={colDef.label + "…"}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.multiline !== undefined && {
            multiline: colDef.multiline,
          })}
          {...(colDef.rows !== undefined && { rows: colDef.rows })}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <TextCellRead
            value={value != null ? String(value) : null}
            {...(className !== undefined && { className })}
          />
        </WithErrorTooltip>
      );

    case "number":
      return isEditing ? (
        <NumberCellEdit
          value={value != null ? Number(value) : null}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.min !== undefined && {
            min: resolveConstraint(colDef.min, mergedRow(row)),
          })}
          {...(colDef.max !== undefined && {
            max: resolveConstraint(colDef.max, mergedRow(row)),
          })}
          {...(colDef.decimals !== undefined && { decimals: colDef.decimals })}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <NumberCellRead
            value={value != null ? Number(value) : null}
            showProgress={colDef.suffix === "%"}
            {...(colDef.suffix !== undefined && { suffix: colDef.suffix })}
            {...(colDef.prefix !== undefined && { prefix: colDef.prefix })}
            {...(colDef.decimals !== undefined && {
              decimals: colDef.decimals,
            })}
            {...(className !== undefined && { className })}
          />
        </WithErrorTooltip>
      );

    case "select": {
      // ── Async select: value stored as { value: id, label: name } (SelectOption shape).
      // ── Static select: value stored as a plain string (the option's value).
      const isAsync = !!colDef.loadOptions;
      const storedObj =
        isAsync && value != null && typeof value === "object"
          ? (value as { value: string; label: string })
          : null;
      // id to pass to SelectCellEdit for matching/searching
      const selectId = storedObj
        ? storedObj.value
        : value != null
          ? String(value)
          : null;
      // human-readable label — passed to SelectCellEdit so it shows the name, not uuid
      const selectLabel = storedObj?.label ?? null;

      return isEditing ? (
        <SelectCellEdit
          value={selectId}
          currentLabel={selectLabel} // ← solves "shows uuid in edit mode"
          options={colDef.options ?? []}
          onCommit={(v, label) => {
            // Cleared (✕ clicked) — v is '' — store null so field is truly empty
            if (v === "") {
              onCommit(null);
              return;
            }
            // Async: store { value, label } so label is available for display
            // Static: store plain string — label resolved from options[] at render
            onCommit(isAsync ? { value: v, label: label ?? v } : v);
          }}
          onCancel={onCancel}
          {...(colDef.searchable !== undefined && {
            searchable: colDef.searchable,
          })}
          {...(colDef.clearable !== undefined && {
            isClearable: colDef.clearable,
          })}
          {...(colDef.loadOptions !== undefined && {
            loadOptions: colDef.loadOptions,
          })}
          {...(colDef.onCreateOption !== undefined && {
            onCreateOption: colDef.onCreateOption,
          })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          {isAsync && selectLabel ? (
            // Async read: show stored label — no options[] lookup needed
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                padding: "0 10px",
                fontSize: 12.5,
                color: "var(--rf-text-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectLabel}
            </div>
          ) : (
            // Static read: look up label from options[]
            <SelectCellRead
              value={value != null ? String(value) : null}
              {...(colDef.options !== undefined && { options: colDef.options })}
              {...(className !== undefined && { className })}
            />
          )}
        </WithErrorTooltip>
      );
    }

    case "multiselect": {
      // Async multiselect stores SelectOption[] ({ value, label }[]).
      // Static multiselect stores string[].
      const isAsyncMulti = !!colDef.loadOptions;
      // Normalise to string[] for MultiSelectCellEdit (it re-normalises internally)
      const multiVal = Array.isArray(value) ? (value as unknown[]) : [];
      // For read mode: extract id strings and pass options so labels can be resolved
      const multiReadVals: string[] = isAsyncMulti
        ? multiVal
            .filter(
              (v): v is { value: string; label: string } =>
                v != null && typeof v === "object" && "value" in (v as object),
            )
            .map((v) => v.value)
        : (multiVal as string[]);

      return isEditing ? (
        <MultiSelectCellEdit
          value={multiVal as string[]}
          options={colDef.options ?? []}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.searchable !== undefined && {
            searchable: colDef.searchable,
          })}
          {...(colDef.clearable !== undefined && {
            isClearable: colDef.clearable,
          })}
          {...(colDef.loadOptions !== undefined && {
            loadOptions: colDef.loadOptions,
          })}
          {...(colDef.onCreateOption !== undefined && {
            onCreateOption: colDef.onCreateOption,
          })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          {isAsyncMulti ? (
            // Async read: show stored labels directly without options[] lookup
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: "100%",
                padding: "0 8px",
                overflow: "hidden",
              }}
            >
              {multiVal.length === 0 ? (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--rf-text-3)",
                    fontStyle: "italic",
                  }}
                >
                  Add tags…
                </span>
              ) : (
                (multiVal as { value: string; label: string }[])
                  .filter(
                    (v) => v != null && typeof v === "object" && "label" in v,
                  )
                  .slice(0, 3)
                  .map((opt) => (
                    <span
                      key={opt.value}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 10.5,
                        fontWeight: 500,
                        padding: "1px 7px",
                        borderRadius: 20,
                        border: "1px solid var(--rf-border)",
                        background: "var(--rf-header)",
                        color: "var(--rf-text-2)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {opt.label}
                    </span>
                  ))
              )}
              {multiVal.length > 3 && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--rf-text-3)",
                    flexShrink: 0,
                  }}
                >
                  +{multiVal.length - 3}
                </span>
              )}
            </div>
          ) : (
            <MultiSelectCellRead
              value={multiReadVals}
              {...(colDef.options !== undefined && { options: colDef.options })}
              {...(className !== undefined && { className })}
            />
          )}
        </WithErrorTooltip>
      );
    }

    case "date":
      return isEditing ? (
        <DateCellEdit
          value={value != null ? String(value) : null}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.minDate !== undefined && {
            minDate: resolveConstraint(colDef.minDate, mergedRow(row)),
          })}
          {...(colDef.maxDate !== undefined && {
            maxDate: resolveConstraint(colDef.maxDate, mergedRow(row)),
          })}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <DateCellRead
            value={value != null ? String(value) : null}
            {...(className !== undefined && { className })}
          />
        </WithErrorTooltip>
      );

    case "time":
      return isEditing ? (
        <TimeCellEdit
          value={value != null ? String(value) : null}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <TimeCellRead
            value={value != null ? String(value) : null}
            {...(className !== undefined && { className })}
          />
        </WithErrorTooltip>
      );

    case "checkbox":
      return (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <CheckboxCell
            value={!!value}
            onChange={(v) => onCommit(v)}
            {...(className !== undefined && { className })}
          />
        </WithErrorTooltip>
      );

    // ── Email — text input + mailto link in read mode
    case "email":
      return isEditing ? (
        <TextCellEdit
          value={String(value ?? "")}
          placeholder="email@example.com"
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <div className="rf-flex rf-items-center px-[10px] rf-h-full rf-min-w-0">
            {value ? (
              <a
                href={`mailto:${value}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[12.5px] text-rf-accent hover:underline rf-truncate"
                title={String(value)}
              >
                {String(value)}
              </a>
            ) : (
              <span className="text-[12px] text-rf-text-3 rf-italic">—</span>
            )}
          </div>
        </WithErrorTooltip>
      );

    // ── URL — text input + clickable link in read mode
    case "url":
      return isEditing ? (
        <TextCellEdit
          value={String(value ?? "")}
          placeholder="https://example.com"
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <div className="rf-flex rf-items-center px-[10px] rf-h-full rf-min-w-0">
            {value ? (
              <a
                href={
                  String(value).startsWith("http")
                    ? String(value)
                    : `https://${value}`
                }
                target={colDef.openInNewTab !== false ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[12.5px] text-rf-accent hover:underline rf-truncate"
                title={String(value)}
              >
                {String(value)}
              </a>
            ) : (
              <span className="text-[12px] text-rf-text-3 rf-italic">—</span>
            )}
          </div>
        </WithErrorTooltip>
      );

    // ── Currency — number formatted as currency
    case "currency": {
      const currCode = colDef.currency ?? "USD";
      const currLocale = colDef.locale ?? "en-US";
      return isEditing ? (
        <NumberCellEdit
          value={value != null ? Number(value) : null}
          min={resolveConstraint(colDef.min, mergedRow(row))}
          max={resolveConstraint(colDef.max, mergedRow(row))}
          decimals={colDef.decimals ?? 2}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <div className="rf-flex rf-items-center justify-end px-[10px] rf-h-full">
            <span className="text-[12.5px] rf-font-mono text-rf-text-1">
              {value != null && isFinite(Number(value)) ? (
                Intl.NumberFormat(currLocale, {
                  style: "currency",
                  currency: currCode,
                  minimumFractionDigits: colDef.decimals ?? 2,
                  maximumFractionDigits: colDef.decimals ?? 2,
                }).format(Number(value))
              ) : (
                <span className="text-rf-text-3 rf-italic">—</span>
              )}
            </span>
          </div>
        </WithErrorTooltip>
      );
    }

    // ── Percentage — number shown as N%
    case "percentage":
      return isEditing ? (
        <NumberCellEdit
          value={value != null ? Number(value) : null}
          min={resolveConstraint(colDef.min, mergedRow(row)) ?? 0}
          max={resolveConstraint(colDef.max, mergedRow(row)) ?? 100}
          decimals={colDef.decimals ?? 1}
          suffix="%"
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(className !== undefined && { className })}
        />
      ) : (
        <WithErrorTooltip isError={isError} errorMessage={errorMessage}>
          <div className="rf-flex rf-items-center px-[10px] rf-h-full rf-gap-2">
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: "var(--rf-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  background: "var(--rf-accent)",
                  width: `${Math.min(100, Math.max(0, Number(value ?? 0)))}%`,
                  transition: "width 300ms ease",
                }}
              />
            </div>
            <span className="text-[11.5px] rf-font-mono text-rf-text-1 rf-flex-shrink-0">
              {value != null
                ? `${Number(value).toFixed(colDef.decimals ?? 1)}%`
                : "—"}
            </span>
          </div>
        </WithErrorTooltip>
      );

    // ── Rating — 1–N stars
    case "rating": {
      const maxStars = colDef.ratingMax ?? 5;
      const rating = Math.round(Number(value ?? 0));
      return isEditing ? (
        <div className="rf-flex rf-items-center px-[10px] rf-h-full gap-0.5">
          {Array.from({ length: maxStars }, (_, i) => (
            <button
              key={i}
              onClick={() => onCommit(rating === i + 1 ? 0 : i + 1)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 1px",
                fontSize: 18,
                lineHeight: 1,
                color: i < rating ? "#F59E0B" : "var(--rf-border)",
                transition: "color 100ms",
              }}
              title={`Rate ${i + 1} of ${maxStars}`}
            >
              ★
            </button>
          ))}
        </div>
      ) : (
        <div className="rf-flex rf-items-center px-[10px] rf-h-full gap-px">
          {Array.from({ length: maxStars }, (_, i) => (
            <span
              key={i}
              style={{
                fontSize: 14,
                color: i < rating ? "#F59E0B" : "var(--rf-border)",
              }}
            >
              ★
            </span>
          ))}
          {rating > 0 && (
            <span className="text-[11px] text-rf-text-3 ml-1">
              {rating}/{maxStars}
            </span>
          )}
        </div>
      );
    }

    // ── Badge — read-only enum display (like select but never editable)
    case "badge": {
      const opt = colDef.options?.find((o) => o.value === String(value ?? ""));
      const label = opt?.label ?? (value != null ? String(value) : null);
      return (
        <div className="rf-flex rf-items-center px-[10px] rf-h-full">
          {label ? (
            opt ? (
              // Has matching option — render with full color support via OptionBadge
              <OptionBadge option={opt} />
            ) : (
              // No matching option — plain text
              <span style={{ fontSize: 12.5, color: "var(--rf-text-1)" }}>
                {label}
              </span>
            )
          ) : (
            <span
              style={{
                fontSize: 12,
                color: "var(--rf-text-3)",
                fontStyle: "italic",
              }}
            >
              —
            </span>
          )}
        </div>
      );
    }

    // ── Progress — 0–100 read-only progress bar
    case "progress": {
      const pct = Math.min(100, Math.max(0, Number(value ?? 0)));
      const color =
        pct >= 100
          ? "var(--rf-ok)"
          : pct >= 66
            ? "var(--rf-accent)"
            : pct >= 33
              ? "#F59E0B"
              : "var(--rf-err)";
      return (
        <div className="rf-flex rf-items-center px-[10px] rf-h-full rf-gap-2">
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: "var(--rf-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                background: color,
                width: `${pct}%`,
                transition: "width 300ms ease",
              }}
            />
          </div>
          <span
            className="text-[11px] rf-font-mono text-rf-text-2 rf-flex-shrink-0"
            style={{ minWidth: 32, textAlign: "right" }}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      );
    }

    default:
      return (
        <div className="rf-flex rf-items-center px-[10px] rf-h-full">
          <span className="text-[13px] text-rf-text-1">
            {String(value ?? "")}
          </span>
        </div>
      );
  }
}
