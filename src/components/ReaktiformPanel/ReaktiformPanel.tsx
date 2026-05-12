"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  MessageSquare,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileCheck,
  File,
  Upload,
  Send,
  AlertCircle,
  Check,
  Lock,
} from "lucide-react";
import { cn, resolveConstraint } from "../../utils";
import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import {
  cachedLoadOptions,
  invalidateLoadOptionsCache,
  makeSelectStyles,
} from "../cells/SelectCell";
import { buildZodSchema } from "../../validation/buildZodSchema";
import { OptionBadge } from "../primitives/Badge";
import type { ColumnDef, Row, RowComment, RowAttachment } from "../../types";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────
type PMFormTab = "details" | "activity" | "attachments";

export type ReaktiformPanelProps<TData = Record<string, unknown>> = {
  row: Row<TData> | null;
  columns: ColumnDef<TData>[];
  rowIdKey?: string;
  isOpen: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSave: (rowId: string, draft: Record<string, unknown>) => void;
  onDiscard: (rowId: string) => void;
  /**
   * Called on every field change in the detail panel form.
   * Use this to update the table row live as the user types.
   * The grid wires this to grid.markDirty internally.
   */
  onFieldChange?: (rowId: string, field: string, value: unknown) => void;
  onAddComment?: (rowId: string, text: string) => void;
  onUploadFile?: (rowId: string, file: File) => void;
  onDeleteAttachment?: (rowId: string, attachmentId: string) => void;
  width?: number;
  className?: string | undefined;
  // ── Tab control
  /**
   * Which tabs to show. Defaults to all: ['details', 'activity', 'files'].
   * Tabs are also auto-hidden when their callback is missing.
   */
  panelTabs?: Array<"details" | "activity" | "files"> | undefined;
  // ── Permission control
  /** Allow saving from the panel. Default: true */
  canSave?: boolean;
  /** Allow editing fields in the panel. Default: true */
  canEdit?: boolean;
  /** Allow adding comments. Default: true */
  canComment?: boolean;
  /** Allow uploading files. Default: true */
  canUploadFiles?: boolean;
};

// ─────────────────────────────────────────────────────────────
//  SHARED STYLES
//  Use rf-input / rf-input-error CSS classes defined in reaktiform.css
//  instead of Tailwind utility strings — these survive any consumer reset.
// ─────────────────────────────────────────────────────────────
const inputBase = "rf-input";
const inputError = "rf-input-error";

