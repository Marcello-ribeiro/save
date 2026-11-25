import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { IconBack, IconDownload, IconEdit, IconFolder, IconTrash, IconUpload } from "../components/Icons";
import { FolderSummary, ProgressBar } from "../components/Progress";
import { SavePaths } from "../components/SavePaths";
import { EmptyState, ErrorState, ListSkeleton, LoginNeeded } from "../components/States";
import { catalogById, catalogByName } from "../lib/catalog";
import {
  createBackup,
  deleteGame,
  downloadBackup,
  editBackup,
  resolveCovers,
  trashBackup,
  updateGame,
  useAccountData,
  type Backup,
  type CoverChoice,
  type Game
} from "../lib/data";
import { checkFolder, pickFolder, type Folder, type Progress } from "../lib/folder";
import { formatBytes, formatDate, formatTime, plural } from "../lib/format";
import { errorText, supabase } from "../lib/supabase";
import { useSync } from "../lib/sync";
import { useToast } from "../lib/toast";

async function loadGame(id: string) {
  const [{ data: game, error }, { data: backups, error: bError }] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("backups").select("*").eq("game_id", id).is("deleted_at", null).order("created_at", { ascending: false })
  ]);
  if (error) throw error;
  if (bError) throw bError;
  if (!game) return null;
  const covers = await resolveCovers([game as Game]);
  return { game: game as Game, coverSrc: covers.get(game.id) ?? null, backups: (backups ?? []) as Backup[] };
}

