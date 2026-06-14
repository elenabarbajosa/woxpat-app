import { isAllowedAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChangePasswordBody;
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return Response.json({ error: "Campos incompletos." }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return Response.json({ error: "Las contraseñas no coinciden" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAllowedAdminEmail(user.email)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return Response.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("[auth] Password update failed:", updateError.message);
    return Response.json({ error: "No se pudo actualizar la contraseña." }, { status: 500 });
  }

  return Response.json({ success: true });
}
