"use client";

import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

/** `offset` is the character index in the document (for locating the component under the cursor). */
export type Cursor = { line: number; col: number; offset: number };

type Props = {
  value: string;
  language: "mdx" | "json";
  onChange: (v: string) => void;
  onReady: (view: EditorView) => void;
  onCursor: (c: Cursor) => void;
};

const paperTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "var(--color-card)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
  ".cm-gutters": { backgroundColor: "var(--color-card)", border: "none", color: "var(--color-line-strong)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--color-highlight) 60%, transparent)" },
  "&.cm-focused": { outline: "none" },
});

export default function SourceEditor({ value, language, onChange, onReady, onCursor }: Props) {
  const extensions = useMemo(
    () => [
      language === "json" ? json() : markdown(),
      EditorView.lineWrapping,
      paperTheme,
      EditorView.updateListener.of((u) => {
        if (!u.selectionSet && !u.docChanged) return;
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        onCursor({ line: line.number, col: head - line.from + 1, offset: head });
      }),
    ],
    [language, onCursor],
  );
  return (
    <CodeMirror
      value={value}
      height="100%"
      className="h-full"
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={(view) => onReady(view)}
      basicSetup={{ foldGutter: false, highlightActiveLine: true }}
    />
  );
}
