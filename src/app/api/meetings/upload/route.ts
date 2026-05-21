import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { getOpenAIClient } from "@/lib/openai";
import {
  createTranscriptionChunks,
  getOpenAiMaxAudioBytes
} from "@/lib/audioChunks";
import { requireCoreUser } from "@/lib/coreAuth";
import { HEADS_FORMATTING_TEMPLATE } from "@/lib/template";

export const runtime = "nodejs";
export const maxDuration = 300;

const getDefaultTitle = (meetingDate: string) => {
  if (!meetingDate) return "Core Meeting Notes";

  const date = new Date(meetingDate);
  return `Core: ${date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  })}`;
};

export async function POST(request: NextRequest) {
  let cleanupChunks: (() => Promise<void>) | null = null;

  try {
    const auth = await requireCoreUser();
    if ("error" in auth) return auth.error;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data." },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read uploaded file data. Please re-select the file and try again."
        },
        { status: 400 }
      );
    }

    const audio = formData.get("audio");
    const transcript = String(formData.get("transcript") ?? "").trim();
    const meetingDate = String(formData.get("meetingDate") ?? "");

    if (!(audio instanceof File) && !transcript) {
      return NextResponse.json(
        { error: "Audio file or transcript is required." },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    let rawTranscript = "";

    if (transcript) {
      rawTranscript = transcript;
    } else if (audio instanceof File) {
      if (audio.size <= getOpenAiMaxAudioBytes()) {
        const transcription = await openai.audio.transcriptions.create({
          file: audio,
          model: "whisper-1"
        });
        rawTranscript = transcription.text?.trim() ?? "";
      } else {
        const { chunkPaths, cleanup } = await createTranscriptionChunks(audio);
        cleanupChunks = cleanup;

        const chunkTranscripts: string[] = [];
        for (const [index, chunkPath] of chunkPaths.entries()) {
          let chunkTranscription;
          try {
            chunkTranscription = await openai.audio.transcriptions.create({
              file: createReadStream(chunkPath),
              model: "whisper-1"
            });
          } catch (chunkError) {
            throw new Error(
              `Transcription failed on chunk ${index + 1} of ${chunkPaths.length}: ${
                chunkError instanceof Error ? chunkError.message : "Unknown chunk error."
              }`
            );
          }

          const chunkText = chunkTranscription.text?.trim();
          if (chunkText) {
            chunkTranscripts.push(chunkText);
          }
        }

        rawTranscript = chunkTranscripts.join(" ").replace(/\s+/g, " ").trim();
      }
    }

    if (!rawTranscript) {
      return NextResponse.json(
        { error: "No transcript text was generated from the audio file." },
        { status: 422 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: HEADS_FORMATTING_TEMPLATE
        },
        {
          role: "user",
          content: `Meeting Date: ${meetingDate || "Unknown"}\n\nTranscript:\n${rawTranscript}`
        }
      ]
    });

    const formattedNotes = completion.choices[0]?.message?.content?.trim();

    if (!formattedNotes) {
      return NextResponse.json(
        { error: "Formatting model did not return usable notes." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      rawTranscript,
      formattedNotes: `<div>${formattedNotes
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\n", "<br />")}</div>`,
      inferredTitle: getDefaultTitle(meetingDate)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error during processing."
      },
      { status: 500 }
    );
  } finally {
    if (cleanupChunks) {
      await cleanupChunks();
    }
  }
}
