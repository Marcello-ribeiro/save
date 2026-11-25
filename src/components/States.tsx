import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconAlert } from "./Icons";

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="card card-pad state state-error" role="alert">
      <IconAlert />
      <p>{text}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card card-pad state">
      <p className="state-title">{title}</p>
      {children}
    </div>
  );
}

export function LoginNeeded({ text }: { text: string }) {
  const location = useLocation();
  return (
    <div className="card card-pad state">
      <p className="state-title">{text}</p>
      <div className="state-actions">
        <Link className="btn btn-primary" to="/entrar" state={{ from: location }}>
          Entrar
        </Link>
        <Link className="btn btn-secondary" to="/criar-conta" state={{ from: location }}>
          Criar conta
        </Link>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list-skeleton" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton row-skel" />
      ))}
    </div>
  );
}
