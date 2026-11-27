/**
 * Marca "salvando…": o círculo quebrado que os jogos mostram no canto da tela
 * enquanto salvam, com uma seta para dentro. Usa só a cor de destaque
 * (currentColor), então acompanha o tema e a cor escolhidos em Configurações.
 */
export function SaveMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle
        className="logo-ring"
        cx="16"
        cy="16"
        r="11.5"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeDasharray="19.6 4.48"
      />
      <path d="M12 13.2h8L16 19.6z" fill="currentColor" />
    </svg>
  );
}

/** `busy` faz o anel girar, como o aviso de "salvando" de um jogo. */
export function Logo({ busy = false }: { busy?: boolean }) {
  return (
    <span className={`logo${busy ? " is-busy" : ""}`}>
      <SaveMark className="logo-mark" />
      <span className="logo-word">
        save<span>vault</span>
      </span>
    </span>
  );
}
