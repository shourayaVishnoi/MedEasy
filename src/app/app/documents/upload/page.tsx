"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, FileUp, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { ACCEPT_ATTR, detectMime, extractText, fileSha256, validateFile } from "@/lib/textExtract";
import { detectCategory, ingestText } from "@/lib/ingest";
import { putFile } from "@/lib/fileStore";
import { storagePath } from "@/lib/cloud/sync";
import { addDocuments, replaceDocument } from "@/lib/actions";
import { CATEGORY_LABEL } from "@/lib/labels";
import { DOCUMENT_CATEGORIES, type DocumentCategory, type MedicalDocument } from "@/lib/types";
import { Badge, Button, Callout, Card, Field, Input, LoadingPage, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { formatBytes, uid } from "@/lib/util";

const OCR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function runOcr(file: File): Promise<{ ok: true; pages: string[] } | { ok: false; error: string }> {
  try {
    const body = new FormData();
    body.append("file", file);
    const r = await fetch("/api/ocr", { method: "POST", body });
    if (r.status === 503) return { ok: false, error: "No OCR provider is configured on this deployment." };
    if (r.status === 401) return { ok: false, error: "Sign in to read images with the OCR provider." };
    if (r.status === 429) return { ok: false, error: "Too many images were read recently. Try again later." };
    if (r.status === 400) return { ok: false, error: "This image type or size can’t be read (JPEG, PNG, WebP or GIF up to 8 MB)." };
    if (!r.ok) return { ok: false, error: "The OCR provider couldn’t read this image." };
    const j = (await r.json()) as { pages?: string[] };
    const pages = (j.pages ?? []).filter((p) => p.trim());
    return pages.length ? { ok: true, pages } : { ok: false, error: "No text was found in this image." };
  } catch {
    return { ok: false, error: "The OCR provider couldn’t be reached." };
  }
}

interface Pending {
  key: string;
  file: File;
  title: string;
  category: DocumentCategory | "auto";
  customCategory: string;
  date: string;
  provider: string;
  tags: string;
  notes: string;
  error?: string;
  progress?: "storing" | "reading" | "done" | "failed";
  message?: string;
}

export default function UploadPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Upload />
    </Suspense>
  );
}

