"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNoteViewerProps = {
  content: string;
  className?: string;
};

const decodeEntities = (value: string) =>
  value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const normalizeContentToMarkdown = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const looksLikeHtml = /<[^>]+>/.test(trimmed);
  if (!looksLikeHtml) {
    return decodeEntities(trimmed);
  }

  return decodeEntities(trimmed)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export function MarkdownNoteViewer({ content, className }: MarkdownNoteViewerProps) {
  const markdown = normalizeContentToMarkdown(content);

  return (
    <div className={`markdown-notes prose max-w-none text-[#d5d9e3] ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          hr: () => <hr className="my-8 border-0 border-t border-white/12" />
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
