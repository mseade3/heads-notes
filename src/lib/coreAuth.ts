import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const parseCsv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const isAllowedCoreEmail = (email?: string | null) => {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase();
  const allowedEmails = parseCsv(process.env.ALLOWED_CORE_EMAILS);
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  const noRestrictions = allowedEmails.length === 0 && !allowedDomain;

  if (noRestrictions) return true;
  if (allowedEmails.includes(normalizedEmail)) return true;
  if (allowedDomain && normalizedEmail.endsWith(`@${allowedDomain}`)) return true;

  return false;
};

export const requireCoreUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (!isAllowedCoreEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { supabase, user };
};
