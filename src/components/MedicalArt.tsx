import { cx } from "@/lib/util";

/** One PQRST heartbeat, 200 units wide, baseline at y=50. */
const BEAT = "l60 0 l8 -6 l8 6 l12 0 l6 8 l6 -48 l6 70 l6 -30 l18 0 l12 -10 l14 10 l44 0";

/** A heart-monitor trace with a bright pulse sweeping along it. */
export function EcgLine({ beats = 6, className, speed = 3.2, delay = 0 }: { beats?: number; className?: string; speed?: number; delay?: number }) {
  const d = `M0 50 ${Array.from({ length: beats }, () => BEAT).join(" ")}`;
  const w = beats * 200;
  return (
    <svg aria-hidden viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" className={cx("overflow-visible", className)}>
      <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path
        d={d}
        pathLength={1000}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="ecg-sweep"
        style={{ animationDuration: `${speed}s`, animationDelay: `${delay}s`, filter: "drop-shadow(0 0 6px currentColor)" }}
      />
    </svg>
  );
}

export function Capsule({ className, a = "#e50914", b = "#ffffff" }: { className?: string; a?: string; b?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 80 32" className={className}>
      <defs>
        <clipPath id="cap">
          <rect width="80" height="32" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#cap)">
        <rect width="40" height="32" fill={a} />
        <rect x="40" width="40" height="32" fill={b} />
        <rect x="8" y="5" width="60" height="5" rx="2.5" fill="#fff" opacity="0.35" />
      </g>
    </svg>
  );
}

export function Tablet({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="18" fill="#f3f3f3" />
      <circle cx="20" cy="20" r="18" fill="none" stroke="#000" strokeOpacity="0.15" strokeWidth="2" />
      <path d="M8 20h24" stroke="#000" strokeOpacity="0.25" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function MedCross({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className}>
      <path d="M15 4h10v11h11v10H25v11H15V25H4V15h11z" fill="currentColor" />
    </svg>
  );
}

export function Molecule({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 20 32 32 48 22M32 32 28 50" />
      <circle cx="20" cy="20" r="7" fill="currentColor" fillOpacity="0.25" />
      <circle cx="32" cy="32" r="6" fill="currentColor" />
      <circle cx="48" cy="22" r="5" fill="currentColor" fillOpacity="0.25" />
      <circle cx="28" cy="50" r="5" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/** A rotating double helix drawn from dots and rungs. */
export function DnaHelix({ rungs = 16, className }: { rungs?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("flex h-48 items-center justify-center gap-[0.55rem]", className)}>
      {Array.from({ length: rungs }, (_, i) => (
        <div key={i} className="dna-rung relative h-full w-2" style={{ animationDelay: `${-i * 0.18}s` }}>
          <span className="dna-a absolute left-0 h-2.5 w-2.5 rounded-full bg-pine shadow-[0_0_12px_var(--color-pine)]" style={{ animationDelay: `${-i * 0.18}s` }} />
          <span className="dna-b absolute left-0 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_white]" style={{ animationDelay: `${-i * 0.18}s` }} />
          <span className="dna-line absolute left-[0.28rem] w-px bg-white/25" style={{ animationDelay: `${-i * 0.18}s` }} />
        </div>
      ))}
    </div>
  );
}

const FLOATERS: { el: "capsule" | "tablet" | "cross" | "molecule"; pos: string; size: string; delay: number; dur: number; rot: number }[] = [
  { el: "capsule", pos: "left-[6%] top-[22%]", size: "w-20", delay: 0, dur: 9, rot: -25 },
  { el: "tablet", pos: "left-[16%] top-[70%]", size: "w-10", delay: -3, dur: 7, rot: 0 },
  { el: "cross", pos: "right-[10%] top-[18%]", size: "w-9 text-pine", delay: -1, dur: 8, rot: 10 },
  { el: "molecule", pos: "right-[6%] top-[62%]", size: "w-16 text-white/70", delay: -4, dur: 11, rot: 0 },
  { el: "capsule", pos: "right-[22%] top-[80%]", size: "w-14", delay: -2, dur: 10, rot: 40 },
  { el: "molecule", pos: "left-[28%] top-[12%]", size: "w-11 text-pine/80", delay: -6, dur: 12, rot: 0 },
  { el: "tablet", pos: "right-[30%] top-[8%]", size: "w-7", delay: -5, dur: 9, rot: 0 },
];

/** Pills, crosses and molecules drifting gently in the background. */
export function FloatingMeds({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {FLOATERS.map((f, i) => (
        <div key={i} className={cx("float-med absolute opacity-80", f.pos)} style={{ animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }}>
          <div className={f.size} style={{ transform: `rotate(${f.rot}deg)` }}>
            {f.el === "capsule" ? <Capsule className="w-full drop-shadow-[0_8px_20px_rgb(229_9_20/0.45)]" /> : f.el === "tablet" ? <Tablet className="w-full drop-shadow-[0_6px_14px_rgb(0_0_0/0.6)]" /> : f.el === "cross" ? <MedCross className="w-full drop-shadow-[0_0_14px_rgb(229_9_20/0.7)]" /> : <Molecule className="w-full" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Netflix-style intro: a heartbeat draws across, the wordmark lands, then the curtain lifts. Pure CSS, never blocks clicks. */
export function IntroSplash({ name }: { name: string }) {
  return (
    <div aria-hidden className="intro-splash pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-black">
      <div className="relative w-[min(80vw,40rem)]">
        <EcgLine beats={3} speed={1.1} className="intro-ecg absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 text-pine" />
        <p className="intro-word relative text-center font-brand text-[18vw] leading-none tracking-[0.04em] text-pine sm:text-[8rem]" style={{ textShadow: "0 0 40px rgb(229 9 20 / 0.6)" }}>
          {name.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
