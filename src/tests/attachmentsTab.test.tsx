// @vitest-environment jsdom
// src/tests/attachmentsTab.test.tsx
// ─────────────────────────────────────────────────────────────
// Exercises the Attachments tab's upload UX through the public
// ReaktiformPanel component (AttachmentsTab itself is a private,
// unexported sub-component of ReaktiformPanel.tsx).
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReaktiformPanel } from "../components/ReaktiformPanel/ReaktiformPanel";
import type { Row, RowAttachment } from "../types";

type TestRow = Row<{ id: string; title: string }>;

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "row-1",
    title: "Test row",
    _id: "row-1",
    _saved: true,
    _new: false,
    _draft: null,
    _errors: {},
    ...overrides,
  };
}

function makeFile(name: string, sizeBytes = 1024): File {
  const file = new File(["x".repeat(sizeBytes)], name, { type: "application/octet-stream" });
  return file;
}

function selectFile(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

async function openFilesTab(): Promise<HTMLInputElement> {
  fireEvent.click(screen.getByText("Files"));
  const label = (await screen.findByText(/Click to upload or drag & drop/i)).closest("label")!;
  return label.querySelector("input[type='file']") as HTMLInputElement;
}

function renderPanel(props: Partial<React.ComponentProps<typeof ReaktiformPanel>> = {}) {
  return render(
    <ReaktiformPanel
      row={makeRow()}
      columns={[]}
      isOpen
      onClose={() => {}}
      onSave={() => {}}
      onDiscard={() => {}}
      {...props}
    />,
  );
}

describe("AttachmentsTab upload UX", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a progress bar that updates as onProgress is called", async () => {
    let capturedOnProgress: ((fileId: string, pct: number) => void) | undefined;
    let capturedFileId: string | undefined;
    const onUploadFile = vi.fn(
      (_rowId: string, _files: File[], helpers?: { onProgress: (id: string, pct: number) => void; fileIds: string[] }) => {
        capturedOnProgress = helpers?.onProgress;
        capturedFileId = helpers?.fileIds[0];
        return new Promise<RowAttachment[]>(() => {}); // never resolves in this test
      },
    );

    renderPanel({ onUploadFile });
    const input = await openFilesTab();
    selectFile(input, [makeFile("report.pdf")]);

    expect(onUploadFile).toHaveBeenCalledTimes(1);
    expect(capturedOnProgress).toBeDefined();

    capturedOnProgress!(capturedFileId!, 42);
    await waitFor(() => {
      expect(screen.getByText("42%")).toBeTruthy();
    });
  });

  it("shows an error row with a working Retry button on rejection", async () => {
    let attempt = 0;
    const onUploadFile = vi.fn((_rowId: string, files: File[]) => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error("Network error"));
      return Promise.resolve(
        files.map((f, i) => ({ id: `a${i}`, name: f.name, size: "1.0 KB", type: "pdf" }) as RowAttachment),
      );
    });

    renderPanel({ onUploadFile });
    const input = await openFilesTab();
    selectFile(input, [makeFile("report.pdf")]);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });
    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    expect(onUploadFile).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.queryByText("Network error")).toBeNull();
    });
  });

  it("falls back to an indeterminate bar if onProgress is never called", async () => {
    const onUploadFile = vi.fn(() => new Promise<RowAttachment[]>(() => {}));
    renderPanel({ onUploadFile });
    const input = await openFilesTab();
    selectFile(input, [makeFile("stuck.pdf")]);

    // Before the stall threshold, the bar still shows a literal 0%.
    expect(screen.getByText("0%")).toBeTruthy();

    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.queryByText("0%")).toBeNull();
    });
  });

  it("shows skeleton placeholders while reloading a row that already has attachments", async () => {
    let resolveLoad: (v: RowAttachment[]) => void;
    const onLoadAttachments = vi.fn(
      () => new Promise<RowAttachment[]>((resolve) => (resolveLoad = resolve)),
    );
    const existing: RowAttachment[] = [{ id: "e1", name: "existing.pdf", size: "1.0 KB", type: "pdf" }];

    const { container } = renderPanel({
      onLoadAttachments,
      onUploadFile: vi.fn(),
      row: makeRow({ _attachments: existing }),
    });
    await openFilesTab();

    expect(screen.queryByText("existing.pdf")).toBeNull();
    expect(container.querySelectorAll(".rf-skeleton").length).toBeGreaterThan(0);

    resolveLoad!(existing);
    await waitFor(() => {
      expect(screen.getByText("existing.pdf")).toBeTruthy();
    });
    expect(container.querySelectorAll(".rf-skeleton").length).toBe(0);
  });

  it("tracks independent uploads with mixed outcomes simultaneously", async () => {
    const onUploadFile = vi.fn((_rowId: string, files: File[]) => {
      const file = files[0]!;
      if (file.name === "fails.pdf") return Promise.reject(new Error("Rejected by server"));
      return Promise.resolve([{ id: "ok1", name: file.name, size: "1.0 KB", type: "pdf" } as RowAttachment]);
    });

    renderPanel({ onUploadFile, allowMultipleFileUpload: true });
    const input = await openFilesTab();

    selectFile(input, [makeFile("fails.pdf")]);
    selectFile(input, [makeFile("ok.pdf")]);

    await waitFor(() => {
      expect(screen.getByText("Rejected by server")).toBeTruthy();
      expect(screen.getByText("ok.pdf")).toBeTruthy();
    });
  });
});
