import { z } from "zod";
import type { ColumnDef } from "../types";

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

        if (col.min !== undefined) {
          s = s.min(col.min, {
            message: `${col.label} must be at least ${col.min}`,
          });
        }
        if (col.max !== undefined) {
          s = s.max(col.max, {
            message: `${col.label} must be at most ${col.max}`,
          });
        }

        fieldSchema = col.required ? s : s.optional();
        break;
      }

      // ── Select ────────────────────────────────────────────
      case "select": {
        if (col.options && col.options.length > 0) {
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
          // No options defined — fallback to string
          fieldSchema = col.required
            ? z.string().min(1, { message: `${col.label} is required` })
            : z.string().optional();
        }
        break;
      }

      // ── Multiselect ───────────────────────────────────────
      case "multiselect": {
        let s = z.array(z.string());

        if (col.required) {
          s = s.min(1, {
            message: `${col.label} requires at least one selection`,
          });
        }

        fieldSchema = col.required ? s : s.optional();
        break;
      }

      // ── Date ──────────────────────────────────────────────
      case "date": {
        // Use superRefine so we can chain multiple checks
        // without hitting Zod's ZodEffects type narrowing issue
        const minDate = col.minDate;
        const maxDate = col.maxDate;
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
  const result = zodSchema.parse(rowData);
  const errors: Record<string, string> = {};

  if (!result.success) {
    for (const err of result.error.errors) {
      const key = err.path[0];
      if (key && typeof key === "string" && !errors[key]) {
        errors[key] = err.message;
      }
    }
  }

  // Step 2 — Custom validate() functions
  // Only runs for columns that define validate — no cost otherwise.
  // Runs even if Zod already has an error for that field, so custom
  // errors can override built-in ones (last write wins).
  for (const col of columns) {
    if (!col.validate) continue;
    const key = col.key as string;
    const fieldValue = rowData[key];
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
