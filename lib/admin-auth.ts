export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;

  const allowlist = parseAdminEmails();
  if (allowlist.length === 0) return false;

  return allowlist.includes(email.trim().toLowerCase());
}
