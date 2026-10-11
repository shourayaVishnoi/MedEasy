"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilePlus2, FileText, Filter } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { CATEGORY_LABEL, STATUS_META } from "@/lib/labels";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/types";
import { Badge, ButtonLink, Card, EmptyState, Input, LoadingPage, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/util";

const PAGE = 20;

export default function Documents() {
  const ws = useWorkspace();
  const [cat, setCat] = useState<DocumentCategory | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "uploaded">("date");
  const [limit, setLimit] = useState(PAGE);

  const docs = useMemo(() => {
    if (!ws) return [];
    return ws.state.documents
      .filter((d) => d.profileId === ws.profileId)
      .filter((d) => cat === "all" || d.category === cat)
      .filter((d) => !q || `${d.title} ${d.provider ?? ""} ${d.tags.join(" ")} ${d.customCategory ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (sort === "date" ? (b.documentDate ?? "").localeCompare(a.documentDate ?? "") : b.uploadedAt.localeCompare(a.uploadedAt)));
  }, [ws, cat, q, sort]);

  if (!ws) return <LoadingPage />;
  const counts = new Map<string, number>();
  for (const d of ws.state.documents.filter((d) => d.profileId === ws.profileId)) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="Medical records"
        subtitle={`Everything for ${ws.profile.displayName}, kept exactly as uploaded. Extracted details sit alongside the original.`}
        actions={
          <ButtonLink href="/app/documents/upload">
            <FilePlus2 className="h-4 w-4" aria-hidden /> Upload
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>
          All
        </Chip>
        {DOCUMENT_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]} <span className="text-muted">{counts.get(c)}</span>
          </Chip>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Filter by title, provider or tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter records" className="sm:max-w-sm" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <Filter className="h-4 w-4" aria-hidden />
          <span className="sr-only">Sort by</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as "date" | "uploaded")} className="h-11 w-48">
            <option value="date">Document date</option>
            <option value="uploaded">Upload time</option>
          </Select>
        </label>
      </div>

      {docs.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText className="h-6 w-6" />} title={q || cat !== "all" ? "No matching records" : "No records yet"} action={<ButtonLink href="/app/documents/upload">Upload your first record</ButtonLink>}>
            Upload lab reports, prescriptions, discharge summaries and more. PDF, JPEG, PNG, HEIC, DOCX and TXT are supported.
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 [&>*]:min-w-0 md:grid-cols-2">
          {docs.slice(0, limit).map((d) => {
            const st = STATUS_META[d.status];
            return (
              <li key={d.id}>
                <Link href={`/app/documents/${d.id}`} className="group block h-full rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-pine/40">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sunken text-accent">
                      <FileText className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium group-hover:underline">{d.title}</p>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {d.customCategory ?? CATEGORY_LABEL[d.category]} · {formatDate(d.documentDate, ws.state.settings.locale)}
                        {d.provider ? ` · ${d.provider}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {d.tags.slice(0, 3).map((t) => (
                          <Badge key={t} tone="neutral" icon={false}>
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {docs.length > limit && (
        <div className="mt-5 text-center">
          <button className="text-sm font-medium text-accent underline underline-offset-2" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({docs.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-pressed={active} onClick={onClick} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-pine bg-pine text-on-pine" : "border-line bg-surface text-ink-2 hover:bg-sunken"}`}>
      {children}
    </button>
  );
}
