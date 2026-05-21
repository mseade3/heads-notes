import { MeetingNote } from "@/types/meeting";

type MeetingCardProps = {
  meeting: MeetingNote;
  isSelected?: boolean;
  onSelect?: (meeting: MeetingNote) => void;
  onEdit?: (meeting: MeetingNote) => void;
  onPublish?: (meeting: MeetingNote) => void;
  onDeleteNote?: (meeting: MeetingNote) => void;
  isDeletingNote?: boolean;
};

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const estimateDurationMinutes = (meeting: MeetingNote) => {
  const sourceText = meeting.raw_transcript?.trim() || stripHtml(meeting.content);
  const words = sourceText ? sourceText.split(/\s+/).length : 0;
  return Math.min(120, Math.max(15, Math.round(words / 150) * 5 || 30));
};

const estimateParticipantCount = (meeting: MeetingNote) => {
  const sourceText = meeting.raw_transcript?.trim() || stripHtml(meeting.content);
  const speakerMatches = sourceText.match(/\b[A-Z][a-z]+:/g) ?? [];
  if (speakerMatches.length > 0) {
    return Math.min(18, Math.max(3, new Set(speakerMatches).size));
  }

  const duration = estimateDurationMinutes(meeting);
  return Math.min(14, Math.max(4, Math.round(duration / 12)));
};

export function MeetingCard({
  meeting,
  isSelected = false,
  onSelect,
  onEdit,
  onPublish,
  onDeleteNote,
  isDeletingNote = false
}: MeetingCardProps) {
  const handleExport = (format: "txt" | "docx" | "pdf") => {
    window.open(`/api/meetings/${meeting.id}/export?format=${format}`, "_blank");
  };

  return (
    <article
      className={`heads-meeting-card rounded-3xl border p-6 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-2xl ${
        isSelected ? "border-[#d4af37]/70 ring-1 ring-[#d4af37]/35" : "border-white/8"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(meeting)}
        className="w-full text-left"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight text-[#f8f8fa]">
            {meeting.title}
          </h3>
          <span
            className={`mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              meeting.status === "draft"
                ? "heads-draft-pill bg-[#5f4b1f]/55 text-[#f7dc95]"
                : "bg-[#1f4d33]/65 text-[#b0f1cd]"
            }`}
          >
            {meeting.status === "draft" ? "Draft" : "Approved"}
          </span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 text-[11px] text-[#aeb4c0]">
          <span className="heads-chip">Date {meeting.meeting_date}</span>
          <span className="heads-chip">Duration {estimateDurationMinutes(meeting)}m</span>
          <span className="heads-chip">
            Participants {estimateParticipantCount(meeting)}
          </span>
        </div>

        <div
          className="line-clamp-3 text-sm leading-relaxed text-[#acb2be]"
          dangerouslySetInnerHTML={{ __html: meeting.content }}
        />
      </button>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleExport("txt")}
          className="heads-outline-btn rounded-full px-3 py-1 text-xs font-medium"
        >
          Export TXT
        </button>
        <button
          type="button"
          onClick={() => handleExport("docx")}
          className="heads-outline-btn rounded-full px-3 py-1 text-xs font-medium"
        >
          Export DOCX
        </button>
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          className="heads-outline-btn rounded-full px-3 py-1 text-xs font-medium"
        >
          Export PDF
        </button>
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(meeting)}
            className="heads-outline-btn rounded-full px-3 py-1 text-xs font-medium"
          >
            {meeting.status === "published" ? "Override Approved" : "Edit Draft"}
          </button>
        ) : null}
        {onPublish ? (
          <button
            type="button"
            onClick={() => onPublish(meeting)}
            className="heads-gold-btn rounded-full px-3 py-1 text-xs"
          >
            Publish
          </button>
        ) : null}
        {onDeleteNote ? (
          <button
            type="button"
            onClick={() => onDeleteNote(meeting)}
            disabled={isDeletingNote}
            className="rounded-full border border-[#7b3a3a] bg-[#2a1515] px-3 py-1 text-xs font-medium text-[#f0b5b5] hover:bg-[#341c1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeletingNote ? "Deleting..." : "Delete Note"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
