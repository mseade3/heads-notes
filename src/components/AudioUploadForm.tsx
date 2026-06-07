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

type ChunkTranscriptionResult = {
  text: string;
};

type AudioChunk = {
  index: number;
  file: File;
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

const CLIENT_DIRECT_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
const CLIENT_CHUNK_SECONDS = 60;
const CLIENT_CHUNK_OVERLAP_SECONDS = 3;
const MAX_CHUNK_UPLOAD_BYTES = 3 * 1024 * 1024;
const CLIENT_MAX_CHUNK_CONCURRENCY = 5;
const CLIENT_CHUNK_MAX_RETRIES = 3;
const CLIENT_RETRY_BASE_DELAY_MS = 500;

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

const encodeMonoWav = (samples: Float32Array, sampleRate: number): Blob => {
  const dataLength = samples.length * 2;
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
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, pcmSample, true);
    offset += 2;
  }

  return new Blob([outputBuffer], { type: "audio/wav" });
};

const createClientAudioChunks = async (inputFile: File) => {
  const AudioContextClass =
    window.AudioContext ||
    ((window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext as typeof AudioContext | undefined);

  if (!AudioContextClass) {
    throw new Error("Browser audio decoding is unavailable for large-file fallback.");
  }

  const context = new AudioContextClass();

  try {
    const decoded = await context.decodeAudioData(await inputFile.arrayBuffer());
    const targetSampleRate = 16000;
    const frameCount = Math.ceil(decoded.duration * targetSampleRate);
    const offlineContext = new OfflineAudioContext(1, frameCount, targetSampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start(0);
    const rendered = await offlineContext.startRendering();

    const monoSamples = rendered.getChannelData(0);
    const samplesPerChunk = targetSampleRate * CLIENT_CHUNK_SECONDS;
    const overlapSamples = targetSampleRate * CLIENT_CHUNK_OVERLAP_SECONDS;
    const chunks: AudioChunk[] = [];

    for (let baseStart = 0; baseStart < monoSamples.length; baseStart += samplesPerChunk) {
      const baseEnd = Math.min(baseStart + samplesPerChunk, monoSamples.length);
      const start = Math.max(0, baseStart - overlapSamples);
      const end = Math.min(monoSamples.length, baseEnd + overlapSamples);
      const segment = monoSamples.slice(start, end);
      const wavBlob = encodeMonoWav(segment, targetSampleRate);
      const chunkFile = new File(
        [wavBlob],
        `chunk-${String(chunks.length + 1).padStart(3, "0")}.wav`,
        {
          type: "audio/wav",
          lastModified: Date.now()
        }
      );

      if (chunkFile.size > MAX_CHUNK_UPLOAD_BYTES) {
        throw new Error(
          "Chunk upload size exceeded safe Vercel limits. Please export audio at lower quality."
        );
      }

      chunks.push({
        index: chunks.length,
        file: chunkFile
      });
    }

    if (chunks.length === 0) {
      throw new Error("Unable to split audio into uploadable chunks.");
    }

    return chunks;
  } finally {
    await context.close();
  }
};

const shouldRetryChunkStatus = (status: number) => status === 429 || status >= 500;

const getClientChunkConcurrency = (chunkCount: number) => {
  if (chunkCount <= 1) return 1;

  const hardwareConcurrency =
    typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : 4;

  const connectionType =
    typeof navigator !== "undefined" &&
    "connection" in navigator &&
    (
      navigator as Navigator & {
        connection?: { effectiveType?: string };
      }
    ).connection?.effectiveType
      ? (
          navigator as Navigator & {
            connection?: { effectiveType?: string };
          }
        ).connection?.effectiveType
      : "";

  let baseline = 4;
  if (hardwareConcurrency <= 2) baseline = 2;
  else if (hardwareConcurrency <= 4) baseline = 3;

  if (connectionType === "slow-2g" || connectionType === "2g") {
    baseline = Math.min(baseline, 2);
  } else if (connectionType === "3g") {
    baseline = Math.min(baseline, 3);
  }

  return Math.min(chunkCount, CLIENT_MAX_CHUNK_CONCURRENCY, Math.max(1, baseline));
};

const getWords = (value: string) => value.trim().split(/\s+/).filter(Boolean);

const mergeWithOverlapDedup = (previousText: string, currentText: string) => {
  if (!previousText) return currentText;
  if (!currentText) return "";

  const previousWords = getWords(previousText);
  const currentWords = getWords(currentText);
  const maxLookback = Math.min(40, previousWords.length, currentWords.length);

  let overlapWordCount = 0;
  for (let length = maxLookback; length >= 6; length -= 1) {
    const previousSlice = previousWords
      .slice(previousWords.length - length)
      .join(" ")
      .toLowerCase();
    const currentSlice = currentWords.slice(0, length).join(" ").toLowerCase();
    if (previousSlice === currentSlice) {
      overlapWordCount = length;
      break;
    }
  }

  if (!overlapWordCount) return currentText;
  return currentWords.slice(overlapWordCount).join(" ");
};

const transcribeChunkWithRetry = async (chunk: AudioChunk) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CLIENT_CHUNK_MAX_RETRIES; attempt += 1) {
    const chunkPayload = new FormData();
    chunkPayload.append("audio", chunk.file);

    try {
      const chunkResponse = await fetch("/api/meetings/transcribe-chunk", {
        method: "POST",
        body: chunkPayload
      });

      if (!chunkResponse.ok) {
        const message = await getUploadErrorMessage(chunkResponse);
        if (attempt < CLIENT_CHUNK_MAX_RETRIES && shouldRetryChunkStatus(chunkResponse.status)) {
          await sleep(CLIENT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(message);
      }

      const chunkBody = (await chunkResponse.json()) as ChunkTranscriptionResult;
      return chunkBody.text?.trim() ?? "";
    } catch (error) {
      lastError = error;
      if (attempt >= CLIENT_CHUNK_MAX_RETRIES) break;
      await sleep(CLIENT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to transcribe chunk ${chunk.index + 1}.`);
};

const transcribeChunksInParallel = async (chunks: AudioChunk[]) => {
  const results = new Array<string>(chunks.length).fill("");
  let cursor = 0;
  const targetConcurrency = getClientChunkConcurrency(chunks.length);

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= chunks.length) return;
      results[index] = await transcribeChunkWithRetry(chunks[index]);
    }
  };

  const workers = Array.from(
    { length: Math.min(targetConcurrency, chunks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
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
      let data: UploadResult;

      if (audioFile.size > CLIENT_DIRECT_UPLOAD_LIMIT_BYTES) {
        setProcessingStage("uploading");
        const chunks = await createClientAudioChunks(audioFile);
        setProcessingStage("transcribing");
        const chunkTranscripts = await transcribeChunksInParallel(chunks);
        const stitchedTranscript = chunkTranscripts.reduce((combined, nextChunkText) => {
          const nextText = combined
            ? mergeWithOverlapDedup(combined, nextChunkText)
            : nextChunkText;
          if (!nextText) return combined;
          return `${combined} ${nextText}`.trim();
        }, "");

        const finalTranscript = stitchedTranscript.replace(/\s+/g, " ").trim();
        if (!finalTranscript) {
          throw new Error("No transcript text was generated from the uploaded audio.");
        }

        const formatPayload = new FormData();
        formatPayload.append("meetingDate", meetingDate);
        formatPayload.append("transcript", finalTranscript);
        setProcessingStage("structuring");

        const formatResponse = await fetch("/api/meetings/upload", {
          method: "POST",
          body: formatPayload
        });
        if (!formatResponse.ok) {
          throw new Error(await getUploadErrorMessage(formatResponse));
        }
        data = (await formatResponse.json()) as UploadResult;
      } else {
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
        data = (await response.json()) as UploadResult;
      }

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
