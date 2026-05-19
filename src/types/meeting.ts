export type MeetingStatus = "draft" | "published";

export type MeetingNote = {
  id: string;
  created_at: string;
  meeting_date: string;
  title: string;
  content: string;
  raw_transcript: string | null;
  created_by: string;
  status: MeetingStatus;
};
