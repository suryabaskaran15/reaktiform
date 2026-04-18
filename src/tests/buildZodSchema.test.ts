// src/tests/buildZodSchema.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for buildZodSchema — Zod schema generation for all
// column types including new: email, url, currency, percentage,
// rating, badge, progress
// ─────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { buildZodSchema, validateField } from "../validation/buildZodSchema";
import type { ColumnDef } from "../types";

// ── Helpers ──────────────────────────────────────────────────

function col(overrides: Partial<ColumnDef>): ColumnDef {
  return {
    key: "field",
    label: "Field",
    type: "text",
    ...overrides,
  };
}

function validate(columns: ColumnDef[], data: Record<string, unknown>) {
  const schema = buildZodSchema(columns);
  return schema.safeParse(data);
}

// ─────────────────────────────────────────────────────────────
//  TEXT
// ─────────────────────────────────────────────────────────────
describe("text column", () => {
  it("accepts any string when not required", () => {
    const r = validate([col({ type: "text" })], { field: "hello" });
    expect(r.success).toBe(true);
  });

  it("accepts empty string when not required", () => {
    const r = validate([col({ type: "text" })], { field: "" });
    expect(r.success).toBe(true);
  });

  it("rejects empty when required", () => {
    const r = validate([col({ type: "text", required: true })], { field: "" });
    expect(r.success).toBe(false);
  });

  it("enforces minLength", () => {
    const c = col({ type: "text", minLength: 5 });
    expect(validate([c], { field: "hi" }).success).toBe(false);
    expect(validate([c], { field: "hello" }).success).toBe(true);
  });

  it("enforces maxLength", () => {
    const c = col({ type: "text", maxLength: 3 });
    expect(validate([c], { field: "hi" }).success).toBe(true);
    expect(validate([c], { field: "hello" }).success).toBe(false);
  });

  it("enforces pattern", () => {
    const c = col({
      type: "text",
      pattern: /^\d{4}$/,
      patternMessage: "Must be 4 digits",
    });
    expect(validate([c], { field: "1234" }).success).toBe(true);
    expect(validate([c], { field: "abcd" }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  NUMBER
// ─────────────────────────────────────────────────────────────
describe("number column", () => {
  it("accepts valid number", () => {
    expect(validate([col({ type: "number" })], { field: 42 }).success).toBe(
      true,
    );
  });

  it("rejects string", () => {
    expect(
      validate([col({ type: "number" })], { field: "not-a-number" }).success,
    ).toBe(false);
  });

  it("enforces min", () => {
    const c = col({ type: "number", min: 10 });
    expect(validate([c], { field: 5 }).success).toBe(false);
    expect(validate([c], { field: 10 }).success).toBe(true);
  });

  it("enforces max", () => {
    const c = col({ type: "number", max: 100 });
    expect(validate([c], { field: 101 }).success).toBe(false);
    expect(validate([c], { field: 100 }).success).toBe(true);
  });

  it("is optional by default", () => {
    expect(validate([col({ type: "number" })], {}).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  EMAIL
// ─────────────────────────────────────────────────────────────
describe("email column", () => {
  it("accepts valid email", () => {
    expect(
      validate([col({ type: "email" })], { field: "user@example.com" }).success,
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(
      validate([col({ type: "email" })], { field: "not-an-email" }).success,
    ).toBe(false);
    expect(
      validate([col({ type: "email" })], { field: "missing@tld" }).success,
    ).toBe(false);
  });

  it("rejects empty when required", () => {
    expect(
      validate([col({ type: "email", required: true })], { field: "" }).success,
    ).toBe(false);
  });

  it("accepts various valid formats", () => {
    const c = col({ type: "email" });
    expect(validate([c], { field: "user+tag@sub.domain.com" }).success).toBe(
      true,
    );
    expect(validate([c], { field: "USER@EXAMPLE.COM" }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  URL
// ─────────────────────────────────────────────────────────────
describe("url column", () => {
  it("accepts valid URLs", () => {
    const c = col({ type: "url" });
    expect(validate([c], { field: "https://example.com" }).success).toBe(true);
    expect(validate([c], { field: "http://localhost:3000" }).success).toBe(
      true,
    );
    expect(
      validate([c], { field: "https://sub.domain.com/path?q=1" }).success,
    ).toBe(true);
  });

  it("rejects plain text", () => {
    expect(
      validate([col({ type: "url" })], { field: "not a url" }).success,
    ).toBe(false);
  });

  it("rejects missing protocol", () => {
    expect(
      validate([col({ type: "url" })], { field: "example.com" }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  CURRENCY
// ─────────────────────────────────────────────────────────────
describe("currency column", () => {
  it("accepts numeric values", () => {
    expect(
      validate([col({ type: "currency" })], { field: 1234.56 }).success,
    ).toBe(true);
    expect(validate([col({ type: "currency" })], { field: 0 }).success).toBe(
      true,
    );
    expect(validate([col({ type: "currency" })], { field: -50 }).success).toBe(
      true,
    );
  });

  it("enforces min", () => {
    const c = col({ type: "currency", min: 0 });
    expect(validate([c], { field: -1 }).success).toBe(false);
    expect(validate([c], { field: 0 }).success).toBe(true);
  });

  it("rejects non-numeric", () => {
    expect(
      validate([col({ type: "currency" })], { field: "RM 100" }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  PERCENTAGE
// ─────────────────────────────────────────────────────────────
describe("percentage column", () => {
  it("accepts 0–100", () => {
    const c = col({ type: "percentage" });
    expect(validate([c], { field: 0 }).success).toBe(true);
    expect(validate([c], { field: 50.5 }).success).toBe(true);
    expect(validate([c], { field: 100 }).success).toBe(true);
  });

  it("rejects out of range by default", () => {
    const c = col({ type: "percentage" });
    expect(validate([c], { field: -1 }).success).toBe(false);
    expect(validate([c], { field: 101 }).success).toBe(false);
  });

  it("respects custom min/max", () => {
    const c = col({ type: "percentage", min: 0, max: 200 });
    expect(validate([c], { field: 150 }).success).toBe(true);
    expect(validate([c], { field: 201 }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  RATING
// ─────────────────────────────────────────────────────────────
describe("rating column", () => {
  it("accepts integers 0–5 by default", () => {
    const c = col({ type: "rating" });
    expect(validate([c], { field: 0 }).success).toBe(true);
    expect(validate([c], { field: 3 }).success).toBe(true);
    expect(validate([c], { field: 5 }).success).toBe(true);
  });

  it("rejects floats (must be integer)", () => {
    expect(validate([col({ type: "rating" })], { field: 3.5 }).success).toBe(
      false,
    );
  });

  it("rejects values above ratingMax", () => {
    const c = col({ type: "rating", ratingMax: 10 });
    expect(validate([c], { field: 10 }).success).toBe(true);
    expect(validate([c], { field: 11 }).success).toBe(false);
  });

  it("rejects negative", () => {
    expect(validate([col({ type: "rating" })], { field: -1 }).success).toBe(
      false,
    );
  });

  it("rejects 0 when required", () => {
    const c = col({ type: "rating", required: true });
    expect(validate([c], { field: 0 }).success).toBe(false);
    expect(validate([c], { field: 1 }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  SELECT
// ─────────────────────────────────────────────────────────────
describe("select column — static options", () => {
  const options = [
    { label: "Active", value: "active" },
    { label: "Closed", value: "closed" },
  ];

  it("accepts valid option value", () => {
    expect(
      validate([col({ type: "select", options })], { field: "active" }).success,
    ).toBe(true);
  });

  it("rejects invalid option value", () => {
    expect(
      validate([col({ type: "select", options })], { field: "unknown" })
        .success,
    ).toBe(false);
  });

  it("is optional when not required", () => {
    expect(validate([col({ type: "select", options })], {}).success).toBe(true);
  });

  it("falls back to string when no options defined", () => {
    expect(
      validate([col({ type: "select" })], { field: "anything" }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  SELECT — ASYNC (loadOptions)
//  Stored value is { value: string, label: string } — a SelectOption object.
//  Validation must accept objects, not just strings.
// ─────────────────────────────────────────────────────────────
describe("select column — async (loadOptions)", () => {
  const loadOptions = async (_: string) => [{ value: "uuid-1", label: "BULK" }];

  it("accepts {value, label} object (async select storage format)", () => {
    const r = validate([col({ type: "select", loadOptions })], {
      field: { value: "uuid-1", label: "BULK" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts plain string (backward compat)", () => {
    const r = validate([col({ type: "select", loadOptions })], {
      field: "uuid-1",
    });
    expect(r.success).toBe(true);
  });

  it("is optional — accepts null when not required", () => {
    const r = validate([col({ type: "select", loadOptions })], { field: null });
    expect(r.success).toBe(true);
  });

  it("rejects empty object {} when required — .value is missing", () => {
    const r = validate([col({ type: "select", loadOptions, required: true })], {
      field: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects null when required", () => {
    const r = validate([col({ type: "select", loadOptions, required: true })], {
      field: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepts {value, label} when required and value is present", () => {
    const r = validate([col({ type: "select", loadOptions, required: true })], {
      field: { value: "uuid-1", label: "BULK" },
    });
    expect(r.success).toBe(true);
  });

  it('never throws "Expected string, received object"', () => {
    const r = validate([col({ type: "select", loadOptions, required: true })], {
      field: { value: "uuid-1", label: "BULK" },
    });
    // Should succeed — the old bug returned a type error here
    expect(r.success).toBe(true);
    if (!r.success) {
      const msgs = r.error.errors.map((e) => e.message);
      expect(msgs.some((m) => m.includes("Expected string"))).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  MULTISELECT — STATIC
// ─────────────────────────────────────────────────────────────
describe("multiselect column — static", () => {
  it("accepts array of strings", () => {
    expect(
      validate([col({ type: "multiselect" })], { field: ["a", "b"] }).success,
    ).toBe(true);
  });

  it("accepts empty array when not required", () => {
    expect(
      validate([col({ type: "multiselect" })], { field: [] }).success,
    ).toBe(true);
  });

  it("rejects empty array when required", () => {
    expect(
      validate([col({ type: "multiselect", required: true })], { field: [] })
        .success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  MULTISELECT — ASYNC (loadOptions)
//  Stored value is SelectOption[] — array of { value, label } objects.
// ─────────────────────────────────────────────────────────────
describe("multiselect column — async (loadOptions)", () => {
  const loadOptions = async (_: string) => [{ value: "id-1", label: "Alpha" }];

  it("accepts array of {value, label} objects", () => {
    const r = validate([col({ type: "multiselect", loadOptions })], {
      field: [
        { value: "id-1", label: "Alpha" },
        { value: "id-2", label: "Beta" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts empty array when not required", () => {
    const r = validate([col({ type: "multiselect", loadOptions })], {
      field: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty array when required", () => {
    const r = validate(
      [col({ type: "multiselect", loadOptions, required: true })],
      { field: [] },
    );
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  DATE
// ─────────────────────────────────────────────────────────────
describe("date column", () => {
  it("accepts ISO date string", () => {
    expect(
      validate([col({ type: "date" })], { field: "2025-01-15" }).success,
    ).toBe(true);
  });

  it("rejects invalid date", () => {
    expect(
      validate([col({ type: "date" })], { field: "not-a-date" }).success,
    ).toBe(false);
  });

  it("enforces minDate", () => {
    const c = col({ type: "date", minDate: "2025-01-01" });
    expect(validate([c], { field: "2024-12-31" }).success).toBe(false);
    expect(validate([c], { field: "2025-01-01" }).success).toBe(true);
  });

  it("enforces maxDate", () => {
    const c = col({ type: "date", maxDate: "2025-12-31" });
    expect(validate([c], { field: "2026-01-01" }).success).toBe(false);
    expect(validate([c], { field: "2025-06-15" }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  CHECKBOX
// ─────────────────────────────────────────────────────────────
describe("checkbox column", () => {
  it("accepts true/false", () => {
    expect(validate([col({ type: "checkbox" })], { field: true }).success).toBe(
      true,
    );
    expect(
      validate([col({ type: "checkbox" })], { field: false }).success,
    ).toBe(true);
  });

  it("requires true when required", () => {
    const c = col({ type: "checkbox", required: true });
    expect(validate([c], { field: false }).success).toBe(false);
    expect(validate([c], { field: true }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  BADGE + PROGRESS (read-only — z.unknown())
// ─────────────────────────────────────────────────────────────
describe("badge and progress columns", () => {
  it("badge accepts any value", () => {
    expect(
      validate([col({ type: "badge" })], { field: "active" }).success,
    ).toBe(true);
    expect(validate([col({ type: "badge" })], { field: null }).success).toBe(
      true,
    );
  });

  it("progress accepts any value", () => {
    expect(validate([col({ type: "progress" })], { field: 75 }).success).toBe(
      true,
    );
    expect(validate([col({ type: "progress" })], { field: null }).success).toBe(
      true,
    );
  });
});

// ─────────────────────────────────────────────────────────────
//  COMPUTED — skipped entirely
// ─────────────────────────────────────────────────────────────
describe("computed columns", () => {
  it("skips computed columns — not in schema", () => {
    const columns: ColumnDef[] = [
      col({ key: "name", type: "text", required: true }),
      col({ key: "formula", type: "number", computed: true }),
    ];
    const schema = buildZodSchema(columns);
    // Schema should only have 'name', not 'formula'
    const shape = schema.shape as Record<string, unknown>;
    expect("name" in shape).toBe(true);
    expect("formula" in shape).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  CROSS-FIELD custom validate()
// ─────────────────────────────────────────────────────────────
describe("validateField with custom validate()", () => {
  it("runs custom validate function", () => {
    const c: ColumnDef = {
      ...col({ type: "number" }),
      validate: (v) => {
        if (Number(v) % 2 !== 0) return "Must be even";
        return undefined;
      },
    };
    expect(validateField(c, 4, {})).toBeNull();
    expect(validateField(c, 3, {})).toBe("Must be even");
  });

  it("cross-field validate using rowValues", () => {
    const c: ColumnDef = {
      ...col({ key: "endDate", type: "date" }),
      validate: (v, row) => {
        if (v && row["startDate"] && String(v) < String(row["startDate"])) {
          return "End date must be after start date";
        }
        return undefined;
      },
    };
    expect(
      validateField(c, "2025-06-01", { startDate: "2025-01-01" }),
    ).toBeNull();
    expect(validateField(c, "2024-12-31", { startDate: "2025-01-01" })).toBe(
      "End date must be after start date",
    );
  });
});

// ─────────────────────────────────────────────────────────────
//  MULTIPLE COLUMNS
// ─────────────────────────────────────────────────────────────
describe("multiple columns in one schema", () => {
  it("validates all columns independently", () => {
    const columns: ColumnDef[] = [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "budget", label: "Budget", type: "currency", min: 0 },
      { key: "rating", label: "Rating", type: "rating", ratingMax: 5 },
    ];

    // Valid
    expect(
      validate(columns, {
        name: "Acme Corp",
        email: "contact@acme.com",
        budget: 5000,
        rating: 4,
      }).success,
    ).toBe(true);

    // Missing required name
    expect(
      validate(columns, {
        name: "",
        email: "contact@acme.com",
        budget: 5000,
        rating: 4,
      }).success,
    ).toBe(false);

    // Invalid email
    expect(
      validate(columns, {
        name: "Acme",
        email: "not-email",
        budget: 5000,
        rating: 4,
      }).success,
    ).toBe(false);

    // Negative budget
    expect(
      validate(columns, {
        name: "Acme",
        email: "a@b.com",
        budget: -1,
        rating: 4,
      }).success,
    ).toBe(false);
  });
});
