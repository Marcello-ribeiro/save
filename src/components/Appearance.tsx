import { useEffect, useRef, useState } from "react";
import { usePrefs, type Accent, type Theme } from "../lib/prefs";
import { Controller } from "./Controller";
import { IconChevron } from "./Icons";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "auto", label: "Automático" }
];

const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "rosa", label: "Rosa", swatch: "linear-gradient(135deg, #ff6fb5, #b69cff)" },
  { value: "azul", label: "Azul", swatch: "#2f7bff" },
  { value: "lilas", label: "Lilás", swatch: "#b69cff" },
  { value: "branco", label: "Branco puro", swatch: "var(--text)" }
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Controles de aparência, usados no mini menu e em Configurações. */
export function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const { prefs, setPrefs } = usePrefs();
  return (
    <div className={`appearance ${compact ? "compact" : ""}`}>
      <div className="appearance-row">
        <span className="field-label">Tema</span>
        <Segmented label="Tema" value={prefs.theme} options={THEMES} onChange={(theme) => setPrefs({ theme })} />
      </div>
      <div className="appearance-row">
        <span className="field-label">Cor de destaque</span>
        <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={prefs.accent === a.value}
              className={`swatch ${prefs.accent === a.value ? "on" : ""}`}
              onClick={() => setPrefs({ accent: a.value })}
              title={a.label}
            >
              <span className="swatch-dot" style={{ background: a.swatch }} />
              {!compact && <span>{a.label}</span>}
              {compact && <span className="visually-hidden">{a.label}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="appearance-row">
        <span className="field-label" id="fx-label">
          Efeitos de fundo
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.fx === "on"}
          aria-labelledby="fx-label"
          className="switch"
          onClick={() => setPrefs({ fx: prefs.fx === "on" ? "off" : "on" })}
        >
          <span className="switch-knob" />
          <span className="switch-text">{prefs.fx === "on" ? "Ligados" : "Desligados"}</span>
        </button>
      </div>
      <div className="appearance-row">
        <span className="field-label">Tamanho das capas</span>
        <Segmented
          label="Tamanho das capas"
          value={prefs.size}
          options={[
            { value: "small", label: "Pequeno" },
            { value: "medium", label: "Médio" }
          ]}
          onChange={(size) => setPrefs({ size })}
        />
      </div>
    </div>
  );
}

/**
  Botão de tema na barra do topo: clicar alterna claro/escuro; segurar ou
  clicar na setinha abre o mini menu de aparência.
*/
export function ThemeButton() {
  const { resolvedTheme, setPrefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const holdTimer = useRef(0);
  const held = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const startHold = () => {
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, 450);
  };
  const endHold = () => window.clearTimeout(holdTimer.current);

  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <div className="theme-btn" ref={wrap}>
      <button
        type="button"
        className="theme-toggle"
        aria-label={next === "light" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
        title="Clique para trocar o tema. Segure para mais opções."
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          setPrefs({ theme: next });
        }}
      >
        <Controller mini className="theme-pad" />
      </button>
      <button type="button" className="theme-more" aria-label="Opções de aparência" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <IconChevron />
      </button>
      {open && (
        <div className="menu theme-menu" role="dialog" aria-label="Aparência">
          <AppearanceControls compact />
        </div>
      )}
    </div>
  );
}
