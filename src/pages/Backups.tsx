import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/Dialog";
import { IconDownload, IconExport, IconRestore, IconSearch, IconTrash } from "../components/Icons";
import { EmptyState, ErrorState, ListSkeleton, LoginNeeded } from "../components/States";
import {
  TRASH_DAYS,
  deleteBackupsForever,
  downloadBackup,
  fetchBackups,
  fetchGames,
  isOldTrash,
  restoreBackup,
  trashBackup,
  useAccountData,
  type Backup
} from "../lib/data";
import { formatBytes, formatDate, formatTime, normalize, plural } from "../lib/format";
import { errorText } from "../lib/supabase";
import { useSync } from "../lib/sync";
import { useToast } from "../lib/toast";

type Row = Backup & { gameName: string };

async function load(): Promise<Row[]> {
  const [games, backups] = await Promise.all([fetchGames(), fetchBackups()]);
  const names = new Map(games.map((g) => [g.id, g.name]));
  return backups.map((b) => ({ ...b, gameName: names.get(b.game_id) ?? "Jogo removido" }));
}

type Confirm = { kind: "one"; row: Row } | { kind: "empty"; rows: Row[] } | null;

export function Backups() {
  const data = useAccountData(load);
  const [tab, setTab] = useState<"ativos" | "lixeira">("ativos");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const toast = useToast();
  const { track } = useSync();
  const navigate = useNavigate();

  const rows = useMemo(() => data.data ?? [], [data.data]);
  const active = rows.filter((r) => !r.deleted_at);
  const trash = rows.filter((r) => r.deleted_at);
  const oldTrash = trash.filter((r) => isOldTrash(r));
  const total = rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  const list = (tab === "ativos" ? active : trash).filter((r) => {
    const q = normalize(query);
    return !q || normalize(`${r.gameName} ${r.file_name} ${r.note ?? ""}`).includes(q);
  });

  async function act(row: Row, fn: () => Promise<unknown>, label: string, done: string) {
    setBusyId(row.id);
    try {
      await track(label, fn);
      toast(done);
      data.reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  const head = (
    <header className="page-head">
      <h1 className="page-title">Backups</h1>
      <p className="page-sub">Acesse e baixe os seus backups.</p>
    </header>
  );

  if (data.status === "idle")
    return (
      <div className="page">
        {head}
        <LoginNeeded text="Entre na sua conta para ver seus backups." />
      </div>
    );

  return (
    <div className="page">
      {head}

      <section className="card card-pad storage-card">
        <div>
          <h2 className="section-title">Guardado na sua conta</h2>
          {data.status === "ready" ? (
            <p className="muted">
              {formatBytes(total)} armazenados, incluindo a lixeira. Limite de 50 MB por arquivo.
            </p>
          ) : (
            <div className="skeleton line-skel" />
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/sincronizacao", { state: { autoExport: true } })}>
          <IconExport />
          Exportar biblioteca
        </button>
      </section>

      <div className="tabs-row">
        <div className="tabs" role="tablist" aria-label="Backups">
          <button type="button" role="tab" aria-selected={tab === "ativos"} className={tab === "ativos" ? "on" : ""} onClick={() => setTab("ativos")}>
            Ativos ({active.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "lixeira"} className={tab === "lixeira" ? "on" : ""} onClick={() => setTab("lixeira")}>
            Lixeira ({trash.length})
          </button>
        </div>
        <label className="search">
          <span className="visually-hidden">Buscar backups</span>
          <IconSearch />
          <input className="input" type="search" placeholder="Buscar por jogo ou nome" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {tab === "lixeira" && trash.length > 0 && (
        <div className="trash-bar">
          <p className="muted">
            Itens na lixeira há mais de {TRASH_DAYS} dias podem ser apagados de vez.{" "}
            {oldTrash.length ? `${plural(oldTrash.length, "item pode", "itens podem")} sair agora.` : "Nenhum passou desse prazo ainda."}
          </p>
          <button type="button" className="btn btn-danger btn-sm" disabled={!oldTrash.length} onClick={() => setConfirm({ kind: "empty", rows: oldTrash })}>
            <IconTrash />
            Esvaziar lixeira
          </button>
        </div>
      )}

      {data.status === "loading" && <ListSkeleton rows={5} />}
      {data.status === "error" && <ErrorState text={errorText(data.error, "Não foi possível carregar os backups.")} onRetry={data.reload} />}
      {data.status === "ready" && list.length === 0 && (
        <EmptyState title={query ? `Nenhum backup com "${query}".` : tab === "ativos" ? "Nenhum backup ativo." : "A lixeira está vazia."}>
          {tab === "ativos" && !query && (
            <Link to="/biblioteca" className="btn btn-secondary">
              Ir para a biblioteca
            </Link>
          )}
        </EmptyState>
      )}

      {data.status === "ready" && list.length > 0 && (
        <ul className="backup-list">
          {list.map((r) => (
            <li key={r.id} className="backup-row">
              <div className="backup-when">
                <span className="backup-date">{formatDate(r.created_at)}</span>
                <span className="muted">{formatTime(r.created_at)}</span>
              </div>
              <div className="backup-info">
                <Link to={`/jogo/${r.game_id}`} className="backup-game">
                  {r.gameName}
                </Link>
                <p className="backup-name">{r.file_name}</p>
                <p className="muted">
                  {formatBytes(r.size_bytes)}
                  {r.deleted_at ? `, na lixeira desde ${formatDate(r.deleted_at)}` : ""}
                </p>
                {r.note && <p className="backup-note">{r.note}</p>}
              </div>
              <div className="backup-actions">
                {tab === "ativos" ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === r.id}
                      onClick={async () => {
                        try {
                          await downloadBackup(r);
                        } catch (err) {
                          toast(errorText(err, "Não foi possível baixar."), "error");
                        }
                      }}
                    >
                      <IconDownload />
                      Baixar ZIP
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => act(r, () => trashBackup(r.id), "Movendo para a lixeira", "Backup movido para a lixeira")}>
                      <IconTrash />
                      Mover para a lixeira
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === r.id} onClick={() => act(r, () => restoreBackup(r.id), "Restaurando", "Backup restaurado")}>
                      <IconRestore />
                      Restaurar
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => setConfirm({ kind: "one", row: r })}>
                      <IconTrash />
                      Apagar de vez
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "empty" ? "Esvaziar lixeira?" : "Apagar backup de vez?"}
        confirmLabel={confirm?.kind === "empty" ? "Esvaziar lixeira" : "Apagar de vez"}
        busy={confirmBusy}
        error={confirmError}
        onClose={() => {
          setConfirm(null);
          setConfirmError("");
        }}
        onConfirm={async () => {
          if (!confirm) return;
          const targets = confirm.kind === "one" ? [confirm.row] : confirm.rows;
          setConfirmBusy(true);
          setConfirmError("");
          try {
            await track("Apagando backups", () => deleteBackupsForever(targets));
            toast(targets.length === 1 ? "Backup apagado" : `${targets.length} backups apagados`);
            setConfirm(null);
            data.reload();
          } catch (err) {
            setConfirmError(errorText(err));
          } finally {
            setConfirmBusy(false);
          }
        }}
      >
        {confirm?.kind === "one" ? (
          <p>
            O arquivo {confirm.row.file_name} de {confirm.row.gameName} será apagado da sua conta. Isso não pode ser desfeito.
          </p>
        ) : (
          <p>{plural(confirm?.kind === "empty" ? confirm.rows.length : 0, "backup", "backups")} na lixeira há mais de {TRASH_DAYS} dias serão apagados. Isso não pode ser desfeito.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
