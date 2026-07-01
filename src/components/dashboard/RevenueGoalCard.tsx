"use client";

import { useRef, useMemo } from "react";
import { useScenario } from "@/lib/use-scenario";
import { computeAdjustedForecast } from "@/lib/compute-adjusted-forecast";
import { formatCurrency, formatPct } from "@/lib/format";
import { ExportButton } from "@/components/ui/ExportButton";
import type { DashboardData } from "@/lib/dashboard-data";

type Props = { data: DashboardData };

export function RevenueGoalCard({ data }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { goalOverride, bookedOverride, includeWeighted, dealOverrides, closeRateModifier, timingModifier, isWhatIfActive, setGoalOverride, setBookedOverride, setIncludeWeighted, clearAll } = useScenario();

  const adjustedWeightedForecast = useMemo(() => {
    if (!isWhatIfActive) return data.weightedForecast;
    return computeAdjustedForecast(
      data.weightedForecastBreakdown, dealOverrides, closeRateModifier, timingModifier, data.year,
    ).total;
  }, [data, dealOverrides, closeRateModifier, timingModifier, isWhatIfActive]);

  const displayGoal     = goalOverride !== "" ? (parseFloat(goalOverride) || data.revenueGoal) : data.revenueGoal;
  const displayExpected = bookedOverride !== "" ? (parseFloat(bookedOverride) || data.expectedFromExisting) : data.expectedFromExisting;
  const displayBooked   = data.revenueToDate + displayExpected;
  const effectiveBooked = includeWeighted ? displayBooked + adjustedWeightedForecast : displayBooked;
  const displayGap      = Math.max(0, displayGoal - effectiveBooked);
  const displayPct      = displayGoal > 0 ? effectiveBooked / displayGoal : 0;
  const forecastPct     = displayGoal > 0 ? adjustedWeightedForecast / displayGoal : 0;
  const scenarioActive  = goalOverride !== "" || bookedOverride !== "";

  // Booked segment always based on displayBooked (not effectiveBooked) so forecast stays visually separate.
  // When included: forecast segment sits on top of the booked bar, still its own teal/30 color.
  // When excluded: forecast segment is hidden entirely.
  const rawBookedPct  = displayGoal > 0 ? displayBooked / displayGoal : 0;
  const bookedWidth   = Math.min(100, rawBookedPct * 100);
  const forecastWidth = includeWeighted
    ? Math.min(100 - bookedWidth, forecastPct * 100)
    : 0;

  return (
    <div ref={cardRef} className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Revenue vs. Goal — FY{data.year}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Booked & planned revenue vs. target</p>
          </div>
          {scenarioActive && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wide">
              Scenario
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ExportButton getElement={() => cardRef.current} filename="revenue-goal" variant="icon" />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">Override Goal ($)</label>
            <input
              type="number"
              value={goalOverride}
              onChange={(e) => setGoalOverride(e.target.value)}
              placeholder={String(Math.round(data.revenueGoal))}
              className="w-28 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">Expected from Existing ($)</label>
            <input
              type="number"
              value={bookedOverride}
              onChange={(e) => setBookedOverride(e.target.value)}
              placeholder={String(Math.round(data.expectedFromExisting))}
              className="w-28 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeWeighted}
              onChange={(e) => setIncludeWeighted(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal"
            />
            <span className="text-xs text-slate-500">Include Weighted Pipeline?</span>
          </label>
          {scenarioActive && (
            <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-slate-100 rounded-card overflow-hidden border border-slate-100 mb-5">
        <div className="bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Revenue Goal</p>
          <p className="text-[1.6rem] leading-none font-extrabold text-navy tabular-nums">{formatCurrency(displayGoal)}</p>
          {goalOverride !== "" && (
            <p className="text-[10px] text-amber-600 mt-1">override active</p>
          )}
        </div>
        <div className="bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Booked Revenue</p>
          <p className="text-[1.6rem] leading-none font-extrabold text-navy tabular-nums">{formatCurrency(displayBooked)}</p>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
            {formatCurrency(data.revenueToDate)} recognized + {formatCurrency(displayExpected)} expected
          </p>
        </div>
        <div className="bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Weighted Forecast</p>
          <p className="text-[1.6rem] leading-none font-extrabold text-teal tabular-nums">{formatCurrency(adjustedWeightedForecast)}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">in-year pipeline contribution</p>
        </div>
        <div className="bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Revenue Gap</p>
          <p className="text-[1.6rem] leading-none font-extrabold text-coral tabular-nums">{formatCurrency(displayGap)}</p>
          <p className="text-[10px] mt-1.5" style={{ color: includeWeighted ? "#34B3D4" : "#9CA3AF" }}>
            {includeWeighted ? "weighted pipeline included" : "weighted pipeline excluded"}
          </p>
        </div>
        <div className="bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">% of Goal</p>
          <p className="text-[1.6rem] leading-none font-extrabold text-navy tabular-nums">{formatPct(displayPct)}</p>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2 relative">
        {/* Booked revenue segment */}
        <div
          className="h-full rounded-l-full bg-gradient-to-r from-teal to-navy absolute left-0 top-0 transition-[width] duration-500"
          style={{ width: `${bookedWidth}%` }}
        />
        {/* Weighted forecast segment */}
        {forecastWidth > 0 && (
          <div
            className="h-full absolute top-0 bg-teal/30 transition-[width,left] duration-500"
            style={{ left: `${bookedWidth}%`, width: `${forecastWidth}%` }}
          />
        )}
      </div>

      {/* Bar axis labels */}
      <div className="flex justify-between text-[10px] text-slate-400 mb-2">
        <span>$0</span>
        <span>{formatCurrency(displayGoal * 0.25)}</span>
        <span>{formatCurrency(displayGoal * 0.5)}</span>
        <span>{formatCurrency(displayGoal * 0.75)}</span>
        <span>{formatCurrency(displayGoal)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 rounded-sm bg-gradient-to-r from-teal to-navy" />
          Booked Revenue
        </span>
        {includeWeighted && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-teal/30 border border-teal/40" />
            Weighted Forecast
          </span>
        )}
      </div>
    </div>
  );
}
