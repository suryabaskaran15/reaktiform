import { useLayoutEffect, useRef, useState } from "react";
import { AlignLeft } from "lucide-react";
import { cn } from "../../utils";
import { stripRichTextToPlainText, truncate } from "../../utils/formatters";
import { RichTextPopover } from "../overlays/RichTextPopover";

// ─────────────────────────────────────────────────────────────
//  RICHTEXT CELL — read shows a stripped plain-text preview (cheap, no
//  per-row Tiptap mount — no Tiptap import anywhere in this file). Edit
//  mode never renders an inline editor in the <td>; it opens an anchored
//  RichTextPopover instead, since a <td> is too small to host a WYSIWYG
//  toolbar + multi-paragraph editor. See CLAUDE.md's richtext decision.
// ─────────────────────────────────────────────────────────────

function PreviewContent({
  value,
  previewLength,
}: {
  value: string | null | undefined;
  previewLength?: number | undefined;
}) {
  const plain = stripRichTextToPlainText(value);
  const preview = truncate(plain, previewLength ?? 60);

  if (!preview) {
    return <span className="text-[12px] text-rf-text-3 rf-italic">Click to enter…</span>;
  }

  return (
    <>
      <AlignLeft
        className="rf-flex-shrink-0"
        style={{ width: 12, height: 12, color: "var(--rf-text-3)", marginRight: 4 }}
      />
      <span
        className="text-[13px] text-rf-text-1 rf-truncate"
        title={plain}
      >
        {preview}
      </span>
    </>
  );
}

// ── READ MODE
type RichTextCellReadProps = {
  value: string | null | undefined;
  previewLength?: number;
  className?: string;
};

export function RichTextCellRead({
  value,
  previewLength,
  className,
}: RichTextCellReadProps) {
  return (
    <div
      className={cn(
        "rf-flex rf-items-center px-[10px] rf-h-full rf-min-w-0",
        className,
      )}
    >
      <PreviewContent value={value} previewLength={previewLength} />
    </div>
  );
}

// ── EDIT MODE — opens the anchored popover; the <td> itself keeps
// showing the same preview so the row doesn't visually blank out.
type RichTextCellEditProps = {
  value: string | null | undefined;
  onCommit: (value: string) => void;
  onCancel: () => void;
  isDark: boolean;
  minHeight?: number;
  placeholder?: string;
  previewLength?: number;
  className?: string;
};

export function RichTextCellEdit({
  value,
  onCommit,
  onCancel,
  isDark,
  minHeight,
  placeholder,
  previewLength,
  className,
}: RichTextCellEditProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (fillRef.current) {
      setAnchor(fillRef.current.getBoundingClientRect());
    }
  }, []);

  return (
    <>
      <div
        ref={fillRef}
        className={cn(
          "rf-flex rf-items-center px-[10px] rf-h-full rf-min-w-0",
          className,
        )}
      >
        <PreviewContent value={value} previewLength={previewLength} />
      </div>
      {anchor && (
        <RichTextPopover
          anchor={anchor}
          initialValue={value ?? ""}
          onCommit={onCommit}
          onCancel={onCancel}
          isDark={isDark}
          {...(minHeight !== undefined && { minHeight })}
          {...(placeholder !== undefined && { placeholder })}
        />
      )}
    </>
  );
}
