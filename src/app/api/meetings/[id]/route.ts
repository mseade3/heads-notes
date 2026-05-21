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
      .select("id, status, created_by")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting note not found or you do not have permission to delete it." },
        { status: 404 }
      );
    }

    let deletedRows: Array<{ id: string }> | null = null;

    if (adminSupabase) {
      const { data, error: deleteError } = await deleteClient
        .from("meeting_notes")
        .delete()
        .eq("id", id)
        .select("id");

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      deletedRows = data;
    } else {
      const { data, error: deleteError } = await auth.supabase
        .from("meeting_notes")
        .delete()
        .eq("id", id)
        .select("id");

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      deletedRows = data;

      if ((!deletedRows || deletedRows.length === 0) && existingMeeting.status === "published") {
        // Fallback for stricter legacy RLS: owners can downgrade published to draft, then delete.
        const { error: updateError } = await auth.supabase
          .from("meeting_notes")
          .update({ status: "draft" })
          .eq("id", id)
          .eq("created_by", auth.user.id);

        if (!updateError) {
          const { data: retryDeleteRows, error: retryDeleteError } = await auth.supabase
            .from("meeting_notes")
            .delete()
            .eq("id", id)
            .eq("created_by", auth.user.id)
            .eq("status", "draft")
            .select("id");

          if (retryDeleteError) {
            return NextResponse.json({ error: retryDeleteError.message }, { status: 500 });
          }
          deletedRows = retryDeleteRows;
        }
      }
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Meeting note not deleted. If this is an approved note, apply the latest delete policy migration in Supabase."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while deleting meeting note."
      },
      { status: 500 }
    );
  }
}
