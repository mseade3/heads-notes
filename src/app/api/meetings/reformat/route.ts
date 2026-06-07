import { NextRequest, NextResponse } from "next/server";
import { requireCoreUser } from "@/lib/coreAuth";
import { getOpenAIClient } from "@/lib/openai";
import { normalizeHeadsVocabulary } from "@/lib/nameNormalization";
import { HEADS_FORMATTING_TEMPLATE } from "@/lib/template";

export const runtime = "nodejs";
export const maxDuration = 120;

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const toDraftSourceText = (value: string) => {
  if (!value) return "";

  const withLineHints = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(ul|ol)>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n\n");

  const withoutTags = withLineHints.replace(/<[^>]+>/g, "");
  const decoded = decodeHtmlEntities(withoutTags);

  return decoded.replace(/\n{3,}/g, "\n\n").trim();
};

const getWordSet = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((word) => word.length >= 4)
  );

const keepsEnoughOriginalContent = (source: string, candidate: string) => {
  const sourceWords = getWordSet(source);
  const candidateWords = getWordSet(candidate);

  if (sourceWords.size === 0) return true;

  let overlap = 0;
  sourceWords.forEach((word) => {
    if (candidateWords.has(word)) overlap += 1;
  });

  const overlapRatio = overlap / sourceWords.size;
  const lengthRatio = candidate.trim().length / Math.max(source.trim().length, 1);

  return overlapRatio >= 0.45 && lengthRatio >= 0.6;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCoreUser();
    if ("error" in auth) return auth.error;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      content?: string;
      meetingDate?: string;
    };

    const content = String(body.content ?? "").trim();
    const meetingDate = String(body.meetingDate ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "Draft content is required." }, { status: 400 });
    }

    const normalizedInput = normalizeHeadsVocabulary(toDraftSourceText(content));
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: HEADS_FORMATTING_TEMPLATE
        },
        {
          role: "user",
          content:
            `Meeting Date: ${meetingDate || "Unknown"}\n\n` +
            "Reformat this edited draft into the official Core Meeting Notes structure. " +
            "Treat the edited draft as source-of-truth. Preserve all substantive user edits, decisions, and action items. " +
            "Only adjust structure, clarity, and naming/term normalization. " +
            "Do not drop material unless it is exact duplicate noise.\n\n" +
            `Edited Draft:\n${normalizedInput}`
        }
      ]
    });

    const aiFormattedNotes = normalizeHeadsVocabulary(
      completion.choices[0]?.message?.content?.trim() ?? ""
    );
    const formattedNotes =
      aiFormattedNotes && keepsEnoughOriginalContent(normalizedInput, aiFormattedNotes)
        ? aiFormattedNotes
        : normalizedInput;

    if (!formattedNotes) {
      return NextResponse.json(
        { error: "Formatting model did not return usable notes." },
        { status: 422 }
      );
    }

    return NextResponse.json({ formattedNotes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error during reformatting."
      },
      { status: 500 }
    );
  }
}
