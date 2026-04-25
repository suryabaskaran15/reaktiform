import { z } from "zod";
import type { ColumnDef, Row } from "../types";
import { resolveConstraint } from "../utils";

/**
 * Automatically builds a Zod validation schema
 * from your reaktiform column definitions.
 *
 * Usage:
 *   const schema = buildZodSchema(columns)
 *   const result = zodSchema.safeParse(rowData)
 */
export function buildZodSchema<TData = Record<string, unknown>>(
  columns: ColumnDef<TData>[],
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const col of columns) {
    // ── Computed columns are formula-driven — never user-editable,
    // never validated by Zod. Their values are auto-calculated.
    if (col.computed) continue;

    let fieldSchema: z.ZodTypeAny;

    switch (col.type) {
      // ── Text ──────────────────────────────────────────────
      case "text": {
        let s = z.string();

        if (col.minLength !== undefined) {
          s = s.min(col.minLength, {
            message: `${col.label} must be at least ${col.minLength} characters`,
          });
        }
        if (col.maxLength !== undefined) {
          s = s.max(col.maxLength, {
            message: `${col.label} must be at most ${col.maxLength} characters`,
          });
        }
        if (col.pattern) {
          s = s.regex(col.pattern, {
            message: col.patternMessage ?? `${col.label} format is invalid`,
          });
        }

        fieldSchema = col.required
          ? s.min(1, { message: `${col.label} is required` })
          : s.optional();
        break;
      }

      // ── Number ────────────────────────────────────────────
      case "number": {
        let s = z.number({
          invalid_type_error: `${col.label} must be a number`,
        });

        if (col.min !== undefined && typeof col.min !== "function") {
          s = s.min(col.min, {
            message: `${col.label} must be at least ${col.min}`,
          });
        }
        if (col.max !== undefined && typeof col.max !== "function") {
          s = s.max(col.max, {
            message: `${col.label} must be at most ${col.max}`,
          });
        }

        // .nullable() so null (empty field from server) is accepted.
        // For required: superRefine checks null/undefined explicitly —
        // NOT a falsy check so that 0 is always a valid "entered" value.
        const sn = s.nullable();
        fieldSchema = col.required
          ? sn.superRefine((val, ctx) => {
              if (val === null || val === undefined) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `${col.label} is required`,
                });
              }
            })
          : sn.optional();
        break;
      }

      // ── Select ────────────────────────────────────────────
      case "select": {
        // Async select (loadOptions) — value is { id, name } object, not a string.
        // z.unknown() + superRefine avoids "Expected string, received object" error.
        if (col.loadOptions) {
          // Async select value is { value: string, label: string } — a SelectOption object.
          // z.unknown() + superRefine: accepts both plain strings and SelectOption objects,
          // validates required by checking the .value property (the id).
          fieldSchema = z.unknown().superRefine((val, ctx) => {
            if (!col.required) return;
            const isEmpty =
              val == null ||
              val === "" ||
              // { value, label } object — check .value (the id field)
              (typeof val === "object" &&
                !(val as Record<string, unknown>).value);
            if (isEmpty) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${col.label} is required`,
              });
            }
          });
        } else if (col.options && col.options.length > 0) {
          const values = col.options.map((o) => o.value) as [
            string,
            ...string[],
          ];
          const s = z.enum(values, {
            errorMap: () => ({
              message: `${col.label} must be one of: ${values.join(", ")}`,
            }),
          });
          fieldSchema = col.required ? s : s.optional();
        } else {
          // No options, no loadOptions — plain string fallback
          fieldSchema = col.required
            ? z.string().min(1, { message: `${col.label} is required` })
            : z.string().optional();
        }
        break;
      }

      // ── Multiselect ───────────────────────────────────────
      case "multiselect": {
        if (col.loadOptions) {
          // Async multiselect: stored as SelectOption[] ({ value, label }[]).
          // z.array(z.unknown()) accepts both SelectOption[] and string[].
          fieldSchema = z.array(z.unknown()).superRefine((arr, ctx) => {
            if (col.required && arr.length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${col.label} requires at least one selection`,
              });
            }
          });
        } else {
          let s = z.array(z.string());
          if (col.required) {
            s = s.min(1, {
              message: `${col.label} requires at least one selection`,
            });
          }
          fieldSchema = col.required ? s : s.optional();
        }
        break;
      }

      // ── Time ──────────────────────────────────────────────
      case "time": {
        // Stored as "HH:MM" (24-hour) — validate format when required
        const s = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
          message: `${col.label} must be a valid time (HH:MM)`,
        });
        fieldSchema = col.required
          ? s.min(1, { message: `${col.label} is required` })
          : s.optional();
        break;
      }

      // ── Date ──────────────────────────────────────────────
      case "date": {
        // Use superRefine so we can chain multiple checks
        // without hitting Zod's ZodEffects type narrowing issue
        // Static minDate/maxDate go into Zod; dynamic functions are
        // evaluated in validateRow() with the actual row values.
        const minDate =
          typeof col.minDate === "function" ? undefined : col.minDate;
        const maxDate =
          typeof col.maxDate === "function" ? undefined : col.maxDate;
        const required = col.required;
        const label = col.label;

        const s = z.string().superRefine((val, ctx) => {
          // Required check
          if (required && !val) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${label} is required`,
            });
            return;
          }
          // Valid date check
          if (val && isNaN(Date.parse(val))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${label} must be a valid date`,
            });
            return;
          }
          // Min date check
          if (minDate && val && new Date(val) < new Date(minDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${label} must be on or after ${minDate}`,
            });
          }
          // Max date check
          if (maxDate && val && new Date(val) > new Date(maxDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${label} must be on or before ${maxDate}`,
            });
          }
        });

        fieldSchema = col.required ? s : s.optional();
        break;
      }

      // ── Email ─────────────────────────────────────────────
      case "email": {
        const s = z
          .string()
          .email({ message: `${col.label} must be a valid email address` });
        fieldSchema = col.required
          ? s.min(1, { message: `${col.label} is required` })
          : s.optional();
        break;
      }

      // ── URL ───────────────────────────────────────────────
      case "url": {
        const s = z
          .string()
          .url({ message: `${col.label} must be a valid URL` });
        fieldSchema = col.required
          ? s.min(1, { message: `${col.label} is required` })
          : s.optional();
        break;
      }

      // ── Currency — numeric, same as number
      case "currency": {
        let s = z.number({
          invalid_type_error: `${col.label} must be a number`,
        });
        if (col.min !== undefined && typeof col.min !== "function")
          s = s.min(col.min, {
            message: `${col.label} must be at least ${col.min}`,
          });
        if (col.max !== undefined && typeof col.max !== "function")
          s = s.max(col.max, {
            message: `${col.label} must be at most ${col.max}`,
          });
        const sn = s.nullable();
        fieldSchema = col.required
          ? sn.superRefine((val, ctx) => {
              if (val === null || val === undefined) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `${col.label} is required`,
                });
              }
            })
          : sn.optional();
        break;
      }

      // ── Percentage — numeric 0–100
      case "percentage": {
        let s = z
          .number({ invalid_type_error: `${col.label} must be a number` })
          .min((typeof col.min === "function" ? undefined : col.min) ?? 0, {
            message: `${col.label} must be at least 0`,
          })
          .max((typeof col.max === "function" ? undefined : col.max) ?? 100, {
            message: `${col.label} must be at most 100`,
          });
        // 0% is a valid percentage — required check must not use !val
        const sn = s.nullable();
        fieldSchema = col.required
          ? sn.superRefine((val, ctx) => {
              if (val === null || val === undefined) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `${col.label} is required`,
                });
              }
            })
          : sn.optional();
        break;
      }

      // ── Rating — integer 0–N
      case "rating": {
        const max = col.ratingMax ?? 5;
        const s = z
          .number({ invalid_type_error: `${col.label} must be a number` })
          .int({ message: `${col.label} must be a whole number` })
          .min(0, { message: `${col.label} must be at least 0` })
          .max(max, { message: `${col.label} must be at most ${max}` });
        fieldSchema = col.required
          ? s.min(1, { message: `${col.label} is required` })
          : s.optional();
        break;
      }

      // ── Badge — read-only enum, no validation needed
      case "badge": {
        fieldSchema = z.unknown();
        break;
      }

      // ── Progress — read-only 0–100, no validation needed
      case "progress": {
        fieldSchema = z.unknown();
        break;
      }

      // ── Checkbox ──────────────────────────────────────────
      case "checkbox": {
        fieldSchema = col.required
          ? z.literal(true, {
              errorMap: () => ({
                message: `${col.label} must be checked`,
              }),
            })
          : z.boolean().optional();
        break;
      }

      default: {
        fieldSchema = z.unknown();
      }
    }

    shape[col.key as string] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Validate a single field value against its column definition.
 * Runs built-in Zod rules, then the custom validate() function.
 * Returns error message string or null if valid.
 *
 * @param col       - Column definition
 * @param value     - Current field value
 * @param rowValues - Full row data for cross-field validation (optional)
 */
