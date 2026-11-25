import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconAlert, IconExport, IconImport } from "../components/Icons";
import { LoginNeeded } from "../components/States";
import { useAuth } from "../lib/auth";
import { formatBytes, plural } from "../lib/format";
import { errorText } from "../lib/supabase";
import { useSync } from "../lib/sync";
import { useToast } from "../lib/toast";
import { exportLibrary, readArchive, runImport, type ImportPlan, type TransferProgress } from "../lib/transfer";

function Bar({ p }: { p: TransferProgress | null }) {
  if (!p) return null;
  const value = Math.round((p.done / Math.max(1, p.total)) * 100);
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span style={{ width: `${value}%` }} />
      </div>
      <p>
        {p.label} ({p.done} de {p.total})
      </p>
    </div>
  );
}

export function SyncPage() {
  const { user } = useAuth();
  const { track, state, detail } = useSync();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<TransferProgress | null>(null);
  const [exportError, setExportError] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<TransferProgress | null>(null);
  const [importError, setImportError] = useState("");
  const [importDone, setImportDone] = useState("");

  async function doExport() {
    setExporting(true);
    setExportError("");
    try {
      const r = await track("Exportando biblioteca", () => exportLibrary(setExportProgress));
      toast(`Biblioteca exportada: ${plural(r.games, "jogo", "jogos")}, ${formatBytes(r.bytes)}`);
    } catch (err) {
      setExportError(errorText(err));
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  // "Exportar biblioteca" na tela de Backups chega aqui
  useEffect(() => {
    if (user && (location.state as { autoExport?: boolean } | null)?.autoExport) {
      navigate(location.pathname, { replace: true, state: null });
      void doExport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const head = (
    <header className="page-head">
      <h1 className="page-title">Sincronização</h1>
      <p className="page-sub">Leve a sua biblioteca para outra conta ou guarde uma cópia no computador.</p>
    </header>
  );

  if (!user)
    return (
      <div className="page">
        {head}
        <LoginNeeded text="Entre na sua conta para exportar ou importar a biblioteca." />
      </div>
    );

  return (
    <div className="page narrow">
      {head}

      {state === "error" && (
        <p className="form-error sync-error" role="alert">
          <IconAlert /> Último envio com erro: {detail}
        </p>
      )}

      <section className="card card-pad transfer" aria-labelledby="transfer-title">
        <h2 id="transfer-title" className="section-title">
          Transferir biblioteca
        </h2>

        <div className="transfer-block">
          <div>
            <h3>Exportar biblioteca</h3>
            <p className="muted">Baixa um arquivo .savevault com os jogos, as capas enviadas por você e todos os backups, inclusive os da lixeira.</p>
            <p className="notice">O arquivo contém seus saves. Guarde-o em um local de confiança.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={doExport} disabled={exporting || importing}>
            <IconExport />
            {exporting ? "Exportando…" : "Exportar biblioteca"}
          </button>
          <Bar p={exportProgress} />
          {exportError && (
            <p className="form-error" role="alert">
              {exportError}
            </p>
          )}
        </div>

        <div className="transfer-block">
          <div>
            <h3>Importar biblioteca</h3>
            <p className="muted">Lê um arquivo .savevault e sobe tudo para esta conta. Backups iguais aos que você já tem são pulados.</p>
          </div>
          {!plan && (
            <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={reading || exporting}>
              <IconImport />
              {reading ? "Lendo arquivo…" : "Importar biblioteca"}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".savevault,application/zip"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setReading(true);
              setImportError("");
              setImportDone("");
              try {
                setPlan(await readArchive(file));
              } catch (err) {
                setImportError(errorText(err));
              } finally {
                setReading(false);
              }
            }}
          />

          {plan && (
            <div className="import-summary">
              <p className="field-label">Resumo de {plan.fileName}</p>
              <ul>
                <li>{plural(plan.newGames, "jogo novo", "jogos novos")}</li>
                <li>{plural(plan.matchedGames, "jogo que você já tem", "jogos que você já tem")}</li>
                <li>
                  {plural(plan.newBackups, "backup para enviar", "backups para enviar")}, {formatBytes(plan.bytes)}
                </li>
                <li>{plural(plan.duplicates, "backup duplicado, será pulado", "backups duplicados, serão pulados")}</li>
              </ul>
              <Bar p={importProgress} />
              <div className="add-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={importing || (plan.newGames === 0 && plan.newBackups === 0)}
                  onClick={async () => {
                    setImporting(true);
                    setImportError("");
                    try {
                      const r = await track("Importando biblioteca", () => runImport(plan, setImportProgress));
                      setImportDone(`Importação concluída: ${plural(r.games, "jogo novo", "jogos novos")} e ${plural(r.backups, "backup", "backups")}.`);
                      setPlan(null);
                    } catch (err) {
                      setImportError(`${errorText(err)} Nada foi importado.`);
                    } finally {
                      setImporting(false);
                      setImportProgress(null);
                    }
                  }}
                >
                  {importing ? "Importando…" : "Importar"}
                </button>
                <button type="button" className="btn btn-ghost" disabled={importing} onClick={() => setPlan(null)}>
                  Cancelar
                </button>
              </div>
              {plan.newGames === 0 && plan.newBackups === 0 && <p className="muted">Tudo neste arquivo já está na sua conta.</p>}
            </div>
          )}
          {importError && (
            <p className="form-error" role="alert">
              {importError}
            </p>
          )}
          {importDone && <p className="form-ok">{importDone}</p>}
        </div>
      </section>
    </div>
  );
}
