import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "../../utils";

// If the content is plain text (no HTML tags), convert \n to proper HTML
// so Tiptap doesn't collapse all whitespace into one blob. Kept as cheap
// insurance for consumers migrating pre-existing plain-text data into a
// newly-typed richtext column, or values set directly via the public
// row-update API (bypassing RichTextEditor entirely).
function normalizeToHtml(raw: string): string {
  if (!raw) return "";
  if (/<[a-z][\s\S]*?>/i.test(raw)) return raw; // already HTML
  return raw
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

interface RichTextViewerProps {
  value: string;
  className?: string;
}

// ── Read-only richtext display. Always routes content through Tiptap's own
// schema-constrained HTML parsing (never a raw dangerouslySetInnerHTML) —
// see the richtext security decision in CLAUDE.md.
export function RichTextViewer({ value, className }: RichTextViewerProps) {
  const html = normalizeToHtml(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
    ],
    content: html,
    editable: false,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = normalizeToHtml(value);
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rf-richtext-editor rf-richtext-viewer", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
