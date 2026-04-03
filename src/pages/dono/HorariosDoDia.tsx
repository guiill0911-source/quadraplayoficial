import { Link, useParams } from "react-router-dom";
import type { CSSProperties } from "react";
import Header from "../../components/Header";
import { db } from "../../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #0f172a 0px, #111827 190px, #f8fafc 190px, #f8fafc 100%)",
  },
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "18px 16px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #111827, #1e293b)",
    color: "#fff",
    borderRadius: 24,
    padding: "26px 24px",
    boxShadow: "0 18px 45px rgba(15,23,42,0.20)",
    marginTop: 12,
  },
  heroBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 12,
  },
  heroTitle: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 12,
    marginBottom: 0,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  card: {
    marginTop: 18,
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
    fontWeight: 900,
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
  topActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  neutralBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  infoBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  ocupacaoBaixa: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#c2410c",
    fontWeight: 800,
    fontSize: 13,
    display: "inline-flex",
  },
  ocupacaoAlta: {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontWeight: 800,
  fontSize: 13,
  display: "inline-flex",
},

ocupacaoMedia: {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontWeight: 800,
  fontSize: 13,
  display: "inline-flex",
},
};

export default function HorariosDoDia() {
        const mostrarAlta = false;
  const mostrarMedia = false;
  const mostrarBaixa = true;
  const { id, data } = useParams<{ id: string; data: string }>();
    const [horarios, setHorarios] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(true);
    const [esporteFiltro, setEsporteFiltro] = useState("todos");
      const esportesDisponiveis = Array.from(
    new Set(
      horarios
        .map((h) => String(h.esporte ?? "").trim())
        .filter(Boolean)
    )
  ).sort();

    useEffect(() => {
    async function carregarHorariosDoDia() {
      if (!id || !data) {
        setHorarios([]);
        setLoadingHorarios(false);
        return;
      }

      try {
        setLoadingHorarios(true);

        const ref = collection(db, "disponibilidades");
        const q = query(
          ref,
          where("quadraId", "==", id),
          where("data", "==", data)
        );

        const snap = await getDocs(q);

        const lista = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        lista.sort((a, b) => {
          const aHora = String(a.horaInicio ?? "");
          const bHora = String(b.horaInicio ?? "");
          return aHora.localeCompare(bHora);
        });

        setHorarios(lista);
      } catch (e) {
        console.error("Erro ao carregar horários do dia:", e);
        setHorarios([]);
      } finally {
        setLoadingHorarios(false);
      }
    }

    carregarHorariosDoDia();
  }, [id, data]);

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.heroBadge}>Gestão por dia</div>
            <h1 style={styles.heroTitle}>Horários do dia</h1>
            <p style={styles.heroText}>
              Aqui o proprietário poderá visualizar todos os horários gerados neste dia
              e aplicar ações específicas por horário, como promoção, bloqueio e ajustes.
            </p>

            <div style={styles.topActions}>
              <Link
                to={`/dono/quadra/${id}/horarios`}
                style={{ textDecoration: "none" }}
              >
                <button style={styles.neutralBtn}>Voltar para o mês</button>
              </Link>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Resumo inicial</h2>
            <p style={styles.sectionText}>
              Esta é a base da nova tela operacional do dia.
            </p>

            <div style={styles.infoBox}>
              <div>
                <strong>Quadra ID:</strong> {id || "—"}
              </div>
              <div>
                <strong>Data:</strong> {data || "—"}
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Inteligência do dia</h2>
            <p style={styles.sectionText}>
              Veja a leitura de ocupação do dia e oportunidades para atrair mais atletas.
            </p>

      <div style={{ marginTop: 14 }}>
  {mostrarAlta ? (
    <div style={styles.ocupacaoAlta}>Alta ocupação</div>
  ) : mostrarMedia ? (
    <div style={styles.ocupacaoMedia}>Média ocupação</div>
  ) : (
    <div style={styles.ocupacaoBaixa}>Baixa ocupação</div>
  )}
