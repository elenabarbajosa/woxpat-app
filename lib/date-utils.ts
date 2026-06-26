export function formatDisplayEventTime(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "TBD") return null;

  const isoMatch = trimmed.match(/T(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (isoMatch) {
    return `${isoMatch[1].padStart(2, "0")}:${isoMatch[2]}`;
  }

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  }

  return trimmed;
}

export function formatPublicEventDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr || dateStr === "TBD") {
    return "Por confirmar";
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const datePart = isoMatch
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(
        new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])),
      )
    : dateStr;

  const timePart = formatDisplayEventTime(timeStr);
  if (!timePart) {
    return datePart;
  }

  return `${datePart}, ${timePart}`;
}
