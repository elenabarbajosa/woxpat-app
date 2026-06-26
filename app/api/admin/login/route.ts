import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ error: "Email o contraseña incorrectos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return Response.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  if (!isAllowedAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return Response.json({ error: "Email o contraseña incorrectos" }, { status: 403 });
  }

  try {
    const serviceClient = createServiceClient();
    await serviceClient.rpc("upsert_admin_allowlist_email", {
      p_email: data.user.email,
    });
  } catch (syncError) {
    console.error("[auth] Failed to sync admin allowlist:", syncError);
  }

  return Response.json({ success: true });
}
