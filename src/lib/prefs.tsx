import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type Theme = "auto" | "light" | "dark";
export type Accent = "rosa" | "azul" | "lilas" | "branco";
export type Section = "biblioteca" | "backups" | "sincronizacao" | "configuracoes";

export type Prefs = {
  theme: Theme;
  accent: Accent;
  fx: "on" | "off";
  size: "small" | "medium";
  startSection: Section;
};

export const DEFAULT_PREFS: Prefs = { theme: "auto", accent: "rosa", fx: "on", size: "small", startSection: "biblioteca" };

const KEY = "savevault:prefs";
const ACCENTS: Accent[] = ["rosa", "azul", "lilas", "branco"];
const SECTIONS: Section[] = ["biblioteca", "backups", "sincronizacao", "configuracoes"];

function clean(raw: unknown): Prefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  return {
    theme: p.theme === "light" || p.theme === "dark" ? p.theme : "auto",
    accent: ACCENTS.includes(p.accent as Accent) ? (p.accent as Accent) : "rosa",
    fx: p.fx === "off" ? "off" : "on",
    size: p.size === "medium" ? "medium" : "small",
    startSection: SECTIONS.includes(p.startSection as Section) ? (p.startSection as Section) : "biblioteca"
  };
}

function readLocal(): Prefs {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocal(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento local: a preferência vale só nesta aba */
  }
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "auto") return theme;
  return darkQuery().matches ? "dark" : "light";
}

function apply(p: Prefs) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(p.theme);
  root.dataset.accent = p.accent;
  root.dataset.fx = p.fx;
  root.dataset.size = p.size;
}

type Ctx = {
  prefs: Prefs;
  resolvedTheme: "light" | "dark";
  setPrefs: (patch: Partial<Prefs>) => void;
};

const PrefsContext = createContext<Ctx | null>(null);

async function saveRemote(userId: string, prefs: Prefs) {
  const { data, error } = await supabase.from("profiles").update({ preferences: prefs }).eq("id", userId).select("id");
  if (!error && data && data.length === 0) {
    await supabase.from("profiles").insert({ id: userId, preferences: prefs });
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setState] = useState<Prefs>(readLocal);
  const [resolvedTheme, setResolved] = useState(() => resolveTheme(prefs.theme));
  const saveTimer = useRef(0);

  useEffect(() => {
    apply(prefs);
    setResolved(resolveTheme(prefs.theme));
    if (prefs.theme !== "auto") return;
    const mq = darkQuery();
    const onChange = () => {
      apply(prefs);
      setResolved(resolveTheme("auto"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  // Ao entrar, a preferência guardada na conta vale mais que a local
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const remote = data?.preferences as Partial<Prefs> | undefined;
        if (remote && Object.keys(remote).length) {
          const next = clean({ ...readLocal(), ...remote });
          writeLocal(next);
          setState(next);
        } else {
          void saveRemote(userId, readLocal());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      setState((prev) => {
        const next = clean({ ...prev, ...patch });
        writeLocal(next);
        apply(next);
        if (userId) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => void saveRemote(userId, next), 400);
        }
        return next;
      });
    },
    [userId]
  );

  const value = useMemo(() => ({ prefs, resolvedTheme, setPrefs }), [prefs, resolvedTheme, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs fora do PrefsProvider");
  return ctx;
}

export const SECTION_PATHS: Record<Section, string> = {
  biblioteca: "/biblioteca",
  backups: "/backups",
  sincronizacao: "/sincronizacao",
  configuracoes: "/configuracoes"
};
