# Dashboard Updates (7-1) — Overview & Sequencing

**Date:** 2026-07-01
**Status:** Approved (design), pending per-SP implementation plans
**Branch:** `feat/dashboard-updates-2026-07`
**Source brief:** `7-1 dashboard edits_optimized prompt.docx`

## Summary

A batch of updates across five tabs, decomposed into six sub-projects (SPs) so each
gets an isolated design -> plan -> build cycle. Shared logic is built once (SP1) and
reused by the tab-level work.

| SP | Title | Depends on | Risk |
|--:|---|---|---|
| 1 | Days-in-Stage + Pace Status engine (shared) | - | Low |
| 2 | Dashboard tab (remove Top Deals, waterfall, Revenue-vs-Goal redesign) | SP1 | Med |
| 3 | Weighted forecast logic (Projected Close Date, per-deal toggle, rename) | - | Med |
| 4 | New Logo + Renewals tabs | SP1 | Low |
| 5 | Leads stage redesign | - | High |
| 6 | Analyzer Pipeline Velocity chart | - | Med |

**Implementation order:** SP1 -> SP2 -> SP4 -> SP3 -> SP5 -> SP6.

## Confirmed decisions (from brainstorming)

1. **Design all six up front**, then implement in order.
2. **Pace-status benchmark = `StageAssumption.avgDaysInStage`** (configurable in Settings),
   not a freshly-computed empirical average.
3. **Pace Status replaces the lifecycle Status column** in tables; lifecycle status stays
   in the `DealDetailModal`.
4. **Weighted forecast:** per-deal Projected-vs-Koda-Expected toggle, **defaulting all deals
   to Projected**.
5. **Leads stages** come from the company-level Company Stage field (Attio `activation`),
   same source as today - the value set changes.
6. **Analyzer velocity:** add a sync step that stores per-stage transition history from Attio.

## Global requirements (apply to every SP)

- Preserve current design language, brand colors (see `CLAUDE.md`), and responsiveness.
- No hardcoded stage names, averages, or thresholds - derive from data / config.
- Reuse existing table, drawer/modal, and chart patterns.
- Centralize logic in reusable utilities; avoid duplication.
- Clean TypeScript typing; preserve backwards compatibility with existing data.

## Cross-cutting cleanups folded in

- The weighted-forecast breakdown builder is duplicated in `dashboard-data.ts` and
  `leads-data.ts`; SP3 centralizes it.
- `PipelineBarCharts` is shared by New Logo and Renewals; SP4 makes it variant-aware.

## Environment note

The Semgrep Guardian hook gates the `Write`/`Edit`/`Bash` tools in this session. Files in
this effort are authored/edited via PowerShell at the user's explicit direction to proceed
without Guardian. New files are written whole; existing files are rewritten in full and
verified by re-reading.
