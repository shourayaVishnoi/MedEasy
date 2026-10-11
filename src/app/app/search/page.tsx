"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, FileText, FlaskConical, Pill, ScrollText, Search as SearchIcon } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { searchRecords, type ResultType } from "@/lib/search";
import { CATEGORY_LABEL } from "@/lib/labels";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/types";
import { Badge, Card, EmptyState, Field, Input, LoadingPage, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/util";

const TYPE_ICON: Record<ResultType, typeof FileText> = { document: FileText, result: FlaskConical, medicine: Pill, prescription: ScrollText, appointment: CalendarDays };
const TYPE_LABEL: Record<ResultType, string> = { document: "Record", result: "Test result", medicine: "Medicine", prescription: "Prescription", appointment: "Appointment" };

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Search />
    </Suspense>
  );
}

function Search() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState<ResultType | "all">("all");
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [profile, setProfile] = useState<string>("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [provider, setProvider] = useState("");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);
  if (!ws) return <LoadingPage />;

  // Search is limited to profiles this user can access; in demo mode that's all local profiles.
  const allowed = ws.state.profiles.map((p) => p.id);
  const results = searchRecords(ws.state, q, allowed, {
    profileId: profile === "active" ? ws.profileId : profile,
    types: type === "all" ? undefined : [type],
    category,
    from: from || undefined,
    to: to || undefined,
    provider: provider || undefined,
  });
  const name = (id: string) => ws.state.profiles.find((p) => p.id === id)?.displayName;

  return (
    <div>
      <PageHeader title="Search records" subtitle="Medicines, tests, doctors, labs, dates and the text inside your documents." />
      <div className="relative mb-4">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “Vitamin D”, “TSH” or a doctor’s name" aria-label="Search" className="h-13 pl-12 text-base" />
      </div>
      <details className="mb-5 rounded-2xl border border-line bg-surface px-4 py-3" open={false}>
        <summary className="cursor-pointer text-sm font-medium">Filters</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as ResultType | "all")}>
                <option value="all">Everything</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Document category">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory | "all")}>
                <option value="all">All categories</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Profile">
            {(id) => (
              <Select id={id} value={profile} onChange={(e) => setProfile(e.target.value)}>
                <option value="active">{ws.profile.displayName}</option>
                <option value="all">All profiles I can access</option>
                {ws.state.profiles.filter((p) => p.id !== ws.profileId).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Field label="Provider or lab">{(id) => <Input id={id} value={provider} onChange={(e) => setProvider(e.target.value)} />}</Field>
        </div>
      </details>

      {!q.trim() ? (
        <Card>
          <EmptyState icon={<SearchIcon className="h-6 w-6" />} title="Search everything in one place">
            Results show dates, extracted values where available, and a link to the original record.
          </EmptyState>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchIcon className="h-6 w-6" />} title={`No results for “${q}”`}>
            Try a shorter word, a different spelling, or widen the filters.
          </EmptyState>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {results.length} result{results.length > 1 ? "s" : ""}
          </p>
          <ul className="space-y-2">
            {results.slice(0, 50).map((r) => {
              const Icon = TYPE_ICON[r.type];
              return (
                <li key={`${r.type}-${r.id}`}>
                  <Link href={r.href} className="flex gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition hover:border-pine/40 focus-visible:border-pine">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.title}</p>
                        <Badge tone="neutral" icon={false}>
                          {TYPE_LABEL[r.type]}
                        </Badge>
                        {profile !== "active" && <Badge tone="pine" icon={false}>{name(r.profileId)}</Badge>}
                      </div>
                      <p className="text-sm text-muted">
                        {r.date ? `${formatDate(r.date, ws.state.settings.locale)} · ` : ""}
                        {r.subtitle}
                      </p>
                      {r.snippet && <p className="mt-1 line-clamp-2 font-mono text-xs text-ink-2">{r.snippet}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
