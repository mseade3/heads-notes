"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

const OPENAI_STANDARD_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024;

const PROCESSING_STAGES = [
  "uploading",
  "transcribing",
  "structuring",
  "saving"
] as const;

type ProcessingStage = (typeof PROCESSING_STAGES)[number] | "idle" | "compressing";

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

const stageOrder: ProcessingStage[] = [
  "compressing",
  "uploading",
  "transcribing",
  "structuring",
  "saving"
];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const encodeMonoWav = (buffer: AudioBuffer): Blob => {
  const channel = buffer.getChannelData(0);
  const dataLength = channel.length * 2;
  const outputBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(outputBuffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < channel.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channel[index]));
    const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, pcmSample, true);
    offset += 2;
  }

  return new Blob([outputBuffer], { type: "audio/wav" });
};

const createCompressedAudioFile = async (inputFile: File) => {
  const AudioContextClass =
    window.AudioContext ||
    ((window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext as typeof AudioContext | undefined);
  if (!AudioContextClass) {
    throw new Error("Browser audio compression is not supported in this environment.");
  }

  const context = new AudioContextClass();

  try {
    const arrayBuffer = await inputFile.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const sampleRateCandidates = [16000, 12000, 8000];

    for (const sampleRate of sampleRateCandidates) {
      const frameCount = Math.ceil(decoded.duration * sampleRate);
      const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineContext.destination);
      source.start(0);

      const rendered = await offlineContext.startRendering();
      const wavBlob = encodeMonoWav(rendered);
      const compressedFile = new File(
        [wavBlob],
        `${inputFile.name.replace(/\.[^/.]+$/, "") || "meeting-audio"}-compressed.wav`,
        {
          type: "audio/wav",
          lastModified: Date.now()
        }
      );

      if (compressedFile.size <= OPENAI_STANDARD_AUDIO_LIMIT_BYTES) {
        return compressedFile;
      }
    }

    throw new Error(
      "Audio is still above 25MB after compression. Try a shorter clip."
    );
  } finally {
    await context.close();
  }
};

export function AudioUploadForm({ meetingDate, onSuccess }: AudioUploadFormProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);
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
    setCompressionNotice(null);

    if (!audioFile) {
      setError("Please choose an audio file first.");
      return;
    }

    try {
      setIsProcessing(true);
      let fileForUpload = audioFile;

      if (audioFile.size > OPENAI_STANDARD_AUDIO_LIMIT_BYTES) {
        setCompressionNotice(
          "File is over 25MB limit. Attempting auto-compression to avoid server errors..."
        );
        setProcessingStage("compressing");
        fileForUpload = await createCompressedAudioFile(audioFile);
      }

      const payload = new FormData();
      setProcessingStage("uploading");
      payload.append("audio", fileForUpload);
      payload.append("meetingDate", meetingDate);

      const responsePromise = fetch("/api/meetings/upload", {
        method: "POST",
        body: payload
      });
      setProcessingStage("transcribing");

      const response = await responsePromise;

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to process audio.");
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

      {compressionNotice ? (
        <p className="rounded-md border border-[#6f5a22] bg-[#1a1409] px-3 py-2 text-xs text-[#f1d788]">
          {compressionNotice}
        </p>
      ) : null}

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
              {processingStage === "compressing" ? (
                <p className="text-xs text-[#f1d788] opacity-100 transition-opacity duration-500">
                  File is over 25MB limit. Attempting auto-compression to avoid server
                  errors...
                </p>
              ) : null}
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
