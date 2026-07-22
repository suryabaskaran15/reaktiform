import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { cn, getDraftValue } from "../../utils";
import { mergedRow } from "../cells/CellRenderer";
import { buildZodSchema } from "../../validation/buildZodSchema";
import { FormField, inputBase } from "./FormField";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";
import { SelectField } from "./fields/SelectField";
import { MultiSelectField } from "./fields/MultiSelectField";
import { DateField } from "./fields/DateField";
import { CheckboxField } from "./fields/CheckboxField";
import type { ColumnDef, Row } from "../../types";

// ─────────────────────────────────────────────────────────────
//  DETAILS TAB
// ─────────────────────────────────────────────────────────────
export function DetailsTab<TData = Record<string, unknown>>({
  row,
  rowId,
  columns,
  onSave,
  onFieldChange,
  resetKey,
  editLocked = false,
}: {
  row: Row<TData>;
  rowId: string;
  columns: ColumnDef<TData>[];
  onSave: (data: Record<string, unknown>) => void;
  onFieldChange: (field: string, value: unknown) => void;
  resetKey: number; // increment to force form reset (Discard)
  /** Edit Lock — see GridConfig.editLocked. Forces every field read-only. */
  editLocked?: boolean;
}) {
  const nonComputedCols = columns.filter((c) => !c.computed);
  const computedCols = columns.filter((c) => c.computed);
  const schema = buildZodSchema(nonComputedCols);

  const buildDefaults = () => {
    const vals: Record<string, unknown> = {};
    nonComputedCols.forEach((col) => {
      const k = col.key as string;
      vals[k] = getDraftValue(row, k);
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
    const currentVal = getDraftValue(row, k);
    // Resolve readOnly — boolean or (row) => boolean. Also used for
    // resolveConstraint below so dynamic min/max/minDate/maxDate see
    // in-session edits, not just the last-saved row.
    const rowForConstraint = mergedRow<TData>(row);
    const isFieldReadOnly =
      editLocked ||
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
          <TextField<TData>
            key={k}
            col={col}
            k={k}
            err={err}
            register={register}
            onFieldChange={onFieldChange}
          />
        );

      case "number":
      case "currency":
      case "percentage":
        return (
          <NumberField<TData>
            key={k}
            col={col}
            k={k}
            err={err}
            register={register}
            rowForConstraint={rowForConstraint}
            onFieldChange={onFieldChange}
          />
        );

      case "select":
        return (
          <SelectField<TData>
            key={k}
            col={col}
            k={k}
            err={err}
            control={control}
            onFieldChange={onFieldChange}
          />
        );

      case "multiselect":
        return (
          <MultiSelectField<TData>
            key={k}
            col={col}
            k={k}
            err={err}
            control={control}
            onFieldChange={onFieldChange}
          />
        );

      case "date":
        return (
          <DateField<TData>
            key={k}
            col={col}
            k={k}
            err={err}
            register={register}
            rowForConstraint={rowForConstraint}
            onFieldChange={onFieldChange}
          />
        );

      case "checkbox":
        return (
          <CheckboxField<TData>
            key={k}
            col={col}
            k={k}
            register={register}
            onFieldChange={onFieldChange}
          />
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
