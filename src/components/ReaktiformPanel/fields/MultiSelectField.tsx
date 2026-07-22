import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Check } from "lucide-react";
import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import {
  cachedLoadOptions,
  invalidateLoadOptionsCache,
  makeSelectStyles,
} from "../../cells/SelectCell";
import { FormField } from "../FormField";
import type { ColumnDef } from "../../../types";

export function MultiSelectField<TData>({
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
