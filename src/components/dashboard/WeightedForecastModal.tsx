// src/components/dashboard/WeightedForecastModal.tsx
"use client";

import { useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatPct } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/stages";
import { useScenario } from "@/lib/use-scenario";
import { computeAdjustedForecast } from "@/lib/compute-adjusted-forecast";
import type { WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";

type Props = {
  open: boolean;
  onClose: () => void;
  deals: WeightedForecastDeal[];
  total: number; // unadjusted total
  year: number;
};

function ModifierInput({
  label, value, onChange, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value === 0 ? "" : value}
          onChange={(e) => {
            const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
            onChange(isNaN(v) ? 0 : v);
          }}
          placeholder="0"
          className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
        />
        <span className="text-sm text-slate-500">%</span>
      </div>
      <p className="text-[10px] text-slate-400 max-w-[220px] leading-snug">{hint}</p>
    </div>
  );
}

export function WeightedForecastModal({ open, onClose, deals, total, year }: Props) {
  const {
    dealOverrides, closeRateModifier, timingModifier,
    setDealOverride, setCloseRateModifier, setTimingModifier, resetWhatIf, isWhatIfActive,
  } = useScenario();

  const { deals: adjusted, total: adjustedTotal } = useMemo(
    () => computeAdjustedForecast(deals, dealOverrides, closeRateModifier, timingModifier, year),
    [deals, dealOverrides, closeRateModifier, timingModifier, year],
  );

  const hasChanges = isWhatIfActive;
  const delta = adjustedTotal - total;

  return (
    <Modal open={open} onClose={onClose} title={`Weighted Forecast — FY${year}`} width="full">

      {/* Global modifiers */}
      <div className="mb-5 p-4 bg-slate-50 rounded-card border border-slate-200">
        <div className="flex flex-wrap items-start gap-8">
          <ModifierInput
            label="Close Rate Modifier (%)"
            value={closeRateModifier}
            onChange={setCloseRateModifier}
            hint="+20 raises all close rates by 20% (x1.2). -20 lowers them by 20% (x0.8)."
          />
          <ModifierInput
            label="Timing Factor Modifier (%)"
            value={timingModifier}
            onChange={setTimingModifier}
            hint="+20 delays all projected-timing closes by 20%, reducing in-year contribution. -20 accelerates them."
          />
          <div className="flex flex-col justify-end gap-1 ml-auto self-end">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Adjusted Total</p>
              <p className={`text-xl font-extrabold ${hasChanges ? "text-teal" : "text-navy"}`}>
                {formatCurrency(adjustedTotal)}
              </p>
              {hasChanges && (
                <p className={`text-xs font-medium mt-0.5 ${delta >= 0 ? "text-green" : "text-coral"}`}>
                  {delta >= 0 ? "+" : ""}{formatCurrency(delta)} vs actual
                </p>
              )}
            </div>
            {hasChanges && (
              <button
                onClick={resetWhatIf}
                className="mt-2 text-xs font-semibold text-slate-400 hover:text-navy transition-colors"
              >
                Reset all overrides
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Formula note */}
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        <span className="font-semibold text-navy">Formula: </span>
        Deal Value × Stage Close Rate × Timing Factor.
        Timing Factor = months remaining after close date + (implementation period) / months in FY{year}.
        Implementation period is assumed to be 45 days.
        Timing defaults to each deal&rsquo;s projected close date (stage-based); use the basis toggle
        to switch a deal to its Koda Expected Close Date, or type a custom date to override.
        Only deals projected (or Koda-expected) to close within FY{year} are included.
      </p>

      {deals.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          No deals projected to close in FY{year}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-5 py-3 pr-2 w-8">Excl.</th>
                <th className="px-5 py-3 pr-4">Deal</th>
                <th className="px-5 py-3 pr-4">Stage</th>
                <th className="px-5 py-3 pr-4">Days in Stage</th>
                <th className="px-5 py-3 pr-4">Close Basis</th>
                <th className="px-5 py-3 pr-4">Close Date</th>
                <th className="px-5 py-3 pr-4 text-right">Value</th>
                <th className="px-5 py-3 pr-4 text-right">Close Rate</th>
                <th className="px-5 py-3 pr-4 text-right">Timing</th>
                <th className="px-5 py-3 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {adjusted.map((d) => {
                const override = dealOverrides[d.id] ?? {};
                const effectiveDate = d.effectiveCloseDate.slice(0, 10);
                const closeRateChanged = Math.abs(d.adjustedCloseRate - d.closeRate) > 0.0001;
                const timingChanged    = Math.abs(d.adjustedTimingFactor - d.timingFactor) > 0.0001;
                const contribChanged   = Math.abs(d.adjustedContribution - d.contribution) > 0.01;
                const hasKoda = d.kodaExpectedCloseDate != null;

                return (
                  <tr
                    key={d.id}
                    className={`border-b border-slate-100 last:border-0 even:bg-slate-50/40 transition-colors ${d.excluded ? "opacity-40" : "hover:bg-teal/5"}`}
                  >
                    {/* Exclude checkbox */}
                    <td className="px-5 py-3 pr-2">
                      <input
                        type="checkbox"
                        checked={override.excluded === true}
                        onChange={(e) => setDealOverride(d.id, { excluded: e.target.checked || null })}
                        className="w-3.5 h-3.5 accent-coral"
                        title="Exclude from forecast"
                      />
                    </td>

                    {/* Deal name */}
                    <td className="px-5 py-3 pr-4">
                      <p className="font-medium text-navy leading-tight">{d.name}</p>
                      {d.companyName && <p className="text-xs text-slate-500">{d.companyName}</p>}
                    </td>

                    {/* Stage */}
                    <td className="px-5 py-3 pr-4 text-slate-600 text-xs whitespace-nowrap">
                      {STAGE_LABELS[d.stage] ?? d.stage}
                    </td>

                    {/* Days in Stage */}
                    <td className="px-5 py-3 pr-4 text-slate-600 text-xs tabular-nums whitespace-nowrap">
                      {d.daysInStage != null ? `${d.daysInStage}d` : "—"}
                    </td>

                    {/* Close basis toggle: Projected (default) vs Koda */}
                    <td className="px-5 py-3 pr-4">
                      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setDealOverride(d.id, { dateSource: "projected" })}
                          className={`px-2 py-1 ${d.dateSource === "projected" && !d.hasDateOverride ? "bg-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}
                        >
                          Proj
                        </button>
                        <button
                          type="button"
                          disabled={!hasKoda}
                          onClick={() => setDealOverride(d.id, { dateSource: "koda" })}
                          title={hasKoda ? "Use Koda Expected Close Date" : "No Koda Expected Close Date set"}
                          className={`px-2 py-1 border-l border-slate-200 ${d.dateSource === "koda" && !d.hasDateOverride ? "bg-teal text-white" : "text-slate-500 hover:bg-slate-50"} disabled:opacity-40 disabled:hover:bg-transparent`}
                        >
                          Koda
                        </button>
                      </div>
                    </td>

                    {/* Effective close date - editable (custom override) */}
                    <td className="px-5 py-3 pr-4">
                      <input
                        type="date"
                        value={override.dateOverride ?? effectiveDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDealOverride(d.id, { dateOverride: (!val || val === effectiveDate) ? null : val });
                        }}
                        className={`w-32 px-1.5 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-teal/40 ${
                          d.hasDateOverride ? "border-teal text-teal font-semibold" : "border-slate-200 text-slate-700"
                        }`}
                      />
                    </td>

                    {/* Value - editable */}
                    <td className="px-5 py-3 pr-4 text-right">
                      <input
                        type="number"
                        value={override.valueOverride ?? ""}
                        placeholder={String(Math.round(d.value))}
                        onChange={(e) => {
                          const val = e.target.value;
                          const n = val === "" ? null : parseFloat(val);
                          setDealOverride(d.id, { valueOverride: n && n > 0 ? n : null });
                        }}
                        className={`w-28 px-1.5 py-1 text-xs text-right border rounded-md focus:outline-none focus:ring-2 focus:ring-teal/40 ${
                          d.hasValueOverride ? "border-teal text-teal font-semibold" : "border-slate-200 text-slate-700"
                        }`}
                      />
                    </td>

                    {/* Close rate */}
                    <td className="px-5 py-3 pr-4 text-right">
                      <p className={`${closeRateChanged ? "text-teal font-semibold" : "text-slate-700"}`}>
                        {formatPct(d.adjustedCloseRate)}
                      </p>
                      {closeRateChanged && (
                        <p className="text-[10px] text-slate-400 line-through">{formatPct(d.closeRate)}</p>
                      )}
                    </td>

                    {/* Timing factor */}
                    <td className="px-5 py-3 pr-4 text-right">
                      <p className={`${timingChanged ? "text-teal font-semibold" : "text-slate-700"}`}>
                        {formatPct(d.adjustedTimingFactor)}
                      </p>
                      {timingChanged && (
                        <p className="text-[10px] text-slate-400 line-through">{formatPct(d.timingFactor)}</p>
                      )}
                    </td>

                    {/* Contribution */}
                    <td className="px-5 py-3 text-right">
                      {d.excluded ? (
                        <p className="text-slate-400 line-through text-xs">{formatCurrency(d.contribution)}</p>
                      ) : (
                        <>
                          <p className={`font-semibold ${contribChanged ? "text-teal" : "text-navy"}`}>
                            {formatCurrency(d.adjustedContribution)}
                          </p>
                          {contribChanged && (
                            <p className="text-[10px] text-slate-400 line-through">{formatCurrency(d.contribution)}</p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={9} className="pt-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {hasChanges ? "Adjusted Weighted Forecast" : "Total Weighted Forecast"}
                </td>
                <td className="pt-3 text-right">
                  <p className={`text-lg font-extrabold ${hasChanges ? "text-teal" : "text-navy"}`}>
                    {formatCurrency(adjustedTotal)}
                  </p>
                  {hasChanges && (
                    <p className="text-[10px] text-slate-400 line-through">{formatCurrency(total)}</p>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}