import type { Meta, StoryObj } from "@storybook/react";
import { Reaktiform } from "../src/components/Reaktiform";
import type { ColumnDef, SelectOption } from "../src/types";

// ── Sample data type
type RiskRow = {
  id: string;
  riskId: string;
  description: string;
  category: string;
  status: string;
  severity: string;
  probability: number;
  owner: string;
  dueDate: string;
  tags: string[];
  completion: number;
  approved: boolean;
  riskScore?: number;
};

// ── Options
const statusOptions: SelectOption[] = [
  { label: "Identified", value: "identified", color: "info" },
  { label: "Under Review", value: "under_review", color: "warning" },
  { label: "Mitigated", value: "mitigated", color: "success" },
  { label: "Closed", value: "closed", color: "default" },
  { label: "Escalated", value: "escalated", color: "error" },
];

const severityOptions: SelectOption[] = [
  { label: "Low", value: "low", color: "success" },
  { label: "Medium", value: "medium", color: "warning" },
  { label: "High", value: "high", color: "error" },
  { label: "Critical", value: "critical", color: "purple" },
];

const categoryOptions: SelectOption[] = [
  { label: "Technical", value: "technical" },
  { label: "Financial", value: "financial" },
  { label: "Schedule", value: "schedule" },
  { label: "Regulatory", value: "regulatory" },
  { label: "Safety", value: "safety" },
  { label: "Environmental", value: "environmental" },
  { label: "Contract", value: "contract" },
];

const ownerOptions: SelectOption[] = [
  { label: "Alice Kwan", value: "alice_kwan" },
  { label: "Bob Patel", value: "bob_patel" },
  { label: "Carlos Mendes", value: "carlos_mendes" },
  { label: "Diana Lee", value: "diana_lee" },
  { label: "Ethan Wright", value: "ethan_wright" },
];

const tagOptions: SelectOption[] = [
  { label: "Phase 1", value: "phase_1" },
  { label: "Phase 2", value: "phase_2" },
  { label: "Client Facing", value: "client_facing" },
  { label: "Internal", value: "internal" },
  { label: "External Audit", value: "external_audit" },
  { label: "Structural", value: "structural" },
  { label: "MEP", value: "mep" },
];

const sevWeight: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ── Column definitions
const columns: ColumnDef<RiskRow>[] = [
  {
    key: "riskId",
    label: "Risk ID",
    type: "text",
    width: 120,
    required: true,
    pattern: /^RSK-\d{3,}$/,
    patternMessage: "Format: RSK-001",
    pinned: true,
  },
  {
    key: "description",
    label: "Description",
    type: "text",
    width: 240,
    required: true,
    minLength: 5,
  },
  {
    key: "category",
    label: "Category",
    type: "select",
    width: 130,
    required: true,
    options: categoryOptions,
    groupable: true,
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    width: 130,
    required: true,
    options: statusOptions,
    groupable: true,
    pinned: true,
  },
  {
    key: "severity",
    label: "Severity",
    type: "select",
    width: 120,
    required: true,
    options: severityOptions,
    groupable: true,
  },
  {
    key: "probability",
    label: "Probability %",
    type: "number",
    width: 110,
    required: true,
    min: 0,
    max: 100,
    suffix: "%",
  },
  {
    key: "owner",
    label: "Owner",
    type: "select",
    width: 150,
    required: true,
    options: ownerOptions,
    groupable: true,
  },
  {
    key: "dueDate",
    label: "Due Date",
    type: "date",
    width: 130,
    required: true,
  },
  {
    key: "tags",
    label: "Tags",
    type: "multiselect",
    width: 160,
    options: tagOptions,
  },
  {
    key: "completion",
    label: "Completion %",
    type: "number",
    width: 130,
    required: true,
    min: 0,
    max: 100,
    suffix: "%",
  },
  {
    key: "approved",
    label: "Approved",
    type: "checkbox",
    width: 90,
    groupable: true,
  },
  // ── Computed column
  {
    key: "riskScore",
    label: "Risk Score",
    type: "number",
    width: 110,
    computed: true,
    saveable: true,
    dependsOn: ["probability", "severity"],
    formula: (row) => {
      const w = sevWeight[row.severity] ?? 1;
      return Math.round(((row.probability ?? 0) * w) / 10);
    },
  },
];

