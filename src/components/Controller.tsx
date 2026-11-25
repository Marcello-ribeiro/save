import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefs } from "../lib/prefs";

/*
  Controle em imagem: branco no tema escuro e preto no tema claro.
  As duas imagens ficam sobrepostas e o CSS mostra a do tema atual,
  com uma troca suave.
*/

const PAD_DARK_THEME = "/controle/controle-branco.webp";
const PAD_LIGHT_THEME = "/controle/controle-preto.webp";

export function Controller({ mini = false, className, style }: { mini?: boolean; className?: string; style?: CSSProperties }) {
  const size = mini ? { width: 40, height: 27 } : { width: 1200, height: 815 };
  return (
    <span className={["pad", className].filter(Boolean).join(" ")} style={style} role="img" aria-label="Controle">
      <img className="pad-dark-theme" src={PAD_DARK_THEME} alt="" {...size} draggable={false} decoding="async" />
      <img className="pad-light-theme" src={PAD_LIGHT_THEME} alt="" {...size} draggable={false} decoding="async" />
    </span>
  );
}

/*
  Controle grande em 3D.
  - Usa o modelo 3D de verdade (public/controle/ps5_controller.glb) com o
    <model-viewer>: clique e arraste para girar para qualquer lado (360°).
    Parado, fica de lado balançando devagar e volta para essa pose sozinho.
  - No tema escuro o controle é branco; no claro, as partes brancas ficam pretas.
  - A barra de luz do controle acende na cor de destaque do site.
  - Se o modelo não carregar, usa a versão em imagem (com camadas de espessura).

  Modelo: "PS5 Controller" de Taohid Animation, CC BY 4.0
  https://sketchfab.com/3d-models/ps5-controller-b7bb9c5102a04cb0b1966c6d02bad7d6
*/

const MODEL_URL = "/controle/ps5_controller.glb";
const DARK_BODY = [0.022, 0.023, 0.028, 1] as const;
const LIGHT_BAR = "Material.008";

// Peças do modelo (nomes dos materiais no arquivo .glb)
const BUTTON_PARTS = ["Material.002", "Material.009"]; // botões de ação e direcional
const LOGO_PARTS = ["Material.006", "Material.005"]; // logo do centro
// Botões contrastam com o corpo: escuros no controle branco, claros no preto
const BUTTONS_ON_WHITE = [0.035, 0.036, 0.045, 1] as const;
const BUTTONS_ON_BLACK = [0.5, 0.51, 0.55, 1] as const;
const LOGO_COLOR = [0.8, 0.8, 0.84, 1] as const;
const LOGO_GLOW = [0.25, 0.25, 0.27] as const;
const REST_ORBIT = { theta: -35, phi: 68 }; // pose de lado

const REST = { x: 14, y: -32, z: -7 };
const LAYERS = 9; // camadas da espessura (versão em imagem)
const DEPTH = 2.4; // px entre camadas
const IDLE_RETURN_MS = 3500;

type Pose = { x: number; y: number };

// --- tipos mínimos da API de materiais do <model-viewer> ---
type Rgba = [number, number, number, number];
type MvMaterial = {
  name: string;
  pbrMetallicRoughness: {
    baseColorFactor: Rgba;
    baseColorTexture: { texture: unknown | null } | null;
    setBaseColorFactor: (c: readonly number[]) => void;
  };
  setEmissiveFactor: (c: readonly number[]) => void;
};
type MvElement = HTMLElement & { model?: { materials: MvMaterial[] } };

/** "#ff6fb5" → [r, g, b] lineares (0–1), que é o que o glTF espera. */
function accentLinear(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  let hex = m ? m[1] : "ff6fb5";
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return [0, 2, 4].map((i) => Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2)) as [number, number, number];
}

