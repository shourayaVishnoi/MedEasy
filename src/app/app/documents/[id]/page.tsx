"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FileWarning, Pencil, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { CATEGORY_LABEL, STATUS_META } from "@/lib/labels";
import { DOCUMENT_CATEGORIES, type DocumentCategory, type MedicalDocument } from "@/lib/types";
import { deleteDocument, replaceDocument, updateDocument } from "@/lib/actions";
import { getFile } from "@/lib/fileStore";
import { extractText } from "@/lib/textExtract";
import { ingestText } from "@/lib/ingest";
import { ExplanationView, ResultsReview } from "@/components/ReportViews";
import { PrescriptionReview } from "@/components/PrescriptionReview";
import { Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, Input, LoadingPage, Modal, Segmented, Select, Textarea, toast } from "@/components/ui";
import { cx, formatBytes, formatDate } from "@/lib/util";

type Tab = "explain" | "results" | "verify" | "original";

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspace();
  const router = useRouter();
  const [tab, setTab] = useState<Tab | null>(null);
  const [highlight, setHighlight] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manualText, setManualText] = useState("");
  const [retrying, setRetrying] = useState(false);

  if (!ws) return <LoadingPage />;
  const doc = ws.state.documents.find((d) => d.id === id);
  // Authorization: a document is only shown inside the profile it belongs to.
  if (!doc || doc.profileId !== ws.profileId) {
    return (
      <Card>
        <EmptyState icon={<FileWarning className="h-6 w-6" />} title="Record not available" action={<Link href="/app/documents" className="font-medium text-accent underline">Back to records</Link>}>
          This record doesn’t exist, was deleted, or belongs to a profile you’re not currently viewing.
        </EmptyState>
      </Card>
    );
  }
  const obs = ws.state.observations.filter((o) => o.documentId === doc.id);
  const rx = ws.state.prescriptions.find((p) => p.documentId === doc.id);
  const isLab = doc.category === "lab_report";
  const tabs: { value: Tab; label: string }[] = [
    ...(isLab ? [{ value: "explain" as const, label: "Explanation" }, { value: "results" as const, label: `Results (${obs.length})` }] : []),
    ...(rx ? [{ value: "verify" as const, label: rx.status === "verified" ? "Prescription" : "Verify prescription" }] : []),
    { value: "original" as const, label: "Original" },
  ];
  const current = tab && tabs.some((t) => t.value === tab) ? tab : doc.status === "needs_review" && isLab && obs.some((o) => o.reviewReasons.length) ? "results" : tabs[0].value;
  const st = STATUS_META[doc.status];
  const cite = (line?: string) => {
    setHighlight(line);
    setTab("original");
  };

  async function retry(text?: string) {
    setRetrying(true);
    try {
      let pages: string[] | null = text ? [text] : null;
      if (!pages && doc!.fileKey) {
        const blob = await getFile(doc!.fileKey);
        if (!blob) throw new Error("missing");
        const out = await extractText(new File([blob], doc!.fileName, { type: doc!.mimeType }));
        if (out.kind !== "text") {
          updateDocument(doc!.id, { status: out.kind === "failed" ? "failed" : "needs_review", errorMessage: `${out.reason} Your original file is safe.` });
          toast("Text still couldn’t be read", "warn");
          return;
        }
        pages = out.pages;
      }
      if (!pages) return;
      const res = ingestText({ ...doc!, errorMessage: undefined }, pages);
      replaceDocument(res.document, res.observations, res.prescription);
      toast("Processed again");
    } catch {
      toast("The original file couldn’t be opened in this browser", "danger");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      <Link href="/app/documents" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Records
      </Link>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <Badge tone="neutral" icon={false}>
              {doc.customCategory ?? CATEGORY_LABEL[doc.category]}
            </Badge>
            {doc.isDemo && <Badge tone="info">Sample record</Badge>}
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{doc.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(doc.documentDate, ws.state.settings.locale)}
            {doc.provider ? ` · ${doc.provider}` : ""} · uploaded {formatDate(doc.uploadedAt, ws.state.settings.locale)}
          </p>
          {doc.tags.length > 0 && <p className="mt-1 text-sm text-muted">{doc.tags.map((t) => `#${t}`).join(" ")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Edit details
          </Button>
          <DownloadOriginal doc={doc} />
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Delete record">
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      {doc.errorMessage && (
        <Callout tone={doc.status === "failed" ? "danger" : "warn"} title={doc.status === "failed" ? "Text extraction failed" : "Text not read yet"} className="mb-5">
          <p>{doc.errorMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {doc.fileKey && (
              <Button size="sm" variant="secondary" onClick={() => retry()} disabled={retrying}>
                <RefreshCw className={cx("h-4 w-4", retrying && "animate-spin")} aria-hidden /> Retry processing
              </Button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            <Textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={4} placeholder="Type or paste the text from the document, one result per line" aria-label="Enter document text manually" />
            <Button size="sm" onClick={() => retry(manualText)} disabled={!manualText.trim()}>
              Use this text
            </Button>
          </div>
        </Callout>
      )}
      {doc.notes && <Callout tone="neutral" title="Your notes" className="mb-5">{doc.notes}</Callout>}

      <div className="mb-5 overflow-x-auto">
        <Segmented label="Sections" value={current} onChange={(v) => setTab(v)} options={tabs} />
      </div>

      {current === "explain" &&
        (obs.length ? (
          <ExplanationView doc={doc} observations={obs} onCite={cite} language={ws.state.settings.language} />
        ) : (
          <Card>
            <EmptyState icon={<FileWarning className="h-6 w-6" />} title="Nothing to explain yet">
              No results were found in this document’s text. MedEasy won’t guess. You can enter the text above or check the original.
            </EmptyState>
          </Card>
        ))}
      {current === "results" && (
        <>
          {obs.some((o) => o.verification === "extracted" && o.reviewReasons.length) && (
            <Callout tone="warn" title="Some values need a quick check" className="mb-4">
              Compare the highlighted values with your original. Uncertain values are never saved as confirmed until you check them.
            </Callout>
          )}
          <ResultsReview observations={obs} onCite={cite} />
        </>
      )}
      {current === "verify" && rx && <PrescriptionReview key={rx.id} rx={rx} state={ws.state} />}
      {current === "original" && <OriginalView doc={doc} highlight={highlight} />}

      <EditDetails open={editing} onClose={() => setEditing(false)} doc={doc} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title="Delete this record?"
        confirmLabel="Delete record"
        onConfirm={async () => {
          await deleteDocument(doc);
          toast("Record deleted");
          router.push("/app/documents");
        }}
      >
        This deletes the original file, its extracted values and any unverified prescription drafts from it. Medicine schedules you already created are kept. This can’t be undone.
      </ConfirmDialog>
    </div>
  );
}

function DownloadOriginal({ doc }: { doc: MedicalDocument }) {
  async function download() {
    let blob: Blob | undefined;
    if (doc.fileKey) blob = await getFile(doc.fileKey);
    if (!blob && doc.pages) blob = new Blob([doc.pages.join("\n\f\n")], { type: "text/plain" });
    if (!blob) return toast("The original file isn’t available in this browser", "warn");
    // Short-lived object URL, revoked right after use.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Button variant="secondary" size="sm" onClick={download}>
      <Download className="h-4 w-4" aria-hidden /> Original
    </Button>
  );
}

function OriginalView({ doc, highlight }: { doc: MedicalDocument; highlight?: string }) {
  const [url, setUrl] = useState<string>();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let u: string | undefined;
    if (doc.fileKey && !doc.mimeType.startsWith("text/")) {
      getFile(doc.fileKey).then((b) => {
        if (b) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      });
    }
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [doc.fileKey, doc.mimeType]);
  useEffect(() => {
    ref.current?.querySelector("[data-hit]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 lg:grid-cols-2">
      {url && (
        <Card className="overflow-hidden">
          {doc.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Original of ${doc.title}`} className="w-full" />
          ) : doc.mimeType === "application/pdf" ? (
            <iframe src={url} title={`Original of ${doc.title}`} className="h-[70vh] w-full" />
          ) : (
            <p className="p-5 text-sm text-muted">Preview isn’t available for this format. Use the Original button to download it.</p>
          )}
        </Card>
      )}
      <Card className={cx("p-5", !url && "lg:col-span-2")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Text read from the document</h2>
          <span className="text-xs text-muted">
            {doc.fileName} · {formatBytes(doc.sizeBytes)}
          </span>
        </div>
        {doc.pages?.length ? (
          <section ref={ref} aria-label="Extracted text" className="max-h-[70vh] space-y-4 overflow-auto">
            {doc.pages.map((p, i) => (
              <div key={i}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Page {i + 1}</p>
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-sunken p-3 font-mono text-[0.8rem] leading-relaxed">
                  {p.split("\n").map((line, j) => {
                    const hit = highlight && line.trim() === highlight.trim();
                    return (
                      <span key={j} data-hit={hit ? "" : undefined} className={cx("block", hit && "rounded bg-warn-soft ring-2 ring-warn/40")}>
                        {line || " "}
                      </span>
                    );
                  })}
                </pre>
              </div>
            ))}
          </section>
        ) : (
          <p className="text-sm text-muted">No text has been read from this document.</p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden /> The original is kept unchanged. Extracted text never replaces it.
        </p>
      </Card>
    </div>
  );
}

function EditDetails({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: MedicalDocument }) {
  const [d, setD] = useState({ title: doc.title, category: doc.category, customCategory: doc.customCategory ?? "", documentDate: doc.documentDate ?? "", provider: doc.provider ?? "", tags: doc.tags.join(", "), notes: doc.notes ?? "" });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit record details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateDocument(doc.id, { ...d, customCategory: d.customCategory || undefined, documentDate: d.documentDate || undefined, provider: d.provider || undefined, notes: d.notes || undefined, tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean) });
              toast("Details saved");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Title">{(id) => <Input id={id} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />}</Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as DocumentCategory })}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Custom category">{(id) => <Input id={id} value={d.customCategory} onChange={(e) => setD({ ...d, customCategory: e.target.value })} />}</Field>
        <Field label="Document date">{(id) => <Input id={id} type="date" value={d.documentDate} onChange={(e) => setD({ ...d, documentDate: e.target.value })} />}</Field>
        <Field label="Provider or laboratory">{(id) => <Input id={id} value={d.provider} onChange={(e) => setD({ ...d, provider: e.target.value })} />}</Field>
        <Field label="Tags">{(id) => <Input id={id} value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Notes">{(id) => <Textarea id={id} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />}</Field>
        </div>
      </div>
    </Modal>
  );
}
