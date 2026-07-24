import { useEffect, useState } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from "lucide-react";

import { EDITOR_CSS } from "./editorCss";

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TB({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        background: active ? "var(--a-18)" : "transparent",
        color: active ? "var(--a-hi)" : "hsl(var(--i2))",
        transition: "all .1s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--b1)",
        flexShrink: 0,
        margin: "0 2px",
      }}
    />
  );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

// Absolute floor for the resizable (panel) drag handle — independent of
// whatever `minHeight` the editor happens to start at, so shrinking isn't
// clamped to "no smaller than the starting size" (see handleResizeStart).
const RESIZE_MIN_HEIGHT = 140;

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  error?: boolean;
  /**
   * Show a bottom-edge drag handle that lets the user grow the editor's
   * own height (vertical only, like a native <textarea>). Use this in
   * contexts with no other sizing control, e.g. embedded in a form field.
   * Do NOT use inside a container that already manages its own resizable
   * size via flex (e.g. RichTextPopover) — the two would fight each
   * other, since this makes the editor own an explicit height instead of
   * filling 100% of its parent. Default: false.
   */
  resizable?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 160,
  error,
  resizable = false,
}: RichTextEditorProps) {
  const minHeightNum =
    typeof minHeight === "number" ? minHeight : parseFloat(String(minHeight)) || 160;
  const [height, setHeight] = useState(minHeightNum);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = height;
    // Prevent text-selection flicker elsewhere on the page while dragging.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMove = (me: MouseEvent) => {
      setHeight(Math.max(RESIZE_MIN_HEIGHT, startH + (me.clientY - startY)));
    };
    const onUp = () => {
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // StarterKit registers the Link mark by default; this editor's
        // toolbar never offers a way to insert one, so it stays disabled
        // to keep the parsed schema minimal instead of depending on
        // Tiptap's own URL-allowlisting for a mark the UI never exposes.
        link: false,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        "data-placeholder": placeholder,
      },
    },
    onUpdate({ editor }) {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
  });

  // sync external value changes (e.g. form reset / edit mode pre-fill)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <>
      <style>{EDITOR_CSS}</style>
      <div
        className="rte-wrap"
        style={{
          display: "flex",
          flexDirection: "column",
          height: resizable ? height : "100%",
          position: "relative",
          borderRadius: 9,
          border: `1.5px solid ${error ? "var(--red)" : "var(--b2)"}`,
          background: "hsl(var(--s2))",
          transition: "border-color .15s, box-shadow .15s",
          ...(editor.isFocused
            ? { borderColor: "var(--a)", boxShadow: "0 0 0 3px var(--a-10)" }
            : {}),
          ["--rte-min-h" as string]: `${minHeight}px`,
        }}
      >
        {/* Toolbar — flexShrink:0 so it stays pinned while the content
            area below scrolls independently. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "6px 10px",
            borderBottom: "1px solid var(--b1)",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {/* Text style */}
          <TB
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold size={13} />
          </TB>
          <TB
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic size={13} />
          </TB>

          <Divider />

          {/* Headings */}
          <TB
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            title="Heading 2"
          >
            <Heading2 size={13} />
          </TB>
          <TB
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            title="Heading 3"
          >
            <Heading3 size={13} />
          </TB>

          <Divider />

          {/* Lists */}
          <TB
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List size={13} />
          </TB>
          <TB
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered size={13} />
          </TB>

          <Divider />

          {/* Blockquote */}
          <TB
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={13} />
          </TB>

          <Divider />

          {/* History */}
          <TB onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo size={13} />
          </TB>
          <TB onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo size={13} />
          </TB>
        </div>

        {/* Editor area — the sole scroll container. flex:1 + minHeight:0
            lets it actually fill the remaining height instead of shrinking
            to its content's natural size (the flex-item default
            min-height is `auto`, not 0). EditorContent renders its OWN
            wrapping <div> (Tiptap's PureEditorContent.render() spreads
            {...rest} onto it) and appends the actual .ProseMirror element
            as a CHILD of that div — without the explicit style below, that
            div is the missing link in the height chain: .ProseMirror's
            height:100% (editorCss.ts) would resolve against this div's
            auto height and collapse back to its min-height floor instead
            of filling the wrapper. */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <EditorContent editor={editor} style={{ height: "100%" }} />
        </div>

        {/* Resize handle — bottom-edge drag, vertical only (there's no
            free horizontal space in a form field to justify width resize,
            unlike RichTextPopover's own corner handle). */}
        {resizable && (
          <div
            onMouseDown={handleResizeStart}
            title="Drag to resize"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: "ns-resize",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: 3,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: 0.5 }}>
              <circle cx="7" cy="7" r="1" fill="var(--b1)" />
              <circle cx="7" cy="4" r="1" fill="var(--b1)" />
              <circle cx="4" cy="7" r="1" fill="var(--b1)" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
}
