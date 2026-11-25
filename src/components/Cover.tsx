import { useState, type KeyboardEvent } from "react";

/** Capa vertical. Se a imagem não carregar, mostra o nome sobre um degradê. */
export function Cover({ src, name }: { src: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <span className="cover cover-fallback">
        <span>{name}</span>
      </span>
    );
  }
  return (
    <span className="cover">
      <img src={src} alt="" width={600} height={900} loading="lazy" decoding="async" onError={() => setFailed(src)} />
    </span>
  );
}

export function CoverSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="cover-grid" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="tile-skeleton">
          <div className="skeleton cover-skel" />
          <div className="skeleton line-skel" />
          <div className="skeleton line-skel short" />
        </div>
      ))}
    </div>
  );
}

/** Setas do teclado andam pela grade de capas. */
export function gridKeys(e: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-grid-item]"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const top = items[0].offsetTop;
  let cols = items.findIndex((el) => el.offsetTop !== top);
  if (cols <= 0) cols = items.length;
  const moves: Record<string, number> = {
    ArrowLeft: i - 1,
    ArrowRight: i + 1,
    ArrowUp: i - cols,
    ArrowDown: i + cols,
    Home: 0,
    End: items.length - 1
  };
  const next = moves[e.key];
  if (next < 0 || next >= items.length) return;
  e.preventDefault();
  items[next].focus();
}
