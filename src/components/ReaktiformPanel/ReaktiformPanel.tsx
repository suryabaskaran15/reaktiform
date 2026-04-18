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
import { cn } from "../../utils";
import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import {
  cachedLoadOptions,
  invalidateLoadOptionsCache,
} from "../cells/SelectCell";
import type { StylesConfig } from "react-select";
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
      <label className="flex items-center gap-1 text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
        {label}
        {required && <span className="text-rf-err font-bold">*</span>}
      </label>
      {children}
      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-rf-err">
          <AlertCircle className="w-[11px] h-[11px] flex-shrink-0" />
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

    // ── Custom renderEditCell — same as inline grid, takes priority
    if (col.renderEditCell) {
      return (
        <FormField
          key={k}
          label={col.label}
          required={col.required}
          error={err}
          className="col-span-2"
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
            className="col-span-2"
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
            className="col-span-1"
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
                {...(col.min !== undefined && { min: col.min })}
                {...(col.max !== undefined && { max: col.max })}
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
        const panelRsStyles: StylesConfig = {
          container: (b: Record<string, unknown>) => ({ ...b, width: "100%" }),
          control: (b: Record<string, unknown>, s: { isFocused: boolean }) => ({
            ...b,
            minHeight: 34,
            fontSize: 12.5,
            border: `1.5px solid ${err ? "#DC2626" : s.isFocused ? "#3B5BDB" : "#E2E5ED"}`,
            borderRadius: 7,
            background: "#F4F6FA",
            boxShadow: s.isFocused ? "0 0 0 3px rgba(59,91,219,.12)" : "none",
            "&:hover": { borderColor: "#3B5BDB" },
            cursor: "pointer",
          }),
          valueContainer: (b: Record<string, unknown>) => ({
            ...b,
            padding: "2px 8px",
          }),
          input: (b: Record<string, unknown>) => ({
            ...b,
            color: "#0F172A",
            fontSize: 12.5,
          }),
          singleValue: (b: Record<string, unknown>) => ({
            ...b,
            color: "#0F172A",
            fontSize: 12.5,
          }),
          placeholder: (b: Record<string, unknown>) => ({
            ...b,
            color: "#94A3B8",
            fontSize: 12,
            fontStyle: "italic",
          }),
          indicatorSeparator: () => ({ display: "none" }),
          dropdownIndicator: (b: Record<string, unknown>) => ({
            ...b,
            padding: "0 6px",
            color: "#94A3B8",
          }),
          clearIndicator: (b: Record<string, unknown>) => ({
            ...b,
            padding: "0 4px",
            color: "#94A3B8",
          }),
          menuPortal: (b: Record<string, unknown>) => ({
            ...b,
            zIndex: 9999,
            pointerEvents: "auto",
          }),
          menu: (b: Record<string, unknown>) => ({
            ...b,
            border: "1px solid #E2E5ED",
            boxShadow: "0 8px 32px rgba(15,23,42,.18)",
            borderRadius: 10,
            background: "#FFFFFF",
            overflow: "hidden",
            marginTop: 4,
          }),
          menuList: (b: Record<string, unknown>) => ({
            ...b,
            padding: "4px 0",
            maxHeight: 260,
            overflowY: "auto",
          }),
          option: (
            b: Record<string, unknown>,
            s: { isSelected: boolean; isFocused: boolean },
          ) => ({
            ...b,
            padding: "8px 12px",
            fontSize: 12.5,
            cursor: "pointer",
            background: s.isSelected
              ? "#EEF2FF"
              : s.isFocused
                ? "#F8FAFF"
                : "transparent",
            color: s.isSelected ? "#3B5BDB" : "#0F172A",
          }),
          noOptionsMessage: (b: Record<string, unknown>) => ({
            ...b,
            fontSize: 12.5,
            color: "#94A3B8",
            padding: "8px 12px",
          }),
          loadingMessage: (b: Record<string, unknown>) => ({
            ...b,
            fontSize: 12.5,
            color: "#94A3B8",
            padding: "8px 12px",
          }),
        };

        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="col-span-1"
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
                        isClearable
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
                      isClearable
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
                      <div className="mt-1.5">
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
        const panelMultiStyles: StylesConfig = {
          container: (b: Record<string, unknown>) => ({ ...b, width: "100%" }),
          control: (b: Record<string, unknown>, s: { isFocused: boolean }) => ({
            ...b,
            minHeight: 34,
            fontSize: 12.5,
            border: `1.5px solid ${err ? "#DC2626" : s.isFocused ? "#3B5BDB" : "#E2E5ED"}`,
            borderRadius: 7,
            background: "#F4F6FA",
            boxShadow: s.isFocused ? "0 0 0 3px rgba(59,91,219,.12)" : "none",
            "&:hover": { borderColor: "#3B5BDB" },
            cursor: "pointer",
            flexWrap: "wrap",
          }),
          valueContainer: (b: Record<string, unknown>) => ({
            ...b,
            padding: "2px 8px",
            gap: 2,
            flexWrap: "wrap",
            overflow: "visible",
          }),
          input: (b: Record<string, unknown>) => ({
            ...b,
            color: "#0F172A",
            fontSize: 12.5,
          }),
          placeholder: (b: Record<string, unknown>) => ({
            ...b,
            color: "#94A3B8",
            fontSize: 12,
            fontStyle: "italic",
          }),
          multiValue: (b: Record<string, unknown>) => ({
            ...b,
            background: "#EEF2FF",
            borderRadius: 100,
            border: "1px solid #C7D2FE",
            margin: "1px 2px",
          }),
          multiValueLabel: (b: Record<string, unknown>) => ({
            ...b,
            color: "#3B5BDB",
            fontSize: 11,
            fontWeight: 600,
            padding: "1px 6px",
          }),
          multiValueRemove: (b: Record<string, unknown>) => ({
            ...b,
            color: "#3B5BDB",
            borderRadius: "0 100px 100px 0",
            "&:hover": { background: "#FFF1F2", color: "#DC2626" },
          }),
          indicatorSeparator: () => ({ display: "none" }),
          dropdownIndicator: (b: Record<string, unknown>) => ({
            ...b,
            padding: "0 6px",
            color: "#94A3B8",
          }),
          menuPortal: (b: Record<string, unknown>) => ({
            ...b,
            zIndex: 9999,
            pointerEvents: "auto",
          }),
          menu: (b: Record<string, unknown>) => ({
            ...b,
            border: "1px solid #E2E5ED",
            boxShadow: "0 8px 32px rgba(15,23,42,.18)",
            borderRadius: 10,
            background: "#FFFFFF",
            overflow: "hidden",
            marginTop: 4,
          }),
          menuList: (b: Record<string, unknown>) => ({
            ...b,
            padding: "4px 0",
            maxHeight: 260,
            overflowY: "auto",
          }),
          option: (
            b: Record<string, unknown>,
            s: { isSelected: boolean; isFocused: boolean },
          ) => ({
            ...b,
            padding: "8px 12px",
            fontSize: 12.5,
            cursor: "pointer",
            background: s.isSelected
              ? "#EEF2FF"
              : s.isFocused
                ? "#F8FAFF"
                : "transparent",
            color: s.isSelected ? "#3B5BDB" : "#0F172A",
          }),
          noOptionsMessage: (b: Record<string, unknown>) => ({
            ...b,
            fontSize: 12.5,
            color: "#94A3B8",
            padding: "8px 12px",
          }),
          loadingMessage: (b: Record<string, unknown>) => ({
            ...b,
            fontSize: 12.5,
            color: "#94A3B8",
            padding: "8px 12px",
          }),
        };

        return (
          <FormField
            key={k}
            label={col.label}
            required={col.required}
            error={err}
            className="col-span-2"
          >
            <Controller
              name={k}
              control={control}
              render={({ field }) => {
                if (col.loadOptions) {
                  // Async multiselect — value is SelectOption[] ({ value, label }[])
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
                        isClearable
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
                      isClearable
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
                  <div className="flex flex-wrap gap-1.5">
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
                            border: `1px solid ${isSel ? "#3B5BDB" : "#E2E5ED"}`,
                            background: isSel ? "#3B5BDB" : "#F1F3F9",
                            color: isSel ? "#fff" : "#475569",
                            opacity: opt.disabled ? 0.4 : 1,
                          }}
                        >
                          {isSel && <Check className="w-3 h-3" />}
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
            className="col-span-1"
          >
            <input
              {...register(k)}
              type="date"
              {...(col.minDate !== undefined && { min: col.minDate })}
              {...(col.maxDate !== undefined && { max: col.maxDate })}
              className={cn(inputBase, "font-mono", err && inputError)}
              onChange={(e) => {
                onFieldChange(k, e.target.value || null);
              }}
            />
          </FormField>
        );

      case "checkbox":
        return (
          <FormField key={k} label={col.label} className="col-span-1">
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
                className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] cursor-pointer"
                onChange={(e) => {
                  onFieldChange(k, e.target.checked);
                }}
              />
              <label
                htmlFor={`form-${k}`}
                className="text-[13px] text-rf-text-1 cursor-pointer font-medium"
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
      <div className="grid grid-cols-2 gap-x-3">
        {nonComputedCols.map(renderField)}
      </div>

      {computedCols.length > 0 && (
        <>
          <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em] mt-4 mb-2.5 pb-1.5 border-b border-rf-border">
            Computed Values
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            {computedCols.map((col) => {
              const k = col.key as string;
              const val = (row as Record<string, unknown>)[k];
              return (
                <FormField key={k} label={col.label} className="col-span-1">
                  <div
                    className={cn(
                      inputBase,
                      "bg-rf-header cursor-not-allowed flex items-center gap-1.5 text-rf-text-2",
                    )}
                  >
                    <Lock className="w-3 h-3 text-rf-text-3 flex-shrink-0" />
                    <span className="font-mono text-[12.5px]">
                      {val !== null && val !== undefined ? String(val) : "—"}
                    </span>
                    <span className="ml-auto text-[9px] font-bold text-rf-text-3 border border-rf-border rounded px-1">
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
      <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em] mb-3 pb-1.5 border-b border-rf-border">
        Activity Log
      </div>
      {comments.length === 0 && (
        <div className="text-center py-8 text-[12.5px] text-rf-text-3 italic">
          No activity yet
        </div>
      )}
      <div className="flex flex-col divide-y divide-rf-border">
        {comments.map((c, i) => {
          const avClass = AV_COLORS[i % AV_COLORS.length] ?? AV_COLORS[0]!;
          const initials = c.author
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={c.id} className="flex gap-2.5 py-2.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0",
                  avClass,
                )}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-rf-text-1">
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
          <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em] mb-2">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-rf-md bg-rf-accent text-white hover:bg-rf-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3 h-3" /> Post
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
      <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em] mb-3 pb-1.5 border-b border-rf-border">
        Files ({attachments.length})
      </div>
      <div className="flex flex-col gap-1.5 mb-4">
        {attachments.length === 0 && (
          <div className="text-center py-6 text-[12.5px] text-rf-text-3 italic">
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
              className="flex items-center gap-2.5 p-2.5 border border-rf-border rounded-rf-md hover:bg-rf-row-hover transition-colors group"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-rf-sm flex items-center justify-center flex-shrink-0",
                  colorClass,
                )}
              >
                <IconComp className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-rf-text-1 truncate">
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
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onUploadFile && canUploadFiles && (
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-rf-border rounded-rf-lg p-6 cursor-pointer transition-all hover:border-rf-accent hover:bg-rf-accent-bg hover:text-rf-accent text-rf-text-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="w-5 h-5" />
          <span className="text-[12.5px] font-medium">
            Click to upload or drag & drop
          </span>
          <span className="text-[11px]">PDF, DOCX, XLSX, PNG, JPG</span>
          <input type="file" className="hidden" onChange={handlePick} />
        </label>
      )}
      {onUploadFile && !canUploadFiles && (
        <div className="flex items-center justify-center gap-2 border border-rf-border rounded-rf-lg p-4 text-rf-text-3 text-[12.5px]">
          <Lock className="w-3.5 h-3.5" /> You do not have permission to upload
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
        <div className="flex items-center gap-2 px-4 py-3 border-b border-rf-border bg-rf-header flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10.5px] font-bold text-rf-text-3 uppercase tracking-[.06em]">
                {rowLabel}
              </span>
              {isDirty && !hasErrors && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Unsaved
                </span>
              )}
              {hasErrors && (
                <span className="text-[10px] font-bold bg-rf-err-bg text-rf-err border border-rf-err-br rounded-full px-1.5 py-0.5">
                  Errors
                </span>
              )}
            </div>
            <div className="text-[14px] font-semibold text-rf-text-1 truncate">
              {description || "Record Details"}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface flex items-center justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-[13px] h-[13px]" />
            </button>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface flex items-center justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-[13px] h-[13px]" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-rf-md border border-rf-border bg-transparent flex items-center justify-center text-rf-text-3 hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br transition-colors"
          >
            <X className="w-[13px] h-[13px]" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-rf-border bg-rf-surface flex-shrink-0">
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
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* TAB BODY — scrollable */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
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
            <div className="flex flex-col items-center justify-center h-full text-rf-text-3 gap-3">
              <FileCheck className="w-10 h-10 opacity-30" />
              <span className="text-[13px]">Select a row to view details</span>
            </div>
          )}
        </div>

        {/* PANEL FOOTER — always visible at bottom, never scrolls away. */}
        {row && activeTab === "details" && (
          <div
            className="flex-shrink-0 flex gap-2 px-4 py-3 border-t border-rf-border bg-rf-surface"
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
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                          <Save className="w-3.5 h-3.5" /> Save Changes
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
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium rounded-rf-md bg-rf-surface text-rf-text-2 border border-rf-border hover:bg-rf-header transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Discard
                    </button>
                  </>
                );
              })()
            ) : (
              <div className="flex-1 flex items-center justify-center gap-2 py-2 text-[12.5px] text-rf-text-3">
                <Lock className="w-3.5 h-3.5" />
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
