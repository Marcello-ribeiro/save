import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppearanceControls } from "../components/Appearance";
import { useAuth } from "../lib/auth";
import { usePrefs, type Section } from "../lib/prefs";
import { useToast } from "../lib/toast";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "biblioteca", label: "Biblioteca" },
  { value: "backups", label: "Backups" },
  { value: "sincronizacao", label: "Sincronização" },
  { value: "configuracoes", label: "Configurações" }
];

export function Settings() {
  const { prefs, setPrefs } = usePrefs();
  const { user, signOut } = useAuth();
  const [start, setStart] = useState<Section>(prefs.startSection);
  const toast = useToast();
  const navigate = useNavigate();

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1 className="page-title">Configurações</h1>
        <p className="page-sub">Aparência e conta. As preferências ficam salvas na sua conta.</p>
      </header>

      <section className="card card-pad settings-block" aria-labelledby="start-title">
        <h2 id="start-title" className="section-title">
          Seção inicial
        </h2>
        <p className="muted">Escolha qual seção abre primeiro.</p>
        <div className="radio-list" role="radiogroup" aria-labelledby="start-title">
          {SECTIONS.map((s) => (
            <label key={s.value} className={`radio ${start === s.value ? "on" : ""}`}>
              <input type="radio" name="start" value={s.value} checked={start === s.value} onChange={() => setStart(s.value)} />
              {s.label}
            </label>
          ))}
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={start === prefs.startSection}
            onClick={() => {
              setPrefs({ startSection: start });
              toast("Preferência salva");
            }}
          >
            Salvar preferência
          </button>
        </div>
      </section>

      <section className="card card-pad settings-block" aria-labelledby="look-title">
        <h2 id="look-title" className="section-title">
          Aparência
        </h2>
        <AppearanceControls />
      </section>

      <section className="card card-pad settings-block" aria-labelledby="account-title">
        <h2 id="account-title" className="section-title">
          Conta
        </h2>
        {user ? (
          <div className="account-row">
            <div>
              <p className="field-label">E-mail</p>
              <p className="muted">{user.email}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await signOut();
                navigate("/biblioteca");
              }}
            >
              Sair
            </button>
          </div>
        ) : (
          <div className="account-row">
            <p className="muted">Você não está em nenhuma conta. As preferências ficam só neste navegador.</p>
            <Link to="/entrar" className="btn btn-primary">
              Entrar
            </Link>
          </div>
        )}
      </section>

      <p className="muted settings-about">
        <Link to="/sobre">Sobre o SaveVault</Link>
      </p>
    </div>
  );
}
