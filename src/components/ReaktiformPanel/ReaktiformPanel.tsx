"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  MessageSquare,
  Paperclip,
  FileCheck,
  Lock,
} from "lucide-react";
import { cn } from "../../utils";
import { DetailsTab } from "./DetailsTab";
import { ActivityTab } from "./ActivityTab";
import { AttachmentsTab } from "./AttachmentsTab";
import { useAttachmentUploads } from "../../hooks/useAttachmentUploads";
import { Spinner } from "../primitives/Spinner";
import type {
  ColumnDef,
  Row,
  RowAttachment,
  UploadProgressReporter,
} from "../../types";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────
type PMFormTab = "details" | "activity" | "attachments";

export type ReaktiformPanelProps<TData = Record<string, unknown>> = {
  row: Row<TData> | null;
  columns: ColumnDef<TData>[];
  rowIdKey?: string;
  isOpen: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSave: (rowId: string, draft: Record<string, unknown>) => void;
  onDiscard: (rowId: string) => void;
  /**
   * Called on every field change in the detail panel form.
   * Use this to update the table row live as the user types.
   * The grid wires this to grid.markDirty internally.
   */
  onFieldChange?: (rowId: string, field: string, value: unknown) => void;
  onAddComment?: (rowId: string, text: string) => void;
  /** Load file attachments for a row when its detail panel opens. */
  onLoadAttachments?: (rowId: string) => Promise<RowAttachment[]>;
  onUploadFile?: (
    rowId: string,
    files: File[],
    helpers?: { onProgress: UploadProgressReporter; fileIds: string[] },
  ) => Promise<RowAttachment[]>;
  onDeleteAttachment?: (rowId: string, attachmentId: string) => Promise<void>;
  /** Render a custom component for each attachment row, replacing the built-in row. */
  renderAttachment?: (
    attachment: RowAttachment,
    helpers: { onDelete: () => void },
  ) => React.ReactNode;
  width?: number;
  className?: string | undefined;
  // ── Tab control
  /**
   * Which tabs to show. Defaults to all: ['details', 'activity', 'files'].
   * Tabs are also auto-hidden when their callback is missing.
   */
  panelTabs?: Array<"details" | "activity" | "files"> | undefined;
  // ── Permission control
  /** Allow saving from the panel. Default: true */
  canSave?: boolean;
  /** Allow editing fields in the panel. Default: true */
  canEdit?: boolean;
  /**
   * Edit Lock — session-level "child lock" (see `GridConfig.editLocked`).
   * When true, every field renders as its read-only static display,
   * regardless of `canEdit` / per-column `readOnly`. Default: false
   */
  editLocked?: boolean;
  /** Allow adding comments. Default: true */
  canComment?: boolean;
  /** Allow uploading files. Default: true */
  canUploadFiles?: boolean;
  /** Allow selecting/dropping more than one file at a time in the Files tab. Default: false */
  allowMultipleFileUpload?: boolean;
};

