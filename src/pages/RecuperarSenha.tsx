import { useState } from "react";
import { Link } from "react-router-dom";
import { enviarRecuperacaoSenha } from "../services/authService";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  async function enviar() {
    setErro("");
    setMsg("");

    setLoading(true);
    try {
      await enviarRecuperacaoSenha(email);
      setMsg("Enviamos um link de recuperação para seu email (se ele existir no sistema).");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <h1>Recuperar senha</h1>

      <input
        placeholder="Seu email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />

      {erro ? <p style={{ color: "crimson" }}>{erro}</p> : null}
      {msg ? <p style={{ color: "green" }}>{msg}</p> : null}

      <button
        onClick={enviar}
        disabled={loading}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #111",
          background: loading ? "#eee" : "#111",
          color: loading ? "#333" : "#fff",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Enviando..." : "Enviar link"}
      </button>

      <p style={{ marginTop: 10 }}>
        <Link to="/login">← Voltar para login</Link>
      </p>
    </div>
  );
}
