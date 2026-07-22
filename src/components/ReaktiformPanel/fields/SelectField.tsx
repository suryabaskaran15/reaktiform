import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import { cn } from "../../../utils";
import {
  cachedLoadOptions,
  invalidateLoadOptionsCache,
  makeSelectStyles,
} from "../../cells/SelectCell";
import { OptionBadge } from "../../primitives/Badge";
import { FormField, inputBase, inputError } from "../FormField";
import type { ColumnDef } from "../../../types";

export function SelectField<TData>({
  col,
  k,
  err,
  control,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  control: Control<Record<string, unknown>>;
  onFieldChange: (field: string, value: unknown) => void;
}) {
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
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {col.options?.find((o) => o.value === field.value)?.color && (
                <div className="rf-mt-1.5">
                  <OptionBadge
                    option={col.options!.find((o) => o.value === field.value)!}
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
