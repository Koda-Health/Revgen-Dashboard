"use client";

import { useState, useEffect } from "react";
import type { DealOverride, DateSource } from "@/lib/compute-adjusted-forecast";

const GOAL_KEY      = "scenario_goalOverride";
const BOOKED_KEY    = "scenario_bookedOverride";
const WEIGHTED_KEY  = "scenario_includeWeighted";
const OVERRIDES_KEY = "whatif_dealOverrides";
const CLOSE_MOD_KEY = "whatif_closeRateModifier";
const TIMING_MOD_KEY= "whatif_timingModifier";

function readStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

// ── Module-level singleton state ────────────────────────────────────────────
let _goal            = "";
let _booked          = "";
let _includeWeighted = false;
let _dealOverrides: Record<string, DealOverride> = {};
let _closeRateModifier = 0;
let _timingModifier    = 0;

const _listeners = new Set<() => void>();
function _notify() { _listeners.forEach((fn) => fn()); }

// ── Scenario (goal/booked) setters ──────────────────────────────────────────
function _setGoal(value: string) {
  _goal = value; writeStorage(GOAL_KEY, value); _notify();
}
function _setBooked(value: string) {
  _booked = value; writeStorage(BOOKED_KEY, value); _notify();
}
function _setIncludeWeighted(value: boolean) {
  _includeWeighted = value; writeStorage(WEIGHTED_KEY, value ? "1" : ""); _notify();
}
function _clearAll() {
  _goal = ""; _booked = ""; _includeWeighted = false;
  writeStorage(GOAL_KEY, ""); writeStorage(BOOKED_KEY, ""); writeStorage(WEIGHTED_KEY, "");
  // Also clear what-if when resetting everything
  _dealOverrides = {}; _closeRateModifier = 0; _timingModifier = 0;
  writeStorage(OVERRIDES_KEY, ""); writeStorage(CLOSE_MOD_KEY, ""); writeStorage(TIMING_MOD_KEY, "");
  _notify();
}

// ── What-if setters ─────────────────────────────────────────────────────────
function _setDealOverride(
  dealId: string,
  update: { excluded?: boolean | null; dateOverride?: string | null; valueOverride?: number | null; dateSource?: DateSource | null },
) {
  const existing: DealOverride = _dealOverrides[dealId] ?? {};
  const updated: DealOverride  = { ...existing };

  if ("excluded"    in update) { if (update.excluded)           updated.excluded    = true;             else delete updated.excluded; }
  if ("dateOverride" in update) { if (update.dateOverride)      updated.dateOverride = update.dateOverride!; else delete updated.dateOverride; }
  if ("valueOverride" in update){ if (update.valueOverride != null) updated.valueOverride = update.valueOverride!; else delete updated.valueOverride; }
  // dateSource defaults to "projected"; only persist an explicit "koda" choice.
  if ("dateSource" in update) { if (update.dateSource === "koda") updated.dateSource = "koda"; else delete updated.dateSource; }

  // Remove entry entirely if nothing left
  if (!updated.excluded && !updated.dateOverride && updated.valueOverride === undefined && !updated.dateSource) {
    const { [dealId]: _unused, ...rest } = _dealOverrides;
    void _unused;
    _dealOverrides = rest;
  } else {
    _dealOverrides = { ..._dealOverrides, [dealId]: updated };
  }
  writeStorage(OVERRIDES_KEY, Object.keys(_dealOverrides).length > 0 ? JSON.stringify(_dealOverrides) : "");
  _notify();
}

function _setCloseRateModifier(value: number) {
  _closeRateModifier = value;
  writeStorage(CLOSE_MOD_KEY, value !== 0 ? String(value) : "");
  _notify();
}

function _setTimingModifier(value: number) {
  _timingModifier = value;
  writeStorage(TIMING_MOD_KEY, value !== 0 ? String(value) : "");
  _notify();
}

function _resetWhatIf() {
  _dealOverrides = {}; _closeRateModifier = 0; _timingModifier = 0;
  writeStorage(OVERRIDES_KEY, ""); writeStorage(CLOSE_MOD_KEY, ""); writeStorage(TIMING_MOD_KEY, "");
  _notify();
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useScenario() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const trigger = () => rerender((n) => n + 1);
    _listeners.add(trigger);
    return () => { _listeners.delete(trigger); };
  }, []);

  // Hydrate from localStorage on first client mount
  useEffect(() => {
    const g  = readStorage(GOAL_KEY);
    const b  = readStorage(BOOKED_KEY);
    const w  = readStorage(WEIGHTED_KEY) === "1";
    const ov = readStorage(OVERRIDES_KEY);
    const cr = readStorage(CLOSE_MOD_KEY);
    const tm = readStorage(TIMING_MOD_KEY);

    _goal            = g;
    _booked          = b;
    _includeWeighted = w;
    _dealOverrides   = ov ? (JSON.parse(ov) as Record<string, DealOverride>) : {};
    _closeRateModifier = cr ? parseFloat(cr) : 0;
    _timingModifier    = tm ? parseFloat(tm) : 0;
    _notify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWhatIfActive =
    Object.keys(_dealOverrides).length > 0 ||
    _closeRateModifier !== 0 ||
    _timingModifier    !== 0;

  return {
    // Scenario overrides
    goalOverride:        _goal,
    bookedOverride:      _booked,
    includeWeighted:     _includeWeighted,
    setGoalOverride:     _setGoal,
    setBookedOverride:   _setBooked,
    setIncludeWeighted:  _setIncludeWeighted,
    clearAll:            _clearAll,
    // What-if analysis
    dealOverrides:       _dealOverrides,
    closeRateModifier:   _closeRateModifier,
    timingModifier:      _timingModifier,
    isWhatIfActive,
    setDealOverride:     _setDealOverride,
    setCloseRateModifier: _setCloseRateModifier,
    setTimingModifier:   _setTimingModifier,
    resetWhatIf:         _resetWhatIf,
  };
}
