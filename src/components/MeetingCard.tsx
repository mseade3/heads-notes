import { MeetingNote } from "@/types/meeting";

type MeetingCardProps = {
  meeting: MeetingNote;
  onEdit?: (meeting: MeetingNote) => void;
  onPublish?: (meeting: MeetingNote) => void;
};

export function MeetingCard({ meeting, onEdit, onPublish }: MeetingCardProps) {
  const handleExport = (format: "txt" | "docx" | "pdf") => {
    window.open(`/api/meetings/${meeting.id}/export?format=${format}`, "_blank");
  };

  return (
    <article className="heads-card rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[#f4f4f4]">{meeting.title}</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#6f5a22] bg-[#1a1409] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#f1d788]">
            {meeting.status}
          </span>
          <span className="text-xs text-[#bdbdbd]">{meeting.meeting_date}</span>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden">
        <div
          className="prose prose-sm max-w-none break-words text-[#e8e8e8]"
          dangerouslySetInnerHTML={{ __html: meeting.content }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleExport("txt")}
          className="heads-outline-btn rounded-md px-3 py-1 text-xs font-medium"
        >
          Export TXT
        </button>
        <button
          type="button"
          onClick={() => handleExport("docx")}
          className="heads-outline-btn rounded-md px-3 py-1 text-xs font-medium"
        >
          Export DOCX
        </button>
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          className="heads-outline-btn rounded-md px-3 py-1 text-xs font-medium"
        >
          Export PDF
        </button>
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(meeting)}
            className="heads-outline-btn rounded-md px-3 py-1 text-xs font-medium"
          >
            Edit Draft
          </button>
        ) : null}
        {onPublish ? (
          <button
            type="button"
            onClick={() => onPublish(meeting)}
            className="heads-gold-btn rounded-md px-3 py-1 text-xs"
          >
            Publish
          </button>
        ) : null}
      </div>
    </article>
  );
}
