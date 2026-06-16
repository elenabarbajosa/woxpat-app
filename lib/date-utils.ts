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

  if (!timeStr || timeStr === "TBD") {
    return datePart;
  }

  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
  const timePart = timeMatch
    ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
    : timeStr;

  return `${datePart}, ${timePart}`;
}
