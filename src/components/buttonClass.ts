import { cx } from "@/lib/util";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-strong dark:text-[#0f1714] shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-sunken",
  ghost: "text-ink-2 hover:bg-sunken",
  quiet: "bg-pine-soft text-pine hover:brightness-95",
  danger: "bg-danger text-white hover:brightness-110 dark:text-[#1a0d0b]",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background,box-shadow,filter] duration-150 disabled:opacity-50 disabled:pointer-events-none select-none",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-[0.95rem]",
    size === "lg" && "h-13 px-6 text-base",
    VARIANTS[variant],
  );
}

