type FlagColor = "green" | "yellow" | "orange" | "red";

const ACCENT_BAR: Record<FlagColor, string> = {
  green:  "bg-green",
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  red:    "bg-red-500",
};

type Props = {
  label: string;
  value: string;
  subValue?: string;
  delta?: { display: string; positive: boolean } | null;
  flagColor?: FlagColor | null;
  /** Optional accent color (hex) applied to the top bar and value text. */
  accentColor?: string;
};

export function KpiCard({ label, value, subValue, delta, flagColor, accentColor }: Props) {
  const accent = flagColor ? ACCENT_BAR[flagColor] : "bg-teal";
  return (
    <div className="relative bg-white rounded-card shadow-card overflow-hidden">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] ${accentColor ? "" : accent}`}
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      />
      <div className="bg-gradient-to-b from-white to-slate-50/60 p-6">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-3">
          {label}
        </p>
        <p
          className={`text-[2.25rem] leading-none font-bold tabular-nums ${
            accentColor ? "" : flagColor === "green" ? "text-green" : "text-navy"
          }`}
          style={accentColor ? { color: accentColor } : undefined}
        >
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{subValue}</p>
        )}
        {delta && (
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                delta.positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {delta.display}
            </span>
            <span className="text-[11px] text-slate-400">vs prior period</span>
          </div>
        )}
      </div>
    </div>
  );
}
