export function getAppOrigin(fallbackOrigin = ""): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return fallbackOrigin.replace(/\/$/, "");
}

export function buildPasswordResetRedirectUrl(fallbackOrigin = ""): string {
  const origin = getAppOrigin(fallbackOrigin);
  return `${origin}/auth/callback?next=/admin/reset-password`;
}