export function GamePage() {
  const { id = "" } = useParams();
  const page = useAccountData(() => loadGame(id), [id]);
  const navigate = useNavigate();
  const toast = useToast();
  const { track } = useSync();

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [renaming, setRenaming] = useState<Backup | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  if (page.status === "idle") return <LoginNeeded text="Entre na sua conta para ver este jogo." />;
  if (page.status === "loading")
    return (
      <div className="page">
        <div className="game-head">
          <div className="skeleton game-cover-skel" />
          <div className="game-head-text">
            <div className="skeleton line-skel" />
          </div>
        </div>
        <ListSkeleton />
      </div>
    );
  if (page.status === "error") return <ErrorState text={errorText(page.error, "Não foi possível carregar o jogo.")} onRetry={page.reload} />;
  if (!page.data)
    return (
      <EmptyState title="Jogo não encontrado.">
        <Link to="/biblioteca" className="btn btn-secondary">
          Voltar para a biblioteca
        </Link>
      </EmptyState>
    );

  const { game, coverSrc, backups } = page.data;
  const catalog = catalogById(game.catalog_id) ?? catalogByName(game.name);
  const total = backups.reduce((s, b) => s + (b.size_bytes ?? 0), 0);

  async function onDownload(b: Backup) {
    setRowBusy(b.id);
    try {
      await downloadBackup(b);
    } catch (err) {
      toast(errorText(err, "Não foi possível baixar o backup."), "error");
    } finally {
      setRowBusy(null);
    }
  }

  async function onTrash(b: Backup) {
    setRowBusy(b.id);
    try {
      await track("Movendo para a lixeira", () => trashBackup(b.id));
      toast("Backup movido para a lixeira");
      page.reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="page">
      <Link to="/biblioteca" className="back-link">
        <IconBack />
        Biblioteca
      </Link>

      <header className="game-head">
        <div className="game-cover">
          <Cover src={coverSrc} name={game.name} />
        </div>
        <div className="game-head-text">
          <h1 className="page-title game-title">{game.name}</h1>
          <p className="muted">
            {backups.length ? `${plural(backups.length, "backup ativo", "backups ativos")}, ${formatBytes(total)}` : "Nenhum backup ativo."}
          </p>
          <div className="game-actions">
            <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
              <IconUpload />
              Novo backup
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <IconEdit />
              Editar jogo
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <IconTrash />
              Excluir jogo
            </button>
          </div>
        </div>
      </header>

      {newOpen && (
        <NewBackup
          game={game}
          onClose={() => setNewOpen(false)}
          onDone={() => {
            setNewOpen(false);
            page.reload();
          }}
        />
      )}

      <section aria-labelledby="backups-title" className="game-section">
        <h2 id="backups-title" className="section-title">
          Backups
        </h2>
        {backups.length === 0 ? (
          <EmptyState title="Nenhum backup ativo.">
            <p className="muted">Crie um backup selecionando a pasta de saves do jogo.</p>
          </EmptyState>
        ) : (
          <ul className="backup-list">
            {backups.map((b) => (
              <li key={b.id} className="backup-row">
                <div className="backup-when">
                  <span className="backup-date">{formatDate(b.created_at)}</span>
                  <span className="muted">{formatTime(b.created_at)}</span>
                </div>
                <div className="backup-info">
                  <p className="backup-name">{b.file_name}</p>
                  <p className="muted">
                    {formatBytes(b.size_bytes)}
                    {b.file_count ? `, ${plural(b.file_count, "arquivo", "arquivos")}` : ""}
                  </p>
                  {b.note && <p className="backup-note">{b.note}</p>}
                </div>
                <div className="backup-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDownload(b)} disabled={rowBusy === b.id}>
                    <IconDownload />
                    Baixar ZIP
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(b)} disabled={rowBusy === b.id}>
                    <IconEdit />
                    Renomear
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTrash(b)} disabled={rowBusy === b.id}>
                    <IconTrash />
                    Mover para a lixeira
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {catalog && (
        <section className="game-section" aria-labelledby="paths-title">
          <h2 id="paths-title" className="section-title">
            Saves no Windows
          </h2>
          <div className="card card-pad">
            <SavePaths paths={catalog.savePaths} />
            <p className="credit">
              Caminhos de saves:{" "}
              <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">
                PCGamingWiki
              </a>
            </p>
          </div>
        </section>
      )}

      {renaming && (
        <RenameDialog
          backup={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => {
            setRenaming(null);
            toast("Backup atualizado");
            page.reload();
          }}
        />
      )}

      {editing && (
        <EditGameDialog
          game={game}
          coverSrc={coverSrc}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            toast("Jogo atualizado");
            page.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir ${game.name}?`}
        confirmLabel="Excluir jogo"
        busy={deleting}
        error={deleteError}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteError("");
        }}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError("");
          try {
            await track("Excluindo jogo", () => deleteGame(game));
            toast("Jogo excluído");
            navigate("/biblioteca");
          } catch (err) {
            setDeleteError(errorText(err));
          } finally {
            setDeleting(false);
          }
        }}
      >
        <p>O jogo, a capa e todos os backups dele, inclusive os da lixeira, serão apagados. Isso não pode ser desfeito.</p>
      </ConfirmDialog>
    </div>
  );
}

function NewBackup({ game, onClose, onDone }: { game: Game; onClose: () => void; onDone: () => void }) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { track } = useSync();
  const toast = useToast();

  async function choose() {
    setError("");
    try {
      const picked = await pickFolder();
      if (!picked) return;
      checkFolder(picked);
      setFolder(picked);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function send() {
    if (!folder) return;
    setBusy(true);
    setError("");
    try {
      await track("Enviando backup", () => createBackup(game, folder, note, setProgress));
      toast("Backup criado");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad new-backup" aria-label="Novo backup">
      <h2 className="section-title">Novo backup</h2>
      {folder ? <FolderSummary folder={folder} /> : <p className="muted">Selecione a pasta de saves. O SaveVault cria um ZIP dela e guarda na sua conta.</p>}
      <label className="field">
        <span className="field-label">Observação</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: antes do chefe final" maxLength={200} disabled={busy} />
      </label>
      <ProgressBar progress={progress} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="add-actions">
        {folder ? (
          <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
            Criar ZIP e enviar
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={choose} disabled={busy}>
            <IconFolder />
            Selecionar pasta
          </button>
        )}
        {folder && (
          <button type="button" className="btn btn-secondary" onClick={choose} disabled={busy}>
            Trocar pasta
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

function RenameDialog({ backup, onClose, onDone }: { backup: Backup; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(backup.file_name);
  const [note, setNote] = useState(backup.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await editBackup(backup.id, { file_name: name, note });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title="Renomear backup"
      onClose={() => !busy && onClose()}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span className="field-label">Nome do arquivo</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={140} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Observação</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Dialog>
  );
}

function EditGameDialog({ game, coverSrc, onClose, onDone }: { game: Game; coverSrc: string | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(game.name);
  const [file, setFile] = useState<File | null>(null);
  const [useCatalog, setUseCatalog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const catalog = catalogById(game.catalog_id) ?? catalogByName(name);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const { track } = useSync();

  const shown = preview ?? (useCatalog ? catalog?.cover : coverSrc) ?? null;

  const save = async () => {
    setBusy(true);
    setError("");
    const cover: CoverChoice | null = file ? { kind: "upload", file } : useCatalog && catalog?.cover ? { kind: "catalog", url: catalog.cover } : null;
    try {
      await track("Salvando jogo", () => updateGame(game, { name, cover }));
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title="Editar jogo"
      onClose={() => !busy && onClose()}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <form
        className="dialog-form edit-game"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="edit-cover">
          <Cover src={shown} name={name || game.name} />
        </div>
        <div className="edit-fields">
          <label className="field">
            <span className="field-label">Nome do jogo</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </label>
          <div className="field">
            <span className="field-label">Capa</span>
            <div className="edit-cover-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
                <IconUpload />
                Enviar imagem
              </button>
              {catalog?.cover && game.cover_url !== catalog.cover && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFile(null);
                    setUseCatalog(true);
                  }}
                  disabled={busy}
                >
                  Usar capa do catálogo
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setUseCatalog(false);
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {error && <p className="form-error edit-error">{error}</p>}
      </form>
    </Dialog>
  );
}