</div>

            <div style={styles.infoBox}>
  {mostrarAlta && (
    <>
      🔥 Seus horários estão com alta ocupação.
      Considere aumentar o preço ou criar horários premium para maximizar seu lucro.
    </>
  )}

  {mostrarMedia && (
    <>
      ⚖️ Sua ocupação está equilibrada.
      Pequenos ajustes de preço ou promoções podem aumentar ainda mais suas reservas.
    </>
  )}

  {mostrarBaixa && (
    <>
      ❄️ Horários com baixa ocupação representam oportunidade de aumentar suas reservas.
      Sugerimos criar uma promoção estratégica nesse horário para atrair mais atletas
      e melhorar o faturamento da quadra ao longo do dia.
    </>
  )}
</div>
<div style={{ marginTop: 12, fontWeight: 800, color: "#0f172a" }}>
  💡 O Quadra Play está analisando seus horários automaticamente para aumentar seu faturamento.
</div>
<div style={styles.card}>
  <h2 style={styles.sectionTitle}>Horários gerados no dia</h2>
  <p style={styles.sectionText}>
    Veja abaixo todos os horários cadastrados para este dia.
  </p>

  <div style={{ marginTop: 14 }}>
  <label
    style={{
      display: "block",
      fontSize: 13,
      fontWeight: 700,
      color: "#475569",
      marginBottom: 6,
    }}
  >
    Filtrar por esporte
  </label>

  <select
    value={esporteFiltro}
    onChange={(e) => setEsporteFiltro(e.target.value)}
    style={{
      minHeight: 44,
      borderRadius: 14,
      border: "1px solid #cbd5e1",
      padding: "0 12px",
      background: "#fff",
      color: "#0f172a",
      fontSize: 14,
      minWidth: 220,
    }}
  >
    <option value="todos">Todos os esportes</option>
    {esportesDisponiveis.map((esp) => (
      <option key={esp} value={esp}>
        {esp}
      </option>
    ))}
  </select>
</div>

  {loadingHorarios ? (
    <div style={styles.infoBox}>Carregando horários...</div>
  ) : horarios.length === 0 ? (
    <div style={styles.infoBox}>Nenhum horário encontrado neste dia.</div>
  ) : (
    <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
     {horarios
  .filter((h) =>
    esporteFiltro === "todos" ? true : String(h.esporte ?? "") === esporteFiltro
  )
  .map((h) => (
        <div
          key={h.id}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            {h.horaInicio} - {h.horaFim}
          </div>

          <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
            Esporte: {h.esporte || "—"}
          </div>

          <div style={{ marginTop: 4, fontSize: 14 }}>
  {h.promocaoAtiva && h.valorPromocional != null ? (
    <>
      <div style={{ color: "#94a3b8", textDecoration: "line-through" }}>
        De: R$ {Number(h.valorOriginal ?? h.valor ?? 0).toFixed(2)}
      </div>

      <div style={{ color: "#16a34a", fontWeight: 900, fontSize: 16 }}>
        Por: R$ {Number(h.valorPromocional).toFixed(2)}
      </div>

      <div
        style={{
          marginTop: 6,
          display: "inline-flex",
          padding: "4px 10px",
          borderRadius: 999,
          background: "#dcfce7",
          border: "1px solid #86efac",
          color: "#166534",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        Promoção ativa
      </div>
    </>
  ) : (
    <div style={{ color: "#475569" }}>
      Valor: R$ {Number(h.valor ?? 0).toFixed(2)}
    </div>
  )}
</div>

          <div style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>
            Status: {h.reservadoPorUid ? "Reservado" : h.bloqueado ? "Bloqueado" : h.ativo ? "Livre" : "Inativo"}
          </div>
          <button
  onClick={async () => {
  const novoValor = prompt("Digite o valor promocional:");
  if (!novoValor) return;

  try {
    const valorNumero = Number(novoValor);

    if (isNaN(valorNumero) || valorNumero <= 0) {
      alert("Valor inválido");
      return;
    }

    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");

    const ref = doc(db, "disponibilidades", h.id);

    await updateDoc(ref, {
      promocaoAtiva: true,
      valorPromocional: valorNumero,
      promocaoCriadaEm: serverTimestamp(),
    });

    alert("Promoção criada com sucesso!");

  } catch (e) {
    console.error(e);
    alert("Erro ao criar promoção");
  }
}}
  style={{
    marginTop: 8,
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: "#22c55e",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  Criar promoção
</button>
        </div>
      ))}
    </div>
  )}
</div>
          </div>
        </div>
      </div>
    </>
  );
}