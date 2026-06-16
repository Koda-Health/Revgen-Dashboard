// src/components/dashboard/PipelineSplitWidgets.tsx
import { formatCurrency } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard-data";

export function PipelineSplitWidgets({ data }: { data: DashboardData }) {
  const { newLogo, renewal, combined } = data.pipelineSplit;
  const cols: { title: string; s: { pipeline: number; weighted: number; count: number }; accent?: string }[] = [
    { title: "New Logo", s: newLogo },
    { title: "Renewals", s: renewal, accent: "#EE8363" },
    { title: "Combined", s: combined },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map(({ title, s, accent }) => (
        <div key={title} className="bg-white rounded-card shadow-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3"
              style={accent ? { color: accent } : undefined}>{title}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Pipeline</span><span className="font-semibold text-navy">{formatCurrency(s.pipeline)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Weighted</span><span className="font-semibold text-navy">{formatCurrency(s.weighted)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Active deals</span><span className="font-semibold text-navy">{s.count}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
