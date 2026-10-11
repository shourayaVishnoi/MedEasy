import { BRAND } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="18" className="fill-pine" />
        <path d="M18 33h8l4.5-10 5.5 19 4.5-10H46" fill="none" stroke="currentColor" className="text-paper" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[1.08rem]">{BRAND.name}</span>
    </span>
  );
}