// ─────────────────────────────────────────────────────────────
//  MAIN ReaktiformPanel
// ─────────────────────────────────────────────────────────────
export function ReaktiformPanel<TData = Record<string, unknown>>({
  row,
  columns,
  rowIdKey = "id",
  isOpen,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
  onSave,
  onDiscard,
  onFieldChange,
  onAddComment,
  onLoadAttachments,
  onUploadFile,
  onDeleteAttachment,
  renderAttachment,
  width = 440,
  className,
  panelTabs,
  canSave = true,
  canEdit = true,
  editLocked = false,
  canComment = true,
  canUploadFiles = true,
  allowMultipleFileUpload = false,
}: ReaktiformPanelProps<TData>) {
  const [activeTab, setActiveTab] = useState<PMFormTab>("details");
  // Incremented when Discard is clicked — forces DetailsTab to reset RHF state
  const [resetKey, setResetKey] = useState(0);

  const rowId = row
    ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
    : "";
  const description = row
    ? String((row as Record<string, unknown>)["description"] ?? "")
    : "";
  const rowLabel = row
    ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
    : "";
  const isDirty = !!row?._draft;
  const hasErrors = Object.keys(row?._errors ?? {}).length > 0;

  const {
    loadedAttachments,
    attachmentsLoading,
    pendingUploads,
    handleAttachmentUpload,
    handleRetryUpload,
    handleDismissUpload,
    handleAttachmentDelete,
  } = useAttachmentUploads({
    rowId,
    isOpen,
    initialAttachments: row?._attachments,
    ...(onUploadFile !== undefined && { onUploadFile }),
    ...(onLoadAttachments !== undefined && { onLoadAttachments }),
    ...(onDeleteAttachment !== undefined && { onDeleteAttachment }),
  });

  // Build the visible tabs list:
  // 1. Filter by panelTabs prop (if provided)
  // 2. Auto-hide Activity if no comment callback
  // 3. Auto-hide Files if no upload callback
  const ALL_TABS: { id: PMFormTab; label: string; icon: React.ElementType }[] =
    [
      { id: "details", label: "Details", icon: FileCheck },
      { id: "activity", label: "Activity", icon: MessageSquare },
      { id: "attachments", label: "Files", icon: Paperclip },
    ];

  const TABS = ALL_TABS.filter((tab) => {
    // panelTabs prop: explicit whitelist
    if (panelTabs) {
      const mapId = tab.id === "attachments" ? "files" : tab.id;
      if (!panelTabs.includes(mapId as "details" | "activity" | "files"))
        return false;
    }
    // Auto-hide tabs whose feature callbacks are absent
    if (tab.id === "activity" && !onAddComment) return false;
    if (tab.id === "attachments" && !onUploadFile) return false;
    return true;
  });

  // If current active tab was hidden, reset to details
  useEffect(() => {
    if (!TABS.find((t) => t.id === activeTab)) {
      setActiveTab("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTabs, onAddComment, onUploadFile]);

  return (
    <>
      {/* Backdrop — only visible when open, click to close */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 149,
          background: "rgba(15,23,42,.25)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.22s ease",
        }}
      />

      {/* Panel — always in DOM, translated off-screen when closed */}
      <div
        data-reaktiform
        className={cn(
          "fixed inset-y-0 right-0 bg-rf-surface",
          "border-l border-rf-border shadow-rf-lg z-[150]",
          "flex flex-col overflow-hidden",
          className,
        )}
        style={{
          width,
          transform: isOpen ? "translateX(0)" : `translateX(${width + 2}px)`,
          transition: "transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)",
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        {/* HEADER */}
        <div className="rf-flex rf-items-center rf-gap-2 px-4 py-3 border-b border-rf-border bg-rf-header rf-flex-shrink-0">
          <div className="rf-flex-1 rf-min-w-0">
            <div className="rf-flex rf-items-center rf-gap-2 mb-0.5">
              <span className="text-[10.5px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em]">
                {rowLabel}
              </span>
              {isDirty && !hasErrors && (
                <span className="text-[10px] rf-font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Unsaved
                </span>
              )}
              {hasErrors && (
                <span className="text-[10px] rf-font-bold bg-rf-err-bg text-rf-err border border-rf-err-br rounded-full px-1.5 py-0.5">
                  Errors
                </span>
              )}
            </div>
            <div className="text-[14px] rf-font-semibold text-rf-text-1 rf-truncate">
              {description || "Record Details"}
            </div>
          </div>
          <div className="rf-flex rf-gap-1 rf-flex-shrink-0">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronLeft className="w-[13px] h-[13px]" />
            </button>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronRight className="w-[13px] h-[13px]" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-rf-md border border-rf-border bg-transparent rf-flex rf-items-center rf-justify-center text-rf-text-3 hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br rf-transition-colors"
          >
            <X className="w-[13px] h-[13px]" />
          </button>
        </div>

        {/* TABS */}
        <div className="rf-flex border-b border-rf-border bg-rf-surface rf-flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-all border-b-2",
                activeTab === id
                  ? "text-rf-accent border-rf-accent font-semibold"
                  : "text-rf-text-3 border-transparent hover:text-rf-text-2",
              )}
            >
              <Icon className="rf-icon-sm" />
              {label}
            </button>
          ))}
        </div>

        {/* TAB BODY — scrollable */}
        <div
          className="rf-flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {row && activeTab === "details" && (
            // key={rowId} forces React to unmount+remount DetailsTab when row changes.
            // This resets React Hook Form with fresh defaultValues for the new row.
            // Without this, useForm keeps stale values from the previous row.
            <DetailsTab
              key={rowId}
              row={row}
              rowId={rowId}
              columns={columns}
              editLocked={editLocked}
              resetKey={resetKey}
              onFieldChange={(field, value) => {
                // Call parent's onFieldChange so the table reflects changes immediately
                // This calls grid.markDirty on every keystroke → table updates live
                onFieldChange?.(rowId, field, value);
              }}
              onSave={(data) => onSave(rowId, data)}
            />
          )}
          {row && activeTab === "activity" && (
            <ActivityTab
              rowId={rowId}
              comments={row._comments ?? []}
              canComment={canComment}
              {...(onAddComment !== undefined && { onAddComment })}
            />
          )}
          {row &&
            activeTab === "attachments" &&
            (row?._new ? (
              <div className="rf-flex-col rf-items-center rf-justify-center rf-h-full text-rf-text-3 rf-gap-3">
                <FileCheck className="w-10 h-10 opacity-30" />
                <span className="text-[13px]">
                  Save the records to upload the files
                </span>
              </div>
            ) : (
              <AttachmentsTab
                rowId={rowId}
                attachments={loadedAttachments ?? row._attachments ?? []}
                isLoading={attachmentsLoading}
                canUploadFiles={canUploadFiles}
                allowMultipleFileUpload={allowMultipleFileUpload}
                pendingUploads={pendingUploads.filter((p) => p.rowId === rowId)}
                onRetryUpload={handleRetryUpload}
                onDismissUpload={handleDismissUpload}
                {...(onUploadFile !== undefined && {
                  onUploadFile: handleAttachmentUpload,
                })}
                {...(onDeleteAttachment !== undefined && {
                  onDeleteAttachment: handleAttachmentDelete,
                })}
                {...(renderAttachment !== undefined && { renderAttachment })}
              />
            ))}
          {!row && (
            <div className="rf-flex-col rf-items-center rf-justify-center rf-h-full text-rf-text-3 rf-gap-3">
              <FileCheck className="w-10 h-10 opacity-30" />
              <span className="text-[13px]">Select a row to view details</span>
            </div>
          )}
        </div>

        {/* PANEL FOOTER — always visible at bottom, never scrolls away. */}
        {row && activeTab === "details" && (
          <div
            className="rf-flex-shrink-0 rf-flex rf-gap-2 px-4 py-3 border-t border-rf-border bg-rf-surface"
            style={{ boxShadow: "0 -4px 12px rgba(15,23,42,.06)" }}
          >
            {canEdit && canSave && !editLocked ? (
              (() => {
                const isSavingRow = !!row._saving;
                return (
                  <>
                    <button
                      type="submit"
                      form={`rf-details-form-${rowId}`}
                      disabled={isSavingRow}
                      className="rf-flex-1 rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 py-2.5 text-[13px] rf-font-semibold rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      {isSavingRow ? (
                        <>
                          <Spinner size={14} />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="rf-icon-sm" /> Save Changes
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingRow}
                      onClick={() => {
                        onDiscard(rowId);
                        setResetKey((k) => k + 1);
                      }}
                      className="rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 px-4 py-2.5 text-[13px] rf-font-medium rounded-rf-md bg-rf-surface text-rf-text-2 border border-rf-border hover:bg-rf-header rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      <RotateCcw className="rf-icon-sm" /> Discard
                    </button>
                  </>
                );
              })()
            ) : (
              <div className="rf-flex-1 rf-flex rf-items-center rf-justify-center rf-gap-2 py-2 text-[12.5px] text-rf-text-3">
                <Lock className="rf-icon-sm" />
                {editLocked
                  ? "Editing is locked — unlock it from the toolbar"
                  : !canEdit
                    ? "Read-only — you do not have edit permission"
                    : "Saving is disabled"}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
