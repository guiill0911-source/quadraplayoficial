import type { CSSProperties } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  } as CSSProperties,

  modal: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 24,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.25)",
  } as CSSProperties,

  hero: {
    padding: "20px 20px 18px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
    color: "#fff",
  } as CSSProperties,

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    marginBottom: 12,
  } as CSSProperties,

  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: -0.4,
  } as CSSProperties,

  body: {
    padding: 20,
  } as CSSProperties,

  message: {
    margin: 0,
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.65,
    whiteSpace: "pre-line",
  } as CSSProperties,

  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 20,
  } as CSSProperties,

  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 16px",
  } as CSSProperties,

  confirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    padding: "0 16px",
    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.22)",
  } as CSSProperties,
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.hero}>
          <div style={styles.badge}>CONFIRMAÇÃO</div>
          <h2 style={styles.title}>{title}</h2>
        </div>

        <div style={styles.body}>
          <p style={styles.message}>{message}</p>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelBtn}
              disabled={loading}
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              style={styles.confirmBtn}
              disabled={loading}
            >
              {loading ? "Carregando..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}