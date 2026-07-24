export const EDITOR_CSS = `
.rte-wrap .ProseMirror {
  min-height: var(--rte-min-h, 120px);
  height: 100%;
  padding: 12px 14px;
  outline: none;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.7;
  color: hsl(var(--i0));
}
.rte-wrap .ProseMirror p { margin: 0 0 0.5em; }
.rte-wrap .ProseMirror p:last-child { margin-bottom: 0; }
.rte-wrap .ProseMirror h2 { font-size: 1rem; font-weight: 700; margin: 0.75em 0 0.35em; color: hsl(var(--i0)); }
.rte-wrap .ProseMirror h3 { font-size: 0.875rem; font-weight: 700; margin: 0.6em 0 0.3em; color: hsl(var(--i1)); }
.rte-wrap .ProseMirror ul,
.rte-wrap .ProseMirror ol { padding-left: 1.4em; margin: 0.4em 0; }
.rte-wrap .ProseMirror ul { list-style: disc; }
.rte-wrap .ProseMirror ol { list-style: decimal; }
.rte-wrap .ProseMirror li { margin: 0.2em 0; }
.rte-wrap .ProseMirror blockquote {
  border-left: 3px solid var(--a);
  margin: 0.5em 0; padding: 4px 12px;
  color: hsl(var(--i2));
  background: var(--a-10);
  border-radius: 0 6px 6px 0;
}
.rte-wrap .ProseMirror strong { font-weight: 700; color: hsl(var(--i0)); }
.rte-wrap .ProseMirror em { font-style: italic; }
.rte-wrap .ProseMirror.ProseMirror-focused { outline: none; }
.rte-wrap .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: hsl(var(--i3));
  pointer-events: none;
  float: left;
  height: 0;
}
`;
