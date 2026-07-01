"use client";

import { Modal } from "@/components/ui/Modal";
import { StagePill } from "@/components/ui/StagePill";
import { formatCurrency, SOURCE_LABELS, DEAL_TYPE_LABELS } from "@/lib/format";
import type { DealRow } from "@/components/ui/DealTable";

type Props = { deal: DealRow | null; onClose: () => void };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">{label}</p>
      <div className="font-medium text-navy">{children}</div>
    </div>
  );
}

export function DealDetailModal({ deal, onClose }: Props) {
  return (
    <Modal open={deal != null} onClose={onClose} title={deal?.name ?? ""}>
      {deal && (
        <div className="grid grid-cols-2 gap-6">
          <Field label="Company">{deal.companyName ?? "—"}</Field>
          <Field label="Value (ACV)">
            {deal.value != null ? formatCurrency(deal.value) : "—"}
          </Field>
          <Field label="Stage">
            {deal.stage ? <StagePill value={deal.stage} /> : "—"}
          </Field>
          <Field label="Status">
            <StagePill value={deal.status} type="status" />
          </Field>
          <Field label="Source">
            {deal.source ? (SOURCE_LABELS[deal.source] ?? deal.source) : "—"}
          </Field>
          <Field label="Deal Type">
            {deal.typeOfDeal ? (DEAL_TYPE_LABELS[deal.typeOfDeal] ?? deal.typeOfDeal) : "—"}
          </Field>
          <Field label="Days in Stage">
            {deal.daysInStage != null ? `${deal.daysInStage}d` : "—"}
          </Field>
          <Field label="Pace">
            <StagePill value={deal.paceStatus} type="pace" />
          </Field>
          <Field label="First Convo">
            {deal.firstConvoDate ? new Date(deal.firstConvoDate).toLocaleDateString() : "—"}
          </Field>
          <Field label="Expected Close">
            {deal.expectedClosedDate
              ? new Date(deal.expectedClosedDate).toLocaleDateString()
              : "—"}
          </Field>
        </div>
      )}
    </Modal>
  );
}