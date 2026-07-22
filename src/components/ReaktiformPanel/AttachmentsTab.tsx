import { useState, useEffect } from "react";
import type { ElementType, ReactNode, DragEvent, ChangeEvent } from "react";
import { Upload, Lock, AlertCircle, X, File, FileText, FileSpreadsheet, FileCheck } from "lucide-react";
import { cn } from "../../utils";
import { ProgressBar } from "../primitives/ProgressBar";
import { Spinner } from "../primitives/Spinner";
import { Skeleton } from "../primitives/Skeleton";
import type { PendingUpload } from "../../hooks/useAttachmentUploads";
import type { RowAttachment } from "../../types";

// ─────────────────────────────────────────────────────────────
//  ATTACHMENTS TAB
// ─────────────────────────────────────────────────────────────
const ATTACH_ICONS: Record<string, ElementType> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  docx: FileCheck,
  doc: FileCheck,
};
const ATTACH_COLORS: Record<string, string> = {
  pdf: "bg-red-50 text-red-600",
  xlsx: "bg-green-50 text-green-600",
  xls: "bg-green-50 text-green-600",
  docx: "bg-blue-50 text-blue-600",
  doc: "bg-blue-50 text-blue-600",
};

// How long an upload can sit at 0% with no onProgress call before we stop
// showing a literal (stuck-looking) 0% bar and switch to an indeterminate one.
const STALL_THRESHOLD_MS = 1500;