function ModelController({ onFail }: { onFail: () => void }) {
  const ref = useRef<MvElement>(null);
  const { prefs, resolvedTheme } = usePrefs();
  const [lib, setLib] = useState(false);
  const [ready, setReady] = useState(false);
  const original = useRef(new Map<MvMaterial, Rgba>());

  useEffect(() => {
    let alive = true;
    import("@google/model-viewer")
      .then(() => alive && setLib(true))
      .catch(() => alive && onFail());
    return () => {
      alive = false;
    };
  }, [onFail]);

  // pinta o controle conforme o tema e a cor de destaque
  const paint = useCallback(() => {
    const model = ref.current?.model;
    if (!model) return;
    const [r, g, b] = accentLinear();
    for (const mat of model.materials) {
      const pbr = mat.pbrMetallicRoughness;
      if (!original.current.has(mat)) original.current.set(mat, [...pbr.baseColorFactor] as Rgba);
      const base = original.current.get(mat)!;
      if (mat.name === LIGHT_BAR) {
        pbr.setBaseColorFactor([r, g, b, 1]);
        mat.setEmissiveFactor([r, g, b]);
        continue;
      }
      if (BUTTON_PARTS.includes(mat.name)) {
        pbr.setBaseColorFactor(resolvedTheme === "light" ? BUTTONS_ON_BLACK : BUTTONS_ON_WHITE);
        continue;
      }
      if (LOGO_PARTS.includes(mat.name)) {
        pbr.setBaseColorFactor(LOGO_COLOR);
        mat.setEmissiveFactor(LOGO_GLOW);
        continue;
      }
      const isWhitePart = !pbr.baseColorTexture?.texture && Math.max(base[0], base[1], base[2]) > 0.3;
      pbr.setBaseColorFactor(resolvedTheme === "light" && isWhitePart ? DARK_BODY : base);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !lib) return;
    const onLoad = () => {
      setReady(true);
      paint();
    };
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onFail);
    if (el.model) onLoad();
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onFail);
    };
  }, [lib, paint, onFail]);

  // a cor de destaque é aplicada por atributo no <html>; espera o CSS atualizar
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(id);
  }, [ready, paint, prefs.accent]);

  const fx = prefs.fx === "on";

  // Parado: o controle fica de lado e balança devagar. Depois que a pessoa
  // gira com o mouse, ele espera um pouco e volta suave para a pose de lado.
  useEffect(() => {
    const el = ref.current as (MvElement & { cameraOrbit: string; getCameraOrbit: () => { theta: number } }) | null;
    if (!el || !ready) return;
    let lastUser = 0;
    let raf = 0;
    let lastSet = 0;
    const onChange = (e: Event) => {
      if ((e as CustomEvent<{ source?: string }>).detail?.source === "user-interaction") lastUser = performance.now();
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastUser < IDLE_RETURN_MS || now - lastSet < 90) return;
      lastSet = now;
      const t = now / 1000;
      // volta pelo caminho mais curto, mesmo depois de várias voltas
      const current = (el.getCameraOrbit().theta * 180) / Math.PI;
      const turns = Math.round((current - REST_ORBIT.theta) / 360) * 360;
      const theta = REST_ORBIT.theta + turns + (fx ? Math.sin(t * 0.45) * 14 : 0);
      const phi = REST_ORBIT.phi + (fx ? Math.sin(t * 0.32) * 5 : 0);
      el.cameraOrbit = `${theta.toFixed(2)}deg ${phi.toFixed(2)}deg auto`;
    };
    el.addEventListener("camera-change", onChange);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("camera-change", onChange);
    };
  }, [ready, fx]);

  return (
    <div className={`pad-model-wrap${ready ? " is-ready" : ""}`}>
      <div className="pad3d-glow" />
      {!ready && <div className="pad-model-loading">Carregando o controle…</div>}
      {lib && (
        <div className="pad-model-float">
          <model-viewer
            ref={ref}
            className="pad-model"
            src={MODEL_URL}
            alt="Controle em 3D"
            loading="eager"
            reveal="auto"
            camera-controls=""
            touch-action="none"
            interaction-prompt="none"
            camera-orbit="-35deg 68deg auto"
            min-camera-orbit="auto 0deg auto"
            max-camera-orbit="auto 180deg auto"
            field-of-view="30deg"
            interpolation-decay="110"
            shadow-intensity="1.2"
            shadow-softness="0.9"
            exposure="1.08"
            environment-image="neutral"
            tone-mapping="neutral"
            disable-zoom=""
            disable-pan=""
          >
            <div slot="progress-bar" />
          </model-viewer>
        </div>
      )}
      <span className="pad3d-hint">Arraste para girar</span>
    </div>
  );
}

