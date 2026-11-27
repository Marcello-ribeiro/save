import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSync } from "../lib/sync";
import { Background } from "./Background";
import { ThemeButton } from "./Appearance";
import { Logo } from "./Logo";
import { IconAlert, IconBackups, IconCheck, IconLibrary, IconRail, IconSettings, IconSync } from "./Icons";

const RAIL_KEY = "savevault:rail";

const NAV = [
  { to: "/biblioteca", label: "Biblioteca", Icon: IconLibrary, also: ["/jogo/"] },
  { to: "/backups", label: "Backups", Icon: IconBackups, also: [] },
  { to: "/sincronizacao", label: "Sincronização", Icon: IconSync, also: [] },
  { to: "/configuracoes", label: "Configurações", Icon: IconSettings, also: [] }
];

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === "open";
  } catch {
    return false;
  }
}

function LogoWithSync() {
  const { state } = useSync();
  return <Logo busy={state === "busy"} />;
}

function SyncBadge() {
  const { state, detail } = useSync();
  const text = state === "busy" ? "Enviando…" : state === "error" ? "Erro" : "Sincronizado";
  return (
    <Link to="/sincronizacao" className={`sync-badge ${state}`} title={detail || text} aria-label={`Sincronização: ${detail || text}`}>
      {state === "busy" ? <span className="sync-spinner" /> : state === "error" ? <IconAlert /> : <IconCheck />}
      <span>{text}</span>
    </Link>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const email = user.email ?? "";
  return (
    <div className="account" ref={wrap}>
      <button type="button" className="avatar" aria-label="Conta" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {email.slice(0, 1).toUpperCase() || "?"}
      </button>
      {open && (
        <div className="menu account-menu" role="menu">
          <p className="account-email" title={email}>
            {email}
          </p>
          <Link role="menuitem" to="/configuracoes" onClick={() => setOpen(false)}>
            Configurações
          </Link>
          <Link role="menuitem" to="/sobre" onClick={() => setOpen(false)}>
            Sobre
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate("/biblioteca");
            }}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const { user, loading } = useAuth();
  const [railOpen, setRailOpen] = useState(readRail);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const toggleRail = () => {
    setRailOpen((v) => {
      try {
        localStorage.setItem(RAIL_KEY, v ? "closed" : "open");
      } catch {
        /* ok */
      }
      return !v;
    });
  };

  return (
    <div className={`app ${railOpen ? "rail-open" : ""}`}>
      <Background />
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="icon-btn rail-toggle" onClick={toggleRail} aria-label={railOpen ? "Recolher menu" : "Expandir menu"} aria-expanded={railOpen}>
            <IconRail />
          </button>
          <Link to="/biblioteca" className="logo-link" aria-label="SaveVault, ir para a biblioteca">
            <LogoWithSync />
          </Link>
        </div>
        <div className="topbar-right">
          {user && <SyncBadge />}
          <ThemeButton />
          {user ? (
            <AccountMenu />
          ) : (
            !loading && (
              <Link to="/entrar" state={{ from: location }} className="btn btn-secondary btn-sm">
                Entrar
              </Link>
            )
          )}
        </div>
      </header>

      <nav className="rail" aria-label="Seções">
        {NAV.map(({ to, label, Icon, also }) => {
          const extra = also.some((p) => location.pathname.startsWith(p));
          return (
            <NavLink key={to} to={to} className={({ isActive }) => `rail-item ${isActive || extra ? "active" : ""}`} title={railOpen ? undefined : label}>
              <Icon />
              <span className="rail-label">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <main className="main" id="conteudo">
        <Outlet />
      </main>

      <span className="version">v{__APP_VERSION__}</span>
    </div>
  );
}
