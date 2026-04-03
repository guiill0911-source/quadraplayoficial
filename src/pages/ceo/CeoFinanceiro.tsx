import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

type Role = "atleta" | "dono" | "ceo";
type PeriodoFiltro = "todos" | "hoje" | "7dias" | "30dias" | "mes";

type Quadra = {
  id: string;
  nome?: string;
  cidade?: string;
  endereco?: string;
  ownerId?: string;
  ownerUid?: string;
};

type Usuario = {
  id: string;
  nome?: string;
  email?: string;
  role?: string;
};

type Reserva = {
  id: string;
  quadraId?: string;
  status?: string;
  valorTotalCentavos?: number;
  valorPlataformaCentavos?: number;
  valorDonoCentavos?: number;
  valorClienteCentavos?: number;
  donoUid?: string;
  clienteUid?: string;

  createdAt?: any;
  updatedAt?: any;
  data?: any;
  startAt?: any;
  dataHoraInicio?: any;
  inicio?: any;
  dataReserva?: any;
};

type LinhaQuadra = {
  quadraId: string;
  quadraNome: string;
  cidade: string;

  totalReservas: number;
  finalizadas: number;
  canceladas: number;
  pendentes: number;
  noShow: number;

  brutoCentavos: number;
  plataformaCentavos: number;
  ticketMedioCentavos: number;
  taxaCancelamento: number;
  taxaNoShow: number;
};

type LinhaDono = {
  donoUid: string;
  donoNome: string;
  donoEmail: string;

  quadrasCount: number;
  cidadesCount: number;

  totalReservas: number;
  finalizadas: number;
  canceladas: number;
  pendentes: number;
  noShow: number;

  brutoCentavos: number;
  plataformaCentavos: number;
  ticketMedioCentavos: number;
  taxaCancelamento: number;
  taxaNoShow: number;
};

type LinhaCidade = {
  cidade: string;

  quadrasCount: number;
  donosCount: number;

  totalReservas: number;
  finalizadas: number;
  canceladas: number;
  pendentes: number;
  noShow: number;

  brutoCentavos: number;
  plataformaCentavos: number;
  ticketMedioCentavos: number;
  taxaCancelamento: number;
  taxaNoShow: number;
};

function normalizeRole(value: any): Role | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "atleta" || v === "dono" || v === "ceo") return v as Role;
  return null;
}

async function exigirCeo() {
  const user = auth.currentUser;
  if (!user) throw new Error("Você precisa estar logado.");

  const snap = await getDoc(doc(db, "users", user.uid));
  const role = normalizeRole(snap.exists() ? (snap.data() as any).role : null);

  if (role !== "ceo") {
    throw new Error("Acesso negado: somente CEO.");
  }

  return user.uid;
}

function dinheiro(valorCentavos?: number) {
  const n = Number(valorCentavos || 0) / 100;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function porcentagem(valor?: number) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function normalizeStatus(status?: string) {
  const s = String(status || "").trim().toLowerCase();

  if (s === "finalizada" || s === "finalizado") return "finalizada";
  if (s === "cancelada" || s === "cancelado") return "cancelada";

  if (
    s === "no_show" ||
    s === "noshow" ||
    s === "nao_compareceu" ||
    s === "não_compareceu"
  ) {
    return "no_show";
  }

  return "pendente";
}

function isFirestoreTimestampLike(value: any) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  );
}

function parseDateValue(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (value instanceof Timestamp) {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  if (isFirestoreTimestampLike(value)) {
    const d = new Timestamp(value.seconds, value.nanoseconds).toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "number") {
    const ms = value < 1000000000000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    const texto = value.trim();
    if (!texto) return null;

    const iso = new Date(texto);
    if (!isNaN(iso.getTime())) return iso;

    const br = texto.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (br) {
      const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = br;
      const d = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss)
      );
      return isNaN(d.getTime()) ? null : d;
    }

    const ymd = texto.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (ymd) {
      const [, yyyy, mm, dd, hh = "00", min = "00", ss = "00"] = ymd;
      const d = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss)
      );
      return isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

