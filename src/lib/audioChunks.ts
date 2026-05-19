import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const OPENAI_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const runFfmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "ignore" });

    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg is not installed on the server. Install ffmpeg to process files larger than 25MB."
          )
        );
        return;
      }
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code ?? "unknown"}.`));
    });
  });

export const getOpenAiMaxAudioBytes = () => OPENAI_MAX_AUDIO_BYTES;

export const createTranscriptionChunks = async (audio: File) => {
  const workdir = await mkdtemp(path.join(tmpdir(), "heads-audio-"));
  const inputPath = path.join(workdir, `${randomUUID()}-${audio.name || "input"}`);
  const compressedPath = path.join(workdir, "compressed.mp3");
  const chunkPattern = path.join(workdir, "chunk-%03d.mp3");

  const inputBuffer = Buffer.from(await audio.arrayBuffer());
  await writeFile(inputPath, inputBuffer);

  // Compress to a predictable low bitrate first.
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "32k",
    compressedPath
  ]);

  const compressedStats = await stat(compressedPath);
  if (compressedStats.size <= OPENAI_MAX_AUDIO_BYTES) {
    return {
      chunkPaths: [compressedPath],
      cleanup: async () => {
        await rm(workdir, { recursive: true, force: true });
      }
    };
  }

  // Split compressed audio into 15-minute chunks.
  await runFfmpeg([
    "-y",
    "-i",
    compressedPath,
    "-f",
    "segment",
    "-segment_time",
    "900",
    "-c",
    "copy",
    chunkPattern
  ]);

  const entries = await readdir(workdir);
  const chunkPaths = entries
    .filter((entry) => /^chunk-\d{3}\.mp3$/.test(entry))
    .sort()
    .map((entry) => path.join(workdir, entry));

  if (chunkPaths.length === 0) {
    throw new Error("Unable to chunk large audio file for transcription.");
  }

  return {
    chunkPaths,
    cleanup: async () => {
      await rm(workdir, { recursive: true, force: true });
    }
  };
};
