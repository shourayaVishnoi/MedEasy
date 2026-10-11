import { BRAND } from "@/lib/brand";

/** Wordmark in condensed cinema caps; `compact` shows just the initial. */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex select-none items-center font-brand leading-none tracking-[0.04em] text-accent ${compact ? "text-[2.1rem]" : "text-[2rem]"} ${className}`} style={{ textShadow: "0 2px 12px rgb(229 9 20 / 0.35)" }}>
      {compact ? BRAND.name.slice(0, 1) : BRAND.name.toUpperCase()}
    </span>
  );
}
