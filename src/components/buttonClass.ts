import { cx } from "@/lib/util";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet" | "light";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-pine text-on-pine hover:bg-pine-strong shadow-[var(--shadow-glow)]",
  secondary: "bg-white/[0.12] text-ink border border-white/10 backdrop-blur hover:bg-white/[0.2]",
  ghost: "text-ink-2 hover:bg-white/[0.08] hover:text-ink",
  quiet: "bg-pine-soft text-accent hover:brightness-125",
  light: "bg-white text-black hover:bg-white/80",
  danger: "bg-danger text-[#1a070b] hover:brightness-110",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[background,box-shadow,filter,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-[0.95rem]",
    size === "lg" && "h-13 px-6 text-base",
    VARIANTS[variant],
  );
}

