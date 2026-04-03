import { useNavigate } from "react-router-dom";

export default function EmailVerificado() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h1 style={{ marginBottom: 16 }}>✅ Email verificado</h1>

        <p style={{ marginBottom: 24, color: "#64748b" }}>
          Sua conta foi confirmada com sucesso. Agora você já pode usar o
          Quadra Play normalmente.
        </p>

        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Ir para o aplicativo
        </button>
      </div>
    </div>
  );
}