// ── Sample rows
const sampleData: RiskRow[] = [
  {
    id: "1",
    riskId: "RSK-001",
    description: "Subcontractor delay due to material shortage",
    category: "schedule",
    status: "under_review",
    severity: "high",
    probability: 72,
    owner: "alice_kwan",
    dueDate: "2025-04-15",
    tags: ["phase_1", "client_facing"],
    completion: 60,
    approved: true,
  },
  {
    id: "2",
    riskId: "RSK-002",
    description: "Design revision scope creep impacting budget",
    category: "financial",
    status: "identified",
    severity: "critical",
    probability: 55,
    owner: "bob_patel",
    dueDate: "2025-03-28",
    tags: ["external_audit"],
    completion: 30,
    approved: false,
  },
  {
    id: "3",
    riskId: "RSK-003",
    description: "Site soil contamination during excavation",
    category: "environmental",
    status: "mitigated",
    severity: "medium",
    probability: 40,
    owner: "carlos_mendes",
    dueDate: "2025-05-10",
    tags: ["phase_2", "structural"],
    completion: 85,
    approved: true,
  },
  {
    id: "4",
    riskId: "RSK-004",
    description: "Regulatory permit approval pending from authority",
    category: "regulatory",
    status: "identified",
    severity: "high",
    probability: 65,
    owner: "diana_lee",
    dueDate: "2025-04-01",
    tags: ["internal", "phase_1"],
    completion: 20,
    approved: false,
  },
  {
    id: "5",
    riskId: "RSK-005",
    description: "MEP coordination clash with structural systems",
    category: "technical",
    status: "under_review",
    severity: "medium",
    probability: 50,
    owner: "ethan_wright",
    dueDate: "2025-04-20",
    tags: ["mep", "phase_2"],
    completion: 45,
    approved: true,
  },
  {
    id: "6",
    riskId: "RSK-006",
    description: "LAD clause trigger risk if milestone slips",
    category: "contract",
    status: "escalated",
    severity: "critical",
    probability: 80,
    owner: "alice_kwan",
    dueDate: "2025-03-20",
    tags: ["client_facing", "external_audit"],
    completion: 15,
    approved: false,
  },
  {
    id: "7",
    riskId: "RSK-007",
    description: "Safety incident risk in confined space operations",
    category: "safety",
    status: "mitigated",
    severity: "low",
    probability: 25,
    owner: "bob_patel",
    dueDate: "2025-06-01",
    tags: ["internal"],
    completion: 90,
    approved: true,
  },
];

// ─────────────────────────────────────────────────────────────
//  META
// ─────────────────────────────────────────────────────────────
const meta: Meta<typeof Reaktiform> = {
  title: "reaktiform/Reaktiform",
  component: Reaktiform,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
**PMGrid** is the core inline-editable data grid component.

- Click any cell to edit inline
- Tab / Enter to confirm, Esc to cancel
- Arrow keys to navigate between cells
- Save / Discard per row — changes are drafts until explicitly saved
- Column header bottom row: Filter | Pin | Group controls
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Reaktiform>;

// ─────────────────────────────────────────────────────────────
//  STORIES
// ─────────────────────────────────────────────────────────────

// ── 1. Full featured (default)
export const FullFeatured: Story = {
  name: "Full Featured — Risk Register",
  args: {
    columns: columns as any,
    data: sampleData,
    features: {
      groupBy: true,
      conditionalFormat: true,
      sidePanel: true,
      undoRedo: true,
      columnResize: true,
      columnPin: true,
      columnHide: true,
      keyboardNav: true,
    },
    onSave: async (row) => {
      console.log("[reaktiform] onSave", row);
    },
    onDelete: async (id) => {
      console.log("[reaktiform] onDelete", id);
    },
    labels: {
      newRecord: "New Risk",
      saveAll: "Save All Risks",
    },
  },
};

// ── 2. Minimal — just data + columns
export const Minimal: Story = {
  name: "Minimal — No extra features",
  args: {
    columns: columns.slice(0, 5) as any,
    data: sampleData.slice(0, 3),
    features: {
      undoRedo: false,
      sidePanel: false,
      conditionalFormat: false,
    },
  },
};

// ── 3. Empty state
export const EmptyState: Story = {
  name: "Empty State",
  args: {
    columns: columns as any,
    data: [],
  },
};

// ── 4. With computed columns
export const WithComputedColumns: Story = {
  name: "With Computed Columns",
  parameters: {
    docs: {
      description: {
        story:
          "The **Risk Score** column is computed automatically from `probability × severity weight`. It cannot be edited and shows an `fx` badge.",
      },
    },
  },
  args: {
    columns: columns as any,
    data: sampleData,
    features: { undoRedo: true },
  },
};

// ── 5. Grouped by severity
export const GroupedBySeverity: Story = {
  name: "Grouped by Severity",
  args: {
    columns: columns as any,
    data: sampleData,
    initialGroupBy: "severity",
    features: { groupBy: true },
  },
};

// ── 6. With initial pinned columns
export const WithPinnedColumns: Story = {
  name: "With Pinned Columns",
  args: {
    columns: columns as any,
    data: sampleData,
    initialPinnedColumns: ["riskId", "status", "severity"],
  },
};
