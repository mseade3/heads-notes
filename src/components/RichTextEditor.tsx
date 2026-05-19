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
          "min-h-[280px] rounded-lg border border-[#3a3a3a] bg-[#111111] px-4 py-3 outline-none text-[#f0f0f0]"
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
      <div className="rounded-lg border border-[#3a3a3a] bg-[#111111] px-4 py-3 text-sm text-[#bdbdbd]">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-[#d6d6d6]">Font</label>
        <select
          value={fontFamily}
          onChange={(event) => onFontFamilyChange(event.target.value)}
          className="max-h-32 rounded-md border border-[#6e5a21] bg-[#141109] px-3 py-1 text-sm text-[#f5df9a]"
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
          className="heads-outline-btn rounded-md px-3 py-1 text-sm font-medium"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="heads-outline-btn rounded-md px-3 py-1 text-sm font-medium"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="heads-outline-btn rounded-md px-3 py-1 text-sm font-medium"
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