export function validateField(
  col: ColumnDef,
  value: unknown,
  rowValues: Record<string, unknown> = {},
): string | null {
  // Step 1 — Built-in Zod rules
  const schema = buildZodSchema([col]);
  const result = schema.safeParse({ [col.key as string]: value });

  if (!result.success) {
    const fieldError = result.error.errors.find((e) => e.path[0] === col.key);
    if (fieldError?.message) return fieldError.message;
  }

  // Step 2 — Custom validate function
  if (col.validate) {
    try {
      const customError = col.validate(value, rowValues);
      if (customError) return customError;
    } catch {
      return `Validation error in ${col.label}`;
    }
  }

  return null;
}

/**
 * Validate all fields in a row.
 * Runs built-in Zod rules first, then custom validate() functions.
 * Returns a map of colKey → error message (empty map = valid row).
 *
 * @param columns   Column definitions
 * @param rowData   Row data to validate
 * @param schema    Optional pre-built Zod schema — pass to avoid rebuilding on every call
 */
export function validateRow<TData = Record<string, unknown>>(
  columns: ColumnDef<TData>[],
  rowData: Record<string, unknown>,
  schema?: ReturnType<typeof buildZodSchema>,
): Record<string, string> {
  // Step 1 — Use provided schema or build one
  const zodSchema = schema ?? buildZodSchema(columns);
  const result = zodSchema.safeParse(rowData); // ← was missing

  const errors: Record<string, string> = {};

  if (!result.success) {
    for (const err of result.error.errors) {
      const key = err.path[0];
      if (key && typeof key === "string" && !errors[key]) {
        errors[key] = err.message;
      }
    }
  }

  // Step 2 — Dynamic constraints: min/max/minDate/maxDate as functions.
  // Evaluated here with actual row values — Zod can't do this because
  // schemas are built once without row context.
  for (const col of columns) {
    if (col.computed) continue;
    const key = col.key as string;
    const val = (rowData as Record<string, unknown>)[key];

    // Dynamic number/currency/percentage/rating min/max
    if (
      (col.type === "number" ||
        col.type === "currency" ||
        col.type === "percentage" ||
        col.type === "rating") &&
      val !== undefined &&
      val !== null &&
      val !== ""
      // Note: val === 0 passes this check correctly — 0 is a valid number
    ) {
      const num = Number(val);
      if (!isNaN(num)) {
        if (typeof col.min === "function") {
          const minVal = resolveConstraint(
            col.min as (r: Record<string, unknown>) => number | undefined,
            rowData as Row<TData>,
          );
          if (minVal !== undefined && num < minVal && !errors[key]) {
            errors[key] = `${col.label} must be at least ${minVal}`;
          }
        }
        if (typeof col.max === "function") {
          const maxVal = resolveConstraint(
            col.max as (r: Record<string, unknown>) => number | undefined,
            rowData as Row<TData>,
          );
          if (maxVal !== undefined && num > maxVal && !errors[key]) {
            errors[key] = `${col.label} must be at most ${maxVal}`;
          }
        }
      }
    }

    // Dynamic date minDate/maxDate
    if (col.type === "date" && val && typeof val === "string") {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        if (typeof col.minDate === "function") {
          const minD = resolveConstraint(
            col.minDate as (r: Record<string, unknown>) => string | undefined,
            rowData as Row<TData>,
          );
          if (minD && date < new Date(minD) && !errors[key]) {
            errors[key] = `${col.label} must be on or after ${minD}`;
          }
        }
        if (typeof col.maxDate === "function") {
          const maxD = resolveConstraint(
            col.maxDate as (r: Record<string, unknown>) => string | undefined,
            rowData as Row<TData>,
          );
          if (maxD && date > new Date(maxD) && !errors[key]) {
            errors[key] = `${col.label} must be on or before ${maxD}`;
          }
        }
      }
    }
  }

  // Step 3 — Custom validate() functions
  // Only runs for columns that define validate — no cost otherwise.
  // Runs even if Zod already has an error for that field, so custom
  // errors can override built-in ones (last write wins).
  for (const col of columns) {
    if (col.computed) continue; // computed columns are never user-editable
    if (!col.validate) continue;
    const key = col.key as string;
    const fieldValue = (rowData as Record<string, unknown>)[key];
    try {
      const customError = col.validate(fieldValue, rowData);
      if (customError) {
        // Custom validation overrides Zod error for this field
        errors[key] = customError;
      } else if (errors[key]) {
        // Custom validate passed — keep Zod error if present
        // (custom returning undefined means "I have no objection",
        //  not "all errors cleared")
      }
    } catch {
      // Custom validate threw — treat as an error so the row is
      // blocked from saving but doesn't crash the grid
      errors[key] = `Validation error in ${col.label}`;
    }
  }

  return errors;
}
