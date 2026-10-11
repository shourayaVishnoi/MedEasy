"use client";

import Link from "next/link";
import { useState } from "react";
import { History } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { buildTimeline, TIMELINE_LABEL, type TimelineKind } from "@/lib/timeline";
import { Badge, Card, EmptyState, Field, Input, LoadingPage, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/util";

export default function Timeline() {
  const ws = useWorkspace();
  const [kind, setKind] = useState<TimelineKind | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<"active" | "all">("active");
  if (!ws) return <LoadingPage />;
  const ids = scope === "all" ? ws.state.profiles.map((p) => p.id) : [ws.profileId];
  const items = buildTimeline(ws.state, ids).filter((i) => (kind === "all" || i.kind === kind) && (!from || i.date >= from) && (!to || i.date <= to));
  const byYear = new Map<string, typeof items>();
  for (const i of items) byYear.set(i.date.slice(0, 4), [...(byYear.get(i.date.slice(0, 4)) ?? []), i]);
  const profileName = (id: string) => ws.state.profiles.find((p) => p.id === id)?.displayName;

  return (
    <div>
      <PageHeader title="Medical timeline" subtitle="Your documented history in date order. Each entry links to its source. Events are listed, not connected: MedEasy doesn’t infer causes." />
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-4">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as TimelineKind | "all")}>
                <option value="all">All types</option>
                {Object.entries(TIMELINE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Field label="Profiles">
            {(id) => (
              <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as "active" | "all")}>
                <option value="active">{ws.profile.displayName}</option>
                <option value="all">All profiles I can access</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<History className="h-6 w-6" />} title="Nothing in this range" />
        </Card>
      ) : (
        [...byYear.entries()].map(([year, list]) => (
          <section key={year} className="mb-8">
            <h2 className="mb-3 font-display text-2xl">{year}</h2>
            <ol className="relative space-y-3 border-l-2 border-line pl-6">
              {list.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute -left-[1.95rem] top-4 h-3.5 w-3.5 rounded-full border-[3px] border-paper bg-pine" aria-hidden />
                  <Link href={i.href} className="block rounded-2xl border border-line bg-surface px-4 py-3 transition hover:border-pine/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={i.date} className="text-sm font-medium text-muted">
                        {formatDate(i.date, ws.state.settings.locale)}
                      </time>
                      <Badge tone="neutral" icon={false}>
                        {TIMELINE_LABEL[i.kind]}
                      </Badge>
                      {scope === "all" && <Badge tone="pine" icon={false}>{profileName(i.profileId)}</Badge>}
                    </div>
                    <p className="mt-1 font-medium">{i.title}</p>
                    {i.detail && <p className="text-sm text-muted">{i.detail}</p>}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
