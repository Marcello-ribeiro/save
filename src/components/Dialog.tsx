import { useEffect, useRef, type ReactNode } from "react";

/** Janela do próprio site (usa <dialog>, que já prende o foco e fecha no Esc). */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <h2 id="dialog-title" className="dialog-title">
            {title}
          </h2>
          {children && <div className="dialog-text">{children}</div>}
          <div className="dialog-actions">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger solid" onClick={onConfirm} disabled={busy}>
            {busy ? "Apagando…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && <p className="form-error">{error}</p>}
    </Dialog>
  );
}
