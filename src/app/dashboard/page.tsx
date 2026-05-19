"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioUploadForm } from "@/components/AudioUploadForm";
import { BrandMark } from "@/components/BrandMark";
import { MeetingCard } from "@/components/MeetingCard";
import { RichTextEditor } from "@/components/RichTextEditor";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { MeetingNote, MeetingStatus } from "@/types/meeting";

type DraftState = {
  id?: string;
  title: string;
  content: string;
  rawTranscript: string;
};

const formatDateForTitle = (dateValue: string) => {
  if (!dateValue) return "Core Meeting";
  const date = new Date(dateValue);
  return `Core: ${date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  })}`;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [activeTab, setActiveTab] = useState<MeetingStatus>("published");
  const [draftFontFamily, setDraftFontFamily] = useState("Times New Roman");
  const [error, setError] = useState<string | null>(null);

  const groupedNotes = useMemo(() => {
    const groups = new Map<string, MeetingNote[]>();
    notes
      .filter((note) => note.status === activeTab)
      .forEach((note) => {
        const date = new Date(note.meeting_date);
        const monthKey = date.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric"
        });
        const existing = groups.get(monthKey) ?? [];
        existing.push(note);
        groups.set(monthKey, existing);
      });

    return Array.from(groups.entries());
  }, [activeTab, notes]);

  const fetchNotes = useCallback(async () => {
    if (!supabase) return;

    const { data, error: fetchError } = await supabase
      .from("meeting_notes")
      .select("*")
      .order("meeting_date", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setNotes((data ?? []) as MeetingNote[]);
    }
  }, [supabase]);

  useEffect(() => {
    const initialize = async () => {
      if (!supabase) {
        setError(
          "Supabase client unavailable. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        setLoading(false);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      await fetchNotes();
      setLoading(false);
    };

    void initialize();
  }, [fetchNotes, router, supabase]);

  const upsertNote = async (status: MeetingStatus) => {
    if (!draft || !supabase) return;
    setSaving(true);
    setError(null);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const payload = {
        meeting_date: meetingDate,
        title: draft.title || formatDateForTitle(meetingDate),
        content: draft.content,
        raw_transcript: draft.rawTranscript,
        created_by: session.user.id,
        status
      };

      if (draft.id) {
        const { error: updateError } = await supabase
          .from("meeting_notes")
          .update(payload)
          .eq("id", draft.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("meeting_notes").insert(payload);
        if (insertError) throw insertError;
      }

      await fetchNotes();
      setDraft(null);
      setDraftFontFamily("Times New Roman");
      setActiveTab(status);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save meeting note."
      );
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async (meeting: MeetingNote) => {
    if (!supabase) return;
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("meeting_notes")
        .update({ status: "published" })
        .eq("id", meeting.id);

      if (updateError) throw updateError;

      await fetchNotes();
      setActiveTab("published");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish saved draft."
      );
    }
  };

  const handleSignOut = async () => {
    if (!supabase) {
      router.push("/login");
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
        <p className="text-sm text-[#bdbdbd]">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-8">
      <header className="space-y-4">
        <div className="heads-topbar flex items-center justify-between rounded-xl px-4 py-3">
          <BrandMark compact />
          <button
            onClick={handleSignOut}
            className="heads-outline-btn rounded-lg px-4 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </div>
        <div>
          <h1 className="text-4xl font-semibold text-[#f5f5f5]">Core Notes Dashboard</h1>
          <p className="mt-1 text-sm text-[#bdbdbd]">
            Upload meeting audio, auto-format notes, then review before publishing.
          </p>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-[#5f2424] bg-[#2a0f0f] px-4 py-3 text-sm text-[#f8b5b5]">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <AudioUploadForm
          meetingDate={meetingDate}
          onSuccess={(result) =>
            {
              setDraftFontFamily("Times New Roman");
              setDraft({
                title: result.inferredTitle || formatDateForTitle(meetingDate),
                content: result.formattedNotes,
                rawTranscript: result.rawTranscript
              });
            }
          }
        />

        <div className="heads-card rounded-xl p-5">
          <label className="mb-2 block text-sm font-medium text-[#d8d8d8]">
            Meeting date
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(event) => setMeetingDate(event.target.value)}
            className="mb-4 w-full rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-sm text-[#bdbdbd]">
            Save as draft while editing, then publish when ready for Core.
          </p>
        </div>
      </section>

      {draft ? (
        <section className="heads-card space-y-4 rounded-xl p-5">
          <h2 className="text-2xl font-semibold text-[#f5f5f5]">
            Review Generated Notes
          </h2>
          <input
            type="text"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, title: event.target.value } : current
              )
            }
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
          <RichTextEditor
            value={draft.content}
            onChange={(value) =>
              setDraft((current) => (current ? { ...current, content: value } : current))
            }
            fontFamily={draftFontFamily}
            onFontFamilyChange={setDraftFontFamily}
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => upsertNote("draft")}
              disabled={saving}
              className="heads-outline-btn rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => upsertNote("published")}
              disabled={saving}
              className="heads-gold-btn rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Publishing..." : "Publish Notes"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="heads-outline-btn rounded-lg px-4 py-2 text-sm font-medium"
            >
              Discard
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[#f5f5f5]">Meeting Notes Library</h2>
          <div className="inline-flex rounded-lg border border-[#3b3b3b] bg-[#121212] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("published")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeTab === "published"
                  ? "bg-[#d4af37] text-[#101010]"
                  : "text-[#d0d0d0] hover:bg-[#1d1d1d]"
              }`}
            >
              Published
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("draft")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeTab === "draft"
                  ? "bg-[#d4af37] text-[#101010]"
                  : "text-[#d0d0d0] hover:bg-[#1d1d1d]"
              }`}
            >
              Drafts
            </button>
          </div>
        </div>
        {groupedNotes.length === 0 ? (
          <p className="text-sm text-[#bdbdbd]">
            No {activeTab === "published" ? "published notes" : "drafts"} yet.
          </p>
        ) : (
          groupedNotes.map(([month, monthNotes]) => (
            <div key={month} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                {month}
              </h3>
              {monthNotes.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onEdit={
                    meeting.status === "draft"
                      ? (selectedMeeting) => {
                          setMeetingDate(selectedMeeting.meeting_date);
                          setDraftFontFamily("Times New Roman");
                          setDraft({
                            id: selectedMeeting.id,
                            title: selectedMeeting.title,
                            content: selectedMeeting.content,
                            rawTranscript: selectedMeeting.raw_transcript ?? ""
                          });
                        }
                      : undefined
                  }
                  onPublish={
                    meeting.status === "draft"
                      ? (selectedMeeting) => {
                          void publishDraft(selectedMeeting);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
