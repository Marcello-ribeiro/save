import { useEffect, useId, useRef } from "react";

/*
  Controle original em SVG. O corpo usa currentColor (vem de --pad-color:
  branco no tema escuro, preto no claro) e a segunda cor vem de
  --pad-second. A luz de borda segue a cor de destaque.
*/

const BODY =
  "M300 74C365 74 425 76 474 88C526 100 552 128 566 172C582 226 596 300 584 350C576 384 540 394 516 378C492 362 474 318 452 290C432 266 392 254 300 254C208 254 168 266 148 290C126 318 108 362 84 378C60 394 24 384 16 350C4 300 18 226 34 172C48 128 74 100 126 88C175 76 235 74 300 74Z";
const CORE = "M150 150C220 138 380 138 450 150C474 196 462 240 444 272C392 252 208 252 156 272C138 240 126 196 150 150Z";
const PANEL = "M214 96C260 90 340 90 386 96C392 120 390 150 382 168C340 174 260 174 218 168C210 150 208 120 214 96Z";
const SHOULDER_L = "M112 100C140 70 205 62 244 78L240 90C200 82 160 88 126 108Z";
const SHOULDER_R = "M488 100C460 70 395 62 356 78L360 90C400 82 440 88 474 108Z";

export function Controller({ mini = false, className }: { mini?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg className={className} viewBox="0 0 600 400" role="img" aria-label="Controle" style={{ color: "var(--pad-color)" }}>
      <defs>
        <linearGradient id={id("shade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--pad-highlight)" }} />
          <stop offset="0.32" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" style={{ stopColor: "var(--pad-shade)" }} />
        </linearGradient>
        <radialGradient id={id("spec")} cx="0.3" cy="0.18" r="0.5">
          <stop offset="0" style={{ stopColor: "var(--pad-highlight)" }} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("cap")} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--accent-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-2)" }} />
        </linearGradient>
        <clipPath id={id("clip")}>
          <path d={BODY} />
        </clipPath>
        {!mini && (
          <filter id={id("glow")} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        )}
        {!mini && (
          <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        )}
      </defs>

      {!mini && <path className="pad-aura" d={BODY} fill={url("rim")} filter={url("glow")} />}

      <path d={SHOULDER_L} style={{ fill: "var(--pad-second)" }} />
      <path d={SHOULDER_R} style={{ fill: "var(--pad-second)" }} />

      <path d={BODY} fill="currentColor" />

      <g clipPath={url("clip")}>
        <path d={CORE} style={{ fill: "var(--pad-second)" }} />
        <rect width="600" height="400" fill={url("shade")} />
        <ellipse cx="190" cy="110" rx="190" ry="70" fill={url("spec")} opacity="0.7" />
      </g>

      {/* painel de toque, com a costura */}
      <path d={PANEL} fill="currentColor" />
      <path d={PANEL} fill={url("shade")} opacity="0.6" />
      <path d={PANEL} fill="none" style={{ stroke: "var(--pad-second)" }} strokeOpacity="0.35" strokeWidth="2" />

      {/* faixas de luz nas laterais do painel */}
      {!mini && (
        <g filter={url("soft")} opacity="0.9">
          <path d="M204 104C199 126 199 148 207 166" style={{ stroke: "var(--accent)" }} strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M396 104C401 126 401 148 393 166" style={{ stroke: "var(--accent)" }} strokeWidth="8" strokeLinecap="round" fill="none" />
        </g>
      )}
      <path className="pad-light" d="M204 104C199 126 199 148 207 166" style={{ stroke: "var(--accent)" }} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path className="pad-light" d="M396 104C401 126 401 148 393 166" style={{ stroke: "var(--accent)" }} strokeWidth="3.5" strokeLinecap="round" fill="none" />

      {/* direcional */}
      <g style={{ fill: "var(--pad-second)" }}>
        <rect x="117" y="121" width="22" height="58" rx="7" />
        <rect x="99" y="139" width="58" height="22" rx="7" />
      </g>

      {/* botões de ação: só pontos, sem símbolos */}
      <g style={{ fill: "var(--pad-second)" }}>
        <circle cx="472" cy="124" r="11.5" />
        <circle cx="498" cy="150" r="11.5" />
        <circle cx="472" cy="176" r="11.5" />
        <circle cx="446" cy="150" r="11.5" />
      </g>

      {/* botões pequenos do centro */}
      <rect x="180" y="92" width="12" height="22" rx="6" style={{ fill: "var(--pad-second)" }} />
      <rect x="408" y="92" width="12" height="22" rx="6" style={{ fill: "var(--pad-second)" }} />
      <rect x="284" y="190" width="32" height="9" rx="4.5" fill="currentColor" opacity="0.9" />

      {/* analógicos */}
      {[222, 378].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="212" r="37" style={{ fill: "var(--pad-second)" }} />
          <circle cx={cx} cy="212" r="26" fill="currentColor" />
          <circle cx={cx} cy="212" r="26" fill={url("cap")} />
          <circle cx={cx} cy="212" r="17" fill="none" style={{ stroke: "var(--pad-second)" }} strokeOpacity="0.4" strokeWidth="2" />
        </g>
      ))}

      {/* luz de borda */}
      <path className="pad-rim" d={BODY} fill="none" stroke={url("rim")} strokeWidth={mini ? 10 : 3} opacity={mini ? 0.9 : 0.85} />
    </svg>
  );
}

/** Controle grande: flutua e inclina seguindo o mouse. */
export function HeroController() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const onMove = (e: PointerEvent) => {
      if (reduced.matches || document.documentElement.dataset.fx === "off") return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const ny = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      target = { x: Math.max(-1, Math.min(1, nx * 2)), y: Math.max(-1, Math.min(1, ny * 2)) };
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      el.style.setProperty("--ry", `${(cur.x * 12).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-cur.y * 8).toFixed(2)}deg`);
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-pad" ref={ref} aria-hidden="true">
      <div className="hero-pad-float">
        <div className="hero-pad-tilt">
          <Controller />
        </div>
      </div>
      <div className="hero-pad-floor" />
    </div>
  );
}