function getReservaDate(reserva: Reserva): Date | null {
  return (
    parseDateValue(reserva.startAt) ||
    parseDateValue(reserva.dataHoraInicio) ||
    parseDateValue(reserva.inicio) ||
    parseDateValue(reserva.dataReserva) ||
    parseDateValue(reserva.createdAt) ||
    parseDateValue(reserva.data) ||
    parseDateValue(reserva.updatedAt) ||
    null
  );
}

function getPeriodoLabel(periodo: PeriodoFiltro) {
  if (periodo === "hoje") return "Hoje";
  if (periodo === "7dias") return "Últimos 7 dias";
  if (periodo === "30dias") return "Últimos 30 dias";
  if (periodo === "mes") return "Este mês";
  return "Todo o período";
}

function isReservaNoPeriodo(reserva: Reserva, periodo: PeriodoFiltro) {
  if (periodo === "todos") return true;

  const dataReserva = getReservaDate(reserva);
  if (!dataReserva) return false;

  const agora = new Date();

  if (periodo === "hoje") {
    return (
      dataReserva.getFullYear() === agora.getFullYear() &&
      dataReserva.getMonth() === agora.getMonth() &&
      dataReserva.getDate() === agora.getDate()
    );
  }

  if (periodo === "7dias") {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 6);
    return dataReserva >= inicio;
  }

  if (periodo === "30dias") {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 29);
    return dataReserva >= inicio;
  }

  if (periodo === "mes") {
    return (
      dataReserva.getFullYear() === agora.getFullYear() &&
      dataReserva.getMonth() === agora.getMonth()
    );
  }

  return true;
}

function nomeBonitoDono(usuario?: Usuario | null, donoUid?: string) {
  const nome = String(usuario?.nome || "").trim();
  if (nome) return nome;
  if (donoUid) return `Dono ${donoUid.slice(0, 6)}`;
  return "Dono sem nome";
}

function cidadeBonita(cidade?: string) {
  const valor = String(cidade || "").trim();
  return valor || "Sem cidade";
}

function calcularTicketMedio(brutoCentavos: number, totalReservas: number) {
  if (!totalReservas) return 0;
  return brutoCentavos / totalReservas;
}

function calcularTaxa(parte: number, total: number) {
  if (!total) return 0;
  return (parte / total) * 100;
}

