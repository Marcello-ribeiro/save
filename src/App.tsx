import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { EmptyState } from "./components/States";
import { SECTION_PATHS, usePrefs } from "./lib/prefs";
import { About } from "./pages/About";
import { AuthPage } from "./pages/Auth";
import { Backups } from "./pages/Backups";
import { GamePage } from "./pages/Game";
import { Library } from "./pages/Library";
import { Settings } from "./pages/Settings";
import { SyncPage } from "./pages/Sync";

function Start() {
  const { prefs } = usePrefs();
  return <Navigate to={SECTION_PATHS[prefs.startSection]} replace />;
}

function NotFound() {
  return (
    <EmptyState title="Página não encontrada.">
      <Link to="/biblioteca" className="btn btn-secondary">
        Ir para a biblioteca
      </Link>
    </EmptyState>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Start />} />
        <Route path="biblioteca" element={<Library />} />
        <Route path="jogo/:id" element={<GamePage />} />
        <Route path="backups" element={<Backups />} />
        <Route path="sincronizacao" element={<SyncPage />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="sobre" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="entrar" element={<AuthPage mode="entrar" />} />
      <Route path="criar-conta" element={<AuthPage mode="criar" />} />
      <Route path="esqueci-a-senha" element={<AuthPage mode="esqueci" />} />
      <Route path="nova-senha" element={<AuthPage mode="nova" />} />
    </Routes>
  );
}
