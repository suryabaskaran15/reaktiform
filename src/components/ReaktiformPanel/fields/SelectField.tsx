import AsyncSelect from "react-select/async";
import AsyncCreatableSelect from "react-select/async-creatable";
import { cn } from "../../../utils";
import {
  cachedLoadOptions,
  invalidateLoadOptionsCache,
  makeSelectStyles,
} from "../../cells/SelectCell";
import { OptionBadge } from "../../primitives/Badge";
import { FormField, isPanelFieldFullRow, inputBase, inputError} from "../FormField";
import type { ColumnDef } from "../../../types";

export function SelectField<TData>({
  col,
  k,
  err,
  value,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  value: unknown;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  // Shared hardcoded styles — must be hardcoded because the menu renders
  // in document.body via portal where CSS vars are not available.
  const panelRsStyles = makeSelectStyles(true);

  const renderControl = () => {
    if (col.loadOptions) {
      // Async select — value stored as { value, label } object
      const storedObj =
        value && typeof value === "object"
          ? (value as { value: string; label: string })
          : null;
      const currentVal = storedObj
        ? storedObj
        : value
          ? {
              value: String(value),
              label: String(value),
            }
          : null;

      const onRSChange = (opt: any) => {
        const committed = opt
          ? { value: opt.value, label: opt.label }
          : null;
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
          name={k}
          value={String(value ?? "")}
          className={cn(
            inputBase,
            "appearance-none cursor-pointer pr-7",
            err && inputError,
          )}
          onChange={(e) => {
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
        {col.options?.find((o) => o.value === value)?.color && (
          <div className="rf-mt-1.5">
            <OptionBadge
              option={col.options!.find((o) => o.value === value)!}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      fullRow={isPanelFieldFullRow(col)}
    >
      {renderControl()}
    </FormField>
  );
}
