import { pathsByStore, type SavePath } from "../lib/catalog";
import { copyText, useToast } from "../lib/toast";
import { IconCopy } from "./Icons";

export function SavePaths({ paths }: { paths: SavePath[] }) {
  const toast = useToast();
  if (!paths.length) return <p className="muted">Nenhuma pasta conhecida para Windows.</p>;
  return (
    <div className="save-paths">
      {pathsByStore(paths).map(([store, list]) => (
        <div key={store} className="save-store">
          <p className="save-store-name">{store}</p>
          {list.map((path) => (
            <div key={path} className="save-path">
              <code>{path}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => toast((await copyText(path)) ? "Caminho copiado" : "Não foi possível copiar", "ok")}
              >
                <IconCopy />
                Copiar caminho
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
