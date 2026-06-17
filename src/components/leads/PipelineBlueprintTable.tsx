"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { STAGE_LABELS, NEW_LOGO_STAGE_ORDER, IMPLEMENTATION_LAG_DAYS } from "@/lib/stages";
import type { BlueprintRow, SerializedAssumption, BlueprintDeal } from "@/lib/leads-data";
import type { WeightedForecastDeal } from "@/lib/compute-adjusted-forecast";
import { computeAdjustedForecast } from "@/lib/compute-adjusted-forecast";
import { useScenario } from "@/lib/use-scenario";

const ACTIVE_STAGES = NEW_LOGO_STAGE_ORDER;
type ActiveStage = (typeof ACTIVE_STAGES)[number];

type Props = {
  assumptions: SerializedAssumption[];
  activeDeals: BlueprintDeal[];
  avgDealSize: number;
  revenueGoal: number;
  revenueGap: number;
  existingArr: number;
  revenueToDate: number;
  expectedFromExisting: number;
  fiscalYearEnd: string;
  defaultYear: number;
  weightedForecastBreakdown: WeightedForecastDeal[];
};

function computeBlueprint(
  assumptions: SerializedAssumption[],
  activeDeals: BlueprintDeal[],
  revenueGap: number,
  avgDealSize: number,
  endDate: Date,
): BlueprintRow[] {
  const today = new Date();
  const assumptionMap = new Map(assumptions.map((a) => [a.stage, a]));

  return ACTIVE_STAGES.map((stage, i) => {
    const assumption = assumptionMap.get(stage);
    const overallCloseRate = assumption?.overallCloseRate ?? 0.21;
    const requiredValue = overallCloseRate > 0 ? revenueGap / overallCloseRate : 0;
    const requiredDeals = Math.ceil(requiredValue / (avgDealSize || 200_000));

    const remainingDays =
      ACTIVE_STAGES.slice(i).reduce(
        (sum, s) => sum + (assumptionMap.get(s)?.avgDaysInStage ?? 0),
        0
      ) + IMPLEMENTATION_LAG_DAYS;

    const deadlineDate = new Date(endDate);
    deadlineDate.setDate(deadlineDate.getDate() - remainingDays);
    const isOverdue = deadlineDate < today;

    const laterStages = ACTIVE_STAGES.slice(i) as string[];
    const actualDealsList = activeDeals.filter((d) => laterStages.includes(d.stage ?? ""));
    const actualDeals = actualDealsList.length;
    const actualValue = actualDealsList.reduce((s, d) => s + (d.value ?? 0), 0);

    return {
      stage: stage as ActiveStage,
      deadline: deadlineDate.toISOString(),
      isOverdue,
      requiredDeals,
      requiredValue,
      actualDeals,
      actualValue,
      delta: actualValue - requiredValue,
    };
  });
}

function statusBadge(row: BlueprintRow): { label: string; className: string } {
  if (row.delta >= 0) return { label: "On Track", className: "bg-emerald-100 text-emerald-700" };
  if (row.delta >= -row.requiredValue * 0.25)
    return { label: "Near", className: "bg-yellow-100 text-yellow-700" };
  return { label: "Gap", className: "bg-red-100 text-red-700" };
}

