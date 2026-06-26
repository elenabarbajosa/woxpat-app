import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const authClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user || !isAllowedAdminEmail(user.email)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const serviceClient = createServiceClient();
    await serviceClient.rpc("upsert_admin_allowlist_email", {
      p_email: user.email,
    });
  } catch (error) {
    console.error("[auth] Failed to sync admin allowlist:", error);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }

  return Response.json({ success: true });
}
