"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertOctagon, BookOpen, CircleHelp, FileSearch, SendHorizonal, ShieldAlert, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { answerQuestion, type AssistantAnswer } from "@/lib/ai/assistant";
import { update } from "@/lib/store";
import { Badge, Button, Callout, Card, LoadingPage, PageHeader } from "@/components/ui";
import { uid } from "@/lib/util";

const SUGGESTIONS = [
  "Summarize my latest blood test",
  "Show my previous reports for TSH",
  "What medicines have I recorded as active?",
  "When is my next appointment?",
  "Which reports should I bring to my next appointment?",
  "Help me prepare questions for my doctor",
];

interface Turn {
  id: string;
  q: string;
  a: AssistantAnswer;
}

export default function Assistant() {
  const ws = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns]);
  if (!ws) return <LoadingPage />;

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    const a = answerQuestion(ws!.state, ws!.profileId, t);
    setTurns((x) => [...x, { id: uid("t"), q: t, a }]);
    setQ("");
    if (ws!.state.settings.keepAssistantHistory)
      update((s) => ({ ...s, chat: [...s.chat, { id: uid("c"), role: "user" as const, text: t, at: new Date().toISOString() }].slice(-200) }));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ask about your records" subtitle={`Answers come only from ${ws.profile.displayName}’s saved records, with links to the source. It can’t diagnose or change medicines.`} />

      {turns.length === 0 && (
        <Card className="mb-6 p-5">
          <p className="text-sm font-medium">Try asking</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm hover:border-pine/40 hover:bg-pine-soft/40">
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-6" aria-live="polite">
        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-pine px-4 py-2.5 text-on-pine">{t.q}</div>
            <AnswerView a={t.a} />
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="sticky bottom-20 mt-6 flex gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg lg:bottom-4"
      >
        <label htmlFor="ask" className="sr-only">
          Your question
        </label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your reports, medicines or appointments" className="min-w-0 flex-1 bg-transparent px-3 text-[0.98rem] outline-none" autoComplete="off" />
        <Button type="submit" aria-label="Send" disabled={!q.trim()}>
          <SendHorizonal className="h-4 w-4" aria-hidden />
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Built-in retrieval engine · documents are treated as data, never as instructions</span>
        {turns.length > 0 && (
          <button className="inline-flex items-center gap-1 underline" onClick={() => setTurns([])}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}

function AnswerView({ a }: { a: AssistantAnswer }) {
  if (a.urgent)
    return (
      <Callout tone="danger" title="This may need urgent help">
        <span className="inline-flex gap-1.5">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {a.urgent}
        </span>
      </Callout>
    );
  const block = (title: string, icon: React.ReactNode, items: AssistantAnswer["documented"], tone?: string) =>
    items.length > 0 && (
      <section className={`rounded-2xl border bg-surface p-4 ${tone ?? "border-line"}`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        <ul className="mt-2 space-y-2 text-[0.95rem] leading-relaxed text-ink-2">
          {items.map((i, k) => (
            <li key={k}>
              {i.text}
              {i.href && (
                <Link href={i.href} className="ml-1.5 inline-flex rounded-md bg-sunken px-1.5 py-0.5 align-middle text-xs font-medium text-accent hover:underline">
                  Source: {i.label ?? "record"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-2.5">
      {a.boundary && (
        <Callout tone="warn" title="I can’t advise on medicine changes">
          <span className="inline-flex gap-1.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {a.boundary}
          </span>
        </Callout>
      )}
      {block("From your records", <FileSearch className="h-4 w-4 text-accent" aria-hidden />, a.documented, "border-pine/25")}
      {block("General information", <BookOpen className="h-4 w-4 text-accent" aria-hidden />, a.general)}
      {block("Not known from your records", <CircleHelp className="h-4 w-4 text-accent" aria-hidden />, a.unknown, "border-dashed border-line")}
      <Badge tone="neutral" icon={false}>
        Built-in engine · not medical advice
      </Badge>
    </div>
  );
}
