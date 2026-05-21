import { NextResponse } from "next/server";
import { requireCoreUser } from "@/lib/coreAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type RouteContext = {
  params:
    | {
        id: string;
      }
    | Promise<{
        id: string;
      }>;
};

const parseMeetingId = async (request: Request, context: RouteContext) => {
  const params = await context.params;
  const fromParams = params?.id?.trim();
  if (fromParams) {
    return fromParams;
  }

  const pathname = new URL(request.url).pathname;
  const pathParts = pathname.split("/").filter(Boolean);
  const fromPath = pathParts.at(-1);
  return fromPath ? decodeURIComponent(fromPath).trim() : "";
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = await requireCoreUser();
    if ("error" in auth) return auth.error;
    const adminSupabase = createSupabaseAdminClient();
    const deleteClient = adminSupabase ?? auth.supabase;

    const id = await parseMeetingId(request, context);
    if (!id) {
      return NextResponse.json({ error: "Meeting ID is required." }, { status: 400 });
    }

    const { data: existingMeeting, error: existingError } = await auth.supabase
      .from("meeting_notes")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Draft not found or you do not have permission to delete it." },
        { status: 404 }
      );
    }

    if (existingMeeting.status !== "draft") {
      return NextResponse.json({ error: "Only draft notes can be deleted." }, { status: 400 });
    }

    const { data: deletedRows, error: deleteError } = await deleteClient
      .from("meeting_notes")
      .delete()
      .eq("id", id)
      .eq("status", "draft")
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "Draft not found or you do not have permission to delete it." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected error while deleting draft."
      },
      { status: 500 }
    );
  }
}