export function PipelineBlueprintTable({
  assumptions,
  activeDeals,
  avgDealSize,
  revenueGoal,
  revenueGap: _revenueGap,  // eslint-disable-line @typescript-eslint/no-unused-vars
  existingArr: _existingArr,  // eslint-disable-line @typescript-eslint/no-unused-vars
  revenueToDate,
  expectedFromExisting,
  fiscalYearEnd,
  defaultYear,
  weightedForecastBreakdown,
}: Props) {
  const [endDateStr, setEndDateStr]   = useState(fiscalYearEnd.substring(0, 10));
  const [gapOverride, setGapOverride] = useState<string>("");

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [fetchedGoal, setFetchedGoal]   = useState<number | null>(null);
  const [fetchedEnd, setFetchedEnd]     = useState<string | null>(null);
  const [yearLoading, setYearLoading]   = useState(false);

  const currentYear = defaultYear;
  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const defaultEndDateStr = (fetchedEnd ?? fiscalYearEnd).substring(0, 10);

  const { goalOverride, bookedOverride, includeWeighted, dealOverrides, closeRateModifier, timingModifier, isWhatIfActive } = useScenario();

  const scenarioActive = goalOverride !== "" || bookedOverride !== "" || includeWeighted || isWhatIfActive;

  const displayGoal = useMemo(
    () => goalOverride !== ""
      ? (parseFloat(goalOverride) || (fetchedGoal ?? revenueGoal))
      : (fetchedGoal ?? revenueGoal),
    [goalOverride, revenueGoal, fetchedGoal]
  );

  const scenarioBooked = useMemo(() => {
    const displayExpected = bookedOverride !== "" ? (parseFloat(bookedOverride) || expectedFromExisting) : expectedFromExisting;
    return revenueToDate + displayExpected;
  }, [bookedOverride, revenueToDate, expectedFromExisting]);

  // When "Include Weighted Pipeline" is on, subtract adjusted forecast from the gap
  const adjustedWeightedForecast = useMemo(() => {
    if (!includeWeighted || weightedForecastBreakdown.length === 0) return 0;
    return computeAdjustedForecast(weightedForecastBreakdown, dealOverrides, closeRateModifier, timingModifier, defaultYear).total;
  }, [includeWeighted, weightedForecastBreakdown, dealOverrides, closeRateModifier, timingModifier, defaultYear]);

  const scenarioGap = useMemo(
    () => Math.max(0, displayGoal - scenarioBooked - adjustedWeightedForecast),
    [displayGoal, scenarioBooked, adjustedWeightedForecast]
  );

  const endDate = useMemo(() => new Date(endDateStr + "T23:59:59"), [endDateStr]);
  const displayGap = gapOverride !== "" ? (parseFloat(gapOverride) || scenarioGap) : scenarioGap;

  const blueprint = useMemo(
    () => computeBlueprint(assumptions, activeDeals, displayGap, avgDealSize, endDate),
    [assumptions, activeDeals, displayGap, avgDealSize, endDate]
  );

  async function handleYearChange(year: number) {
    setSelectedYear(year);
    if (year === defaultYear) {
      setFetchedGoal(null);
      setFetchedEnd(null);
      setEndDateStr(fiscalYearEnd.substring(0, 10));
      return;
    }
    setYearLoading(true);
    try {
      const res = await fetch(`/api/settings/fiscal?year=${year}`);
      const json = await res.json() as { config: { revenueGoal: number; fiscalYearEnd: string } | null };
      if (json.config && json.config.revenueGoal > 0) {
        setFetchedGoal(json.config.revenueGoal);
        setEndDateStr(json.config.fiscalYearEnd.substring(0, 10));
        setFetchedEnd(json.config.fiscalYearEnd);
      } else {
        // Fall back to current year's values
        setFetchedGoal(null);
        setFetchedEnd(null);
        setEndDateStr(fiscalYearEnd.substring(0, 10));
      }
    } catch {
      setFetchedGoal(null);
      setFetchedEnd(null);
    } finally {
      setYearLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Math Blueprint
          </h2>
          {scenarioActive && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wider">
              Scenario
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            disabled={yearLoading}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-navy font-semibold focus:outline-none focus:ring-2 focus:ring-teal/40 disabled:opacity-50"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {yearLoading && <span className="text-[10px] text-slate-400">Loading…</span>}
          {selectedYear !== defaultYear && fetchedGoal === null && !yearLoading && (
            <span className="text-[10px] text-amber-600">No config for {selectedYear} — using {defaultYear}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Adjust the target close date and revenue gap to model different scenarios.
        Stage deadlines recalculate automatically based on pipeline stage duration assumptions.
      </p>

      <div className="flex flex-wrap items-end gap-6 p-5 bg-slate-50 rounded-card mb-5 border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Target Close Date
          </label>
          <input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value || defaultEndDateStr)}
            className="w-36 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Revenue Gap Override ($)
          </label>
          <input
            type="number"
            value={gapOverride}
            onChange={(e) => setGapOverride(e.target.value)}
            placeholder={String(Math.round(scenarioGap))}
            className="w-36 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/40 text-navy font-semibold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Revenue Gap</span>
          <span className="text-xl font-bold text-coral">{formatCurrency(displayGap)}</span>
          {includeWeighted && adjustedWeightedForecast > 0 && (
            <span className="text-[11px] text-teal">weighted pipeline included</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Revenue Goal</span>
          <span className="text-xl font-bold text-navy">{formatCurrency(displayGoal)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Booked Revenue</span>
          <span className="text-xl font-bold text-navy">{formatCurrency(scenarioBooked)}</span>
        </div>
        {(endDateStr !== defaultEndDateStr || gapOverride !== "" || scenarioActive) && (
          <button
            onClick={() => { setEndDateStr(defaultEndDateStr); setGapOverride(""); }}
            className="text-xs text-slate-400 hover:text-navy transition-colors mt-4"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <th className="px-5 py-3 pr-4">Stage</th>
              <th className="px-5 py-3 pr-4">Need by</th>
              <th className="px-5 py-3 pr-4 text-right">Blueprint Deals</th>
              <th className="px-5 py-3 pr-4 text-right">Blueprint Value</th>
              <th className="px-5 py-3 pr-4 text-right">Actual Deals</th>
              <th className="px-5 py-3 pr-4 text-right">Actual Value</th>
              <th className="px-5 py-3 pr-4 text-right">Delta</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {blueprint.map((row) => {
              const badge = statusBadge(row);
              return (
                <tr key={row.stage} className="border-b border-slate-100 last:border-0 even:bg-slate-50/40 hover:bg-teal/5 transition-colors">
                  <td className="px-5 py-3 pr-4 font-medium text-navy">
                    {STAGE_LABELS[row.stage] ?? row.stage}
                  </td>
                  <td className={`px-5 py-3 pr-4 text-xs ${row.isOverdue ? "text-red-500 font-medium" : "text-slate-500"}`}>
                    {new Date(row.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {row.isOverdue && " · past"}
                  </td>
                  <td className="px-5 py-3 pr-4 text-right text-slate-600">{row.requiredDeals}</td>
                  <td className="px-5 py-3 pr-4 text-right text-slate-600">{formatCurrency(row.requiredValue)}</td>
                  <td className="px-5 py-3 pr-4 text-right font-semibold text-navy tabular-nums">{row.actualDeals}</td>
                  <td className="px-5 py-3 pr-4 text-right font-semibold text-navy tabular-nums">{formatCurrency(row.actualValue)}</td>
                  <td className={`px-5 py-3 pr-4 text-right font-semibold tabular-nums ${row.delta >= 0 ? "text-emerald-600" : "text-coral"}`}>
                    {row.delta >= 0 ? "+" : ""}{formatCurrency(row.delta)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
