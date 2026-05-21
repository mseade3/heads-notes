"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

const PROCESSING_STAGES = [
  "uploading",
  "transcribing",
  "structuring",
  "saving"
] as const;

type ProcessingStage = (typeof PROCESSING_STAGES)[number] | "idle";

type UploadResult = {
  formattedNotes: string;
  rawTranscript: string;
  inferredTitle: string;
};

type AudioUploadFormProps = {
  meetingDate: string;
  onSuccess: (result: UploadResult) => Promise<void> | void;
};

const stageLabels: Record<Exclude<ProcessingStage, "idle" | "compressing">, string> = {
  uploading: "Uploading audio file...",
  transcribing: "Transcribing audio via OpenAI Whisper...",
  structuring: "Structuring executive notes with GPT...",
  saving: "Saving draft..."
};

const stageOrder: ProcessingStage[] = ["uploading", "transcribing", "structuring", "saving"];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getUploadErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: string };
      return body.error ?? `Request failed (${response.status}).`;
    } catch {
      return `Request failed (${response.status}).`;
    }
  }

  const rawText = (await response.text()).trim();
  if (/request entity too large/i.test(rawText)) {
    return "Upload request is too large before processing. Please try a smaller file or lower bitrate export.";
  }

  if (rawText) {
    return rawText;
  }

  return `Request failed (${response.status}).`;
};

export function AudioUploadForm({ meetingDate, onSuccess }: AudioUploadFormProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const activeStageIndex = useMemo(
    () => stageOrder.indexOf(processingStage),
    [processingStage]
  );
  const progressPercent = useMemo(() => {
    if (activeStageIndex < 0) return 0;
    return ((activeStageIndex + 1) / stageOrder.length) * 100;
  }, [activeStageIndex]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!audioFile) {
      setError("Please choose an audio file first.");
      return;
    }

    try {
      setIsProcessing(true);

      const payload = new FormData();
      setProcessingStage("uploading");
      payload.append("audio", audioFile);
      payload.append("meetingDate", meetingDate);

      const responsePromise = fetch("/api/meetings/upload", {
        method: "POST",
        body: payload
      });
      setProcessingStage("transcribing");

      const response = await responsePromise;

      if (!response.ok) {
        throw new Error(await getUploadErrorMessage(response));
      }

      setProcessingStage("structuring");
      const data = (await response.json()) as UploadResult;
      await sleep(250);

      setProcessingStage("saving");
      await onSuccess(data);
      setAudioFile(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unexpected error while processing audio."
      );
    } finally {
      setProcessingStage("idle");
      setIsProcessing(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="heads-glass-card group relative space-y-5 rounded-3xl border border-white/10 p-8 sm:p-10"
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="block text-base font-semibold tracking-tight text-[#eceff6]">
            Upload audio (.mp3, .wav, .m4a)
          </label>
          <Image
            src="/brand/heads-gold-h.png"
            alt="H.E.A.D.S. accent"
            width={30}
            height={30}
            className="h-8 w-8 object-contain opacity-90 transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <input
          type="file"
          accept=".mp3,.wav,.m4a,audio/*"
          onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-2xl px-4 py-3 text-sm text-[#f2f2f2] file:mr-4 file:rounded-full file:border-0 file:bg-[#d4af37] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#121212] file:shadow-sm hover:file:bg-[#e5c45c]"
        />
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="heads-gold-btn heads-interactive-btn relative w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="relative z-10">Generate Meeting Notes</span>
      </button>
      {isProcessing ? (
        <div className="heads-processing-overlay absolute inset-0 z-20 rounded-xl border border-[#3a2f14] p-5">
          <div className="flex h-full flex-col justify-center">
            <div className="mb-2 flex items-center gap-2">
              <Image
                src="/brand/heads-gold-h.png"
                alt="Processing crest"
                width={20}
                height={20}
                className="h-5 w-5 object-contain opacity-95"
              />
              <p className="text-lg font-semibold text-[#f4f4f4]">Crafting your meeting notes</p>
            </div>
            <p className="mb-5 text-xs text-[#b9b9b9]">
              This flow is designed to be smooth and should complete shortly.
            </p>

            <div className="mb-5 overflow-hidden rounded-full border border-[#4f4423] bg-[#171209]">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-[#caa64d] via-[#e8cf8a] to-[#caa64d] transition-all duration-700 ease-out"
                style={{ width: `${Math.max(progressPercent, 8)}%` }}
              />
            </div>

            <div className="space-y-2.5">
              {PROCESSING_STAGES.map((stage) => {
                const stageIndex = stageOrder.indexOf(stage);
                const isDone = activeStageIndex > stageIndex;
                const isActive = stage === processingStage;
                const isVisible = isDone || isActive;

                return (
                  <div
                    key={stage}
                    className={`flex items-center gap-2 text-xs transition-all duration-500 ${
                      isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-50"
                    } ${isDone ? "text-[#a8d6b1]" : isActive ? "text-[#f1d788]" : "text-[#8a8a8a]"}`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isDone
                          ? "bg-[#8fcf9d]"
                          : isActive
                            ? "heads-loading-dot bg-[#f1d788]"
                            : "bg-[#4a4a4a]"
                      }`}
                    />
                    <span>
                      {stageLabels[stage]}
                      {stage === "transcribing"
                        ? " This might take a minute for longer files."
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#f8b5b5]">{error}</p> : null}
    </form>
  );
}
