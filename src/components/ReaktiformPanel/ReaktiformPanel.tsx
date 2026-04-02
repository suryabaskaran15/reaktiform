"use client";

import React, { useState } from "react";
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
  onAddComment?: (rowId: string, text: string) => void;
  onUploadFile?: (rowId: string, file: File) => void;
  onDeleteAttachment?: (rowId: string, attachmentId: string) => void;
  width?: number;
  className?: string | undefined;
};

// ─────────────────────────────────────────────────────────────
//  SHARED STYLES
// ─────────────────────────────────────────────────────────────
const inputBase = [
  "w-full px-2.5 py-[7px] text-[13px]",
  "border border-rf-border rounded-rf-md bg-rf-bg text-rf-text-1",
  "outline-none transition-all duration-150",
  "focus:border-rf-accent focus:bg-rf-surface",
  "focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  "placeholder:text-rf-text-3",
].join(" ");

const inputError = [
  "border-rf-err bg-rf-err-bg",
  "focus:border-rf-err focus:shadow-[0_0_0_3px_rgba(220,38,38,.10)]",
].join(" ");

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
  required?: boolean;
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
  columns,
  onSave,
  onDiscard,
}: {
  row: Row<TData>;
  columns: ColumnDef<TData>[];
  onSave: (data: Record<string, unknown>) => void;
  onDiscard: () => void;
}) {
  const nonComputedCols = columns.filter((c) => !c.computed);
  const computedCols = columns.filter((c) => c.computed);
  const schema = buildZodSchema(nonComputedCols);

  const defaultValues: Record<string, unknown> = {};
  nonComputedCols.forEach((col) => {
    const k = col.key as string;
    defaultValues[k] = row._draft?.[k] ?? (row as Record<string, unknown>)[k];
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const renderField = (col: ColumnDef<TData>) => {
    const k = col.key as string;
    const err = (errors as Record<string, { message?: string }>)[k]?.message;

    switch (col.type) {
      case "text":
        return (
          <FormField
            key={k}
            label={col.label}
            required={!!col?.required}
            error={err}
            className={col.multiline ? "col-span-2" : "col-span-2"}
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
              />
            ) : (
              <input
                {...register(k)}
                type="text"
                placeholder={`Enter ${col.label.toLowerCase()}…`}
                className={cn(inputBase, err && inputError)}
              />
            )}
          </FormField>
        );

      case "number":
        return (
          <FormField
            key={k}
            label={col.label}
            required={!!col?.required}
            error={err}
            className="col-span-1"
          >
            <div className="relative">
              {col.prefix && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-rf-text-3">
                  {col.prefix}
                </span>
              )}
              <input
                {...register(k, { valueAsNumber: true })}
                type="number"
                {...(col.min !== undefined && { min: col.min })}
                {...(col.max !== undefined && { max: col.max })}
                placeholder="0"
                className={cn(
                  inputBase,
                  col.prefix && "pl-6",
                  col.suffix && "pr-8",
                  err && inputError,
                  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                )}
              />
              {col.suffix && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-rf-text-3">
                  {col.suffix}
                </span>
              )}
            </div>
          </FormField>
        );

      case "select":
        return (
          <FormField
            key={k}
            label={col.label}
            required={!!col?.required}
            error={err}
            className="col-span-1"
          >
            <Controller
              name={k}
              control={control}
              render={({ field }) => (
                <>
                  <select
                    {...field}
                    value={String(field.value ?? "")}
                    className={cn(
                      inputBase,
                      "appearance-none cursor-pointer pr-7",
                      err && inputError,
                    )}
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
                  {col.options?.find((o) => o.value === field.value)?.color && (
                    <div className="mt-1.5">
                      <OptionBadge
                        option={
                          col.options!.find((o) => o.value === field.value)!
                        }
                      />
                    </div>
                  )}
                </>
              )}
            />
          </FormField>
        );

      case "multiselect":
        return (
          <FormField
            key={k}
            label={col.label}
            required={!!col?.required}
            error={err}
            className="col-span-2"
          >
            <Controller
              name={k}
              control={control}
              render={({ field }) => {
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
                          onClick={() =>
                            field.onChange(
                              isSel
                                ? current.filter((v) => v !== opt.value)
                                : [...current, opt.value],
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-all",
                            isSel
                              ? "bg-rf-accent text-white border-rf-accent"
                              : "bg-rf-header text-rf-text-2 border-rf-border hover:border-rf-accent-br hover:bg-rf-accent-bg hover:text-rf-accent",
                            opt.disabled && "opacity-40 cursor-not-allowed",
                          )}
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

      case "date":
        return (
          <FormField
            key={k}
            label={col.label}
            required={!!col?.required}
            error={err}
            className="col-span-1"
          >
            <input
              {...register(k)}
              type="date"
              {...(col.minDate !== undefined && { min: col.minDate })}
              {...(col.maxDate !== undefined && { max: col.maxDate })}
              className={cn(inputBase, "font-mono", err && inputError)}
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

      <div className="sticky bottom-0 bg-rf-surface pt-3 pb-1 mt-4 border-t border-rf-border flex gap-2">
        <button
          type="submit"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> Save Changes
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-rf-md bg-rf-surface text-rf-text-2 border border-rf-border hover:bg-rf-header transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Discard
        </button>
      </div>
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
}: {
  rowId: string;
  comments: RowComment[];
  onAddComment?: (rowId: string, text: string) => void;
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
      {onAddComment && (
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
}: {
  rowId: string;
  attachments: RowAttachment[];
  onUploadFile?: (rowId: string, file: File) => void;
  onDeleteAttachment?: (rowId: string, id: string) => void;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onUploadFile?.(rowId, file);
  };
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      {onUploadFile && (
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
  onAddComment,
  onUploadFile,
  onDeleteAttachment,
  width = 440,
  className,
}: ReaktiformPanelProps<TData>) {
  const [activeTab, setActiveTab] = useState<PMFormTab>("details");

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

  const TABS: { id: PMFormTab; label: string; icon: React.ElementType }[] = [
    { id: "details", label: "Details", icon: FileCheck },
    { id: "activity", label: "Activity", icon: MessageSquare },
    { id: "attachments", label: "Files", icon: Paperclip },
  ];

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

        {/* TAB BODY */}
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
              columns={columns}
              onSave={(data) => onSave(rowId, data)}
              onDiscard={() => onDiscard(rowId)}
            />
          )}
          {row && activeTab === "activity" && (
            <ActivityTab
              rowId={rowId}
              comments={row._comments ?? []}
              {...(onAddComment !== undefined && { onAddComment })}
            />
          )}
          {row && activeTab === "attachments" && (
            <AttachmentsTab
              rowId={rowId}
              attachments={row._attachments ?? []}
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
      </div>
    </>
  );
}