export function AttachmentsTab({
  rowId,
  attachments,
  onUploadFile,
  onDeleteAttachment,
  renderAttachment,
  canUploadFiles = true,
  isLoading = false,
  allowMultipleFileUpload = false,
  pendingUploads,
  onRetryUpload,
  onDismissUpload,
}: {
  rowId: string;
  attachments: RowAttachment[];
  onUploadFile?: (rowId: string, files: File[]) => void;
  onDeleteAttachment?: (rowId: string, id: string) => void;
  renderAttachment?: (
    attachment: RowAttachment,
    helpers: { onDelete: () => void },
  ) => ReactNode;
  canUploadFiles?: boolean;
  isLoading?: boolean;
  /** Allow selecting/dropping more than one file at a time. Default: false (single file, original behavior). */
  allowMultipleFileUpload?: boolean;
  pendingUploads: PendingUpload[];
  onRetryUpload: (pendingId: string) => void;
  onDismissUpload: (pendingId: string) => void;
}) {
  const isEmpty = attachments.length === 0;
  const [isDragActive, setIsDragActive] = useState(false);
  // Forces a re-render every 500ms while any upload might need to flip to
  // indeterminate — otherwise the stall check below would only re-evaluate
  // on the next unrelated render.
  const [, forceTick] = useState(0);

  useEffect(() => {
    const hasStalledCandidate = pendingUploads.some(
      (p) => p.status === "uploading" && p.percent === 0,
    );
    if (!hasStalledCandidate) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, [pendingUploads]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (!canUploadFiles) return;
    const files = allowMultipleFileUpload
      ? Array.from(e.dataTransfer.files)
      : e.dataTransfer.files[0]
        ? [e.dataTransfer.files[0]]
        : [];
    if (files.length) onUploadFile?.(rowId, files);
  };
  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (!canUploadFiles) return;
    const picked = e.target.files;
    const files = allowMultipleFileUpload
      ? Array.from(picked ?? [])
      : picked?.[0]
        ? [picked[0]]
        : [];
    if (files.length) onUploadFile?.(rowId, files);
    // reset so picking the same file(s) again still fires onChange
    e.target.value = "";
  };

  const showEmptyText = !isLoading && isEmpty && pendingUploads.length === 0;

  return (
    <div className="rf-flex rf-flex-col rf-h-full">
      <div className="sticky top-0 -mt-4 pt-4 z-40 bg-rf-surface rf-flex-shrink-0">
        {onUploadFile && canUploadFiles && (
          <label
            className={cn(
              "rf-flex rf-flex-col rf-items-center rf-justify-center rf-gap-2 border-2 border-dashed rounded-rf-lg p-6 rf-cursor-pointer transition-all",
              isDragActive
                ? "border-rf-accent bg-rf-accent-bg text-rf-accent"
                : "border-rf-border hover:border-rf-accent hover:bg-rf-accent-bg hover:text-rf-accent text-rf-text-3",
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="w-9 h-9 rf-flex rf-items-center rf-justify-center rounded-full bg-rf-accent-bg text-rf-accent">
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-[12.5px] rf-font-medium">
              Click to upload or drag & drop
            </span>
            <span className="text-[11px]">PDF, DOCX, XLSX, PNG, JPG</span>
            <input
              type="file"
              multiple={allowMultipleFileUpload}
              className="rf-hidden"
              onChange={handlePick}
            />
          </label>
        )}
        {onUploadFile && !canUploadFiles && (
          <div className="rf-flex rf-items-center rf-justify-center rf-gap-2 border border-rf-border rounded-rf-lg p-4 text-rf-text-3 text-[12.5px]">
            <Lock className="rf-icon-sm" /> You do not have permission to upload
            files
          </div>
        )}
        <div className="rf-flex-shrink-0 text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mt-4 mb-3 pb-1.5 border-b border-rf-border">
          Files ({attachments.length})
        </div>
      </div>
      <div
        className={cn(
          "rf-flex rf-flex-col",
          showEmptyText && "rf-justify-center rf-flex-1",
        )}
      >
        {pendingUploads.length > 0 && (
          <div className="rf-flex-col rf-gap-1.5 mb-2">
            {pendingUploads.map((p) => {
              const isStalled =
                p.status === "uploading" &&
                p.percent === 0 &&
                Date.now() - p.lastProgressAt > STALL_THRESHOLD_MS;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rf-flex rf-items-center rf-gap-2.5 p-2.5 border rounded-rf-md",
                    p.status === "error"
                      ? "border-rf-err-br bg-rf-err-bg"
                      : "border-rf-border",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-rf-sm flex items-center justify-center flex-shrink-0",
                      p.status === "error"
                        ? "bg-rf-err-bg text-rf-err"
                        : "bg-rf-accent-bg text-rf-accent",
                    )}
                  >
                    {p.status === "error" ? (
                      <AlertCircle className="rf-icon-lg" />
                    ) : (
                      <Spinner size={16} />
                    )}
                  </div>
                  <div className="rf-flex-1 rf-min-w-0">
                    <div className="text-[12.5px] rf-font-medium text-rf-text-1 rf-truncate">
                      {p.name}
                    </div>
                    {p.status === "error" ? (
                      <div className="text-[11px] text-rf-err rf-truncate">
                        {p.errorMessage ?? "Upload failed"}
                      </div>
                    ) : (
                      <ProgressBar
                        value={p.percent}
                        tone="accent"
                        indeterminate={isStalled}
                        className="mt-1"
                      />
                    )}
                  </div>
                  {p.status === "error" && (
                    <div className="rf-flex rf-items-center rf-gap-1 rf-flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onRetryUpload(p.id)}
                        className="px-2 py-1 text-[11px] rf-font-semibold rounded text-rf-accent hover:bg-rf-accent-bg rf-transition-colors"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissUpload(p.id)}
                        className="p-1 rounded text-rf-text-3 hover:text-rf-err hover:bg-rf-err-bg rf-transition-colors"
                        title="Dismiss"
                      >
                        <X className="rf-icon-sm" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isLoading ? (
          <div className="rf-flex-col rf-gap-1.5 mb-4">
            {Array.from({ length: Math.max(attachments.length, 3) }).map(
              (_, i) => (
                <div
                  key={i}
                  className="rf-flex rf-items-center rf-gap-2.5 p-2.5 border border-rf-border rounded-rf-md"
                >
                  <Skeleton width={32} height={32} rounded="sm" />
                  <div className="rf-flex-1 rf-min-w-0 rf-flex rf-flex-col rf-gap-1.5">
                    <Skeleton width="70%" height={12} />
                    <Skeleton width="35%" height={10} />
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          !isEmpty && (
            <div className="rf-flex-col rf-gap-1.5 mb-4">
              {attachments.map((a) => {
                if (renderAttachment) {
                  return (
                    <div key={a.id}>
                      {renderAttachment(a, {
                        onDelete: () => onDeleteAttachment?.(rowId, a.id),
                      })}
                    </div>
                  );
                }

                const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
                const IconComp = ATTACH_ICONS[ext] ?? File;
                const colorClass =
                  ATTACH_COLORS[ext] ?? "bg-rf-header text-rf-text-2";
                return (
                  <div
                    key={a.id}
                    className="rf-flex rf-items-center rf-gap-2.5 p-2.5 border border-rf-border rounded-rf-md hover:bg-rf-row-hover rf-transition-colors group"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-rf-sm flex items-center justify-center flex-shrink-0",
                        colorClass,
                      )}
                    >
                      <IconComp className="rf-icon-lg" />
                    </div>
                    <div className="rf-flex-1 rf-min-w-0">
                      <div className="text-[12.5px] rf-font-medium text-rf-text-1 rf-truncate">
                        {a.name}
                      </div>
                      <div className="text-[11px] text-rf-text-3">{a.size}</div>
                    </div>
                    {onDeleteAttachment && (
                      <button
                        type="button"
                        onClick={() => onDeleteAttachment(rowId, a.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-rf-text-3 hover:text-rf-err hover:bg-rf-err-bg transition-all"
                        title="Remove"
                      >
                        <X className="rf-icon-sm" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
        {showEmptyText && (
          <div className="text-center py-3 text-[12.5px] text-rf-text-3 rf-italic mb-4">
            No files attached
          </div>
        )}
      </div>
    </div>
  );
}
