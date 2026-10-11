import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "@/lib/util";

/** A titled, horizontally scrolling row of tiles. */
export function Row({ title, href, linkLabel = "See all", children, className, id }: { title: ReactNode; href?: string; linkLabel?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cx("animate-rise", className)} aria-labelledby={id}>
      <div className="mb-3 flex items-end gap-3">
        <h2 id={id} className="font-display text-lg font-bold tracking-tight sm:text-xl">
          {title}
        </h2>
        {href && (
          <Link href={href} className="group mb-0.5 inline-flex items-center text-xs font-bold text-accent">
            {linkLabel}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Tile for a Row: fixed width so rows scroll sideways on every screen. */
export function Tile({ href, children, className, width = "w-[15rem] sm:w-[17rem]" }: { href?: string; children: ReactNode; className?: string; width?: string }) {
  const cls = cx("tile relative block overflow-hidden rounded-md border border-line bg-surface", width, className);
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}
