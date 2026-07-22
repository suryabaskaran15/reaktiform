import { useState, useEffect } from "react";
import { generateId, formatFileSize } from "../utils";
import type { RowAttachment, UploadProgressReporter } from "../types";

// An upload that's in flight or has failed. Never becomes a RowAttachment
// directly — the caller removes it once the consumer's onUploadFile resolves
// and appends the real RowAttachment(s) it returned.
export type PendingUpload = {
  id: string;
  rowId: string;
  file: File;
  name: string;
  sizeLabel: string;
  percent: number;
  status: "uploading" | "error";
  errorMessage?: string | undefined;
  lastProgressAt: number;
};

/**
 * Owns ReaktiformPanel's attachment state: on-demand loading via
 * onLoadAttachments, and in-flight/failed upload tracking separate from the
 * committed RowAttachment[] list. Panel-internal — not part of any public
 * entry point.
 */
export function useAttachmentUploads(params: {
  rowId: string;
  isOpen: boolean;
  /** Static, consumer-provided fallback — typically row?._attachments. */
  initialAttachments: RowAttachment[] | undefined;
  onUploadFile?: (
    rowId: string,
    files: File[],
    helpers?: { onProgress: UploadProgressReporter; fileIds: string[] },
  ) => Promise<RowAttachment[]>;
  onLoadAttachments?: (rowId: string) => Promise<RowAttachment[]>;
  onDeleteAttachment?: (rowId: string, attachmentId: string) => Promise<void>;
}) {
  const { rowId, isOpen, initialAttachments, onUploadFile, onLoadAttachments, onDeleteAttachment } =
    params;

  // Loaded on-demand via onLoadAttachments when a row's panel opens — falls
  // back to initialAttachments until loaded / if onLoadAttachments isn't
  // provided at all.
  const [loadedAttachments, setLoadedAttachments] = useState<
    RowAttachment[] | null
  >(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !rowId || !onLoadAttachments) {
      setLoadedAttachments(null);
      return;
    }
    let cancelled = false;
    setLoadedAttachments(null);
    setAttachmentsLoading(true);
    onLoadAttachments(rowId)
      .then((result) => {
        if (!cancelled) setLoadedAttachments(result);
      })
      .catch(() => {
        if (!cancelled) setLoadedAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rowId, onLoadAttachments]);

  // In-flight/failed uploads, tracked separately from the committed
  // RowAttachment[] list. Tagged with the rowId they belong to so switching
  // rows (onPrev/onNext) never shows one row's uploads on another.
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  // Shared by both a fresh upload and a retry — starts the consumer's
  // onUploadFile call and reconciles pendingUploads based on the outcome.
  const runUpload = (
    targetRowId: string,
    filesToUpload: File[],
    fileIds: string[],
  ) => {
    if (!onUploadFile) return;
    const onProgress: UploadProgressReporter = (fileId, percent) => {
      setPendingUploads((prev) =>
        prev.map((p) =>
          p.id === fileId ? { ...p, percent, lastProgressAt: Date.now() } : p,
        ),
      );
    };
    onUploadFile(targetRowId, filesToUpload, { onProgress, fileIds })
      .then((newAttachments) => {
        setPendingUploads((prev) =>
          prev.filter((p) => !fileIds.includes(p.id)),
        );
        setLoadedAttachments((prev) => [
          ...(prev ?? initialAttachments ?? []),
          ...newAttachments,
        ]);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Upload failed";
        setPendingUploads((prev) =>
          prev.map((p) =>
            fileIds.includes(p.id)
              ? { ...p, status: "error" as const, errorMessage: message }
              : p,
          ),
        );
      });
  };

  const handleAttachmentUpload = (targetRowId: string, files: File[]) => {
    if (!onUploadFile) return;
    const fileIds = files.map(() => generateId("upload"));
    const startedAt = Date.now();
    setPendingUploads((prev) => [
      ...prev,
      ...files.map((file, i) => ({
        id: fileIds[i]!,
        rowId: targetRowId,
        file,
        name: file.name,
        sizeLabel: formatFileSize(file.size),
        percent: 0,
        status: "uploading" as const,
        lastProgressAt: startedAt,
      })),
    ]);
    runUpload(targetRowId, files, fileIds);
  };

  const handleRetryUpload = (pendingId: string) => {
    if (!isOpen) return;
    const target = pendingUploads.find((p) => p.id === pendingId);
    if (!target) return;
    setPendingUploads((prev) =>
      prev.map((p) =>
        p.id === pendingId
          ? {
              ...p,
              status: "uploading" as const,
              percent: 0,
              errorMessage: undefined,
              lastProgressAt: Date.now(),
            }
          : p,
      ),
    );
    runUpload(target.rowId, [target.file], [pendingId]);
  };

  const handleDismissUpload = (pendingId: string) => {
    setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
  };

  const handleAttachmentDelete = (
    targetRowId: string,
    attachmentId: string,
  ) => {
    if (!onDeleteAttachment) return;
    onDeleteAttachment(targetRowId, attachmentId)
      .then(() => {
        setLoadedAttachments((prev) =>
          (prev ?? initialAttachments ?? []).filter(
            (a) => a.id !== attachmentId,
          ),
        );
      })
      .catch(() => {
        // app already surfaces the error (toast); leave attachment in place
      });
  };

  return {
    loadedAttachments,
    attachmentsLoading,
    pendingUploads,
    handleAttachmentUpload,
    handleRetryUpload,
    handleDismissUpload,
    handleAttachmentDelete,
  };
}
