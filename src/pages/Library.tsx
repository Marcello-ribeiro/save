import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AddGameForm } from "../components/AddGameForm";
import { CatalogPanel } from "../components/CatalogPanel";
import { HeroController } from "../components/Controller";
import { Cover, CoverSkeleton, gridKeys } from "../components/Cover";
import { IconPlus, IconSearch } from "../components/Icons";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../lib/auth";
import { catalogById, type CatalogGame } from "../lib/catalog";
import { fetchLibrary, useAccountData } from "../lib/data";
import { formatShortDate, normalize, plural } from "../lib/format";
import { errorText } from "../lib/supabase";

type AddState = { open: boolean; initial: CatalogGame | null };
type ReturnState = { addGame?: boolean; catalogId?: string | null } | null;

export function Library() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const library = useAccountData(fetchLibrary);
  const [query, setQuery] = useState("");
  const [add, setAdd] = useState<AddState>({ open: false, initial: null });

  // volta do login com o cadastro aberto
  useEffect(() => {
    const st = location.state as ReturnState;
    if (user && st?.addGame) {
      setAdd({ open: true, initial: catalogById(st.catalogId) });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [user, location, navigate]);

  const openAdd = (initial: CatalogGame | null) => {
    if (!user) {
      navigate("/entrar", { state: { from: { pathname: "/biblioteca", state: { addGame: true, catalogId: initial?.id ?? null } } } });
      return;
    }
    setAdd({ open: true, initial });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const games = library.data ?? [];
  const shown = useMemo(() => {
    const q = normalize(query);
    return q ? games.filter((g) => normalize(g.name).includes(q)) : games;
  }, [games, query]);

  const form = add.open ? (
    <AddGameForm
      key={add.initial?.id ?? "manual"}
      initial={add.initial}
      onClose={() => setAdd({ open: false, initial: null })}
      onDone={() => {
        setAdd({ open: false, initial: null });
        library.reload();
      }}
    />
  ) : null;

  const hasGames = library.status === "ready" && games.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          Meus <em>Jogos</em>
        </h1>
        <p className="page-sub">Organize seus jogos e guarde backups dos seus saves.</p>
      </header>

      {library.status === "loading" && <CoverSkeleton />}
      {library.status === "error" && <ErrorState text={errorText(library.error, "Não foi possível carregar a biblioteca.")} onRetry={library.reload} />}

      {(library.status === "idle" || (library.status === "ready" && !hasGames)) &&
        (form ?? (
          <section className="card hero-card">
            <div className="hero-copy">
              <h2>Cadastre seu primeiro jogo</h2>
              <p className="muted">Escolha um jogo, selecione a pasta de saves e guarde uma cópia em ZIP na sua conta.</p>
              <button type="button" className="btn btn-primary" onClick={() => openAdd(null)}>
                <IconPlus />
                Cadastrar primeiro jogo
              </button>
            </div>
            <div className="hero-art">
              <HeroController />
            </div>
          </section>
        ))}

      {hasGames && (
        <>
          {form}
          <section className="library" aria-label="Jogos cadastrados">
            <div className="library-tools">
              <label className="search">
                <span className="visually-hidden">Buscar na biblioteca</span>
                <IconSearch />
                <input className="input" type="search" placeholder="Buscar por nome" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              {!add.open && (
                <button type="button" className="btn btn-primary" onClick={() => openAdd(null)}>
                  <IconPlus />
                  Cadastrar jogo
                </button>
              )}
            </div>
            {shown.length === 0 ? (
              <EmptyState title={`Nenhum jogo com "${query}".`} />
            ) : (
              <div className="cover-grid" onKeyDown={gridKeys}>
                {shown.map((g) => (
                  <Link key={g.id} to={`/jogo/${g.id}`} className="tile" data-grid-item>
                    <Cover src={g.coverSrc} name={g.name} />
                    <span className="tile-name">{g.name}</span>
                    <span className="tile-meta">{g.activeCount ? plural(g.activeCount, "backup", "backups") : "Sem backup"}</span>
                    {g.lastBackupAt && <span className="tile-meta">Último em {formatShortDate(g.lastBackupAt)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <CatalogPanel onSelect={(g) => openAdd(g)} />
    </div>
  );
}
