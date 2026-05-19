import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { requireCoreUser } from "@/lib/coreAuth";
import { htmlToPlainText } from "@/lib/text";

const safeFilename = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCoreUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format") ?? "txt";

  const { data, error } = await auth.supabase
    .from("meeting_notes")
    .select("id, title, meeting_date, content")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Meeting note not found." }, { status: 404 });
  }

  const plainText = htmlToPlainText(data.content);
  const baseName = safeFilename(`${data.meeting_date}-${data.title || "meeting-note"}`);

  if (format === "txt") {
    return new NextResponse(plainText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.txt"`
      }
    });
  }

  if (format === "docx") {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: data.title || "Meeting Note"
            }),
            ...plainText
              .split("\n")
              .filter(Boolean)
              .map((line) => new Paragraph({ text: line.trim() }))
          ]
        }
      ]
    });

    const docBuffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(docBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`
      }
    });
  }

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const margin = 50;
    const maxWidth = page.getWidth() - margin * 2;
    let y = page.getHeight() - margin;

    const drawLine = (line: string) => {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font
      });
      y -= fontSize + 4;
      if (y <= margin) {
        page = pdf.addPage([612, 792]);
        y = page.getHeight() - margin;
      }
    };

    const lines = plainText.split("\n").flatMap((line) => {
      const words = line.split(" ");
      const wrapped: string[] = [];
      let current = "";

      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        const width = font.widthOfTextAtSize(candidate, fontSize);
        if (width > maxWidth && current) {
          wrapped.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });

      if (current) {
        wrapped.push(current);
      }

      return wrapped.length ? wrapped : [""];
    });

    lines.forEach((line) => drawLine(line));

    const pdfBytes = await pdf.save();
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`
      }
    });
  }

  return NextResponse.json(
    { error: "Unsupported export format. Use txt, docx, or pdf." },
    { status: 400 }
  );
}
