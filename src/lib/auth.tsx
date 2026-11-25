import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") navigate("/nova-senha");
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      }
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

/** Mensagens do Supabase Auth em português. */
export function authErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? "");
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme o e-mail antes de entrar. O link está na sua caixa de entrada.";
  if (/already registered|already been registered|user already exists/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/password should be at least|weak password/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/invalid format|validate email|invalid email/i.test(msg)) return "Digite um e-mail válido.";
  if (/rate limit|security purposes|too many/i.test(msg)) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  if (/same password|different from the old/i.test(msg)) return "A nova senha precisa ser diferente da anterior.";
  if (/signups not allowed|signup is disabled/i.test(msg)) return "O cadastro de contas está desligado neste projeto.";
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet.";
  return "Não foi possível concluir. Tente de novo.";
}