// ─────────────────────────────────────────────────────────────
//  FORM FIELD WRAPPER
// ─────────────────────────────────────────────────────────────
function FormField({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean | undefined;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <label className="rf-flex rf-items-center rf-gap-1 text-[11px] rf-font-semibold text-rf-text-2 rf-uppercase tracking-[.04em] mb-1.5">
        {label}
        {required && <span className="text-rf-err rf-font-bold">*</span>}
      </label>
      {children}
      {error && (
        <div className="rf-flex rf-items-center rf-gap-1 mt-1 text-[11px] text-rf-err">
          <AlertCircle className="w-[11px] h-[11px] rf-flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  DETAILS TAB
// ─────────────────────────────────────────────────────────────
function DetailsTab<TData = Record<string, unknown>>({
  row,
  rowId,
  columns,
  onSave,
  onFieldChange,
  resetKey,
}: {
  row: Row<TData>;
  rowId: string;
  columns: ColumnDef<TData>[];
  onSave: (data: Record<string, unknown>) => void;
  onFieldChange: (field: string, value: unknown) => void;
  resetKey: number; // increment to force form reset (Discard)
}) {
  const nonComputedCols = columns.filter((c) => !c.computed);
  const computedCols = columns.filter((c) => c.computed);
  const schema = buildZodSchema(nonComputedCols);

  const buildDefaults = () => {
    const vals: Record<string, unknown> = {};
    nonComputedCols.forEach((col) => {
      const k = col.key as string;
      vals[k] = row._draft?.[k] ?? (row as Record<string, unknown>)[k];
    });
    return vals;
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // Reset form whenever resetKey increments (Discard was clicked) or row changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    reset(buildDefaults());
  }, [resetKey, rowId]);

  // Merge RHF errors with grid-level errors (row._errors) so the form
  // always shows errors that were set by inline editing or on save.
  const getFieldError = (k: string): string | undefined => {
    const rhfErr = (errors as Record<string, { message?: string }>)[k]?.message;
    if (rhfErr) return rhfErr;
    return row._errors?.[k];
  };

  const renderField = (col: ColumnDef<TData>) => {
    const k = col.key as string;
    const err = getFieldError(k);
    const currentVal = row._draft?.[k] ?? (row as Record<string, unknown>)[k];
    // Resolve readOnly — boolean or (row) => boolean
    const rowForConstraint = {
      ...(row as Record<string, unknown>),
      ...(row._draft ?? {}),
    };
    const isFieldReadOnly =
      col.readOnly === true ||
      (typeof col.readOnly === "function" &&
        col.readOnly(rowForConstraint as TData));

    // ── Custom renderEditCell — same as inline grid, takes priority
    if (col.renderEditCell) {
      return (
        <FormField
          key={k}
          label={col.label}
          required={col.required}
          error={err}
          className="rf-col-span-2"
        >
          {col.renderEditCell(
            currentVal,
            row as unknown as TData,
            (v) => {
              onFieldChange(k, v);
            }, // onCommit
            () => {}, // onCancel (no-op in panel)
          )}
        </FormField>
      );
    }

    // ── Read-only guard — applies to ALL field types.
    // When isFieldReadOnly, show a static display instead of an editable input.
    if (isFieldReadOnly) {
      const displayVal = currentVal != null ? String(currentVal) : "—";
      return (
        <FormField
          key={k}
          label={col.label}
          required={false}
          error={undefined}
          className="rf-col-span-2"
        >
          <div
            style={{
              padding: "6px 10px",
              fontSize: 12.5,
              color: "var(--rf-text-2)",
              background: "var(--rf-header)",
              borderRadius: 7,
              border: "1px solid var(--rf-border)",
              opacity: 0.72,
              minHeight: 34,
              display: "flex",
              alignItems: "center",
              fontStyle: "italic",
              userSelect: "none",
            }}
          >
            {displayVal}
          </div>
        </FormField>
      );
    }

    switch (col.type) {
      case "text":
      case "email":
      case "url":
        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="rf-col-span-2"
          >
            {col.multiline ? (
              <textarea
                {...register(k)}
                rows={col.rows ?? 3}
                placeholder={`Enter ${col.label.toLowerCase()}…`}
                className={cn(
                  inputBase,
                  "resize-y min-h-[70px]",
                  err && inputError,
                )}
                onChange={(e) => {
                  onFieldChange(k, e.target.value);
                }}
              />
            ) : (
              <input
                {...register(k)}
                type="text"
                placeholder={`Enter ${col.label.toLowerCase()}…`}
                className={cn(inputBase, err && inputError)}
                onChange={(e) => {
                  onFieldChange(k, e.target.value);
                }}
              />
            )}
          </FormField>
        );

      case "number":
      case "currency":
      case "percentage":
        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="rf-col-span-1"
          >
            {/* Wrapper positions prefix/suffix absolutely inside the input box */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              {col.prefix && (
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--rf-text-3)",
                    pointerEvents: "none",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {col.prefix}
                </span>
              )}
              <input
                {...register(k, { valueAsNumber: true })}
                type="number"
                {...(col.min !== undefined && {
                  min: resolveConstraint(col.min, row),
                })}
                {...(col.max !== undefined && {
                  max: resolveConstraint(col.max, row),
                })}
                placeholder="0"
                style={{
                  paddingLeft: col.prefix
                    ? `${col.prefix.length * 8 + 14}px`
                    : undefined,
                  paddingRight: col.suffix
                    ? `${col.suffix.length * 8 + 10}px`
                    : undefined,
                }}
                className={cn(
                  inputBase,
                  err && inputError,
                  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                )}
                onChange={(e) => {
                  onFieldChange(k, e.target.valueAsNumber);
                }}
              />
              {col.suffix && (
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--rf-text-3)",
                    pointerEvents: "none",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {col.suffix}
                </span>
              )}
            </div>
          </FormField>
        );

      case "select": {
        // Shared hardcoded styles — must be hardcoded because the menu renders
        // in document.body via portal where CSS vars are not available.
        const panelRsStyles = makeSelectStyles(true);

        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="rf-col-span-1"
          >
            <Controller
              name={k}
              control={control}
              render={({ field }) => {
                if (col.loadOptions) {
                  // Async select — value stored as { value, label } object
                  const storedObj =
                    field.value && typeof field.value === "object"
                      ? (field.value as { value: string; label: string })
                      : null;
                  const currentVal = storedObj
                    ? storedObj
                    : field.value
                      ? {
                          value: String(field.value),
                          label: String(field.value),
                        }
                      : null;

                  const onRSChange = (opt: any) => {
                    const committed = opt
                      ? { value: opt.value, label: opt.label }
                      : null;
                    field.onChange(committed);
                    onFieldChange(k, committed);
                  };
                  if (col.onCreateOption) {
                    return (
                      <AsyncCreatableSelect
                        value={currentVal}
                        loadOptions={cachedLoadOptions(col.loadOptions!)}
                        defaultOptions // calls loadOptions('') on open — shows initial list
                        cacheOptions // caches results so re-opens are instant (no API call)
                        isClearable={!!col.clearable}
                        placeholder="Search or create…"
                        menuPortalTarget={
                          typeof document !== "undefined" ? document.body : null
                        }
                        menuPosition="fixed"
                        styles={panelRsStyles}
                        onChange={onRSChange}
                        onCreateOption={async (input) => {
                          const created = await col.onCreateOption!(input);
                          if (col.loadOptions)
                            invalidateLoadOptionsCache(col.loadOptions);
                          const committed = {
                            value: created.value,
                            label: created.label,
                          };
                          field.onChange(committed);
                          onFieldChange(k, committed);
                        }}
                      />
                    );
                  }
                  return (
                    <AsyncSelect
                      value={currentVal}
                      loadOptions={cachedLoadOptions(col.loadOptions!)}
                      defaultOptions
                      cacheOptions
                      isClearable={!!col.clearable}
                      placeholder="Search…"
                      menuPortalTarget={
                        typeof document !== "undefined" ? document.body : null
                      }
                      menuPosition="fixed"
                      styles={panelRsStyles}
                      onChange={onRSChange}
                    />
                  );
                }

                // Static select — native <select>
                return (
                  <>
                    <select
                      {...field}
                      value={String(field.value ?? "")}
                      className={cn(
                        inputBase,
                        "appearance-none cursor-pointer pr-7",
                        err && inputError,
                      )}
                      onChange={(e) => {
                        field.onChange(e);
                        onFieldChange(k, e.target.value);
                      }}
                    >
                      <option value="">— Select —</option>
                      {(col.options ?? []).map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={opt.disabled}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {col.options?.find((o) => o.value === field.value)
                      ?.color && (
                      <div className="rf-mt-1.5">
                        <OptionBadge
                          option={
                            col.options!.find((o) => o.value === field.value)!
                          }
                        />
                      </div>
                    )}
                  </>
                );
              }}
            />
          </FormField>
        );
      }

      case "multiselect": {
        // Multi-select styles — same token object as single select

        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="rf-col-span-2"
          >
            <Controller
              name={k}
              control={control}
              render={({ field }) => {
                if (col.loadOptions) {
                  // Async multiselect — value is SelectOption[] ({ value, label }[])
                  // panelMultiStyles uses makeSelectStyles(true) for dark mode support
                  const panelMultiStyles = makeSelectStyles<true>(true);
                  const currentOpts: { value: string; label: string }[] =
                    Array.isArray(field.value)
                      ? (field.value as unknown[]).filter(
                          (v): v is { value: string; label: string } =>
                            v != null &&
                            typeof v === "object" &&
                            "value" in (v as object),
                        )
                      : [];

                  const handleMultiChange = (
                    vals: readonly { value: string; label: string }[],
                  ) => {
                    const committed = [...vals];
                    field.onChange(committed);
                    onFieldChange(k, committed);
                  };

                  if (col.onCreateOption) {
                    return (
                      <AsyncCreatableSelect
                        isMulti
                        value={currentOpts}
                        loadOptions={cachedLoadOptions(col.loadOptions!)}
                        defaultOptions
                        cacheOptions
                        isClearable={!!col.clearable}
                        placeholder="Search or create…"
                        menuPortalTarget={
                          typeof document !== "undefined" ? document.body : null
                        }
                        menuPosition="fixed"
                        styles={panelMultiStyles}
                        onChange={handleMultiChange as never}
                        onCreateOption={async (input) => {
                          const created = await col.onCreateOption!(input);
                          if (col.loadOptions)
                            invalidateLoadOptionsCache(col.loadOptions);
                          const committed = [
                            ...currentOpts,
                            { value: created.value, label: created.label },
                          ];
                          field.onChange(committed);
                          onFieldChange(k, committed);
                        }}
                      />
                    );
                  }
                  return (
                    <AsyncSelect
                      isMulti
                      value={currentOpts}
                      loadOptions={cachedLoadOptions(col.loadOptions!)}
                      defaultOptions
                      cacheOptions
                      isClearable={!!col.clearable}
                      placeholder="Search…"
                      menuPortalTarget={
                        typeof document !== "undefined" ? document.body : null
                      }
                      menuPosition="fixed"
                      styles={panelMultiStyles}
                      onChange={handleMultiChange as never}
                    />
                  );
                }

                // Static multiselect — pill toggles
                const current: string[] = Array.isArray(field.value)
                  ? (field.value as string[])
                  : [];
                return (
                  <div className="rf-flex-wrap rf-gap-1.5">
                    {(col.options ?? []).map((opt) => {
                      const isSel = current.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            const next = isSel
                              ? current.filter((v) => v !== opt.value)
                              : [...current, opt.value];
                            field.onChange(next);
                            onFieldChange(k, next);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 500,
                            padding: "4px 10px",
                            borderRadius: 20,
                            cursor: "pointer",
                            transition: "all 120ms",
                            border: `1px solid ${isSel ? "var(--rf-accent)" : "var(--rf-border)"}`,
                            background: isSel
                              ? "var(--rf-accent)"
                              : "var(--rf-header)",
                            color: isSel ? "#fff" : "var(--rf-text-2)",
                            opacity: opt.disabled ? 0.4 : 1,
                          }}
                        >
                          {isSel && <Check className="rf-icon-sm" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            />
          </FormField>
        );
      }

      case "date":
        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="rf-col-span-1"
          >
            <input
              {...register(k)}
              type="date"
              {...(col.minDate !== undefined && {
                min: resolveConstraint(col.minDate, row),
              })}
              {...(col.maxDate !== undefined && {
                max: resolveConstraint(col.maxDate, row),
              })}
              className={cn(inputBase, "font-mono", err && inputError)}
              onChange={(e) => {
                onFieldChange(k, e.target.value || null);
              }}
            />
          </FormField>
        );

      case "checkbox":
        return (
          <FormField key={k} label={col.label} className="rf-col-span-1">
            <div
              className={cn(
                inputBase,
                "flex items-center gap-2 cursor-pointer",
              )}
            >
              <input
                {...register(k)}
                type="checkbox"
                id={`form-${k}`}
                className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] rf-cursor-pointer"
                onChange={(e) => {
                  onFieldChange(k, e.target.checked);
                }}
              />
              <label
                htmlFor={`form-${k}`}
                className="text-[13px] text-rf-text-1 rf-cursor-pointer rf-font-medium"
              >
                {col.label}
              </label>
            </div>
          </FormField>
        );

      default:
        return null;
    }
  };

  return (
    <form
      id={`rf-details-form-${rowId}`}
      onSubmit={handleSubmit((data) => onSave(data as Record<string, unknown>))}
    >
      <div className="rf-grid-cols-2 gap-x-3">
        {nonComputedCols.map(renderField)}
      </div>

      {computedCols.length > 0 && (
        <>
          <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mt-4 mb-2.5 pb-1.5 border-b border-rf-border">
            Computed Values
          </div>
          <div className="rf-grid-cols-2 gap-x-3">
            {computedCols.map((col) => {
              const k = col.key as string;
              const val = (row as Record<string, unknown>)[k];
              return (
                <FormField key={k} label={col.label} className="rf-col-span-1">
                  <div
                    className={cn(
                      inputBase,
                      "bg-rf-header cursor-not-allowed flex items-center gap-1.5 text-rf-text-2",
                    )}
                  >
                    <Lock className="rf-icon-sm text-rf-text-3 rf-flex-shrink-0" />
                    <span className="rf-font-mono text-[12.5px]">
                      {val !== null && val !== undefined ? String(val) : "—"}
                    </span>
                    <span className="rf-ml-auto text-[9px] rf-font-bold text-rf-text-3 border border-rf-border rounded px-1">
                      fx
                    </span>
                  </div>
                </FormField>
              );
            })}
          </div>
        </>
      )}
      {/* Extra bottom padding so last field isn't hidden behind the footer bar */}
      <div style={{ height: 16 }} />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  ACTIVITY TAB
// ─────────────────────────────────────────────────────────────
const AV_COLORS = [
  "bg-rf-accent-bg text-rf-accent",
  "bg-rf-ok-bg text-green-600",
  "bg-rf-purple-bg text-purple-600",
  "bg-amber-50 text-amber-600",
  "bg-teal-50 text-teal-600",
];

function ActivityTab({
  rowId,
  comments,
  onAddComment,
  canComment = true,
}: {
  rowId: string;
  comments: RowComment[];
  onAddComment?: (rowId: string, text: string) => void;
  canComment?: boolean;
}) {
  const [text, setText] = useState("");
  const post = () => {
    if (!text.trim()) return;
    onAddComment?.(rowId, text.trim());
    setText("");
  };

  return (
    <div>
      <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mb-3 pb-1.5 border-b border-rf-border">
        Activity Log
      </div>
      {comments.length === 0 && (
        <div className="text-center py-8 text-[12.5px] text-rf-text-3 rf-italic">
          No activity yet
        </div>
      )}
      <div className="rf-flex-col divide-y divide-rf-border">
        {comments.map((c, i) => {
          const avClass = AV_COLORS[i % AV_COLORS.length] ?? AV_COLORS[0]!;
          const initials = c.author
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={c.id} className="rf-flex rf-gap-2.5 py-2.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0",
                  avClass,
                )}
              >
                {initials}
              </div>
              <div className="rf-flex-1 rf-min-w-0">
                <div className="rf-flex rf-items-center rf-gap-2 mb-1">
                  <span className="text-[12px] rf-font-semibold text-rf-text-1">
                    {c.author}
                  </span>
                  <span className="text-[11px] text-rf-text-3">
                    {c.createdAt}
                  </span>
                </div>
                <p className="text-[12.5px] text-rf-text-2 leading-relaxed">
                  {c.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {onAddComment && canComment && (
        <div className="mt-4 border-t border-rf-border pt-3">
          <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mb-2">
            Add Comment
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
            className={cn(inputBase, "resize-none w-full mb-2")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post();
            }}
          />
          <button
            type="button"
            onClick={post}
            disabled={!text.trim()}
            className="rf-inline-flex rf-items-center rf-gap-1.5 px-3 py-1.5 text-[12.5px] rf-font-semibold rounded-rf-md bg-rf-accent text-white hover:bg-rf-accent-hover disabled:opacity-40 disabled:rf-cursor-not-allowed rf-transition-colors"
          >
            <Send className="rf-icon-sm" /> Post
          </button>
          <span className="ml-2 text-[11px] text-rf-text-3">or Ctrl+Enter</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ATTACHMENTS TAB
// ─────────────────────────────────────────────────────────────
const ATTACH_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  docx: FileCheck,
  doc: FileCheck,
};
const ATTACH_COLORS: Record<string, string> = {
  pdf: "bg-red-50 text-red-600",
  xlsx: "bg-green-50 text-green-600",
  xls: "bg-green-50 text-green-600",
  docx: "bg-blue-50 text-blue-600",
  doc: "bg-blue-50 text-blue-600",
};

function AttachmentsTab({
  rowId,
  attachments,
  onUploadFile,
  onDeleteAttachment,
  canUploadFiles = true,
}: {
  rowId: string;
  attachments: RowAttachment[];
  onUploadFile?: (rowId: string, file: File) => void;
  onDeleteAttachment?: (rowId: string, id: string) => void;
  canUploadFiles?: boolean;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canUploadFiles) return;
    const file = e.dataTransfer.files[0];
    if (file) onUploadFile?.(rowId, file);
  };
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUploadFiles) return;
    const file = e.target.files?.[0];
    if (file) onUploadFile?.(rowId, file);
  };

  return (
    <div>
      <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mb-3 pb-1.5 border-b border-rf-border">
        Files ({attachments.length})
      </div>
      <div className="rf-flex-col rf-gap-1.5 mb-4">
        {attachments.length === 0 && (
          <div className="text-center py-6 text-[12.5px] text-rf-text-3 rf-italic">
            No files attached
          </div>
        )}
        {attachments.map((a) => {
          const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
          const IconComp = ATTACH_ICONS[ext] ?? File;
          const colorClass =
            ATTACH_COLORS[ext] ?? "bg-rf-header text-rf-text-2";
          return (
            <div
              key={a.id}
              className="rf-flex rf-items-center rf-gap-2.5 p-2.5 border border-rf-border rounded-rf-md hover:bg-rf-row-hover rf-transition-colors group"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-rf-sm flex items-center justify-center flex-shrink-0",
                  colorClass,
                )}
              >
                <IconComp className="rf-icon-lg" />
              </div>
              <div className="rf-flex-1 rf-min-w-0">
                <div className="text-[12.5px] rf-font-medium text-rf-text-1 rf-truncate">
                  {a.name}
                </div>
                <div className="text-[11px] text-rf-text-3">{a.size}</div>
              </div>
              {onDeleteAttachment && (
                <button
                  type="button"
                  onClick={() => onDeleteAttachment(rowId, a.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-rf-text-3 hover:text-rf-err hover:bg-rf-err-bg transition-all"
                  title="Remove"
                >
                  <X className="rf-icon-sm.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onUploadFile && canUploadFiles && (
        <label
          className="rf-flex-col rf-items-center rf-justify-center rf-gap-2 border-2 border-dashed border-rf-border rounded-rf-lg p-6 rf-cursor-pointer transition-all hover:border-rf-accent hover:bg-rf-accent-bg hover:text-rf-accent text-rf-text-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="w-5 h-5" />
          <span className="text-[12.5px] rf-font-medium">
            Click to upload or drag & drop
          </span>
          <span className="text-[11px]">PDF, DOCX, XLSX, PNG, JPG</span>
          <input type="file" className="rf-hidden" onChange={handlePick} />
        </label>
      )}
      {onUploadFile && !canUploadFiles && (
        <div className="rf-flex rf-items-center rf-justify-center rf-gap-2 border border-rf-border rounded-rf-lg p-4 text-rf-text-3 text-[12.5px]">
          <Lock className="rf-icon-sm.5" /> You do not have permission to upload
          files
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN ReaktiformPanel
// ─────────────────────────────────────────────────────────────
export function ReaktiformPanel<TData = Record<string, unknown>>({
  row,
  columns,
  rowIdKey = "id",
  isOpen,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
  onSave,
  onDiscard,
  onFieldChange,
  onAddComment,
  onUploadFile,
  onDeleteAttachment,
  width = 440,
  className,
  panelTabs,
  canSave = true,
  canEdit = true,
  canComment = true,
  canUploadFiles = true,
}: ReaktiformPanelProps<TData>) {
  const [activeTab, setActiveTab] = useState<PMFormTab>("details");
  // Incremented when Discard is clicked — forces DetailsTab to reset RHF state
  const [resetKey, setResetKey] = useState(0);

  const rowId = row
    ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
    : "";
  const description = row
    ? String((row as Record<string, unknown>)["description"] ?? "")
    : "";
  const rowLabel = row
    ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
    : "";
  const isDirty = !!row?._draft;
  const hasErrors = Object.keys(row?._errors ?? {}).length > 0;

  // Build the visible tabs list:
  // 1. Filter by panelTabs prop (if provided)
  // 2. Auto-hide Activity if no comment callback
  // 3. Auto-hide Files if no upload callback
  const ALL_TABS: { id: PMFormTab; label: string; icon: React.ElementType }[] =
    [
      { id: "details", label: "Details", icon: FileCheck },
      { id: "activity", label: "Activity", icon: MessageSquare },
      { id: "attachments", label: "Files", icon: Paperclip },
    ];

  const TABS = ALL_TABS.filter((tab) => {
    // panelTabs prop: explicit whitelist
    if (panelTabs) {
      const mapId = tab.id === "attachments" ? "files" : tab.id;
      if (!panelTabs.includes(mapId as "details" | "activity" | "files"))
        return false;
    }
    // Auto-hide tabs whose feature callbacks are absent
    if (tab.id === "activity" && !onAddComment) return false;
    if (tab.id === "attachments" && !onUploadFile) return false;
    return true;
  });

  // If current active tab was hidden, reset to details
  useEffect(() => {
    if (!TABS.find((t) => t.id === activeTab)) {
      setActiveTab("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTabs, onAddComment, onUploadFile]);

  return (
    <>
      {/* Backdrop — only visible when open, click to close */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 149,
          background: "rgba(15,23,42,.25)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.22s ease",
        }}
      />

      {/* Panel — always in DOM, translated off-screen when closed */}
      <div
        data-reaktiform
        className={cn(
          "fixed right-0 top-14 bottom-0 bg-rf-surface",
          "border-l border-rf-border shadow-rf-lg z-[150]",
          "flex flex-col overflow-hidden",
          className,
        )}
        style={{
          width,
          transform: isOpen ? "translateX(0)" : `translateX(${width + 2}px)`,
          transition: "transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)",
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        {/* HEADER */}
        <div className="rf-flex rf-items-center rf-gap-2 px-4 py-3 border-b border-rf-border bg-rf-header rf-flex-shrink-0">
          <div className="rf-flex-1 rf-min-w-0">
            <div className="rf-flex rf-items-center rf-gap-2 mb-0.5">
              <span className="text-[10.5px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em]">
                {rowLabel}
              </span>
              {isDirty && !hasErrors && (
                <span className="text-[10px] rf-font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Unsaved
                </span>
              )}
              {hasErrors && (
                <span className="text-[10px] rf-font-bold bg-rf-err-bg text-rf-err border border-rf-err-br rounded-full px-1.5 py-0.5">
                  Errors
                </span>
              )}
            </div>
            <div className="text-[14px] rf-font-semibold text-rf-text-1 rf-truncate">
              {description || "Record Details"}
            </div>
          </div>
          <div className="rf-flex rf-gap-1 rf-flex-shrink-0">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronLeft className="w-[13px] h-[13px]" />
            </button>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronRight className="w-[13px] h-[13px]" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-rf-md border border-rf-border bg-transparent rf-flex rf-items-center rf-justify-center text-rf-text-3 hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br rf-transition-colors"
          >
            <X className="w-[13px] h-[13px]" />
          </button>
        </div>

        {/* TABS */}
        <div className="rf-flex border-b border-rf-border bg-rf-surface rf-flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-all border-b-2",
                activeTab === id
                  ? "text-rf-accent border-rf-accent font-semibold"
                  : "text-rf-text-3 border-transparent hover:text-rf-text-2",
              )}
            >
              <Icon className="rf-icon-sm.5" />
              {label}
            </button>
          ))}
        </div>

        {/* TAB BODY — scrollable */}
        <div
          className="rf-flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {row && activeTab === "details" && (
            // key={rowId} forces React to unmount+remount DetailsTab when row changes.
            // This resets React Hook Form with fresh defaultValues for the new row.
            // Without this, useForm keeps stale values from the previous row.
            <DetailsTab
              key={rowId}
              row={row}
              rowId={rowId}
              columns={columns}
              resetKey={resetKey}
              onFieldChange={(field, value) => {
                // Call parent's onFieldChange so the table reflects changes immediately
                // This calls grid.markDirty on every keystroke → table updates live
                onFieldChange?.(rowId, field, value);
              }}
              onSave={(data) => onSave(rowId, data)}
            />
          )}
          {row && activeTab === "activity" && (
            <ActivityTab
              rowId={rowId}
              comments={row._comments ?? []}
              canComment={canComment}
              {...(onAddComment !== undefined && { onAddComment })}
            />
          )}
          {row && activeTab === "attachments" && (
            <AttachmentsTab
              rowId={rowId}
              attachments={row._attachments ?? []}
              canUploadFiles={canUploadFiles}
              {...(onUploadFile !== undefined && { onUploadFile })}
              {...(onDeleteAttachment !== undefined && { onDeleteAttachment })}
            />
          )}
          {!row && (
            <div className="rf-flex-col rf-items-center rf-justify-center rf-h-full text-rf-text-3 rf-gap-3">
              <FileCheck className="w-10 h-10 opacity-30" />
              <span className="text-[13px]">Select a row to view details</span>
            </div>
          )}
        </div>

        {/* PANEL FOOTER — always visible at bottom, never scrolls away. */}
        {row && activeTab === "details" && (
          <div
            className="rf-flex-shrink-0 rf-flex rf-gap-2 px-4 py-3 border-t border-rf-border bg-rf-surface"
            style={{ boxShadow: "0 -4px 12px rgba(15,23,42,.06)" }}
          >
            {canEdit && canSave ? (
              (() => {
                const isSavingRow = !!row._saving;
                return (
                  <>
                    <button
                      type="submit"
                      form={`rf-details-form-${rowId}`}
                      disabled={isSavingRow}
                      className="rf-flex-1 rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 py-2.5 text-[13px] rf-font-semibold rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      {isSavingRow ? (
                        <>
                          <svg
                            style={{
                              width: 14,
                              height: 14,
                              animation: "rf-spin 0.8s linear infinite",
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeDasharray="32"
                              strokeDashoffset="12"
                              strokeLinecap="round"
                            />
                          </svg>
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="rf-icon-sm.5" /> Save Changes
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingRow}
                      onClick={() => {
                        onDiscard(rowId);
                        setResetKey((k) => k + 1);
                      }}
                      className="rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 px-4 py-2.5 text-[13px] rf-font-medium rounded-rf-md bg-rf-surface text-rf-text-2 border border-rf-border hover:bg-rf-header rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      <RotateCcw className="rf-icon-sm.5" /> Discard
                    </button>
                  </>
                );
              })()
            ) : (
              <div className="rf-flex-1 rf-flex rf-items-center rf-justify-center rf-gap-2 py-2 text-[12.5px] text-rf-text-3">
                <Lock className="rf-icon-sm.5" />
                {!canEdit
                  ? "Read-only — you do not have edit permission"
                  : "Saving is disabled"}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
