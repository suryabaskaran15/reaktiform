import { useCallback, useRef } from "react";
import { produce } from "immer";
import { useGridStore, useGridActions } from "../store";
import { validateRow, buildZodSchema } from "../validation/buildZodSchema";
import { generateId, deepClone } from "../utils";
import type { ColumnDef, Row } from "../types";
import type { HistoryEntry } from "../store/gridStore";
import type { useComputedColumns } from "./useComputedColumns";

type UseDraftOptions<TData> = {
  columns: ColumnDef<TData>[];
  rowIdKey: string;
  // Single row callbacks
  onCreate?: (row: TData) => Promise<TData | void> | void;
  onUpdate?: (row: TData) => Promise<TData | void> | void;
  onSave?: (row: TData, isNew: boolean) => Promise<TData | void> | void;
  // Bulk save callback
  onBulkSave?: (rows: TData[]) => Promise<TData[] | void> | void;
  // Delete / add
  onDelete?: (id: string) => Promise<void> | void;
  onAdd?: (row: TData) => void;
  // Save result hooks — for toasts, logging, etc.
  onSaveSuccess?: (row: TData, isNew: boolean) => void;
  onSaveError?: (err: Error, row: TData, isNew: boolean) => void;
  // Internal: fires with the row's _id when a save fails.
  // useReaktiform uses this to auto-open the error popover for that row.
  onRowSaveError?: (rowInternalId: string) => void;
  // Internal: marks/unmarks a row as in-flight during API call.
  // Prevents data-sync effect from overwriting store with stale incoming data.
  setSavingRow?: (rowId: string, saving: boolean) => void;
  // Computed columns engine
  computed?: ReturnType<typeof useComputedColumns<TData>>;
};

