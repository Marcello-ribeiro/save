import { useEffect, useMemo, useRef, useState } from "react";
import { searchCatalog, type CatalogGame } from "../lib/catalog";
import { Cover, gridKeys } from "./Cover";
import { IconChevron, IconClose, IconExternal, IconSearch } from "./Icons";
import { SavePaths } from "./SavePaths";

const PAGE = 24;

export function CatalogPanel({ onSelect }: { onSelect: (game: CatalogGame) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<CatalogGame | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchCatalog(query), [query]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE));
  const current = Math.min(page, pages - 1);
  const slice = results.slice(current * PAGE, current * PAGE + PAGE);

  useEffect(() => {
    if (picked) detailRef.current?.focus();
  }, [picked]);

  return (
    <section className={`card catalog ${open ? "open" : ""}`} aria-labelledby="catalog-title">
      <div className="catalog-bar">
        <span className="catalog-icon">
          <IconSearch />
        </span>
        <div className="catalog-bar-text">
          <h2 id="catalog-title">Encontrar jogos e saves</h2>
          <p className="muted">Pesquise um jogo e veja onde ficam os saves no Windows.</p>
        </div>
        <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="catalog-body" onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar catálogo" : "Abrir catálogo"}
          <IconChevron className={open ? "flip" : ""} />
        </button>
      </div>

      {open && (
        <div id="catalog-body" className="catalog-body">
          <div className="catalog-tools">
            <label className="search catalog-search">
              <span className="visually-hidden">Buscar no catálogo</span>
              <IconSearch />
              <input
                className="input"
                type="search"
                placeholder="Buscar no catálogo"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <p className="catalog-count muted" aria-live="polite">
              {results.length ? `${current * PAGE + 1}–${current * PAGE + slice.length} de ${results.length} jogos` : "Nenhum jogo encontrado."}
            </p>
          </div>

          {picked && (
            <div className="catalog-detail" ref={detailRef} tabIndex={-1} aria-label={`Detalhes de ${picked.name}`}>
              <div className="catalog-detail-cover">
                <Cover src={picked.cover} name={picked.name} />
              </div>
              <div className="catalog-detail-main">
                <div className="catalog-detail-head">
                  <h3>{picked.name}</h3>
                  <button type="button" className="icon-btn" aria-label="Fechar detalhes" onClick={() => setPicked(null)}>
                    <IconClose />
                  </button>
                </div>
                <p className="field-label">Pastas de saves</p>
                <SavePaths paths={picked.savePaths} />
                <div className="catalog-detail-actions">
                  <button type="button" className="btn btn-primary" onClick={() => onSelect(picked)}>
                    Selecionar {picked.name}
                  </button>
                  <a className="btn btn-ghost" href={picked.sourceUrl} target="_blank" rel="noreferrer">
                    Consultar fonte
                    <IconExternal />
                  </a>
                </div>
                <p className="credit">
                  Caminhos de saves:{" "}
                  <a href="https://www.pcgamingwiki.com" target="_blank" rel="noreferrer">
                    PCGamingWiki
                  </a>{" "}
                  (CC BY-NC-SA 3.0)
                </p>
              </div>
            </div>
          )}

          {slice.length > 0 && (
            <div className="cover-grid" onKeyDown={gridKeys} aria-label="Jogos do catálogo">
              {slice.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  data-grid-item
                  className={`tile ${picked?.id === g.id ? "picked" : ""}`}
                  onClick={() => setPicked(g)}
                  aria-pressed={picked?.id === g.id}
                >
                  <Cover src={g.cover} name={g.name} />
                  <span className="tile-name">{g.name}</span>
                </button>
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav className="pager" aria-label="Páginas do catálogo">
              <button type="button" className="btn btn-secondary btn-sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Anterior
              </button>
              <span className="muted">
                Página {current + 1} de {pages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Próxima
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
