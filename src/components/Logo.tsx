/** Cofre estilizado: porta arredondada com o disco do segredo. */
export function VaultMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2.5" y="3.5" width="27" height="25" rx="7" fill="var(--surface-3)" />
      <rect x="2.5" y="3.5" width="27" height="25" rx="7" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="6.6" fill="none" stroke="var(--text)" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.1" fill="var(--accent)" />
      <path d="M16 9.4v2.4M16 20.2v2.4M9.4 16h2.4M20.2 16h2.4" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 11v3M6.5 18v3" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <VaultMark className="logo-mark" />
      <span className="logo-word">
        Save<span>Vault</span>
      </span>
    </span>
  );
}
