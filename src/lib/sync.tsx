import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { errorText } from "./supabase";

export type SyncState = "idle" | "busy" | "error";

type Ctx = {
  state: SyncState;
  detail: string;
  /** Roda um envio e deixa o selo do topo em "Enviando…" enquanto dura. */
  track: <T>(label: string, task: () => Promise<T>) => Promise<T>;
};

const SyncContext = createContext<Ctx | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>("idle");
  const [detail, setDetail] = useState("");
  const running = useRef(0);

  const track = useCallback(async <T,>(label: string, task: () => Promise<T>) => {
    running.current++;
    setState("busy");
    setDetail(label);
    try {
      const result = await task();
      running.current--;
      if (running.current === 0) {
        setState("idle");
        setDetail("");
      }
      return result;
    } catch (err) {
      running.current--;
      setState("error");
      setDetail(errorText(err));
      throw err;
    }
  }, []);

  const value = useMemo(() => ({ state, detail, track }), [state, detail, track]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync fora do SyncProvider");
  return ctx;
}
