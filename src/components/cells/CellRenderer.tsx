import { cn } from "../../utils";
import { TextCellRead, TextCellEdit } from "./TextCell";
import { NumberCellRead, NumberCellEdit } from "./NumberCell";
import { SelectCellRead, SelectCellEdit } from "./SelectCell";
import { MultiSelectCellRead, MultiSelectCellEdit } from "./MultiSelectCell";
import { DateCellRead, DateCellEdit } from "./DateCell";
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
      <div className={cn("h-full", className)}>
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
      <div className={cn("h-full", className)}>
        {colDef.renderCell(value, row as unknown as TData)}
      </div>
    );
  }

  // ── Computed column — always read-only
  if (colDef.computed) {
    return (
      <ComputedCell
        value={computedValue}
        colDef={colDef as ColumnDef}
        {...(className !== undefined && { className })}
      />
    );
  }

  // ── Error tooltip
  const errorEl =
    isError && errorMessage ? (
      <div className="absolute bottom-[calc(100%+5px)] left-2 bg-[#1E293B] text-[#F8FAFC] text-[10.5px] font-medium px-2 py-1 rounded-rf-md whitespace-nowrap z-[999] pointer-events-none shadow-rf-md after:content-[''] after:absolute after:top-full after:left-3 after:border-4 after:border-transparent after:border-t-[#1E293B]">
        {errorMessage}
      </div>
    ) : null;

  // ── Cell by type
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
        <div className="relative h-full">
          {errorEl}
          <TextCellRead
            value={value != null ? String(value) : null}
            {...(className !== undefined && { className })}
          />
        </div>
      );

    case "number":
      return isEditing ? (
        <NumberCellEdit
          value={value != null ? Number(value) : null}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.min !== undefined && { min: colDef.min })}
          {...(colDef.max !== undefined && { max: colDef.max })}
          {...(colDef.decimals !== undefined && { decimals: colDef.decimals })}
          {...(className !== undefined && { className })}
        />
      ) : (
        <div className="relative h-full w-full">
          {errorEl}
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
        </div>
      );

    case "select":
      return isEditing ? (
        <SelectCellEdit
          value={value != null ? String(value) : null}
          options={colDef.options ?? []}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.searchable !== undefined && {
            searchable: colDef.searchable,
          })}
          {...(colDef.loadOptions !== undefined && {
            loadOptions: colDef.loadOptions,
          })}
          {...(colDef.onCreateOption !== undefined && {
            onCreateOption: colDef.onCreateOption,
          })}
        />
      ) : (
        <div className="relative h-full">
          {errorEl}
          <SelectCellRead
            value={value != null ? String(value) : null}
            {...(colDef.options !== undefined && { options: colDef.options })}
            {...(className !== undefined && { className })}
          />
        </div>
      );

    case "multiselect":
      return isEditing ? (
        <MultiSelectCellEdit
          value={Array.isArray(value) ? (value as string[]) : null}
          options={colDef.options ?? []}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.searchable !== undefined && {
            searchable: colDef.searchable,
          })}
          {...(colDef.loadOptions !== undefined && {
            loadOptions: colDef.loadOptions,
          })}
          {...(colDef.onCreateOption !== undefined && {
            onCreateOption: colDef.onCreateOption,
          })}
        />
      ) : (
        <div className="relative h-full">
          {errorEl}
          <MultiSelectCellRead
            value={Array.isArray(value) ? (value as string[]) : null}
            {...(colDef.options !== undefined && { options: colDef.options })}
            {...(className !== undefined && { className })}
          />
        </div>
      );

    case "date":
      return isEditing ? (
        <DateCellEdit
          value={value != null ? String(value) : null}
          onCommit={(v) => onCommit(v)}
          onCancel={onCancel}
          {...(colDef.minDate !== undefined && { minDate: colDef.minDate })}
          {...(colDef.maxDate !== undefined && { maxDate: colDef.maxDate })}
          {...(className !== undefined && { className })}
        />
      ) : (
        <div className="relative h-full">
          {errorEl}
          <DateCellRead
            value={value != null ? String(value) : null}
            {...(className !== undefined && { className })}
          />
        </div>
      );

    case "checkbox":
      return (
        <div className="relative h-full">
          {errorEl}
          <CheckboxCell
            value={!!value}
            onChange={(v) => onCommit(v)}
            {...(className !== undefined && { className })}
          />
        </div>
      );

    default:
      return (
        <div className="flex items-center px-[10px] h-full">
          <span className="text-[13px] text-rf-text-1">
            {String(value ?? "")}
          </span>
        </div>
      );
  }
}