function Upload() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("type") === "prescription" ? "prescription" : "auto";
  const [items, setItems] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [pasted, setPasted] = useState("");
  const [useOcr, setUseOcr] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  if (!ws) return <LoadingPage />;

  const add = (files: FileList | File[]) => {
    const next = Array.from(files).map<Pending>((file) => ({
      key: uid("f"),
      file,
      title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      category: forced,
      customCategory: "",
      date: "",
      provider: "",
      tags: "",
      notes: "",
      error: validateFile(file) ?? undefined,
    }));
    setItems((x) => [...x, ...next]);
  };
  const patch = (key: string, p: Partial<Pending>) => setItems((x) => x.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const hasImages = items.some((i) => !i.error && i.progress !== "done" && OCR_TYPES.has(i.file.type));
  const ocrOn = useOcr ?? ws.state.settings.aiEnabled;

  async function processAll() {
    setBusy(true);
    let firstId: string | undefined;
    for (const it of items) {
      if (it.error || it.progress === "done") continue;
      patch(it.key, { progress: "storing" });
      const id = uid("doc");
      const fileKey = ws!.state.mode === "cloud" ? storagePath(ws!.profileId, id, it.file.name) : `${ws!.profileId}/${id}`;
      const sha256 = await fileSha256(it.file).catch(() => undefined);
      try {
        await putFile(fileKey, it.file); // 1. store the untouched original first
      } catch {
        patch(it.key, {
          progress: "failed",
          message: ws!.state.mode === "cloud" ? "The file couldn’t be uploaded. Check your connection and try again. Nothing was saved." : "The file couldn’t be stored in this browser (storage may be full). Nothing was saved.",
        });
        continue;
      }
      const base: MedicalDocument = {
        id,
        profileId: ws!.profileId,
        title: it.title.trim() || it.file.name,
        category: it.category === "auto" ? "other" : it.category,
        customCategory: it.customCategory.trim() || undefined,
        documentDate: it.date || undefined,
        provider: it.provider.trim() || undefined,
        tags: it.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: it.notes.trim() || undefined,
        uploadedAt: new Date().toISOString(),
        fileName: it.file.name,
        mimeType: detectMime(it.file),
        sizeBytes: it.file.size,
        fileKey,
        sha256,
        status: "processing",
      };
      addDocuments([base]); // 2. the record exists even if extraction fails later
      firstId ??= id;
      patch(it.key, { progress: "reading" });
      const out = await extractText(it.file);
      if (out.kind === "text") {
        const category = it.category === "auto" ? detectCategory(out.pages.join("\n"), it.file.name) : it.category;
        const res = ingestText({ ...base, category }, out.pages);
        replaceDocument(res.document, res.observations, res.prescription);
        patch(it.key, { progress: "done", message: res.document.status === "needs_review" ? "Stored. Some details need your review." : "Stored and read successfully." });
      } else {
        if (out.kind === "needs_ocr" && ocrOn && OCR_TYPES.has(it.file.type)) {
          patch(it.key, { progress: "reading", message: "Reading the image with the OCR provider…" });
          const ocr = await runOcr(it.file);
          if (ocr.ok) {
            const category = it.category === "auto" ? detectCategory(ocr.pages.join("\n"), it.file.name) : it.category;
            const res = ingestText({ ...base, category }, ocr.pages);
            // OCR output is always checked by a person before it's relied on.
            const doc = { ...res.document, status: "needs_review" as const, errorMessage: "Text was read from an image. Check every value against the original." };
            replaceDocument(doc, res.observations, res.prescription);
            patch(it.key, { progress: "done", message: "Stored. Text was read from the image; please check the details." });
            continue;
          }
          replaceDocument({ ...base, status: "needs_review", errorMessage: `${ocr.error} Your original file is safe; you can enter details manually.` }, []);
          patch(it.key, { progress: "done", message: `${ocr.error} Your original file is safe.` });
          continue;
        }
        const msg =
          out.kind === "needs_ocr"
            ? `${out.reason} ${OCR_TYPES.has(it.file.type) ? "Reading images with the OCR provider is turned off." : "Scanned PDFs can’t be read automatically yet."} Your original file is safe; you can paste the text or enter details manually.`
            : `${out.reason} Your original file is safe. You can retry or enter the details manually.`;
        replaceDocument({ ...base, status: out.kind === "failed" ? "failed" : "needs_review", errorMessage: msg }, []);
        patch(it.key, { progress: "done", message: msg });
      }
    }
    setBusy(false);
    toast("Upload finished");
    if (firstId && items.filter((i) => !i.error).length === 1) router.push(`/app/documents/${firstId}`);
  }

  async function addPasted() {
    const text = pasted.trim();
    if (!text) return;
    const file = new File([text], "pasted-text.txt", { type: "text/plain" });
    add([file]);
    setPasted("");
  }

  const ready = items.filter((i) => !i.error && i.progress !== "done");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={forced === "prescription" ? "Add a prescription" : "Upload records"} subtitle={`For ${ws.profile.displayName}. You can add several files at once.`} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`rounded-[1.5rem] border-2 border-dashed p-8 text-center transition ${drag ? "border-pine bg-pine-soft/50" : "border-line bg-surface"}`}
      >
        <FileUp className="mx-auto h-9 w-9 text-pine" aria-hidden />
        <p className="mt-3 font-medium">Drag files here, or choose them</p>
        <p className="mt-1 text-sm text-muted">PDF, JPEG, PNG, HEIC, DOCX or TXT · up to 20 MB each</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()}>Choose files</Button>
          <Button variant="secondary" onClick={() => camRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden /> Scan with camera
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Choose files to upload" />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Take a photo of a document" />
      </div>

      <details className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Or paste the text of a report or prescription</summary>
        <div className="mt-3 space-y-2">
          <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder={"e.g.\nHemoglobin   13.1   g/dL   13.0 - 17.0"} aria-label="Pasted report text" />
          <Button variant="secondary" size="sm" onClick={addPasted} disabled={!pasted.trim()}>
            Add as a text file
          </Button>
        </div>
      </details>

      {items.length > 0 && (
        <div className="mt-6 space-y-4">
          {items.map((it) => (
            <Card key={it.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.file.name}</p>
                  <p className="text-sm text-muted">{formatBytes(it.file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {it.error && <Badge tone="danger">Not accepted</Badge>}
                  {it.progress === "storing" && <Badge tone="info" icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}>Storing original</Badge>}
                  {it.progress === "reading" && <Badge tone="info" icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}>Reading text</Badge>}
                  {it.progress === "done" && <Badge tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Saved</Badge>}
                  {it.progress === "failed" && <Badge tone="danger" icon={<XCircle className="h-3.5 w-3.5" />}>Failed</Badge>}
                  {!it.progress && (
                    <Button size="sm" variant="ghost" onClick={() => setItems((x) => x.filter((i) => i.key !== it.key))} aria-label={`Remove ${it.file.name}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
              {it.error && <p className="mt-2 text-sm text-danger">{it.error}</p>}
              {it.message && <p className="mt-2 text-sm text-ink-2">{it.message}</p>}
              {!it.error && !it.progress && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Title">{(id) => <Input id={id} value={it.title} onChange={(e) => patch(it.key, { title: e.target.value })} />}</Field>
                  <Field label="Type" hint="Auto-detect reads the text; you can change it later.">
                    {(id, d) => (
                      <Select id={id} aria-describedby={d} value={it.category} onChange={(e) => patch(it.key, { category: e.target.value as Pending["category"] })}>
                        <option value="auto">Detect automatically</option>
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABEL[c]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Document date" hint="Leave empty to read it from the document.">{(id, d) => <Input id={id} aria-describedby={d} type="date" value={it.date} onChange={(e) => patch(it.key, { date: e.target.value })} />}</Field>
                  <Field label="Provider or laboratory">{(id) => <Input id={id} value={it.provider} onChange={(e) => patch(it.key, { provider: e.target.value })} />}</Field>
                  <Field label="Custom category (optional)">{(id) => <Input id={id} value={it.customCategory} onChange={(e) => patch(it.key, { customCategory: e.target.value })} placeholder="e.g. Dental" />}</Field>
                  <Field label="Tags" hint="Comma separated">{(id, d) => <Input id={id} aria-describedby={d} value={it.tags} onChange={(e) => patch(it.key, { tags: e.target.value })} />}</Field>
                  <div className="sm:col-span-2">
                    <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={it.notes} onChange={(e) => patch(it.key, { notes: e.target.value })} />}</Field>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {hasImages && (
            <label className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-pine)]" checked={ocrOn} onChange={(e) => setUseOcr(e.target.checked)} />
              <span>
                <span className="block font-medium">Read text from photos with the OCR provider</span>
                <span className="text-muted">The image is sent to the configured AI provider only to read its text, and every value is marked for your review. Leave this off to keep images private and enter details yourself.</span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="h-4 w-4 text-pine" aria-hidden /> Originals are stored unchanged before any processing.
            </p>
            <Button onClick={processAll} disabled={busy || ready.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              Save {ready.length || ""} {ready.length === 1 ? "file" : "files"}
            </Button>
          </div>
        </div>
      )}

      {ws.state.mode === "cloud" ? (
        <Callout tone="neutral" className="mt-8" title="Private storage">
          Files go to private storage. Only people with access to this profile can open them, through short-lived links.
        </Callout>
      ) : (
        <Callout tone="neutral" className="mt-8" title="Demo mode storage">
          Files you add here are kept only in this browser. With an account they go to private storage with access limited to the profile’s authorized users.
        </Callout>
      )}
    </div>
  );
}