export function useDraft<TData = Record<string, unknown>>({
  columns,
  rowIdKey,
  onCreate,
  onUpdate,
  onSave,
  onBulkSave,
  onDelete,
  onAdd,
  onSaveSuccess,
  onSaveError,
  onRowSaveError,
  setSavingRow,
  computed,
}: UseDraftOptions<TData>) {
  const rows = useGridStore((s) => s.rows) as Row<TData>[];
  const actions = useGridActions();

  // ── Zod schema cache — rebuild only when columns reference changes.
  // markDirty fires on every keystroke; rebuilding Zod schema every time
  // is O(columns) work per keypress. Caching brings it to O(1).
  const schemaRef = useRef<ReturnType<typeof buildZodSchema> | null>(null);
  const colsRef = useRef<typeof columns | null>(null);
  const getCachedSchema = useCallback(() => {
    if (schemaRef.current === null || colsRef.current !== columns) {
      schemaRef.current = buildZodSchema(columns as ColumnDef[]);
      colsRef.current = columns;
    }
    return schemaRef.current;
  }, [columns]);

  // ── Get display value (draft takes priority over committed)
  // Applies valueTransform.read if defined — converts backend shapes to flat values
  const getVal = useCallback(
    (row: Row<TData>, key: string): unknown => {
      const raw =
        row._draft && key in row._draft
          ? row._draft[key]
          : (row as Record<string, unknown>)[key];

      // Apply read transform if defined on this column
      const col = columns.find((c) => c.key === key);
      if (col?.valueTransform?.read && raw !== undefined && raw !== null) {
        try {
          return col.valueTransform.read(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    },
    [columns],
  );

  // ── Check if row has unsaved changes
  const isDirty = useCallback((row: Row<TData>): boolean => {
    return row._draft !== null;
  }, []);

  // ── Get all row errors as a map
  const getErrors = useCallback((row: Row<TData>): Record<string, string> => {
    return row._errors ?? {};
  }, []);

  // ── Mark a single field as dirty (start / update draft)
  const markDirty = useCallback(
    (rowId: string, field: string, newVal: unknown) => {
      const row = rows.find(
        (r) =>
          (r as Record<string, unknown>)[rowIdKey] === rowId || r._id === rowId,
      );
      if (!row) return;

      const oldVal = getVal(row, field);

      // ── Skip if value hasn't actually changed.
      // Handles primitives, arrays (JSON compare), and objects.
      // This prevents marking a row dirty when user clicks a cell
      // and immediately presses Enter/Tab without changing anything.
      const isEqual = (a: unknown, b: unknown): boolean => {
        if (a === b) return true;
        if (Array.isArray(a) && Array.isArray(b))
          return JSON.stringify(a) === JSON.stringify(b);
        if (a === null && b === "") return true; // empty number cell
        if (a === "" && b === null) return true;
        return false;
      };
      if (isEqual(oldVal, newVal)) return;

      // Build new draft
      const newDraft = produce(
        row._draft ?? buildDraftFromRow(row, columns),
        (draft: Record<string, unknown>) => {
          draft[field] = newVal;
        },
      );

      // Validate against new draft — use cached schema (O(1) vs O(cols) per keypress)
      const draftData = { ...(row as Record<string, unknown>), ...newDraft };
      const errors = validateRow(
        columns as ColumnDef[],
        draftData,
        getCachedSchema(),
      );

      // Update row in store
      actions.updateRowInStore(row._id, {
        _draft: newDraft,
        _saved: false,
        _errors: errors,
      });

      // Invalidate computed column cache for fields that depend on this change
      computed?.invalidateRow(row._id, field);

      // Push to history
      const histEntry: HistoryEntry = {
        type: "field",
        rowId: row._id,
        field,
        oldVal,
        newVal,
        label: `Changed ${columns.find((c) => c.key === field)?.label ?? field}`,
        detail: `${String(getVal(row, rowIdKey) ?? row._id).slice(0, 20)}: ${String(oldVal ?? "—").slice(0, 18)} → ${String(newVal ?? "—").slice(0, 18)}`,
      };
      actions.pushHistory(histEntry);
      actions.clearFuture();
    },
    [rows, rowIdKey, columns, getVal, actions],
  );

  // ── Save a single row (commit draft → row data)
  const saveRow = useCallback(
    async (rowId: string): Promise<boolean> => {
      const row = rows.find(
        (r) =>
          (r as Record<string, unknown>)[rowIdKey] === rowId || r._id === rowId,
      );
      if (!row || !row._draft) return false;

      // Block save if validation errors exist
      const errors = row._errors ?? {};
      if (Object.keys(errors).length > 0) return false;

      const isNew = !!row._new;

      // Snapshot for undo
      const oldData = buildDraftFromRow(row, columns);
      const draftSnap = deepClone(row._draft);

      // Merge draft into committed row
      const committed = {
        ...row,
        ...row._draft,
        _draft: null,
        _saved: true,
        _new: false,
      };

      // ── Call consumer callback — priority order:
      //   isNew  → onCreate  else onSave(row, true)
      //   !isNew → onUpdate  else onSave(row, false)
      //
      // Apply valueTransform.write before sending to server so the API
      // receives the shape it expects (e.g. { owner: { id: 'alice_kwan' } }
      // instead of flat { owner: 'alice_kwan' })
      // Mark this row as in-flight BEFORE the API call.
      // This prevents the data-sync effect from overwriting store values
      // if a re-render is triggered while the API is pending.
      const realId = String(
        (row as Record<string, unknown>)[rowIdKey] ?? row._id,
      );
      setSavingRow?.(realId, true);
      // Mark row as saving so UI can show spinner and disable save button
      actions.updateRowInStore(row._id, { _saving: true });

      let serverResponse: TData | void = undefined;
      try {
        // Build API payload — apply write transforms for columns that define them
        const apiPayload = { ...committed } as Record<string, unknown>;
        for (const col of columns) {
          const key = col.key as string;
          if (!col.valueTransform?.write) continue;
          const internalVal = apiPayload[key];
          if (internalVal === undefined || internalVal === null) continue;
          try {
            apiPayload[key] = col.valueTransform.write(
              internalVal as string | string[],
            );
          } catch {
            // Transform failed — send raw value
          }
        }

        const payload = apiPayload as unknown as TData;
        if (isNew) {
          serverResponse = onCreate
            ? await onCreate(payload)
            : await onSave?.(payload, true);
        } else {
          serverResponse = onUpdate
            ? await onUpdate(payload)
            : await onSave?.(payload, false);
        }
      } catch (err) {
        // ── API failure — keep the draft INTACT so user doesn't lose changes.
        console.error("[reaktiform] save error — draft preserved:", err);
        setSavingRow?.(realId, false); // unmark so next sync works normally
        // Extract the most meaningful message from whatever was thrown.
        // Handles: Error instances, plain strings, and structured objects
        // like { message, detail, error_description } from API responses.
        const extractMessage = (e: unknown): string => {
          if (e instanceof Error) return e.message;
          if (typeof e === "string") return e;
          if (e && typeof e === "object") {
            const obj = e as Record<string, unknown>;
            const msg =
              obj.message ?? obj.detail ?? obj.error_description ?? obj.error;
            if (msg && typeof msg === "string") return msg;
          }
          return String(e);
        };
        actions.updateRowInStore(row._id, {
          _saved: false,
          _saving: false,
          _saveError: extractMessage(err),
        });
        // Auto-open error popover for this row (via internal callback)
        try {
          onRowSaveError?.(row._id);
        } catch {}
        // Notify consumer (for toast / error UI)
        try {
          onSaveError?.(
            err instanceof Error ? err : new Error(String(err)),
            committed as unknown as TData,
            isNew,
          );
        } catch {}
        throw err;
      }

      // ── Commit the draft values to the store — this is the source of truth.
      // We do NOT merge the server response back into the store for updates.
      // Reason: different APIs return different shapes (full entity, partial,
      // 204 No Content, etc.) and merging causes race conditions with the
      // consumer's data prop (TanStack/SWR cache updates on mutation success).
      // The draft values are already correct — the user typed them, validation
      // passed, we sent them. Trust them.
      //
      // For NEW rows only: merge server response to capture the server-generated
      // id and any server-computed fields (createdAt, version, etc.).
      const finalData =
        isNew && serverResponse
          ? {
              ...committed,
              ...(serverResponse as Record<string, unknown>),
              _saveError: undefined,
            }
          : { ...committed, _saveError: undefined };

      actions.updateRowInStore(row._id, { ...finalData, _saving: false });
      computed?.invalidateRowAll(row._id);
      setSavingRow?.(realId, false); // unmark — sync can resume for explicit refetches

      // Notify consumer of success — use this for toasts only.
      // Do NOT trigger a refetch here — consumer calls onRefresh explicitly.
      try {
        onSaveSuccess?.(finalData as unknown as TData, isNew);
      } catch {}

      // Push to undo history
      actions.pushHistory({
        type: "saveRow",
        rowId: row._id,
        label: `Saved ${String((row as Record<string, unknown>)[rowIdKey] ?? row._id)}`,
        oldData,
        newData: buildDraftFromRow(finalData as Row<TData>, columns),
        draftSnap,
      });

      return true;
    },
    [
      rows,
      rowIdKey,
      columns,
      actions,
      onCreate,
      onUpdate,
      onSave,
      computed,
      onSaveSuccess,
      onSaveError,
      onRowSaveError,
      setSavingRow,
    ],
  );

  // ── Discard changes on a row
  const discardRow = useCallback(
    (rowId: string) => {
      const row = rows.find(
        (r) =>
          (r as Record<string, unknown>)[rowIdKey] === rowId || r._id === rowId,
      );
      if (!row) return;

      if (row._new && !row._saved) {
        // Brand new row — delete it entirely
        const idx = rows.indexOf(row);
        actions.pushHistory({
          type: "delRow",
          rowId: row._id,
          index: idx,
          snapshot: deepClone(row as unknown as Record<string, unknown>),
          label: `Discarded new row`,
        });
        actions.removeRowFromStore(row._id);
      } else {
        // Existing row — clear draft and any save error
        actions.updateRowInStore(row._id, {
          _draft: null,
          _saved: true,
          _errors: {},
          _saveError: undefined,
        });
        // Invalidate computed cache — draft gone, values reverted
        computed?.invalidateRowAll(row._id);
      }
    },
    [rows, rowIdKey, actions],
  );

  // ── Save all dirty rows
  // If onBulkSave provided → ONE API call with all valid dirty rows
  // Fallback → loop individual saves (existing behaviour)
  const saveAll = useCallback(async (): Promise<{
    saved: number;
    skipped: number;
  }> => {
    const dirty = rows.filter((r) => isDirty(r));
    const valid = dirty.filter(
      (r) => Object.keys(r._errors ?? {}).length === 0,
    );
    const invalid = dirty.filter(
      (r) => Object.keys(r._errors ?? {}).length > 0,
    );

    if (!valid.length) return { saved: 0, skipped: invalid.length };

    // ── Bulk path — one API call
    if (onBulkSave) {
      try {
        // Build committed versions of all valid rows
        const committedRows = valid.map((row) => ({
          ...row,
          ...row._draft,
          _draft: null,
          _saved: true,
          _new: false,
        }));

        const payloads = committedRows.map((r) => r as unknown as TData);
        const serverResponses = await onBulkSave(payloads);

        // Apply each committed row to store
        committedRows.forEach((committed, idx) => {
          const row = valid[idx]!;
          const serverRow = serverResponses?.[idx];
          const finalData = serverRow
            ? { ...committed, ...(serverRow as Record<string, unknown>) }
            : committed;

          actions.updateRowInStore(row._id, finalData);
          computed?.invalidateRowAll(row._id);

          actions.pushHistory({
            type: "saveRow",
            rowId: row._id,
            label: `Saved ${String((row as Record<string, unknown>)[rowIdKey] ?? row._id)}`,
            oldData: buildDraftFromRow(row, columns),
            newData: buildDraftFromRow(finalData as Row<TData>, columns),
            draftSnap: deepClone(row._draft ?? {}),
          });
        });
      } catch (err) {
        console.error("[reaktiform] onBulkSave error:", err);
        throw err;
      }
      return { saved: valid.length, skipped: invalid.length };
    }

    // ── Individual fallback path
    for (const row of valid) {
      await saveRow(
        String((row as Record<string, unknown>)[rowIdKey] ?? row._id),
      );
    }

    return { saved: valid.length, skipped: invalid.length };
  }, [
    rows,
    isDirty,
    saveRow,
    rowIdKey,
    columns,
    onBulkSave,
    actions,
    computed,
  ]);

  // ── Discard all dirty rows
  const discardAll = useCallback(() => {
    const dirty = rows.filter((r) => isDirty(r));
    dirty.forEach((row) => {
      discardRow(String((row as Record<string, unknown>)[rowIdKey] ?? row._id));
    });
  }, [rows, isDirty, discardRow, rowIdKey]);

  // ── Add a new empty row
  const addRow = useCallback(
    (defaultValues?: Partial<TData>) => {
      const id = generateId("row");
      const today = new Date().toISOString().slice(0, 10);

      // Build empty row from column definitions
      const emptyRow: Record<string, unknown> = {
        _id: id,
        _saved: false,
        _new: true,
        _draft: null,
        _errors: {},
        _comments: [],
        _attachments: [],
        ...defaultValues,
      };

      // Set defaults per column type
      for (const col of columns) {
        if (!((col.key as string) in emptyRow)) {
          switch (col.type) {
            case "text":
              emptyRow[col.key as string] = "";
              break;
            case "number":
              emptyRow[col.key as string] = "";
              break;
            case "select":
              emptyRow[col.key as string] = "";
              break;
            case "multiselect":
              emptyRow[col.key as string] = [];
              break;
            case "date":
              emptyRow[col.key as string] = today;
              break;
            case "checkbox":
              emptyRow[col.key as string] = false;
              break;
          }
        }
      }

      // Immediately put everything into draft so Save/Discard appear
      const draft = buildDraftFromRow(emptyRow as Row<TData>, columns);
      emptyRow._draft = draft;
      emptyRow._errors = {}; // start with no errors — validate on save, not on add
      emptyRow._saveError = undefined; // no previous save attempt

      actions.addRowToStore(emptyRow);
      actions.pushHistory({
        type: "addRow",
        rowId: id,
        snapshot: deepClone(emptyRow),
        label: "Added new row",
      });
      actions.clearFuture();

      // Call consumer callback
      onAdd?.(emptyRow as unknown as TData);

      return id;
    },
    [columns, actions, onAdd],
  );

  // ── Delete a row
  const deleteRow = useCallback(
    async (rowId: string) => {
      const row = rows.find(
        (r) =>
          (r as Record<string, unknown>)[rowIdKey] === rowId || r._id === rowId,
      );
      if (!row) return;

      const idx = rows.indexOf(row);
      actions.pushHistory({
        type: "delRow",
        rowId: row._id,
        index: idx,
        snapshot: deepClone(row as unknown as Record<string, unknown>),
        label: `Deleted row`,
      });
      actions.clearFuture();
      actions.removeRowFromStore(row._id);

      try {
        await onDelete?.(row._id);
      } catch (err) {
        console.error("[reaktiform] onDelete error:", err);
      }
    },
    [rows, rowIdKey, actions, onDelete],
  );

  // ── Duplicate a row
  const duplicateRow = useCallback(
    (rowId: string) => {
      const row = rows.find(
        (r) =>
          (r as Record<string, unknown>)[rowIdKey] === rowId || r._id === rowId,
      );
      if (!row) return;

      const newId = generateId("row");
      const dup: Record<string, unknown> = {
        ...deepClone(row as unknown as Record<string, unknown>),
        _id: newId,
        _saved: false,
        _new: true,
        _draft: null,
        _errors: {},
        _comments: [],
        _attachments: [],
      };

      const draft = buildDraftFromRow(dup as Row<TData>, columns);
      dup._draft = draft;
      const errors = validateRow(columns as ColumnDef[], { ...dup, ...draft });
      dup._errors = errors;

      const idx = rows.indexOf(row);
      // Insert after source row
      const newRows = [...rows];
      newRows.splice(idx + 1, 0, dup as Row<TData>);
      actions.setRows(newRows as Record<string, unknown>[]);

      actions.pushHistory({
        type: "addRow",
        rowId: newId,
        snapshot: deepClone(dup),
        label: "Duplicated row",
      });
      actions.clearFuture();
    },
    [rows, rowIdKey, columns, actions],
  );

  // ── Dirty count and saving count
  const dirtyCount = rows.filter((r) => isDirty(r)).length;
  const savingCount = rows.filter(
    (r) => !!(r as Record<string, unknown>)["_saving"],
  ).length;

  return {
    rows,
    getVal,
    isDirty,
    getErrors,
    markDirty,
    saveRow,
    discardRow,
    saveAll,
    discardAll,
    addRow,
    deleteRow,
    duplicateRow,
    dirtyCount,
    savingCount,
  };
}

// ── Helper: build a draft object from current row data
function buildDraftFromRow<TData>(
  row: Row<TData> | Record<string, unknown>,
  columns: ColumnDef<TData>[],
): Record<string, unknown> {
  const draft: Record<string, unknown> = {};
  for (const col of columns) {
    draft[col.key as string] = (row as Record<string, unknown>)[
      col.key as string
    ];
  }
  return draft;
}
