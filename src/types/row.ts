// ── Internal row metadata (added by reaktiform, not consumer data)
export type RowMeta = {
  _id: string                          // internal unique id
  _saved: boolean                      // has been committed to server
  _new: boolean                        // just added, never saved
  _draft: Record<string, unknown> | null  // pending unsaved changes
  _errors: Record<string, string>      // field key → error message
  _comments?: RowComment[]
  _attachments?: RowAttachment[]
}

// ── Consumer row = their data + our meta
export type Row<TData = Record<string, unknown>> = TData & RowMeta

// ── Draft value accessor helper type
export type DraftValue<TData> = {
  [K in keyof TData]: TData[K]
}

// ── Row comment
export type RowComment = {
  id: string
  author: string
  text: string
  createdAt: string
  avatarColor?: string
}

// ── Row attachment
export type RowAttachment = {
  id: string
  name: string
  size: string
  type: 'pdf' | 'xlsx' | 'docx' | 'png' | 'jpg' | 'csv' | string
  url?: string
  uploadedAt?: string
  uploadedBy?: string
}

// ── Row state enum (for styling)
export type RowState =
  | 'clean'      // saved, valid
  | 'dirty'      // has unsaved draft
  | 'error'      // has validation errors
  | 'new'        // newly added, not yet saved
  | 'selected'   // checkbox selected
