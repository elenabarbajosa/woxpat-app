import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/admin/reset-password";

  console.info("[auth-callback] code exists:", Boolean(code));
  console.info("[auth-callback] next:", next);

  if (!code) {
    const loginUrl = new URL("/admin/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "reset_link_invalid");
    return NextResponse.redirect(loginUrl);
  }

  const safeNext = next.startsWith("/") ? next : "/admin/reset-password";
  const redirectUrl = new URL(safeNext, requestUrl.origin);
  const supabaseResponse = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth-callback] exchange success/error:", error.message);
    const loginUrl = new URL("/admin/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "reset_link_invalid");
    return NextResponse.redirect(loginUrl);
  }

  console.info("[auth-callback] exchange success/error: success");
  return supabaseResponse;
}
