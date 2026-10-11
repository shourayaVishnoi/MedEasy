"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, PillBottle } from "lucide-react";
import type { AppState, Prescription, PrescriptionItem } from "@/lib/types";
import { addMedicine, savePrescription } from "@/lib/actions";
import { MedicineForm } from "./MedicineForm";
import { Badge, Button, Callout, Card, Field, Input, Modal, toast } from "./ui";

/**
 * Field-by-field verification of an extracted prescription. A schedule can only
 * be created from an item the user has checked against the original.
 */
export function PrescriptionReview({ rx, state }: { rx: Prescription; state: AppState }) {
  const [draft, setDraft] = useState<Prescription>(rx);
  const [scheduling, setScheduling] = useState<PrescriptionItem | null>(null);
  const setItem = (id: string, p: Partial<PrescriptionItem>) => setDraft({ ...draft, items: draft.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const meds = state.medicines.filter((m) => m.prescriptionId === rx.id);
  const allVerified = draft.items.length > 0 && draft.items.every((i) => i.verified);

  return (
    <div className="space-y-4">
      <Callout tone="warn" title="Check every field against the original">
        Nothing becomes an active schedule until you confirm it. If anything is unclear on the prescription, confirm it with the prescriber or pharmacist rather than guessing.
      </Callout>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Prescriber">{(id) => <Input id={id} value={draft.prescriber ?? ""} onChange={(e) => setDraft({ ...draft, prescriber: e.target.value })} />}</Field>
        <Field label="Prescription date">{(id) => <Input id={id} type="date" value={draft.prescribedOn ?? ""} onChange={(e) => setDraft({ ...draft, prescribedOn: e.target.value })} />}</Field>
      </div>
      {draft.items.length === 0 && <p className="text-sm text-muted">No medicines were recognised. You can add a medicine manually from the Medicines page.</p>}
      {draft.items.map((it, idx) => {
        const scheduled = meds.some((m) => m.name.toLowerCase() === it.medicineName.toLowerCase());
        return (
          <Card key={it.id} as="article" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {idx + 1}. {it.medicineName || "Unnamed medicine"}
              </h3>
              <div className="flex gap-1.5">
                {it.verified ? <Badge tone="ok">Checked by you</Badge> : <Badge tone="warn">Not checked</Badge>}
                {scheduled && <Badge tone="pine" icon={<PillBottle className="h-3.5 w-3.5" />}>Schedule created</Badge>}
              </div>
            </div>
            {it.sourceLine && (
              <p className="mt-2 rounded-xl bg-sunken px-3 py-2 font-mono text-[0.8rem] text-ink-2">
                <span className="sr-only">Original line: </span>“{it.sourceLine}”
              </p>
            )}
            {it.reviewReasons.length > 0 && !it.verified && (
              <ul className="mt-2 space-y-1">
                {it.reviewReasons.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-sm text-warn">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {r}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["medicineName", "Medicine"],
                  ["strength", "Strength"],
                  ["dosageForm", "Form"],
                  ["dose", "Dose"],
                  ["route", "Route"],
                  ["frequencyText", "Frequency"],
                  ["foodInstruction", "Food instruction"],
                  ["durationText", "Duration"],
                  ["instructions", "Other instructions"],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label}>
                  {(id) => <Input id={id} value={(it[k] as string | undefined) ?? ""} placeholder="Not on prescription" onChange={(e) => setItem(it.id, { [k]: e.target.value || undefined, verified: false })} />}
                </Field>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={it.verified} onChange={(e) => setItem(it.id, { verified: e.target.checked })} className="h-4 w-4 accent-[var(--color-pine)]" />
                I checked these details against the original
              </label>
              <span className="flex-1" />
              <Button
                size="sm"
                disabled={!it.verified || !it.dose || scheduled}
                onClick={() => {
                  savePrescription(draft);
                  setScheduling(it);
                }}
                title={!it.dose ? "Enter the dose first" : undefined}
              >
                Create schedule
              </Button>
            </div>
          </Card>
        );
      })}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => { savePrescription(draft); toast("Draft saved"); }}>
          Save draft
        </Button>
        <Button disabled={!allVerified} onClick={() => { savePrescription({ ...draft, status: "verified" }); toast("Prescription marked as verified"); }}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark prescription verified
        </Button>
      </div>

      {scheduling && (
        <Modal open onClose={() => setScheduling(null)} title={`Schedule for ${scheduling.medicineName}`} wide>
          <p className="mb-4 text-sm text-ink-2">
            The prescription says: <strong>{[scheduling.dose, scheduling.frequencyText, scheduling.foodInstruction, scheduling.durationText].filter(Boolean).join(" · ") || "no frequency"}</strong>. Choose the times you’ll take it.
          </p>
          <MedicineForm
            submitLabel="Create active schedule"
            asNeeded={/as needed/i.test(scheduling.frequencyText ?? "")}
            durationHint={scheduling.durationText}
            initial={{
              name: scheduling.medicineName,
              strength: scheduling.strength,
              dose: scheduling.dose ?? "",
              route: scheduling.route,
              frequencyText: scheduling.frequencyText,
              instructions: [scheduling.foodInstruction, scheduling.instructions].filter(Boolean).join(". ") || undefined,
              prescriber: draft.prescriber,
              schedule: { times: [], weekdays: [], startDate: new Date().toISOString().slice(0, 10), timezone: state.settings.timezone },
            }}
            onSubmit={(d) => {
              addMedicine({ ...d, profileId: rx.profileId, prescriptionId: rx.id, status: "active" });
              toast(`${d.name} schedule created`);
              setScheduling(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
