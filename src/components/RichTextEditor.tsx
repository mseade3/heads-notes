"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  fontFamily: string;
  onFontFamilyChange: (fontFamily: string) => void;
};

const FONT_OPTIONS = [
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Palatino",
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Gill Sans",
  "Calibri",
  "Cambria",
  "Book Antiqua",
  "Lucida Sans",
  "Courier New",
  "Lucida Console",
  "Monaco"
];

export function RichTextEditor({
  value,
  onChange,
  fontFamily,
  onFontFamilyChange
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Review and edit your generated meeting notes..."
      })
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "executive-editor min-h-[320px] rounded-3xl border border-white/10 bg-[#121212]/90 px-6 py-5 outline-none text-[#eef1f7]"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    }
  });

  useEffect(() => {
    if (!editor) return;

    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#121212]/90 px-4 py-3 text-sm text-[#bdbdbd]">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b4bac7]">
          Font
        </label>
        <select
          value={fontFamily}
          onChange={(event) => onFontFamilyChange(event.target.value)}
          className="max-h-32 rounded-2xl border border-white/12 bg-[#1b1b1b]/90 px-3 py-2 text-sm text-[#eceff6]"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="heads-outline-btn rounded-xl px-3 py-1.5 text-sm font-medium"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="heads-outline-btn rounded-xl px-3 py-1.5 text-sm font-medium"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="heads-outline-btn rounded-xl px-3 py-1.5 text-sm font-medium"
        >
          Bullets
        </button>
      </div>
      <div style={{ fontFamily }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
