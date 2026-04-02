import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ReaktiformPanel } from "../src/components/ReaktiformPanel";
import type { ReaktiformPanelProps } from "../src/components/ReaktiformPanel";
import type { Row, ColumnDef, SelectOption } from "../src/types";

// ── Reuse same column defs and options from PMGrid story
const statusOptions: SelectOption[] = [
  { label: "Identified", value: "identified", color: "info" },
  { label: "Under Review", value: "under_review", color: "warning" },
  { label: "Mitigated", value: "mitigated", color: "success" },
  { label: "Escalated", value: "escalated", color: "error" },
];

const severityOptions: SelectOption[] = [
  { label: "Low", value: "low", color: "success" },
  { label: "Medium", value: "medium", color: "warning" },
  { label: "High", value: "high", color: "error" },
  { label: "Critical", value: "critical", color: "purple" },
];

type RiskRow = {
  id: string;
  riskId: string;
  description: string;
  status: string;
  severity: string;
  probability: number;
  dueDate: string;
  completion: number;
  approved: boolean;
};

const columns: ColumnDef<RiskRow>[] = [
  { key: "riskId", label: "Risk ID", type: "text", required: true },
  {
    key: "description",
    label: "Description",
    type: "text",
    required: true,
    multiline: true,
    rows: 3,
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: statusOptions,
  },
  {
    key: "severity",
    label: "Severity",
    type: "select",
    required: true,
    options: severityOptions,
  },
  {
    key: "probability",
    label: "Probability %",
    type: "number",
    required: true,
    min: 0,
    max: 100,
    suffix: "%",
  },
  { key: "dueDate", label: "Due Date", type: "date", required: true },
  {
    key: "completion",
    label: "Completion %",
    type: "number",
    required: true,
    min: 0,
    max: 100,
    suffix: "%",
  },
  { key: "approved", label: "Approved", type: "checkbox" },
];

const sampleRow: Row<RiskRow> = {
  id: "1",
  riskId: "RSK-001",
  description: "Subcontractor delay due to material shortage on site",
  status: "under_review",
  severity: "high",
  probability: 72,
  dueDate: "2025-04-15",
  completion: 60,
  approved: true,
  _id: "row_1",
  _saved: true,
  _new: false,
  _draft: null,
  _errors: {},
  _comments: [
    {
      id: "c1",
      author: "Alice Kwan",
      text: "Escalated to PM on 2025-02-10",
      createdAt: "2025-02-10",
    },
    {
      id: "c2",
      author: "Bob Patel",
      text: "Supplier confirmed alternate source — monitoring",
      createdAt: "2025-02-15",
    },
  ],
  _attachments: [
    { id: "a1", name: "Supplier_Letter.pdf", size: "142 KB", type: "pdf" },
    { id: "a2", name: "Risk_Analysis.xlsx", size: "88 KB", type: "xlsx" },
  ],
};

// ── Interactive wrapper for state management
function PMFormDemo(
  props: Omit<ReaktiformPanelProps<RiskRow>, "isOpen" | "onClose">,
) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div
      style={{ position: "relative", minHeight: 600, background: "#F4F6FA" }}
    >
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            margin: 24,
            padding: "8px 16px",
            background: "#3B5BDB",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Open Detail Panel
        </button>
      )}
      <ReaktiformPanel
        {...props}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  META
// ─────────────────────────────────────────────────────────────
const meta: Meta<typeof ReaktiformPanel> = {
  title: "reaktiform/PMForm",
  component: ReaktiformPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
**PMForm** is the detail side panel component that slides in from the right.

- Three tabs: Details (full form) · Activity (comments) · Attachments (files)
- All fields use React Hook Form + Zod validation
- Computed columns shown as read-only with \`fx\` badge
- Prev/Next navigation between records
- Spring-animated slide in/out via Framer Motion
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReaktiformPanel>;

// ─────────────────────────────────────────────────────────────
//  STORIES
// ─────────────────────────────────────────────────────────────

// ── 1. Default open
export const Default: Story = {
  name: "Details Tab",
  render: () => (
    <PMFormDemo
      row={sampleRow}
      columns={columns}
      rowIdKey="id"
      canGoPrev={false}
      canGoNext={true}
      onPrev={() => console.log("prev")}
      onNext={() => console.log("next")}
      onSave={(id, data) => console.log("[reaktiform] onSave", id, data)}
      onDiscard={(id) => console.log("[reaktiform] onDiscard", id)}
      onAddComment={(id, text) => console.log("[reaktiform] comment", id, text)}
      onUploadFile={(id, file) =>
        console.log("[reaktiform] upload", id, file.name)
      }
      onDeleteAttachment={(id, attId) =>
        console.log("[reaktiform] delete attachment", id, attId)
      }
    />
  ),
};

// ── 2. With unsaved draft
export const WithUnsavedDraft: Story = {
  name: "With Unsaved Changes",
  render: () => (
    <PMFormDemo
      row={{
        ...sampleRow,
        _draft: { ...sampleRow, status: "escalated", probability: 90 },
        _saved: false,
        _errors: {},
      }}
      columns={columns}
      rowIdKey="id"
      onSave={(id, data) => console.log("onSave", id, data)}
      onDiscard={(id) => console.log("onDiscard", id)}
    />
  ),
};

// ── 3. With validation errors
export const WithErrors: Story = {
  name: "With Validation Errors",
  render: () => (
    <PMFormDemo
      row={{
        ...sampleRow,
        _draft: { ...sampleRow, riskId: "invalid", description: "" },
        _saved: false,
        _errors: {
          riskId: "Format: RSK-001",
          description: "Required. Min 5 characters.",
        },
      }}
      columns={columns}
      rowIdKey="id"
      onSave={(id, data) => console.log("onSave", id, data)}
      onDiscard={(id) => console.log("onDiscard", id)}
    />
  ),
};

// ── 4. Empty (no row selected)
export const NoRowSelected: Story = {
  name: "No Row Selected",
  render: () => (
    <PMFormDemo
      row={null}
      columns={columns}
      rowIdKey="id"
      onSave={() => {}}
      onDiscard={() => {}}
    />
  ),
};
