"use client";

import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Info, X, XCircle } from "lucide-react";
import { cx } from "@/lib/util";

import { buttonClass, type Variant } from "./buttonClass";
export { buttonClass };

export const Button = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" | "lg" }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
  },
);

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" } & Record<string, unknown>) {
  return (
    <As className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, subtitle, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pine/15 text-accent ring-1 ring-pine/25">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-display text-[1.08rem] font-semibold leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "pine";
const TONES: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-ink-2 border-white/10",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  pine: "bg-pine/15 text-accent border-pine/30",
};
const TONE_ICON: Partial<Record<Tone, ReactNode>> = {
  ok: <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />,
  warn: <AlertTriangle aria-hidden className="h-3.5 w-3.5" />,
  danger: <XCircle aria-hidden className="h-3.5 w-3.5" />,
  info: <Info aria-hidden className="h-3.5 w-3.5" />,
  neutral: <CircleDashed aria-hidden className="h-3.5 w-3.5" />,
};

/** Status badge: always icon + text, never colour alone. */
export function Badge({ tone = "neutral", children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode | false; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>
      {icon === false ? null : (icon ?? TONE_ICON[tone])}
      {children}
    </span>
  );
}

export function Callout({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cx("flex gap-3 rounded-lg border px-4 py-3 text-sm", TONES[tone], className)}>
      <span className="mt-0.5 shrink-0">{TONE_ICON[tone] ?? TONE_ICON.info}</span>
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cx(title ? "mt-0.5" : undefined, "text-ink-2")}>{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-rise">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[0.98rem] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-pine/15 text-accent ring-1 ring-pine/25">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton h-4", className)} />;
}

export function LoadingPage() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

const fieldBase =
  "w-full rounded-md border border-line-strong bg-raised px-3.5 text-[0.98rem] text-ink placeholder:text-muted/80 transition focus:border-ink/70 focus:outline-none focus:ring-3 focus:ring-white/10 disabled:bg-sunken";

export function Field({ label, hint, error, children, required }: { label: string; hint?: ReactNode; error?: string; children: (id: string, describedBy?: string) => ReactNode; required?: boolean }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="flex items-center gap-1 text-xs font-medium text-danger">
          <XCircle aria-hidden className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-11", className)} {...p} />;
});
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "h-11 pr-8", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-24 py-2.5", className)} {...p} />;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={cx(
        "m-auto w-[calc(100%-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-xl border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-ink hover:bg-white/15" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-black/30 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = "Confirm", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </Modal>
  );
}

let toastPush: ((t: { text: string; tone?: Tone }) => void) | null = null;
export function toast(text: string, tone: Tone = "ok") {
  toastPush?.({ text, tone });
}
export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string; tone?: Tone }[]>([]);
  useEffect(() => {
    toastPush = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, ...t }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
    };
    return () => {
      toastPush = null;
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-rise rounded-md border border-line-strong bg-raised px-4 py-3 text-sm font-medium shadow-2xl">
          <span className="inline-flex items-center gap-2">
            {TONE_ICON[t.tone ?? "ok"]}
            {t.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition", value === o.value ? "border-white bg-white text-black" : "border-white/25 text-ink-2 hover:border-white/60 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
