import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedAdminEmail(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({ ok: true });
}
