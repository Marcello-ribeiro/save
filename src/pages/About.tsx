import { catalog } from "../lib/catalog";

export function About() {
  return (
    <div className="page narrow">
      <header className="page-head">
        <h1 className="page-title">Sobre</h1>
        <p className="page-sub">O SaveVault guarda cópias em ZIP dos saves dos seus jogos de PC, separadas por jogo.</p>
      </header>

      <section className="card card-pad prose">
        <h2 className="section-title">Como funciona</h2>
        <p>
          Você escolhe a pasta de saves de um jogo, o navegador cria um ZIP dela e envia para a sua conta. Os arquivos ficam em um Storage privado: só você tem acesso. Para
          restaurar, baixe o ZIP e extraia na mesma pasta.
        </p>
        <p>O catálogo tem {catalog.length} jogos populares de PC, com a capa e as pastas onde cada um guarda os saves no Windows.</p>

        <h2 className="section-title">Créditos</h2>
        <ul>
          <li>
            Caminhos de saves:{" "}
            <a href="https://www.pcgamingwiki.com" target="_blank" rel="noreferrer">
              PCGamingWiki
            </a>
            , sob a licença{" "}
            <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">
              CC BY-NC-SA 3.0
            </a>
            , organizados pelo{" "}
            <a href="https://github.com/mtkennerly/ludusavi-manifest" target="_blank" rel="noreferrer">
              manifesto do Ludusavi
            </a>
            .
          </li>
          <li>Capas: arte dos próprios jogos, servida pela CDN da Steam.</li>
          <li>ZIP no navegador: JSZip. Conta, banco e arquivos: Supabase.</li>
        </ul>
        <p className="muted">Versão {__APP_VERSION__}</p>
      </section>
    </div>
  );
}
