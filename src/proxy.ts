import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const parseCsv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isAuthorizedCoreUser = (email?: string | null) => {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  const allowedEmails = parseCsv(process.env.ALLOWED_CORE_EMAILS);
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();

  if (allowedEmails.length === 0 && !allowedDomain) {
    return true;
  }

  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  if (allowedDomain && normalizedEmail.endsWith(`@${allowedDomain}`)) {
    return true;
  }

  return false;
};

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const needsAuth = isDashboard;

  if (needsAuth && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isAuthorizedCoreUser(user.email)) {
    const unauthorizedUrl = new URL("/login", request.url);
    unauthorizedUrl.searchParams.set("unauthorized", "1");
    return NextResponse.redirect(unauthorizedUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"]
};
