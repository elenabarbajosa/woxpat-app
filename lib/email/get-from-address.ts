export function getEmailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Woxpat <hola@woxpat.com>"
  );
}