function ImageController() {
  const stage = useRef<HTMLDivElement>(null);
  const obj = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const body = obj.current;
    if (!el || !body) return;

    const off = () => document.documentElement.dataset.fx === "off";
    const rot: Pose = { x: REST.x, y: REST.y };
    const vel: Pose = { x: 0, y: 0 };
    let dragging = false;
    let last = { x: 0, y: 0, t: 0 };
    let lastTouch = 0;
    let raf = 0;
    let t0 = performance.now();

    const shortest = (from: number, to: number) => {
      const d = ((((to - from) % 360) + 540) % 360) - 180;
      return from + d;
    };

    const apply = (now: number) => {
      const t = (now - t0) / 1000;
      const idle = off() ? 0 : 1;
      const bob = Math.sin(t * 1.3) * 8 * idle;
      const sway = Math.sin(t * 0.7) * 3 * idle;
      const roll = REST.z + Math.sin(t * 0.9) * 1.5 * idle;
      body.style.transform =
        `translate3d(0, ${bob.toFixed(2)}px, 0) rotateX(${(rot.x + sway * 0.5).toFixed(2)}deg) ` +
        `rotateY(${(rot.y + sway).toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg)`;
      // a sombra encolhe quando o controle sobe e fica mais forte de frente
      const facing = Math.abs(Math.cos((rot.y * Math.PI) / 180));
      el.style.setProperty("--floor-scale", (0.82 + facing * 0.18 - bob / 120).toFixed(3));
      el.style.setProperty("--floor-alpha", (0.55 + facing * 0.45).toFixed(3));
    };

    const loop = (now: number) => {
      if (!dragging) {
        if (Math.abs(vel.x) + Math.abs(vel.y) > 0.02) {
          rot.x += vel.x;
          rot.y += vel.y;
          vel.x *= 0.94;
          vel.y *= 0.94;
          last.t = now;
        } else if (now - last.t > IDLE_RETURN_MS) {
          const tx = shortest(rot.x, REST.x);
          const ty = shortest(rot.y, REST.y);
          rot.x += (tx - rot.x) * 0.045;
          rot.y += (ty - rot.y) * 0.045;
        }
      }
      apply(now);
      raf = requestAnimationFrame(loop);
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      vel.x = vel.y = 0;
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      rot.y += dx * 0.55;
      rot.x -= dy * 0.55;
      vel.y = dx * 0.55;
      vel.x = -dy * 0.55;
      last = { x: e.clientX, y: e.clientY, t: now };
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-dragging");
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (performance.now() - last.t > 80) vel.x = vel.y = 0; // soltou parado: sem inércia
      last.t = performance.now();
    };
    const reset = () => {
      vel.x = vel.y = 0;
      last.t = 0;
    };
    const tap = (e: PointerEvent) => {
      // duplo toque no celular
      if (e.pointerType !== "touch") return;
      const now = performance.now();
      if (now - lastTouch < 300) reset();
      lastTouch = now;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerdown", tap);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", reset);
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerdown", tap);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", reset);
    };
  }, []);

  return (
    <div className="pad3d" ref={stage} title="Arraste para girar · duplo clique para voltar">
      <div className="pad3d-glow" />
      <div className="pad3d-obj" ref={obj}>
        {Array.from({ length: LAYERS }, (_, i) => (
          <Controller
            key={i}
            className="pad3d-layer"
            style={{ transform: `translateZ(${(-(i + 1) * DEPTH).toFixed(1)}px)`, filter: `brightness(${(0.62 - i * 0.035).toFixed(3)})` }}
          />
        ))}
        <div className="pad3d-back" style={{ transform: `translateZ(${(-(LAYERS + 1) * DEPTH).toFixed(1)}px) rotateY(180deg)` }} />
        <Controller className="pad3d-front" />
      </div>
      <div className="pad3d-floor" />
      <span className="pad3d-hint">Arraste para girar</span>
    </div>
  );
}

/** Controle grande da Biblioteca. */
export function HeroController() {
  const [fallback, setFallback] = useState(false);
  const fail = useCallback(() => setFallback(true), []);
  return (
    <div className="hero-pad" aria-hidden="true">
      {fallback ? <ImageController /> : <ModelController onFail={fail} />}
    </div>
  );
}
