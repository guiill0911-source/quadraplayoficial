import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginComEmail } from "../services/authService";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar() {
    setErro("");
    if (!email.trim() || !senha) {
      setErro("Preencha email e senha.");
      return;
    }
    setLoading(true);
    try {
      await loginComEmail(email.trim(), senha);
      nav("/");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <h1>Entrar</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />
      <input
        placeholder="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />

      {erro ? <p style={{ color: "crimson" }}>{erro}</p> : null}

      <button
        onClick={entrar}
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
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p style={{ marginTop: 10 }}>
        Não tem conta? <Link to="/cadastro">Criar agora</Link>
      </p>

      <p style={{ marginTop: 6 }}>
        Esqueceu a senha? <Link to="/recuperar-senha">Recuperar</Link>
      </p>
    </div>
  );
}
