"use client";

import { FormEvent, useState } from "react";

type UploadResult = {
  formattedNotes: string;
  rawTranscript: string;
  inferredTitle: string;
};

type AudioUploadFormProps = {
  meetingDate: string;
  onSuccess: (result: UploadResult) => void;
};

export function AudioUploadForm({ meetingDate, onSuccess }: AudioUploadFormProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<"idle" | "uploading" | "processing">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!audioFile) {
      setError("Please choose an audio file first.");
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingStage("uploading");

      const payload = new FormData();
      payload.append("audio", audioFile);
      payload.append("meetingDate", meetingDate);

      const response = await fetch("/api/meetings/upload", {
        method: "POST",
        body: payload
      });
      setProcessingStage("processing");

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to process audio.");
      }

      const data = (await response.json()) as UploadResult;

      onSuccess(data);
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
      className="heads-card space-y-4 rounded-xl p-5"
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-[#d8d8d8]">
          Upload audio (.mp3, .wav, .m4a)
        </label>
        <input
          type="file"
          accept=".mp3,.wav,.m4a,audio/*"
          onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-lg px-3 py-2 text-sm text-[#f2f2f2] file:mr-4 file:rounded-md file:border-0 file:bg-[#d4af37] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#121212] file:shadow-sm hover:file:bg-[#e5c45c]"
        />
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="heads-gold-btn w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? "Transcribing and formatting..." : "Generate Meeting Notes"}
      </button>
      {isProcessing ? (
        <div className="space-y-2">
          <p className="text-xs text-[#bdbdbd]">
            {processingStage === "uploading" && "Uploading audio file..."}
            {processingStage === "processing" &&
              "Upload complete. AI is transcribing and formatting your notes..."}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#f8b5b5]">{error}</p> : null}
    </form>
  );
}
