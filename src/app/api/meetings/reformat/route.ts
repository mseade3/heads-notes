import { NextRequest, NextResponse } from "next/server";
import { requireCoreUser } from "@/lib/coreAuth";
import { getOpenAIClient } from "@/lib/openai";
import { normalizeHeadsVocabulary } from "@/lib/nameNormalization";
import { HEADS_FORMATTING_TEMPLATE } from "@/lib/template";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const normalizedInput = normalizeHeadsVocabulary(content);
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.1,
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
            "Preserve meaning and details, but normalize naming and terminology.\n\n" +
            `Edited Draft:\n${normalizedInput}`
        }
      ]
    });

    const formattedNotes = normalizeHeadsVocabulary(
      completion.choices[0]?.message?.content?.trim() ?? ""
    );

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
