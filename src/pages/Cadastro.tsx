import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cadastrarComEmail, type UserRole } from "../services/authService";

export default function Cadastro() {
  const nav = useNavigate();

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [role, setRole] = useState<UserRole>("atleta");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function criar() {
    setErro("");

    if (!nome.trim() || !sobrenome.trim() || !email.trim() || !senha) {
      setErro("Preencha nome, sobrenome, email e senha.");
      return;
    }

    setLoading(true);
    try {
      await cadastrarComEmail({
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        cpf: cpf.trim() ? cpf.trim() : undefined,
        role,
        email: email.trim(),
        senha,
      });
      nav("/");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1>Criar conta</h1>

      <input
        placeholder="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />

      <input
        placeholder="Sobrenome"
        value={sobrenome}
        onChange={(e) => setSobrenome(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />

      <input
        placeholder="CPF (opcional no MVP)"
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 8 }}
      />

      <label style={{ display: "block", marginTop: 10 }}>
        Perfil:
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          style={{ marginLeft: 10, padding: 8 }}
        >
          <option value="atleta">Atleta</option>
          <option value="dono">Dono</option>
        </select>
      </label>

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
        onClick={criar}
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
        {loading ? "Criando..." : "Criar conta"}
      </button>

      <p style={{ marginTop: 10 }}>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