export default function CeoFinanceiro() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);

  const [filtro, setFiltro] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("todos");

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      await exigirCeo();

      const [quadrasSnap, reservasSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "quadras")),
        getDocs(collection(db, "reservas")),
        getDocs(collection(db, "users")),
      ]);

      const quadrasData = quadrasSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Quadra[];

      const reservasData = reservasSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Reserva[];

      const usersData = usersSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Usuario[];

      setQuadras(quadrasData);
      setReservas(reservasData);
      setUsuarios(usersData);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar financeiro do CEO.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const reservasNoPeriodo = useMemo(() => {
    return reservas.filter((r) => isReservaNoPeriodo(r, periodo));
  }, [reservas, periodo]);

  const resumo = useMemo(() => {
    const mapaQuadras = new Map<string, Quadra>();
    for (const q of quadras) {
      mapaQuadras.set(q.id, q);
    }

    const mapaUsuarios = new Map<string, Usuario>();
    for (const u of usuarios) {
      mapaUsuarios.set(u.id, u);
    }

    const agrupadoQuadras = new Map<string, LinhaQuadra>();

    const agrupadoDonos = new Map<
      string,
      LinhaDono & {
        _quadrasIds: Set<string>;
        _cidades: Set<string>;
      }
    >();

    const agrupadoCidades = new Map<
      string,
      LinhaCidade & {
        _quadrasIds: Set<string>;
        _donosIds: Set<string>;
      }
    >();

    let totalReservas = 0;
    let totalFinalizadas = 0;
    let totalCanceladas = 0;
    let totalPendentes = 0;
    let totalNoShow = 0;

    let brutoTotalCentavos = 0;
    let plataformaTotalCentavos = 0;

    for (const r of reservasNoPeriodo) {
      const quadraId = String(r.quadraId || "").trim();
      if (!quadraId) continue;

      const quadra = mapaQuadras.get(quadraId);
      const cidade = cidadeBonita(quadra?.cidade);
      const donoUid = String(
        r.donoUid || quadra?.ownerId || quadra?.ownerUid || ""
      ).trim();

      const usuarioDono = donoUid ? mapaUsuarios.get(donoUid) : undefined;

      if (!agrupadoQuadras.has(quadraId)) {
        agrupadoQuadras.set(quadraId, {
          quadraId,
          quadraNome: quadra?.nome || "Quadra sem nome",
          cidade,

          totalReservas: 0,
          finalizadas: 0,
          canceladas: 0,
          pendentes: 0,
          noShow: 0,

          brutoCentavos: 0,
          plataformaCentavos: 0,
          ticketMedioCentavos: 0,
          taxaCancelamento: 0,
          taxaNoShow: 0,
        });
      }

      const linhaQuadra = agrupadoQuadras.get(quadraId)!;

      const bruto = Number(r.valorTotalCentavos || 0);
      const plataforma = Number(r.valorPlataformaCentavos || 0);
      const status = normalizeStatus(r.status);

      linhaQuadra.totalReservas += 1;
      linhaQuadra.brutoCentavos += bruto;
      linhaQuadra.plataformaCentavos += plataforma;

      if (status === "finalizada") {
        linhaQuadra.finalizadas += 1;
        totalFinalizadas += 1;
      } else if (status === "cancelada") {
        linhaQuadra.canceladas += 1;
        totalCanceladas += 1;
      } else if (status === "no_show") {
        linhaQuadra.noShow += 1;
        totalNoShow += 1;
      } else {
        linhaQuadra.pendentes += 1;
        totalPendentes += 1;
      }

      totalReservas += 1;
      brutoTotalCentavos += bruto;
      plataformaTotalCentavos += plataforma;

      if (donoUid) {
        if (!agrupadoDonos.has(donoUid)) {
          agrupadoDonos.set(donoUid, {
            donoUid,
            donoNome: nomeBonitoDono(usuarioDono, donoUid),
            donoEmail: String(usuarioDono?.email || "").trim(),

            quadrasCount: 0,
            cidadesCount: 0,

            totalReservas: 0,
            finalizadas: 0,
            canceladas: 0,
            pendentes: 0,
            noShow: 0,

            brutoCentavos: 0,
            plataformaCentavos: 0,
            ticketMedioCentavos: 0,
            taxaCancelamento: 0,
            taxaNoShow: 0,

            _quadrasIds: new Set<string>(),
            _cidades: new Set<string>(),
          });
        }

        const linhaDono = agrupadoDonos.get(donoUid)!;

        linhaDono.totalReservas += 1;
        linhaDono.brutoCentavos += bruto;
        linhaDono.plataformaCentavos += plataforma;

        if (quadraId) linhaDono._quadrasIds.add(quadraId);
        if (cidade) linhaDono._cidades.add(cidade);

        if (status === "finalizada") linhaDono.finalizadas += 1;
        else if (status === "cancelada") linhaDono.canceladas += 1;
        else if (status === "no_show") linhaDono.noShow += 1;
        else linhaDono.pendentes += 1;
      }

      if (!agrupadoCidades.has(cidade)) {
        agrupadoCidades.set(cidade, {
          cidade,

          quadrasCount: 0,
          donosCount: 0,

          totalReservas: 0,
          finalizadas: 0,
          canceladas: 0,
          pendentes: 0,
          noShow: 0,

          brutoCentavos: 0,
          plataformaCentavos: 0,
          ticketMedioCentavos: 0,
          taxaCancelamento: 0,
          taxaNoShow: 0,

          _quadrasIds: new Set<string>(),
          _donosIds: new Set<string>(),
        });
      }

      const linhaCidade = agrupadoCidades.get(cidade)!;

      linhaCidade.totalReservas += 1;
      linhaCidade.brutoCentavos += bruto;
      linhaCidade.plataformaCentavos += plataforma;

      if (quadraId) linhaCidade._quadrasIds.add(quadraId);
      if (donoUid) linhaCidade._donosIds.add(donoUid);

      if (status === "finalizada") linhaCidade.finalizadas += 1;
      else if (status === "cancelada") linhaCidade.canceladas += 1;
      else if (status === "no_show") linhaCidade.noShow += 1;
      else linhaCidade.pendentes += 1;
    }

    const linhas = Array.from(agrupadoQuadras.values())
      .map((item) => ({
        ...item,
        ticketMedioCentavos: calcularTicketMedio(
          item.brutoCentavos,
          item.totalReservas
        ),
        taxaCancelamento: calcularTaxa(item.canceladas, item.totalReservas),
        taxaNoShow: calcularTaxa(item.noShow, item.totalReservas),
      }))
      .sort((a, b) => {
        return (
          b.plataformaCentavos - a.plataformaCentavos ||
          b.brutoCentavos - a.brutoCentavos ||
          b.totalReservas - a.totalReservas
        );
      });

    const linhasDonos = Array.from(agrupadoDonos.values())
      .map((item) => ({
        donoUid: item.donoUid,
        donoNome: item.donoNome,
        donoEmail: item.donoEmail,

        quadrasCount: item._quadrasIds.size,
        cidadesCount: item._cidades.size,

        totalReservas: item.totalReservas,
        finalizadas: item.finalizadas,
        canceladas: item.canceladas,
        pendentes: item.pendentes,
        noShow: item.noShow,

        brutoCentavos: item.brutoCentavos,
        plataformaCentavos: item.plataformaCentavos,
        ticketMedioCentavos: calcularTicketMedio(
          item.brutoCentavos,
          item.totalReservas
        ),
        taxaCancelamento: calcularTaxa(item.canceladas, item.totalReservas),
        taxaNoShow: calcularTaxa(item.noShow, item.totalReservas),
      }))
      .sort((a, b) => {
        return (
          b.plataformaCentavos - a.plataformaCentavos ||
          b.brutoCentavos - a.brutoCentavos ||
          b.totalReservas - a.totalReservas
        );
      });

    const linhasCidades = Array.from(agrupadoCidades.values())
      .map((item) => ({
        cidade: item.cidade,

        quadrasCount: item._quadrasIds.size,
        donosCount: item._donosIds.size,

        totalReservas: item.totalReservas,
        finalizadas: item.finalizadas,
        canceladas: item.canceladas,
        pendentes: item.pendentes,
        noShow: item.noShow,

        brutoCentavos: item.brutoCentavos,
        plataformaCentavos: item.plataformaCentavos,
        ticketMedioCentavos: calcularTicketMedio(
          item.brutoCentavos,
          item.totalReservas
        ),
        taxaCancelamento: calcularTaxa(item.canceladas, item.totalReservas),
        taxaNoShow: calcularTaxa(item.noShow, item.totalReservas),
      }))
      .sort((a, b) => {
        return (
          b.plataformaCentavos - a.plataformaCentavos ||
          b.brutoCentavos - a.brutoCentavos ||
          b.totalReservas - a.totalReservas
        );
      });

    return {
      linhas,
      linhasDonos,
      linhasCidades,
      totalReservas,
      totalFinalizadas,
      totalCanceladas,
      totalPendentes,
      totalNoShow,
      brutoTotalCentavos,
      plataformaTotalCentavos,
      ticketMedioGeralCentavos: calcularTicketMedio(
        brutoTotalCentavos,
        totalReservas
      ),
      taxaCancelamentoGeral: calcularTaxa(totalCanceladas, totalReservas),
      taxaNoShowGeral: calcularTaxa(totalNoShow, totalReservas),
    };
  }, [quadras, usuarios, reservasNoPeriodo]);

  const linhasFiltradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return resumo.linhas;

    return resumo.linhas.filter((l) => {
      return (
        l.quadraNome.toLowerCase().includes(t) ||
        l.cidade.toLowerCase().includes(t) ||
        l.quadraId.toLowerCase().includes(t)
      );
    });
  }, [resumo.linhas, filtro]);

  const linhasDonosFiltradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return resumo.linhasDonos;

    return resumo.linhasDonos.filter((l) => {
      return (
        l.donoNome.toLowerCase().includes(t) ||
        l.donoEmail.toLowerCase().includes(t) ||
        l.donoUid.toLowerCase().includes(t)
      );
    });
  }, [resumo.linhasDonos, filtro]);

  const linhasCidadesFiltradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return resumo.linhasCidades;

    return resumo.linhasCidades.filter((l) => {
      return l.cidade.toLowerCase().includes(t);
    });
  }, [resumo.linhasCidades, filtro]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(34,197,94,0.10), transparent 28%), radial-gradient(circle at top right, rgba(59,130,246,0.10), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "20px 16px 40px" }}>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: 24,
            background:
              "linear-gradient(135deg, #020617 0%, #1e3a8a 58%, #16a34a 100%)",
            color: "#fff",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -50,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              filter: "blur(10px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -30,
              bottom: -70,
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              filter: "blur(12px)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.4,
              }}
            >
              CEO • FINANCEIRO DA PLATAFORMA
            </div>

            <h1
              style={{
                margin: "14px 0 8px",
                fontSize: "clamp(28px, 4vw, 42px)",
                lineHeight: 1.05,
                fontWeight: 900,
              }}
            >
              Receita do aplicativo e desempenho por operação
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 760,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.65,
                fontSize: 15,
              }}
            >
              Aqui você acompanha quanto a plataforma movimenta, quanto fica para o app
              e a qualidade operacional por quadra, dono e cidade.
            </p>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button onClick={() => navigate(-1)} style={heroBtnGhost}>
                ← Voltar
              </button>

              <button
                onClick={() => navigate("/ceo")}
                style={heroBtnWhite}
              >
                Dashboard CEO
              </button>

              <button onClick={carregar} style={heroBtnGreen}>
                Atualizar financeiro
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <div style={stylesBlock.loading}>
            Carregando financeiro do CEO...
          </div>
        )}

        {erro && !loading && (
          <div style={stylesBlock.error}>
            {erro}
          </div>
        )}

        {!loading && !erro && (
          <>
            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={sectionKicker}>Período analisado</div>
                  <div style={sectionTitleMini}>{getPeriodoLabel(periodo)}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PeriodoButton active={periodo === "todos"} onClick={() => setPeriodo("todos")} label="Todos" />
                  <PeriodoButton active={periodo === "hoje"} onClick={() => setPeriodo("hoje")} label="Hoje" />
                  <PeriodoButton active={periodo === "7dias"} onClick={() => setPeriodo("7dias")} label="7 dias" />
                  <PeriodoButton active={periodo === "30dias"} onClick={() => setPeriodo("30dias")} label="30 dias" />
                  <PeriodoButton active={periodo === "mes"} onClick={() => setPeriodo("mes")} label="Este mês" />
                </div>
              </div>
            </section>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 18,
              }}
            >
              <StatCard
                title="Total de reservas"
                value={String(resumo.totalReservas)}
                subtitle="Reservas dentro do período escolhido"
              />
              <StatCard
                title="Bruto movimentado"
                value={dinheiro(resumo.brutoTotalCentavos)}
                subtitle="Valor total gerado no período"
              />
              <StatCard
                title="Receita da plataforma"
                value={dinheiro(resumo.plataformaTotalCentavos)}
                subtitle="Comissão total do aplicativo"
              />
              <StatCard
                title="Quadras com receita"
                value={String(resumo.linhas.length)}
                subtitle="Quadras com reservas no período"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
                marginTop: 16,
              }}
            >
              <SoftStat label="Finalizadas" value={String(resumo.totalFinalizadas)} />
              <SoftStat label="Canceladas" value={String(resumo.totalCanceladas)} />
              <SoftStat label="Pendentes" value={String(resumo.totalPendentes)} />
              <SoftStat label="No-show" value={String(resumo.totalNoShow)} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              <StatCard
                title="Ticket médio"
                value={dinheiro(resumo.ticketMedioGeralCentavos)}
                subtitle="Valor médio por reserva no período"
              />
              <StatCard
                title="Taxa de cancelamento"
                value={porcentagem(resumo.taxaCancelamentoGeral)}
                subtitle="Percentual de reservas canceladas"
              />
              <StatCard
                title="Taxa de no-show"
                value={porcentagem(resumo.taxaNoShowGeral)}
                subtitle="Percentual de reservas com não comparecimento"
              />
            </div>

            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={sectionTitle}>Visão operacional</h2>
                  <p style={sectionDesc}>
                    Use o filtro para localizar quadras, donos ou cidades dentro do período.
                  </p>
                </div>

                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por quadra, dono, cidade ou ID..."
                  style={searchInput}
                />
              </div>
            </section>

            <section style={sectionStyle}>
              <div>
                <h2 style={sectionTitle}>Ranking financeiro e operacional por quadra</h2>
                <p style={sectionDesc}>
                  Veja quais quadras mais geram receita, qual o ticket médio e onde há mais cancelamentos ou no-show.
                </p>
              </div>

              {linhasFiltradas.length === 0 ? (
                <div style={stylesBlock.empty}>
                  Nenhuma quadra encontrada para esse filtro ou período.
                </div>
              ) : (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {linhasFiltradas.map((linha, index) => (
                    <div key={linha.quadraId} style={stylesBlock.card}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.6fr) repeat(9, minmax(108px, 0.66fr))",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={stylesBlock.rowHead}>
                            <span
                              style={{
                                ...stylesBlock.rankPill,
                                background: index < 3 ? "#eff6ff" : "#f8fafc",
                                color: index < 3 ? "#1d4ed8" : "#475569",
                                border: "1px solid #dbeafe",
                              }}
                            >
                              #{index + 1}
                            </span>

                            <div style={stylesBlock.rowTitle}>{linha.quadraNome}</div>
                          </div>

                          <div style={stylesBlock.meta}>
                            {linha.cidade} • ID: {linha.quadraId}
                          </div>
                        </div>

                        <MiniMetric label="Reservas" value={String(linha.totalReservas)} />
                        <MiniMetric label="Finalizadas" value={String(linha.finalizadas)} />
                        <MiniMetric label="Canceladas" value={String(linha.canceladas)} />
                        <MiniMetric label="No-show" value={String(linha.noShow)} />
                        <MiniMetric label="Bruto" value={dinheiro(linha.brutoCentavos)} />
                        <MiniMetric label="Ticket médio" value={dinheiro(linha.ticketMedioCentavos)} />
                        <MiniMetric label="Tx. cancel." value={porcentagem(linha.taxaCancelamento)} />
                        <MiniMetric label="Tx. no-show" value={porcentagem(linha.taxaNoShow)} />
                        <MiniMetric
                          label="Seu app gerou"
                          value={dinheiro(linha.plataformaCentavos)}
                          strong
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <div>
                <h2 style={sectionTitle}>Ranking por dono</h2>
                <p style={sectionDesc}>
                  Veja quais donos concentram mais quadras, mais reservas e melhor qualidade operacional.
                </p>
              </div>

              {linhasDonosFiltradas.length === 0 ? (
                <div style={stylesBlock.empty}>
                  Nenhum dono encontrado para esse filtro ou período.
                </div>
              ) : (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {linhasDonosFiltradas.map((linha, index) => (
                    <div key={linha.donoUid} style={stylesBlock.card}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.8fr) repeat(10, minmax(100px, 0.62fr))",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={stylesBlock.rowHead}>
                            <span
                              style={{
                                ...stylesBlock.rankPill,
                                background: index < 3 ? "#ecfeff" : "#f8fafc",
                                color: index < 3 ? "#0f766e" : "#475569",
                                border: "1px solid #ccfbf1",
                              }}
                            >
                              #{index + 1}
                            </span>

                            <div style={stylesBlock.rowTitle}>{linha.donoNome}</div>
                          </div>

                          <div
                            style={{
                              ...stylesBlock.meta,
                              wordBreak: "break-word",
                            }}
                          >
                            {linha.donoEmail || "Sem e-mail"} • ID: {linha.donoUid}
                          </div>
                        </div>

                        <MiniMetric label="Quadras" value={String(linha.quadrasCount)} />
                        <MiniMetric label="Cidades" value={String(linha.cidadesCount)} />
                        <MiniMetric label="Reservas" value={String(linha.totalReservas)} />
                        <MiniMetric label="Finalizadas" value={String(linha.finalizadas)} />
                        <MiniMetric label="Canceladas" value={String(linha.canceladas)} />
                        <MiniMetric label="No-show" value={String(linha.noShow)} />
                        <MiniMetric label="Bruto" value={dinheiro(linha.brutoCentavos)} />
                        <MiniMetric label="Ticket médio" value={dinheiro(linha.ticketMedioCentavos)} />
                        <MiniMetric label="Tx. cancel." value={porcentagem(linha.taxaCancelamento)} />
                        <MiniMetric label="Tx. no-show" value={porcentagem(linha.taxaNoShow)} />
                        <MiniMetric
                          label="Seu app gerou"
                          value={dinheiro(linha.plataformaCentavos)}
                          strong
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <div>
                <h2 style={sectionTitle}>Desempenho por cidade</h2>
                <p style={sectionDesc}>
                  Acompanhe quais cidades concentram mais operação, maior ticket médio e melhor saúde operacional.
                </p>
              </div>

              {linhasCidadesFiltradas.length === 0 ? (
                <div style={stylesBlock.empty}>
                  Nenhuma cidade encontrada para esse filtro ou período.
                </div>
              ) : (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {linhasCidadesFiltradas.map((linha, index) => (
                    <div key={linha.cidade} style={stylesBlock.card}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.7fr) repeat(10, minmax(100px, 0.62fr))",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={stylesBlock.rowHead}>
                            <span
                              style={{
                                ...stylesBlock.rankPill,
                                background: index < 3 ? "#f5f3ff" : "#f8fafc",
                                color: index < 3 ? "#6d28d9" : "#475569",
                                border: "1px solid #e9d5ff",
                              }}
                            >
                              #{index + 1}
                            </span>

                            <div style={stylesBlock.rowTitle}>{linha.cidade}</div>
                          </div>

                          <div style={stylesBlock.meta}>
                            Visão consolidada da operação da cidade
                          </div>
                        </div>

                        <MiniMetric label="Quadras" value={String(linha.quadrasCount)} />
                        <MiniMetric label="Donos" value={String(linha.donosCount)} />
                        <MiniMetric label="Reservas" value={String(linha.totalReservas)} />
                        <MiniMetric label="Finalizadas" value={String(linha.finalizadas)} />
                        <MiniMetric label="Canceladas" value={String(linha.canceladas)} />
                        <MiniMetric label="No-show" value={String(linha.noShow)} />
                        <MiniMetric label="Bruto" value={dinheiro(linha.brutoCentavos)} />
                        <MiniMetric label="Ticket médio" value={dinheiro(linha.ticketMedioCentavos)} />
                        <MiniMetric label="Tx. cancel." value={porcentagem(linha.taxaCancelamento)} />
                        <MiniMetric label="Tx. no-show" value={porcentagem(linha.taxaNoShow)} />
                        <MiniMetric
                          label="Seu app gerou"
                          value={dinheiro(linha.plataformaCentavos)}
                          strong
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const heroBtnGhost: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const heroBtnWhite: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "none",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const heroBtnGreen: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 18,
  background: "#fff",
  borderRadius: 24,
  border: "1px solid #e2e8f0",
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  padding: 20,
};

const sectionKicker: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.35,
};

const sectionTitleMini: React.CSSProperties = {
  marginTop: 6,
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
};

const searchInput: React.CSSProperties = {
  minWidth: 280,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
};

const stylesBlock = {
  card: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: 16,
  } as React.CSSProperties,

  empty: {
    marginTop: 16,
    borderRadius: 16,
    border: "1px dashed #cbd5e1",
    background: "#fff",
    padding: 18,
    color: "#64748b",
    fontWeight: 700,
  } as React.CSSProperties,

  loading: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#475569",
    fontWeight: 800,
  } as React.CSSProperties,

  error: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
  } as React.CSSProperties,

  rankPill: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  } as React.CSSProperties,

  meta: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.55,
  } as React.CSSProperties,

  rowHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,

  rowTitle: {
    fontWeight: 900,
    color: "#0f172a",
    fontSize: 16,
  } as React.CSSProperties,
};

function PeriodoButton({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        background: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#334155",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        border: "1px solid #e2e8f0",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 900,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "#64748b",
          lineHeight: 1.55,
          fontWeight: 700,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function SoftStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#ffffffcc",
        backdropFilter: "blur(8px)",
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        padding: 16,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 900,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: strong ? "#eff6ff" : "#f8fafc",
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 16,
          fontWeight: 900,
          color: strong ? "#1d4ed8" : "#0f172a",
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>
    </div>
  );
}