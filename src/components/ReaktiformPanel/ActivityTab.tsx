import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "../../utils";
import { inputBase } from "./FormField";
import type { RowComment } from "../../types";

// ─────────────────────────────────────────────────────────────
//  ACTIVITY TAB
// ─────────────────────────────────────────────────────────────
const AV_COLORS = [
  "bg-rf-accent-bg text-rf-accent",
  "bg-rf-ok-bg text-green-600",
  "bg-rf-purple-bg text-purple-600",
  "bg-amber-50 text-amber-600",
  "bg-teal-50 text-teal-600",
];

export function ActivityTab({
  rowId,
  comments,
  onAddComment,
  canComment = true,
}: {
  rowId: string;
  comments: RowComment[];
  onAddComment?: (rowId: string, text: string) => void;
  canComment?: boolean;
}) {
  const [text, setText] = useState("");
  const post = () => {
    if (!text.trim()) return;
    onAddComment?.(rowId, text.trim());
    setText("");
  };

  return (
    <div>
      <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mb-3 pb-1.5 border-b border-rf-border">
        Activity Log
      </div>
      {comments.length === 0 && (
        <div className="text-center py-8 text-[12.5px] text-rf-text-3 rf-italic">
          No activity yet
        </div>
      )}
      <div className="rf-flex-col divide-y divide-rf-border">
        {comments.map((c, i) => {
          const avClass = AV_COLORS[i % AV_COLORS.length] ?? AV_COLORS[0]!;
          const initials = c.author
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={c.id} className="rf-flex rf-gap-2.5 py-2.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0",
                  avClass,
                )}
              >
                {initials}
              </div>
              <div className="rf-flex-1 rf-min-w-0">
                <div className="rf-flex rf-items-center rf-gap-2 mb-1">
                  <span className="text-[12px] rf-font-semibold text-rf-text-1">
                    {c.author}
                  </span>
                  <span className="text-[11px] text-rf-text-3">
                    {c.createdAt}
                  </span>
                </div>
                <p className="text-[12.5px] text-rf-text-2 leading-relaxed">
                  {c.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {onAddComment && canComment && (
        <div className="mt-4 border-t border-rf-border pt-3">
          <div className="text-[11px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em] mb-2">
            Add Comment
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
            className={cn(inputBase, "resize-none w-full mb-2")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post();
            }}
          />
          <button
            type="button"
            onClick={post}
            disabled={!text.trim()}
            className="rf-inline-flex rf-items-center rf-gap-1.5 px-3 py-1.5 text-[12.5px] rf-font-semibold rounded-rf-md bg-rf-accent text-white hover:bg-rf-accent-hover disabled:opacity-40 disabled:rf-cursor-not-allowed rf-transition-colors"
          >
            <Send className="rf-icon-sm" /> Post
          </button>
          <span className="ml-2 text-[11px] text-rf-text-3">or Ctrl+Enter</span>
        </div>
      )}
    </div>
  );
}
