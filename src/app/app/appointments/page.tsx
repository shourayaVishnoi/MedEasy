"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CalendarPlus, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { useNow, useWorkspace } from "@/lib/hooks";
import { APPOINTMENT_LABEL } from "@/lib/labels";
import type { Appointment, AppointmentType } from "@/lib/types";
import { deleteAppointment, saveAppointment } from "@/lib/actions";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingPage, Modal, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { uid } from "@/lib/util";

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Appointments />
    </Suspense>
  );
}

function icsFor(a: Appointment) {
  const dt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(a.startsAt);
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedEasy//EN",
    "BEGIN:VEVENT",
    `UID:${a.id}@healthos`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(new Date(start.getTime() + 30 * 60000))}`,
    `SUMMARY:${esc(a.title)}`,
    a.location ? `LOCATION:${esc(a.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function Appointments() {
  const ws = useWorkspace();
  const now = useNow();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [toDelete, setToDelete] = useState<Appointment | null>(null);
  if (!ws) return <LoadingPage />;
  const { state, profileId } = ws;
  const tz = state.settings.timezone;
  const all = state.appointments.filter((a) => a.profileId === profileId);
  const upcoming = all.filter((a) => a.status === "upcoming" && new Date(a.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((a) => !upcoming.includes(a)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const docTitle = (id: string) => state.documents.find((d) => d.id === id)?.title;

  const Item = ({ a }: { a: Appointment }) => (
    <Card as="article" id={`appt-${a.id}`} className="scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pine-soft text-center text-accent">
            <span className="text-[0.7rem] font-semibold uppercase leading-none">{new Date(a.startsAt).toLocaleString(state.settings.locale, { month: "short", timeZone: tz })}</span>
            <span className="text-xl font-semibold leading-none">{new Date(a.startsAt).toLocaleString(state.settings.locale, { day: "numeric", timeZone: tz })}</span>
          </div>
          <div>
            <h3 className="font-semibold">{a.title}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {new Date(a.startsAt).toLocaleString(state.settings.locale, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz })}
              </span>
              {a.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {/^https?:\/\//.test(a.location) ? <a href={a.location} className="text-accent underline" rel="noreferrer noopener" target="_blank">Join link</a> : a.location}
                </span>
              )}
            </p>
            {a.provider && <p className="text-sm text-ink-2">{a.provider}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral" icon={false}>
            {APPOINTMENT_LABEL[a.type]}
          </Badge>
          {a.status !== "upcoming" && <Badge tone={a.status === "completed" ? "ok" : "neutral"}>{a.status === "completed" ? "Completed" : "Cancelled"}</Badge>}
          {a.status === "upcoming" && new Date(a.startsAt) < now && <Badge tone="warn">Date passed</Badge>}
        </div>
      </div>
      {(a.purpose || a.preparation || a.questions.length > 0 || a.followUpTasks.length > 0 || a.relatedDocumentIds.length > 0) && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
          {a.purpose && (
            <div>
              <p className="font-medium">Purpose</p>
              <p className="text-ink-2">{a.purpose}</p>
            </div>
          )}
          {a.preparation && (
            <div>
              <p className="font-medium">Preparation (entered by you)</p>
              <p className="text-ink-2">{a.preparation}</p>
            </div>
          )}
          {a.questions.length > 0 && (
            <div>
              <p className="font-medium">Questions to ask</p>
              <ul className="list-disc pl-5 text-ink-2">
                {a.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {a.followUpTasks.length > 0 && (
            <div>
              <p className="font-medium">Follow-up tasks</p>
              <ul className="list-disc pl-5 text-ink-2">
                {a.followUpTasks.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {a.relatedDocumentIds.length > 0 && (
            <div>
              <p className="font-medium">Related records</p>
              <ul className="text-ink-2">
                {a.relatedDocumentIds.map((d) => (
                  <li key={d}>
                    <Link href={`/app/documents/${d}`} className="text-accent underline underline-offset-2">
                      {docTitle(d) ?? "Deleted record"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
        {a.status === "upcoming" && (
          <>
            <Button size="sm" variant="ghost" onClick={() => { saveAppointment({ ...a, status: "completed" }); toast("Marked completed"); }}>
              Mark completed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([icsFor(a)], { type: "text/calendar" }));
                const el = document.createElement("a");
                el.href = url;
                el.download = "appointment.ics";
                el.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Appointments & follow-ups"
        subtitle="Visits, lab tests, vaccinations and review dates, with your questions and related records."
        actions={
          <Button onClick={() => setCreating(true)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add appointment
          </Button>
        }
      />
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming</h2>
      {upcoming.length ? (
        <div className="space-y-3">
          {upcoming.map((a) => (
            <Item key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No upcoming appointments" action={<Button variant="quiet" onClick={() => setCreating(true)}>Add one</Button>} />
        </Card>
      )}
      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
          <div className="space-y-3">
            {past.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </div>
        </>
      )}
      {(creating || editing) && (
        <AppointmentForm
          initial={editing ?? undefined}
          profileId={profileId}
          docs={state.documents.filter((d) => d.profileId === profileId)}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} danger title="Delete this appointment?" confirmLabel="Delete" onConfirm={() => { if (toDelete) deleteAppointment(toDelete.id); toast("Appointment deleted"); }}>
        The appointment and its notes will be removed. Linked records are not affected.
      </ConfirmDialog>
    </div>
  );
}

function AppointmentForm({ initial, profileId, docs, onClose }: { initial?: Appointment; profileId: string; docs: { id: string; title: string }[]; onClose: () => void }) {
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [a, setA] = useState({
    type: initial?.type ?? ("doctor" as AppointmentType),
    title: initial?.title ?? "",
    when: initial ? toLocal(initial.startsAt) : "",
    provider: initial?.provider ?? "",
    location: initial?.location ?? "",
    purpose: initial?.purpose ?? "",
    questions: initial?.questions.join("\n") ?? "",
    preparation: initial?.preparation ?? "",
    followUps: initial?.followUpTasks.join("\n") ?? "",
    related: initial?.relatedDocumentIds ?? [],
  });
  const [err, setErr] = useState<string>();
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={initial ? "Edit appointment" : "Add appointment"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!a.title.trim() || !a.when) return setErr("Add a title and a date and time.");
              saveAppointment({
                id: initial?.id ?? uid("ap"),
                profileId,
                type: a.type,
                title: a.title.trim(),
                startsAt: new Date(a.when).toISOString(),
                provider: a.provider || undefined,
                location: a.location || undefined,
                purpose: a.purpose || undefined,
                questions: a.questions.split("\n").map((s) => s.trim()).filter(Boolean),
                preparation: a.preparation || undefined,
                followUpTasks: a.followUps.split("\n").map((s) => s.trim()).filter(Boolean),
                relatedDocumentIds: a.related,
                status: initial?.status ?? "upcoming",
              });
              toast("Appointment saved");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as AppointmentType })}>
              {Object.entries(APPOINTMENT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Title" required error={err}>{(id, d) => <Input id={id} aria-describedby={d} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} />}</Field>
        <Field label="Date and time" required>{(id) => <Input id={id} type="datetime-local" value={a.when} onChange={(e) => setA({ ...a, when: e.target.value })} />}</Field>
        <Field label="Healthcare provider">{(id) => <Input id={id} value={a.provider} onChange={(e) => setA({ ...a, provider: e.target.value })} />}</Field>
        <Field label="Location or meeting link">{(id) => <Input id={id} value={a.location} onChange={(e) => setA({ ...a, location: e.target.value })} />}</Field>
        <Field label="Purpose">{(id) => <Input id={id} value={a.purpose} onChange={(e) => setA({ ...a, purpose: e.target.value })} />}</Field>
        <Field label="Questions to ask" hint="One per line">{(id, d) => <Textarea id={id} aria-describedby={d} value={a.questions} onChange={(e) => setA({ ...a, questions: e.target.value })} />}</Field>
        <Field label="Preparation instructions" hint="Only what the clinic or lab told you.">{(id, d) => <Textarea id={id} aria-describedby={d} value={a.preparation} onChange={(e) => setA({ ...a, preparation: e.target.value })} />}</Field>
        <Field label="Follow-up tasks" hint="One per line">{(id, d) => <Textarea id={id} aria-describedby={d} value={a.followUps} onChange={(e) => setA({ ...a, followUps: e.target.value })} />}</Field>
        <fieldset>
          <legend className="text-sm font-medium">Related records</legend>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-auto rounded-xl border border-line p-2">
            {docs.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={a.related.includes(d.id)} onChange={(e) => setA({ ...a, related: e.target.checked ? [...a.related, d.id] : a.related.filter((x) => x !== d.id) })} />
                {d.title}
              </label>
            ))}
            {docs.length === 0 && <p className="text-sm text-muted">No records yet.</p>}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
