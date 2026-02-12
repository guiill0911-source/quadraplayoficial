import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../services/firebase";

import { buscarSlotsDisponiveisDaQuadra } from "../services/disponibilidadesBusca";
import type { SlotDisponibilidade } from "../services/disponibilidadesBusca";
import { reservarHorario } from "../services/reservas";
import { useAuth } from "../services/authContext";

import { criarAvaliacao, buscarResumoAvaliacoesDaQuadra } from "../services/avaliacoes";

/* =======================
   TIPOS
======================= */

type Comodidades = {
  chuveiro?: boolean;
  churrasqueira?: boolean;
  mesaSinuca?: boolean;
  iluminacao?: boolean;
  coletes?: boolean;
};

type QuadraDoc = {
  ownerId?: string;
  nome: string;
  cidade: string;
  endereco?: string;
  ativo?: boolean;
  observacoes?: string;
  valorHora?: number | null;
  esportes?: string[];
  valoresPorEsporte?: Record<string, number>;
  fotoCapaUrl?: string | null;
  comodidades?: Comodidades;
};

type ReservaDoc = {
  id: string;
  quadraId: string;
  clienteUid: string;
  status?: string; // confirmada | cancelada
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM
  noShow?: boolean;
};

/* =======================
   CONSTANTES
======================= */

const ESPORTES_LABELS: Record<string, string> = {
  futsal: "Futsal",
  society_5: "Society 5",
  society_7: "Society 7",
  volei: "Vôlei",
  futevolei: "Futevôlei",
  futmesa: "Futmesa",
  beach_tenis: "Beach Tênis",
};

/* =======================
   HELPERS
======================= */

function hojeISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function agoraMinutosDoDia(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseHHMMToMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function chipsComodidades(c?: Comodidades): string[] {
  if (!c) return [];
  const r: string[] = [];
  if (c.chuveiro) r.push("Chuveiro");
  if (c.churrasqueira) r.push("Churrasqueira");
  if (c.mesaSinuca) r.push("Mesa de sinuca");
  if (c.iluminacao) r.push("Iluminação");
  if (c.coletes) r.push("Coletes");
  return r;
}

function isReservaFinalizada(res: ReservaDoc) {
  // “finalizada” = data < hoje OU (hoje e horaFim <= agora)
  const hoje = hojeISO();
  if (res.data < hoje) return true;
  if (res.data > hoje) return false;

  const fim = parseHHMMToMin(res.horaFim);
  if (fim == null) return false;
  return fim <= agoraMinutosDoDia();
}

function stars(media: number) {
  // só um visualzinho simples
  const rounded = Math.round(media); // 0..5
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

/* =======================
   COMPONENTE
======================= */

export default function Quadra() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [quadra, setQuadra] = useState<QuadraDoc | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Reserva
  const [dataReserva, setDataReserva] = useState(hojeISO());
  const [esporte, setEsporte] = useState("");
  const [slots, setSlots] = useState<SlotDisponibilidade[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");

  const [reservandoId, setReservandoId] = useState("");
  const [msg, setMsg] = useState("");
  const [erroReserva, setErroReserva] = useState("");

  // Avaliações (resumo + elegibilidade)
  const [resumo, setResumo] = useState<{ total: number; media: number }>({ total: 0, media: 0 });
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [reservaElegivel, setReservaElegivel] = useState<ReservaDoc | null>(null);
  const [jaAvaliouEssaReserva, setJaAvaliouEssaReserva] = useState(false);

  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [msgAvaliacao, setMsgAvaliacao] = useState<string>("");
  const [erroAvaliacao, setErroAvaliacao] = useState<string>("");

  /* =======================
     CARREGAR QUADRA
  ======================= */

  useEffect(() => {
    async function carregar() {
      if (!id) return;

      try {
        const ref = doc(db, "quadras", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErro("Quadra não encontrada");
        } else {
          const q = snap.data() as QuadraDoc;
          setQuadra(q);
          setEsporte(q.esportes?.[0] ?? "");
        }
      } catch {
        setErro("Erro ao carregar quadra");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [id]);

  /* =======================
     RESUMO AVALIAÇÕES
  ======================= */

  useEffect(() => {
    async function carregarResumo() {
      if (!id) return;
      try {
        setLoadingResumo(true);
        const r = await buscarResumoAvaliacoesDaQuadra(id);
        setResumo(r);
      } catch (e) {
        console.error(e);
        // não quebra a tela
      } finally {
        setLoadingResumo(false);
      }
    }
    carregarResumo();
  }, [id]);

  /* =======================
     BUSCAR SLOTS
  ======================= */

  useEffect(() => {
    async function buscar() {
      if (!id || !dataReserva || !esporte) return;

      setLoadingSlots(true);
      setErroReserva("");
      setMsg("");

      const hoje = hojeISO();
      if (dataReserva < hoje) {
        setSlots([]);
        setErroReserva("Selecione uma data de hoje ou futura.");
        setLoadingSlots(false);
        return;
      }

      try {
        const res = await buscarSlotsDisponiveisDaQuadra({
          quadraId: id,
          data: dataReserva,
          esporte,
        });

        const agoraMin = agoraMinutosDoDia();
        const isHoje = dataReserva === hoje;

        const filtrados = (res ?? [])
          .filter((s) => {
            if (isHoje) {
              const ini = parseHHMMToMin(s.horaInicio);
              if (ini != null && ini <= agoraMin) return false;
            }
            return true;
          })
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

        setSlots(filtrados);
      } catch {
        setErroReserva("Erro ao buscar horários");
      } finally {
        setLoadingSlots(false);
      }
    }

    buscar();
  }, [id, dataReserva, esporte]);

  /* =======================
     ELEGIBILIDADE PARA AVALIAR
  ======================= */

  useEffect(() => {
    async function checarElegibilidade() {
      setReservaElegivel(null);
      setJaAvaliouEssaReserva(false);
      setMsgAvaliacao("");
      setErroAvaliacao("");

      if (!id) return;
      if (!user?.uid) return;

      try {
        // 1) buscar reservas do usuário nessa quadra
        // (se pedir índice, depois a gente cria — MVP ok)
        const col = collection(db, "reservas");
        const q = query(col, where("quadraId", "==", id), where("clienteUid", "==", user.uid));
        const snap = await getDocs(q);

        const lista: ReservaDoc[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            quadraId: String(x.quadraId ?? ""),
            clienteUid: String(x.clienteUid ?? ""),
            status: x.status,
            data: String(x.data ?? ""),
            horaInicio: String(x.horaInicio ?? ""),
            horaFim: String(x.horaFim ?? ""),
            noShow: Boolean(x.noShow),
          };
        });

        // 2) filtrar: confirmada + não noShow + já terminou
        const elegiveis = lista
          .filter((r) => r.status === "confirmada")
          .filter((r) => r.noShow !== true)
          .filter((r) => isReservaFinalizada(r));

        // pega a mais recente (por data+horaFim)
        elegiveis.sort((a, b) => `${b.data} ${b.horaFim}`.localeCompare(`${a.data} ${a.horaFim}`));
        const escolhida = elegiveis[0] ?? null;

        if (!escolhida) {
          setReservaElegivel(null);
          return;
        }

        setReservaElegivel(escolhida);

        // 3) checar se já avaliou essa reserva
        const colAv = collection(db, "avaliacoes");
        const qAv = query(
          colAv,
          where("reservaId", "==", escolhida.id),
          where("clienteUid", "==", user.uid),
          limit(1)
        );
        const snapAv = await getDocs(qAv);
        setJaAvaliouEssaReserva(!snapAv.empty);
      } catch (e: any) {
        console.error(e);
        // não derruba a página
      }
    }

    checarElegibilidade();
  }, [id, user?.uid]);

  /* =======================
     AÇÕES
  ======================= */

  function limparReserva() {
    setMsg("");
    setErroReserva("");
    setReservandoId("");
    setDataReserva(hojeISO());
    setEsporte(quadra?.esportes?.[0] ?? "");
    setSlots([]);
  }

  async function reservar(slot: SlotDisponibilidade) {
    setErroReserva("");
    setMsg("");

    if (!user?.uid) {
      setErroReserva("Você precisa estar logado para reservar.");
      return;
    }

    if (!nomeCliente.trim()) {
      setErroReserva("Informe seu nome");
      return;
    }

    const hoje = hojeISO();
    if (dataReserva < hoje) {
      setErroReserva("Não é possível reservar em data passada.");
      return;
    }

    if (dataReserva === hoje) {
      const ini = parseHHMMToMin(slot.horaInicio);
      if (ini != null && ini <= agoraMinutosDoDia()) {
        setErroReserva("Este horário já passou.");
        return;
      }
    }

    const ok = window.confirm(
      `Confirmar reserva?\n\n` +
        `Data: ${dataReserva}\n` +
        `Horário: ${slot.horaInicio}–${slot.horaFim}\n` +
        `Esporte: ${ESPORTES_LABELS[slot.esporte] ?? slot.esporte}\n` +
        `Valor: ${formatBRL(slot.valor)}`
    );

    if (!ok) return;

    try {
      setReservandoId(slot.id);

      await reservarHorario({
        disponibilidadeId: slot.id,
        nomeCliente: nomeCliente.trim(),
        telefoneCliente: telefoneCliente.trim() || undefined,
      });

      setMsg("Reserva realizada!");
      setSlots((s) => s.filter((x) => x.id !== slot.id));
    } catch (e: any) {
      setErroReserva(e?.message ?? "Erro ao reservar");
    } finally {
      setReservandoId("");
    }
  }

  async function enviarAvaliacao() {
    setErroAvaliacao("");
    setMsgAvaliacao("");

    if (!id) return;
    if (!user?.uid) {
      setErroAvaliacao("Você precisa estar logado para avaliar.");
      return;
    }
    if (!reservaElegivel) {
      setErroAvaliacao("Você ainda não tem um jogo finalizado apto para avaliação.");
      return;
    }
    if (jaAvaliouEssaReserva) {
      setErroAvaliacao("Você já avaliou este jogo.");
      return;
    }

    try {
      setEnviandoAvaliacao(true);

      await criarAvaliacao({
        quadraId: id,
        reservaId: reservaElegivel.id,
        nota,
        comentario,
      });

      setMsgAvaliacao("Avaliação enviada! ✅ Obrigado.");
      setComentario("");
      setJaAvaliouEssaReserva(true);

      // atualiza resumo
      try {
        const r = await buscarResumoAvaliacoesDaQuadra(id);
        setResumo(r);
      } catch {}
    } catch (e: any) {
      console.error(e);
      setErroAvaliacao(e?.message ?? "Erro ao enviar avaliação.");
    } finally {
      setEnviandoAvaliacao(false);
    }
  }

  /* =======================
     RENDER
  ======================= */

  if (loading) return <p>Carregando...</p>;
  if (erro) return <p>{erro}</p>;
  if (!quadra) return <p>Quadra não encontrada</p>;

  const comodidades = chipsComodidades(quadra.comodidades);

  const mediaStr = resumo.total > 0 ? resumo.media.toFixed(1) : "—";

  return (
    <div style={{ padding: 16 }}>
      <Link to="/">← Voltar</Link>

      {quadra.fotoCapaUrl && (
        <img
          src={quadra.fotoCapaUrl}
          alt={quadra.nome}
          style={{
            marginTop: 12,
            width: "100%",
            maxHeight: 260,
            objectFit: "cover",
            borderRadius: 12,
          }}
        />
      )}

      <h1 style={{ marginBottom: 6 }}>{quadra.nome}</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0 }}>{quadra.cidade}</p>

        <div style={{ fontSize: 14, color: "#444" }}>
          {loadingResumo ? (
            <span>Carregando avaliações…</span>
          ) : resumo.total > 0 ? (
            <span>
              <strong>{stars(resumo.media)}</strong> <strong>{mediaStr}</strong> ({resumo.total} avaliações)
            </span>
          ) : (
            <span style={{ color: "#666" }}>Sem avaliações ainda</span>
          )}
        </div>
      </div>

      {/* ✅ Avaliar quadra (só quando elegível) */}
      {user?.uid && (
        <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 620 }}>
          <strong>Avaliar esta quadra</strong>

          {!reservaElegivel ? (
            <p style={{ marginTop: 8, color: "#666" }}>
              Você poderá avaliar após <strong>jogar</strong> (quando o horário da sua reserva terminar).
              <br />
              Se o dono marcar <strong>“não compareceu”</strong>, a avaliação não fica disponível.
            </p>
          ) : jaAvaliouEssaReserva ? (
            <p style={{ marginTop: 8, color: "green" }}>
              Você já avaliou seu último jogo nesta quadra ✅
            </p>
          ) : (
            <>
              <p style={{ marginTop: 8, color: "#666" }}>
                Jogo apto: <strong>{reservaElegivel.data}</strong> • {reservaElegivel.horaInicio}–{reservaElegivel.horaFim}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Nota</span>
                  <select value={nota} onChange={(e) => setNota(Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} ⭐
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, flex: 1, minWidth: 240 }}>
                  <span>Comentário</span>
                  <input
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Ex: Quadra bem iluminada, atendimento ótimo..."
                  />
                </label>

                <button onClick={enviarAvaliacao} disabled={enviandoAvaliacao}>
                  {enviandoAvaliacao ? "Enviando..." : "Enviar avaliação"}
                </button>
              </div>

              {erroAvaliacao && <p style={{ marginTop: 10, color: "crimson" }}>{erroAvaliacao}</p>}
              {msgAvaliacao && !erroAvaliacao && <p style={{ marginTop: 10, color: "green" }}>{msgAvaliacao}</p>}
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h3>Reservar horário</h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="date"
          value={dataReserva}
          min={hojeISO()}
          onChange={(e) => setDataReserva(e.target.value)}
        />

        <select value={esporte} onChange={(e) => setEsporte(e.target.value)}>
          {(quadra.esportes ?? []).map((e) => (
            <option key={e} value={e}>
              {ESPORTES_LABELS[e] ?? e}
            </option>
          ))}
        </select>

        <button onClick={limparReserva}>Voltar pra hoje / Limpar</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <input placeholder="Seu nome" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
        <input
          placeholder="Telefone (opcional)"
          value={telefoneCliente}
          onChange={(e) => setTelefoneCliente(e.target.value)}
        />
      </div>

      {erroReserva && <p style={{ color: "crimson" }}>{erroReserva}</p>}
      {msg && <p style={{ color: "green" }}>{msg}</p>}

      {loadingSlots ? (
        <p>Carregando horários...</p>
      ) : slots.length === 0 ? (
        <p style={{ color: "#666" }}>Nenhum horário disponível.</p>
      ) : (
        slots.map((s) => (
          <div key={s.id} style={{ border: "1px solid #ddd", padding: 8, marginTop: 8 }}>
            {s.horaInicio} – {s.horaFim} | {formatBRL(s.valor)}
            <button
              onClick={() => reservar(s)}
              disabled={reservandoId === s.id}
              style={{ marginLeft: 8 }}
            >
              {reservandoId === s.id ? "Reservando..." : "Reservar"}
            </button>
          </div>
        ))
      )}

      <hr />
      <strong>Comodidades</strong>
      <div>{comodidades.join(" • ") || "Nenhuma"}</div>
    </div>
  );
}
