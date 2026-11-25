import { useEffect, useMemo, useRef, useState } from "react";
import { catalogByName, type CatalogGame } from "../lib/catalog";
import { createGame, type CoverChoice } from "../lib/data";
import { checkFolder, pickFolder, type Folder, type Progress } from "../lib/folder";
import { errorText } from "../lib/supabase";
import { useSync } from "../lib/sync";
import { useToast } from "../lib/toast";
import { Cover } from "./Cover";
import { IconCheck, IconClose, IconFolder, IconUpload } from "./Icons";
import { FolderSummary, ProgressBar } from "./Progress";
import { SavePaths } from "./SavePaths";

export function AddGameForm({ initial, onClose, onDone }: { initial: CatalogGame | null; onClose: () => void; onDone: (gameId: string) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [coverPick, setCoverPick] = useState<"catalog" | "upload" | "none">(initial?.cover ? "catalog" : "none");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const { track } = useSync();
  const toast = useToast();

  // o jogo do catálogo vem da seleção ou do nome digitado
  const match = useMemo(() => (initial && initial.name === name ? initial : catalogByName(name)), [initial, name]);
  const preview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  useEffect(() => {
    if (coverPick === "catalog" && !match?.cover) setCoverPick(coverFile ? "upload" : "none");
    if (coverPick === "none" && match?.cover && !coverFile) setCoverPick("catalog");
  }, [match, coverPick, coverFile]);

  const cover: CoverChoice =
    coverPick === "catalog" && match?.cover ? { kind: "catalog", url: match.cover } : coverPick === "upload" && coverFile ? { kind: "upload", file: coverFile } : { kind: "none" };

  async function choose(): Promise<Folder | null> {
    setError("");
    try {
      const picked = await pickFolder();
      if (!picked) return null;
      checkFolder(picked);
      setFolder(picked);
      return picked;
    } catch (err) {
      setError(errorText(err));
      return null;
    }
  }

  async function submit(withFolder: Folder | null) {
    setError("");
    if (!name.trim()) {
      setError("Digite o nome do jogo.");
      nameInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const game = await track(withFolder ? "Enviando backup" : "Cadastrando jogo", () =>
        createGame({ name, catalog: match, cover, folder: withFolder }, setProgress)
      );
      toast(withFolder ? "Jogo cadastrado com o primeiro backup" : "Jogo cadastrado");
      onDone(game.id);
    } catch (err) {
      setError(errorText(err));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad add-form" aria-labelledby="add-title">
      <div className="add-head">
        <h2 id="add-title" className="section-title">
          Cadastrar jogo
        </h2>
        <button type="button" className="icon-btn" aria-label="Fechar cadastro" onClick={onClose} disabled={busy}>
          <IconClose />
        </button>
      </div>

      <form
        className="add-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(folder);
        }}
      >
        <label className="field">
          <span className="field-label">Nome do jogo</span>
          <input ref={nameInput} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Stardew Valley" disabled={busy} maxLength={120} />
          {match && match !== initial && <span className="field-hint">Encontrado no catálogo.</span>}
        </label>

        <fieldset className="field cover-field" disabled={busy}>
          <legend className="field-label">Capa</legend>
          <div className="cover-options">
            {match?.cover && (
              <button type="button" className={`cover-option ${coverPick === "catalog" ? "on" : ""}`} aria-pressed={coverPick === "catalog"} onClick={() => setCoverPick("catalog")}>
                <Cover src={match.cover} name={match.name} />
                <span>Capa do catálogo</span>
              </button>
            )}
            {preview && (
              <button type="button" className={`cover-option ${coverPick === "upload" ? "on" : ""}`} aria-pressed={coverPick === "upload"} onClick={() => setCoverPick("upload")}>
                <span className="cover">
                  <img src={preview} alt="" width={600} height={900} />
                </span>
                <span>Sua capa</span>
              </button>
            )}
            <button type="button" className="cover-option add" onClick={() => fileInput.current?.click()}>
              <span className="cover cover-add">
                <IconUpload />
              </span>
              <span>{preview ? "Trocar capa" : "Adicionar capa"}</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCoverFile(file);
                  setCoverPick("upload");
                }
                e.target.value = "";
              }}
            />
          </div>
        </fieldset>

        {match && (
          <div className="field">
            <p className="field-label">Saves no Windows</p>
            <SavePaths paths={match.savePaths} />
            <p className="field-hint">Escolha a pasta que tem os arquivos do save, não a pasta onde o jogo está instalado.</p>
          </div>
        )}

        {folder && !busy && (
          <div className="field">
            <p className="field-label">Pasta verificada</p>
            <FolderSummary folder={folder} />
          </div>
        )}

        <ProgressBar progress={progress} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="add-actions">
          {folder ? (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <IconCheck />
              Criar ZIP e cadastrar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                const picked = await choose();
                if (picked) await submit(picked);
              }}
            >
              <IconFolder />
              Selecionar pasta e criar ZIP
            </button>
          )}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void choose()}>
            {folder ? "Trocar pasta" : "Verificar pasta de saves"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void submit(null)}>
            Cadastrar sem pasta
          </button>
        </div>
      </form>
    </section>
  );
}
