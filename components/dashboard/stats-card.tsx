interface StatsCardProps {
  label: string;
  value: number;
  hint: string;
}

export function StatsCard({ label, value, hint }: StatsCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </article>
  );
}
