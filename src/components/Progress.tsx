import { formatBytes, plural } from "../lib/format";
import { progressText, progressValue, type Folder, type Progress } from "../lib/folder";
import { IconFolder } from "./Icons";

export function ProgressBar({ progress }: { progress: Progress | null }) {
  if (!progress) return null;
  const value = Math.round(progressValue(progress));
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span style={{ width: `${value}%` }} />
      </div>
      <p>{progressText(progress)}</p>
    </div>
  );
}

export function FolderSummary({ folder }: { folder: Folder }) {
  return (
    <div className="folder-summary">
      <IconFolder />
      <div>
        <p className="folder-name">{folder.name}</p>
        <p className="muted">
          {plural(folder.files.length, "arquivo", "arquivos")}, {formatBytes(folder.bytes)} no total
        </p>
      </div>
    </div>
  );
}
