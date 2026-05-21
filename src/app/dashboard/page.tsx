"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AudioUploadForm } from "@/components/AudioUploadForm";
import { BrandMark } from "@/components/BrandMark";
import { MeetingCard } from "@/components/MeetingCard";
import { Preloader } from "@/components/Preloader";
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
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [activeTab, setActiveTab] = useState<MeetingStatus>("published");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [draftFontFamily, setDraftFontFamily] = useState("Times New Roman");
  const [error, setError] = useState<string | null>(null);

  const filteredNotes = useMemo(
    () => notes.filter((note) => note.status === activeTab),
    [activeTab, notes]
  );

  const groupedNotes = useMemo(() => {
    const groups = new Map<string, MeetingNote[]>();
    filteredNotes.forEach((note) => {
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
  }, [filteredNotes]);

  const selectedMeeting = useMemo(
    () => filteredNotes.find((note) => note.id === selectedMeetingId) ?? filteredNotes[0] ?? null,
    [filteredNotes, selectedMeetingId]
  );

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

  useEffect(() => {
    if (selectedMeetingId && filteredNotes.some((note) => note.id === selectedMeetingId)) {
      return;
    }
    setSelectedMeetingId(filteredNotes[0]?.id ?? null);
  }, [filteredNotes, selectedMeetingId]);

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

  const deleteDraft = async (meeting: MeetingNote) => {
    setError(null);
    setDeletingDraftId(meeting.id);

    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to delete draft.");
      }

      setNotes((current) => current.filter((note) => note.id !== meeting.id));
      if (draft?.id === meeting.id) {
        setDraft(null);
      }
      await fetchNotes();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete draft."
      );
    } finally {
      setDeletingDraftId(null);
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
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
        <div className="heads-glass-card rounded-3xl border border-white/10 p-6 text-sm text-[#cfd2d9]">
          Loading executive workspace...
        </div>
      </main>
    );
  }

  return (
    <Preloader durationMs={3200}>
      <main className="relative mx-auto min-h-screen max-w-7xl px-4 pb-14 pt-6 sm:px-8">
        <header className="heads-glass-card mb-10 rounded-3xl border border-white/10 bg-black/75 px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between">
            <BrandMark compact />
            <button
              onClick={handleSignOut}
              className="heads-outline-btn rounded-2xl px-4 py-2 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[300px_1fr]">
          <aside className="heads-glass-card relative h-fit self-start rounded-3xl border border-white/10 p-6">
            <div className="space-y-5">
              <div className="heads-soft-panel rounded-3xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                  Meeting Date
                </p>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(event) => setMeetingDate(event.target.value)}
                  className="mt-3 w-full rounded-2xl px-4 py-3 text-sm"
                />
                <p className="mt-3 text-sm leading-relaxed text-[#9aa0ad]">
                  Generate and review executive-ready notes before approval.
                </p>
              </div>
              <div className="heads-soft-panel rounded-3xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                  Performance
                </p>
                <p className="mt-3 text-base font-semibold text-[#f4f6fb]">
                  {notes.length} meetings archived
                </p>
                <p className="mt-1 text-sm text-[#9aa0ad]">
                  {notes.filter((note) => note.status === "draft").length} drafts awaiting approval
                </p>
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-8">
            <header className="heads-glass-card overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-10">
              <h1 className="text-4xl font-bold tracking-tight text-[#f7f8fc] sm:text-5xl">
                Executive Meeting Notes
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#a3a8b3]">
                Upload audio, process transcript intelligence, and publish polished board summaries
                with zero friction.
              </p>
            </header>

            {error ? (
              <p className="rounded-2xl border border-[#7a2a2a]/70 bg-[#3a1717]/70 px-4 py-3 text-sm text-[#ffc6c6]">
                {error}
              </p>
            ) : null}

            <section className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <AudioUploadForm
                meetingDate={meetingDate}
                onSuccess={async (result) => {
                  setDraftFontFamily("Times New Roman");
                  setDraft({
                    title: result.inferredTitle || formatDateForTitle(meetingDate),
                    content: result.formattedNotes,
                    rawTranscript: result.rawTranscript
                  });
                }}
              />

              {draft ? (
                <section className="heads-glass-card overflow-hidden rounded-3xl border border-white/10 p-8">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#f6f7fb]">
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
                    className="mt-4 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                  <div className="mt-4">
                    <RichTextEditor
                      value={draft.content}
                      onChange={(value) =>
                        setDraft((current) => (current ? { ...current, content: value } : current))
                      }
                      fontFamily={draftFontFamily}
                      onFontFamilyChange={setDraftFontFamily}
                    />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => upsertNote("draft")}
                      disabled={saving}
                      className="heads-outline-btn rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Draft"}
                    </button>
                    <button
                      onClick={() => upsertNote("published")}
                      disabled={saving}
                      className="heads-gold-btn rounded-xl px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Publishing..." : "Approve & Publish"}
                    </button>
                    <button
                      onClick={() => setDraft(null)}
                      className="heads-outline-btn rounded-xl px-4 py-2 text-sm font-medium"
                    >
                      Discard
                    </button>
                  </div>
                </section>
              ) : (
                <section className="heads-glass-card flex items-center overflow-hidden rounded-3xl border border-white/10 p-8">
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold tracking-tight text-[#f7f8fc]">
                      Ready for the next brief
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-[#a3a8b3]">
                      Generate meeting notes to open the executive editor and finalize your draft.
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Image
                        src="/brand/heads-gold-h.png"
                        alt="H.E.A.D.S. crest accent"
                        width={76}
                        height={76}
                        className="h-14 w-14 object-contain opacity-90"
                      />
                    </div>
                  </div>
                </section>
              )}
            </section>

            <section className="grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="space-y-4">
                <div className="heads-glass-card overflow-hidden rounded-3xl border border-white/10 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-[#f7f8fc]">
                      Meeting Library
                    </h2>
                    <div className="heads-toggle inline-flex rounded-2xl p-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("published")}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ease-in-out ${
                          activeTab === "published"
                            ? "bg-[#d4af37] text-[#101018] shadow-[0_8px_24px_rgba(212,175,55,0.35)]"
                            : "text-[#d2d6e1] hover:bg-white/8"
                        }`}
                      >
                        Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("draft")}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ease-in-out ${
                          activeTab === "draft"
                            ? "bg-[#d4af37] text-[#101018] shadow-[0_8px_24px_rgba(212,175,55,0.35)]"
                            : "text-[#d2d6e1] hover:bg-white/8"
                        }`}
                      >
                        Drafts
                      </button>
                    </div>
                  </div>
                </div>

                {groupedNotes.length === 0 ? (
                  <p className="heads-glass-card rounded-2xl border border-white/10 px-4 py-5 text-sm text-[#bac0cc]">
                    No {activeTab === "published" ? "approved notes" : "drafts"} available yet.
                  </p>
                ) : (
                  groupedNotes.map(([month, monthNotes]) => (
                    <div key={month} className="space-y-3">
                      <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
                        {month}
                      </h3>
                      {monthNotes.map((meeting) => (
                        <MeetingCard
                          key={meeting.id}
                          meeting={meeting}
                          isSelected={selectedMeeting?.id === meeting.id}
                          onSelect={(selected) => setSelectedMeetingId(selected.id)}
                          onEdit={
                            meeting.status === "draft"
                              ? (selectedMeetingData) => {
                                  setMeetingDate(selectedMeetingData.meeting_date);
                                  setDraftFontFamily("Times New Roman");
                                  setDraft({
                                    id: selectedMeetingData.id,
                                    title: selectedMeetingData.title,
                                    content: selectedMeetingData.content,
                                    rawTranscript: selectedMeetingData.raw_transcript ?? ""
                                  });
                                }
                              : undefined
                          }
                          onPublish={
                            meeting.status === "draft"
                              ? (selectedMeetingData) => {
                                  void publishDraft(selectedMeetingData);
                                }
                              : undefined
                          }
                          onDeleteDraft={
                            meeting.status === "draft"
                              ? async (selectedMeetingData) => {
                                  await deleteDraft(selectedMeetingData);
                                }
                              : undefined
                          }
                          isDeletingDraft={deletingDraftId === meeting.id}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              <section className="heads-glass-card overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-10">
                {selectedMeeting ? (
                  <article className="executive-brief">
                    <header className="border-b border-white/10 pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold text-[#f8f9fd]">
                          {selectedMeeting.title}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            selectedMeeting.status === "draft"
                              ? "heads-draft-pill border border-[#b08b2f]/40 bg-[#2a2210] text-[#f1d788]"
                              : "border border-[#2f7353]/40 bg-[#123324] text-[#8be0b8]"
                          }`}
                        >
                          {selectedMeeting.status === "draft" ? "Draft" : "Approved"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#aab0bc]">
                        Meeting Date {selectedMeeting.meeting_date}
                      </p>
                    </header>
                    <div
                      className="prose max-w-none pt-4 text-[#d5d9e3]"
                      dangerouslySetInnerHTML={{ __html: selectedMeeting.content }}
                    />
                  </article>
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center text-center text-sm text-[#b5b9c5]">
                    Select a meeting note to preview the executive brief.
                  </div>
                )}
              </section>
            </section>
          </section>
        </div>
      </main>
    </Preloader>
  );
}
