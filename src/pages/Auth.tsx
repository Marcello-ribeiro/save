import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Background } from "../components/Background";
import { HeroController } from "../components/Controller";
import { Logo } from "../components/Logo";
import { authErrorText, useAuth } from "../lib/auth";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Mode = "entrar" | "criar" | "esqueci" | "nova";
type From = { pathname: string; search?: string; state?: unknown };

const TITLES: Record<Mode, { title: string; sub: string; button: string }> = {
  entrar: { title: "Entrar", sub: "Acesse sua biblioteca de saves.", button: "Entrar" },
  criar: { title: "Criar conta", sub: "Guarde os saves dos seus jogos na nuvem.", button: "Criar conta" },
  esqueci: { title: "Esqueci a senha", sub: "Enviamos um link para você criar uma senha nova.", button: "Enviar link" },
  nova: { title: "Nova senha", sub: "Digite a senha que você quer usar daqui para frente.", button: "Salvar senha" }
};

export function AuthPage({ mode }: { mode: Mode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: From } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const goBack = () => navigate(from ? `${from.pathname}${from.search ?? ""}` : "/", { replace: true, state: from?.state ?? null });

  if (!loading && user && (mode === "entrar" || mode === "criar")) {
    return <Navigate to={from ? `${from.pathname}${from.search ?? ""}` : "/"} replace state={from?.state ?? null} />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!supabaseConfigured) {
      setError("O Supabase não está configurado. Preencha o arquivo .env.local.");
      return;
    }
    if ((mode === "criar" || mode === "nova") && password !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    if ((mode === "criar" || mode === "nova") && password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        goBack();
      } else if (mode === "criar") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/biblioteca` } });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) throw new Error("User already registered");
        if (data.session) goBack();
        else setDone(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail para ativar a conta e depois entre.`);
      } else if (mode === "esqueci") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-senha` });
        if (error) throw error;
        setDone("Se houver uma conta com este e-mail, você vai receber um link para criar uma senha nova.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate("/biblioteca", { replace: true });
      }
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  const t = TITLES[mode];
  const needsSession = mode === "nova" && !loading && !user;

  return (
    <div className="auth">
      <Background />
      <header className="auth-top">
        <Link to="/biblioteca" className="logo-link" aria-label="SaveVault, ir para a biblioteca">
          <Logo />
        </Link>
      </header>
      <main className="auth-main" id="conteudo">
        <section className="card auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="auth-title">
            {t.title}
          </h1>
          <p className="muted">{t.sub}</p>

          {needsSession ? (
            <p className="form-error">O link expirou ou já foi usado. Peça um novo em "Esqueci a senha".</p>
          ) : (
            <form className="auth-form" onSubmit={onSubmit} noValidate>
              {mode !== "nova" && (
                <label className="field">
                  <span className="field-label">E-mail</span>
                  <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>
              )}
              {mode !== "esqueci" && (
                <label className="field">
                  <span className="field-label">{mode === "nova" ? "Nova senha" : "Senha"}</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus={mode === "nova"}
                  />
                </label>
              )}
              {(mode === "criar" || mode === "nova") && (
                <label className="field">
                  <span className="field-label">Confirmar senha</span>
                  <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {done && (
                <p className="form-ok" role="status">
                  {done}
                </p>
              )}
              <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
                {busy ? "Aguarde…" : t.button}
              </button>
            </form>
          )}

          <div className="auth-links">
            {mode === "entrar" && (
              <>
                <Link to="/esqueci-a-senha" state={location.state}>
                  Esqueci a senha
                </Link>
                <span>
                  Não tem conta?{" "}
                  <Link to="/criar-conta" state={location.state}>
                    Criar conta
                  </Link>
                </span>
              </>
            )}
            {mode === "criar" && (
              <span>
                Já tem conta?{" "}
                <Link to="/entrar" state={location.state}>
                  Entrar
                </Link>
              </span>
            )}
            {(mode === "esqueci" || mode === "nova") && (
              <Link to="/entrar" state={location.state}>
                Voltar para entrar
              </Link>
            )}
          </div>
        </section>
        <div className="auth-art">
          <HeroController />
        </div>
      </main>
    </div>
  );
}
