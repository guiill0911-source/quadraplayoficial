import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "../../components/Header";
import ConfirmModal from "../../components/ConfirmModal";
import { useAuth } from "../../services/authContext";
import { gerarDisponibilidadesParaData } from "../../services/disponibilidades";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import Etapa2GerarHorariosBanner from "../../components/Etapa2GerarHorariosBanner";

type Disp = {
  id: string;
  quadraId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  esporte: string;
  valor: number;
  ativo: boolean;
  bloqueado?: boolean;
  bloqueadoPorUid?: string | null;
  reservadoPorUid?: string | null;
  removido?: boolean;
};

type QuadraDoc = {
  ownerId?: string;
  nome?: string;
  funcionamento?: any;
  excecoesFuncionamento?: Record<string, any>;
};

function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function toISODate(year: number, monthIndex0: number, day: number) {
  const m = String(monthIndex0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function offsetSemanaComecaSegunda(jsDay: number) {
  return (jsDay + 6) % 7;
}

function dayNumberFromISO(iso: string) {
  const d = iso.slice(8, 10);
  return Number(d);
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DiaLongo =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

const DIAS_LONGOS: { key: DiaLongo; label: string; short: string }[] = [
  { key: "segunda", label: "Segunda", short: "Seg" },
  { key: "terca", label: "Terça", short: "Ter" },
  { key: "quarta", label: "Quarta", short: "Qua" },
  { key: "quinta", label: "Quinta", short: "Qui" },
  { key: "sexta", label: "Sexta", short: "Sex" },
  { key: "sabado", label: "Sábado", short: "Sáb" },
  { key: "domingo", label: "Domingo", short: "Dom" },
];

type DiaUI = { fechado: boolean; abre: string; fecha: string };
type FuncUI = {
  mesmoHorarioTodosOsDias: boolean;
  padrao: { abre: string; fecha: string };

  semana: { fechado: boolean; abre: string; fecha: string };
  sabado: { fechado: boolean; abre: string; fecha: string };
  domingo: { fechado: boolean; abre: string; fecha: string };

  dias: Record<DiaLongo, DiaUI>;
};

function defaultFuncUI(): FuncUI {
  const dia: DiaUI = { fechado: false, abre: "08:00", fecha: "22:00" };

  return {
    mesmoHorarioTodosOsDias: true,
    padrao: { abre: "08:00", fecha: "22:00" },

    semana: { fechado: false, abre: "08:00", fecha: "22:00" },
    sabado: { fechado: false, abre: "08:00", fecha: "22:00" },
    domingo: { fechado: false, abre: "08:00", fecha: "22:00" },

    dias: {
      segunda: { ...dia },
      terca: { ...dia },
      quarta: { ...dia },
      quinta: { ...dia },
      sexta: { ...dia },
      sabado: { ...dia },
      domingo: { ...dia },
    },
  };
}

function isTimeValid(t: string) {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

function toFuncUI(raw: any): FuncUI {
  const ui = defaultFuncUI();
  if (!raw || typeof raw !== "object") return ui;
    if (raw.semana && typeof raw.semana === "object") {
    if (typeof raw.semana.aberto === "boolean") ui.semana.fechado = !raw.semana.aberto;
    if (typeof raw.semana.fechado === "boolean") ui.semana.fechado = !!raw.semana.fechado;
    if (typeof raw.semana.inicio === "string") ui.semana.abre = raw.semana.inicio;
    if (typeof raw.semana.fim === "string") ui.semana.fecha = raw.semana.fim;
    if (typeof raw.semana.abre === "string") ui.semana.abre = raw.semana.abre;
    if (typeof raw.semana.fecha === "string") ui.semana.fecha = raw.semana.fecha;
  }

  if (raw.sabado && typeof raw.sabado === "object") {
    if (typeof raw.sabado.aberto === "boolean") ui.sabado.fechado = !raw.sabado.aberto;
    if (typeof raw.sabado.fechado === "boolean") ui.sabado.fechado = !!raw.sabado.fechado;
    if (typeof raw.sabado.inicio === "string") ui.sabado.abre = raw.sabado.inicio;
    if (typeof raw.sabado.fim === "string") ui.sabado.fecha = raw.sabado.fim;
    if (typeof raw.sabado.abre === "string") ui.sabado.abre = raw.sabado.abre;
    if (typeof raw.sabado.fecha === "string") ui.sabado.fecha = raw.sabado.fecha;
  }

  if (raw.domingo && typeof raw.domingo === "object") {
    if (typeof raw.domingo.aberto === "boolean") ui.domingo.fechado = !raw.domingo.aberto;
    if (typeof raw.domingo.fechado === "boolean") ui.domingo.fechado = !!raw.domingo.fechado;
    if (typeof raw.domingo.inicio === "string") ui.domingo.abre = raw.domingo.inicio;
    if (typeof raw.domingo.fim === "string") ui.domingo.fecha = raw.domingo.fim;
    if (typeof raw.domingo.abre === "string") ui.domingo.abre = raw.domingo.abre;
    if (typeof raw.domingo.fecha === "string") ui.domingo.fecha = raw.domingo.fecha;
  }

  if (typeof raw.mesmoHorarioTodosOsDias === "boolean")
    ui.mesmoHorarioTodosOsDias = raw.mesmoHorarioTodosOsDias;

  if (raw.padrao && typeof raw.padrao === "object") {
    if (typeof raw.padrao.abre === "string") ui.padrao.abre = raw.padrao.abre;
    if (typeof raw.padrao.fecha === "string") ui.padrao.fecha = raw.padrao.fecha;
    if (typeof raw.padrao.inicio === "string") ui.padrao.abre = raw.padrao.inicio;
    if (typeof raw.padrao.fim === "string") ui.padrao.fecha = raw.padrao.fim;
  }

  for (const d of DIAS_LONGOS) {
    const v = raw[d.key];
    if (v && typeof v === "object") {
      if (typeof v.aberto === "boolean") ui.dias[d.key].fechado = !v.aberto;
      if (typeof v.fechado === "boolean") ui.dias[d.key].fechado = !!v.fechado;

      if (typeof v.inicio === "string") ui.dias[d.key].abre = v.inicio;
      if (typeof v.fim === "string") ui.dias[d.key].fecha = v.fim;

      if (typeof v.abre === "string") ui.dias[d.key].abre = v.abre;
      if (typeof v.fecha === "string") ui.dias[d.key].fecha = v.fecha;
    }
  }

  return ui;
}

function fromFuncUI(ui: FuncUI) {
  const out: any = {
  mesmoHorarioTodosOsDias: ui.mesmoHorarioTodosOsDias,
  padrao: { abre: ui.padrao.abre, fecha: ui.padrao.fecha },

  semana: ui.mesmoHorarioTodosOsDias
    ? { aberto: true, inicio: ui.padrao.abre, fim: ui.padrao.fecha }
    : ui.semana.fechado
    ? { aberto: false }
    : { aberto: true, inicio: ui.semana.abre, fim: ui.semana.fecha },

  sabado: ui.mesmoHorarioTodosOsDias
    ? { aberto: true, inicio: ui.padrao.abre, fim: ui.padrao.fecha }
    : ui.sabado.fechado
    ? { aberto: false }
    : { aberto: true, inicio: ui.sabado.abre, fim: ui.sabado.fecha },

  domingo: ui.mesmoHorarioTodosOsDias
    ? { aberto: true, inicio: ui.padrao.abre, fim: ui.padrao.fecha }
    : ui.domingo.fechado
    ? { aberto: false }
    : { aberto: true, inicio: ui.domingo.abre, fim: ui.domingo.fecha },
};

 for (const d of DIAS_LONGOS) {
  let dia: DiaUI;

  if (ui.mesmoHorarioTodosOsDias) {
    dia = { fechado: false, abre: ui.padrao.abre, fecha: ui.padrao.fecha };
  } else if (
    d.key === "segunda" ||
    d.key === "terca" ||
    d.key === "quarta" ||
    d.key === "quinta" ||
    d.key === "sexta"
  ) {
    dia = ui.semana;
  } else if (d.key === "sabado") {
    dia = ui.sabado;
  } else {
    dia = ui.domingo;
  }

  if (dia.fechado) out[d.key] = { aberto: false };
  else out[d.key] = { aberto: true, inicio: dia.abre, fim: dia.fecha };
}

  return out;
}

function resumoFuncionamento(ui: FuncUI) {
  if (ui.mesmoHorarioTodosOsDias) {
    return `Todos os dias: ${ui.padrao.abre}–${ui.padrao.fecha}`;
  }

  const semana = ui.semana.fechado
    ? "Seg–Sex fechado"
    : `Seg–Sex ${ui.semana.abre}–${ui.semana.fecha}`;

  const sabado = ui.sabado.fechado
    ? "Sáb fechado"
    : `Sáb ${ui.sabado.abre}–${ui.sabado.fecha}`;

  const domingo = ui.domingo.fechado
    ? "Dom fechado"
    : `Dom ${ui.domingo.abre}–${ui.domingo.fecha}`;

  return `${semana} • ${sabado} • ${domingo}`;
}

const styles: Record<string, React.CSSProperties> = {
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
    maxWidth: 780,
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
  greenBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(16,185,129,0.18)",
  },
  redBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
  },
  blueBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
  },
  smallBtn: {
    minHeight: 32,
    padding: "0 8px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  smallGreenBtn: {
    minHeight: 32,
    padding: "0 8px",
    borderRadius: 10,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#166534",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  smallRedBtn: {
    minHeight: 32,
    padding: "0 8px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  statusBox: {
    marginTop: 12,
    minHeight: 24,
    fontSize: 13,
    fontWeight: 700,
  },
  workingCard: {
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    padding: 16,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 700,
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
  },
  gridViewport: {
    overflowX: "auto",
    paddingBottom: 8,
    marginTop: 6,
  },
  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 150px)",
    gap: 10,
    marginBottom: 10,
    minWidth: 1110,
  },
  weekHeader: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    padding: "0 6px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 150px)",
    gap: 10,
    minWidth: 1110,
  },
  singleColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: 10,
    maxWidth: 1040,
  },
  dayCardActive: {
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 12,
    minHeight: 210,
    background: "linear-gradient(180deg, #ffffff, #f8fbff)",
    boxShadow: "0 10px 24px rgba(37,99,235,0.08)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  dayCardEmpty: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 12,
    minHeight: 210,
    background: "#fcfcfd",
    boxShadow: "0 6px 14px rgba(15,23,42,0.03)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  blankDay: {
    border: "1px dashed #e2e8f0",
    borderRadius: 18,
    padding: 10,
    minHeight: 110,
    background: "#fafafa",
    boxSizing: "border-box",
  },
  dayTop: {
    display: "grid",
    gap: 10,
  },
  dayHeader: {
    minWidth: 0,
  },
  dayActions: {
    display: "grid",
    gap: 6,
    alignContent: "start",
  },
  dayNumber: {
    fontWeight: 900,
    fontSize: 22,
    color: "#0f172a",
    lineHeight: 1,
  },
  dayMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
    lineHeight: 1.5,
  },
  dayStatsWrap: {
    marginTop: 10,
    display: "grid",
    gap: 6,
  },
  statBadgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  statGreen: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 11,
    fontWeight: 800,
  },
  statRed: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 999,
    background: "#fff1f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontSize: 11,
    fontWeight: 800,
  },
  statBlue: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 800,
  },
  miniSlots: {
    marginTop: 12,
    display: "grid",
    gap: 6,
    fontSize: 12,
    color: "#334155",
  },
  slotsHint: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 700,
  },
  miniSlotRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  bottomFinalize: {
    marginTop: 24,
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
    background: "#fff",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
    maxWidth: 1040,
  },
};

export default function GerenciarHorariosMes() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();

  const [quadraNome, setQuadraNome] = useState<string>("");
  const [ownerIdDaQuadra, setOwnerIdDaQuadra] = useState<string>("");

  const [mes, setMes] = useState(() => monthKey(new Date()));
  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [disps, setDisps] = useState<Disp[]>([]);
  const [trabalhandoDia, setTrabalhandoDia] = useState<string>("");

  const [mostrarSomenteDiasComHorarios, setMostrarSomenteDiasComHorarios] = useState(false);

  const [funcUI, setFuncUI] = useState<FuncUI>(defaultFuncUI());
  const [mostrarEditorFunc, setMostrarEditorFunc] = useState(false);
  const [salvandoFunc, setSalvandoFunc] = useState(false);

  const [zerandoMes, setZerandoMes] = useState(false);
  const [excecoes, setExcecoes] = useState<Record<string, any>>({});
  const [gerandoMes, setGerandoMes] = useState(false);

  const [confirmData, setConfirmData] = useState<{
  mensagem: string;
  onConfirm: () => Promise<void>;
} | null>(null);

  const [ano, mesNum] = mes.split("-").map((x) => Number(x));
  const monthIndex0 = (mesNum || 1) - 1;

  const diasDoMes = useMemo(() => {
    if (!ano || mesNum < 1 || mesNum > 12) return [];
    const total = daysInMonth(ano, monthIndex0);
    return Array.from({ length: total }, (_, i) => toISODate(ano, monthIndex0, i + 1));
  }, [ano, mesNum, monthIndex0]);

  const porDia = useMemo(() => {
    const map: Record<string, Disp[]> = {};
    for (const d of disps) {
      if (!map[d.data]) map[d.data] = [];
      map[d.data].push(d);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => `${a.horaInicio}`.localeCompare(`${b.horaInicio}`));
    }
    return map;
  }, [disps]);

  const semPermissao = useMemo(() => {
    if (!user?.uid) return true;
    if (!ownerIdDaQuadra) return false;
    return ownerIdDaQuadra !== user.uid;
  }, [user?.uid, ownerIdDaQuadra]);

  const gridDias = useMemo(() => {
    if (!ano || mesNum < 1 || mesNum > 12) return [];
    const firstDay = new Date(ano, monthIndex0, 1);
    const offset = offsetSemanaComecaSegunda(firstDay.getDay());

    const blanks = Array.from({ length: offset }, () => null as string | null);
    const dias = diasDoMes.map((d) => d as string | null);

    if (mostrarSomenteDiasComHorarios) {
      return dias
        .filter((dia) => (porDia[dia as string]?.length ?? 0) > 0)
        .map((d) => d as string | null);
    }

    return [...blanks, ...dias];
  }, [ano, mesNum, monthIndex0, diasDoMes, mostrarSomenteDiasComHorarios, porDia]);

  function isPastDay(isoDate: string) {
    return isoDate < todayISO();
  }

  function normalizeExcecao(raw: any) {
    if (!raw || typeof raw !== "object") return null;
    const aberto =
      typeof raw.aberto === "boolean"
        ? raw.aberto
        : typeof raw.fechado === "boolean"
        ? !raw.fechado
        : true;
    const inicio = raw.inicio ?? raw.abre;
    const fim = raw.fim ?? raw.fecha;
    return { aberto, inicio, fim };
  }

  function resumoExcecao(data: string) {
    const ex = normalizeExcecao(excecoes?.[data]);
    if (!ex) return null;
    if (ex.aberto === false) return "Exceção: FECHADO";
    if (typeof ex.inicio === "string" && typeof ex.fim === "string") return `Exceção: ${ex.inicio}–${ex.fim}`;
    return "Exceção: (custom)";
  }

  async function carregarTudo() {
    try {
      setErro(null);
      setMsg(null);
      setCarregando(true);

      if (!id) {
        setErro("Quadra inválida.");
        return;
      }

      const quadraRef = doc(db, "quadras", id);
      const quadraSnap = await getDoc(quadraRef);

      if (!quadraSnap.exists()) {
        setErro("Quadra não encontrada.");
        return;
      }

      const q = quadraSnap.data() as QuadraDoc;
      setOwnerIdDaQuadra(q.ownerId ?? "");
      setQuadraNome(q.nome ?? "");
      setFuncUI(toFuncUI((q as any).funcionamento));
      setExcecoes(q.excecoesFuncionamento ?? {});

      const start = `${mes}-01`;
      const end = `${mes}-${String(daysInMonth(ano, monthIndex0)).padStart(2, "0")}`;

      const col = collection(db, "disponibilidades");
      const qDisp = query(
        col,
        where("quadraId", "==", id),
        where("data", ">=", start),
        where("data", "<=", end)
      );

      const snap = await getDocs(qDisp);

      const lista: Disp[] = [];
      snap.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));

      setDisps(lista.filter((x) => x.removido !== true));
    } catch (e: any) {
      console.error(e);
      setErro("Erro ao carregar mês. Veja o console (pode pedir criação de índice).");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mes]);

  async function salvarFuncionamento() {
    try {
      setErro(null);
      setMsg(null);

      if (!id) return setErro("Quadra inválida.");
      if (!user?.uid) return setErro("Você precisa estar logado.");

      if (!isTimeValid(funcUI.padrao.abre) || !isTimeValid(funcUI.padrao.fecha)) {
        return setErro("Funcionamento: horário padrão inválido.");
      }

      setSalvandoFunc(true);
      await updateDoc(doc(db, "quadras", id), { funcionamento: fromFuncUI(funcUI) });

      setMsg("Funcionamento semanal salvo ✅");
      setMostrarEditorFunc(false);

      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao salvar funcionamento.");
    } finally {
      setSalvandoFunc(false);
    }
  }

  async function sincronizarDisponibilidadesDoDiaAposEdicao(data: string, gerarNovamente: boolean) {
  if (!id || !user?.uid) return;

  const lista = porDia[data] ?? [];

  const apagaveis = lista.filter((x) => !x.reservadoPorUid);

  if (apagaveis.length > 0) {
    await Promise.all(
      apagaveis.map((d) =>
        updateDoc(doc(db, "disponibilidades", d.id), {
          removido: true,
          ativo: false,
          bloqueado: false,
          bloqueadoPorUid: null,
        })
      )
    );
  }

  if (gerarNovamente) {
  try {
    await gerarDisponibilidadesParaData(id, data);
  } catch (e: any) {
    const msg = String(e?.message ?? "");

    if (msg.includes("bloqueada temporariamente")) {
      alert("⚠️ Sua quadra está bloqueada.\n\nRegularize o pagamento com a plataforma para voltar a gerar horários.");
      return;
    }

    alert("Erro ao gerar horários. Tente novamente.");
  }
}
}

  async function editarDia(data: string) {
    if (!id || !user?.uid) return;

    const atual = resumoExcecao(data) ?? "Sem exceção (usa semanal)";
    const escolha = window.prompt(
      `Editar DIA ${data}\n\nAtual: ${atual}\n\nDigite:\n1 = Definir/editar horário\n2 = Marcar FECHADO\n3 = Remover exceção\n\n(Enter = cancelar)`
    );
    if (!escolha) return;

    try {
      setErro(null);
      setMsg(null);
      setTrabalhandoDia(data);

      if (escolha.trim() === "1") {
        const abre =
          window.prompt(
            "Abre (HH:MM)",
            (normalizeExcecao(excecoes?.[data])?.inicio as string) ?? "08:00"
          ) ?? "";
        const fecha =
          window.prompt(
            "Fecha (HH:MM)",
            (normalizeExcecao(excecoes?.[data])?.fim as string) ?? "22:00"
          ) ?? "";

        if (!isTimeValid(abre) || !isTimeValid(fecha)) {
          setMsg("Horário inválido. Use HH:MM (ex: 22:00).");
          return;
        }

        await updateDoc(doc(db, "quadras", id), {
          [`excecoesFuncionamento.${data}`]: { aberto: true, inicio: abre, fim: fecha },
        });

        await sincronizarDisponibilidadesDoDiaAposEdicao(data, true);

        setMsg(`Exceção do dia ${data} salva: ${abre}–${fecha} ✅`);
        await carregarTudo();
        return;
      }

      if (escolha.trim() === "2") {
        await updateDoc(doc(db, "quadras", id), {
          [`excecoesFuncionamento.${data}`]: { aberto: false },
        });

        await sincronizarDisponibilidadesDoDiaAposEdicao(data, false);

        setMsg(`Exceção do dia ${data} salva: FECHADO ✅`);
        await carregarTudo();
        return;
      }

      if (escolha.trim() === "3") {
        await updateDoc(doc(db, "quadras", id), {
          [`excecoesFuncionamento.${data}`]: deleteField(),
        });

        setMsg(`Exceção do dia ${data} removida (voltou pro semanal) ✅`);
        await carregarTudo();
        return;
      }

      setMsg("Opção inválida. Use 1, 2 ou 3.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao editar dia.");
    } finally {
      setTrabalhandoDia("");
    }
  }

  async function gerarDia(data: string) {
    if (!id) return;

    if (isPastDay(data)) {
      setErro(null);
      setMsg(`Não é permitido gerar horários em dia passado (${data}).`);
      return;
    }

    try {
      setMsg(null);
      setErro(null);
      setTrabalhandoDia(data);

      const r: any = await gerarDisponibilidadesParaData(id, data);

      if (r?.fechado) {
        setMsg(`⚠️ ${data} está fechado (${r?.motivo ?? "regra de funcionamento"}). Nenhum horário criado.`);
      } else {
        setMsg(`✅ ${r.criados} horários criados para ${data}`);
      }

      await carregarTudo();
    } catch (e) {
      console.error(e);
      setErro("Erro ao gerar horários do dia. Veja o console.");
    } finally {
      setTrabalhandoDia("");
    }
  }

  async function onGerarMes() {
    if (!id) return;
    if (semPermissao) return;

    setConfirmData({
  mensagem:
    `Gerar horários para TODOS os dias deste mês (${mes})?\n\n` +
    `Dias passados serão ignorados.\n` +
    `Se um dia estiver FECHADO (por funcionamento/exceção), ele não cria horários.`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg(null);
      setGerandoMes(true);

      const hoje = todayISO();
      const diasValidos = diasDoMes.filter((d) => d >= hoje);

      if (diasValidos.length === 0) {
        setMsg("Não há dias futuros neste mês para gerar.");
        return;
      }

      let totalCriados = 0;
      let totalFechados = 0;
      let totalFalhas = 0;

      for (let i = 0; i < diasValidos.length; i++) {
        const data = diasValidos[i];
        setTrabalhandoDia(data);
        setMsg(`Gerando mês... (${i + 1}/${diasValidos.length}) Dia: ${data}`);

        try {
          const r: any = await gerarDisponibilidadesParaData(id, data);

          if (r?.fechado) {
            totalFechados += 1;
          } else {
            totalCriados += Number(r?.criados ?? 0);
          }
        } catch (e) {
          console.error("Falha ao gerar dia", data, e);
          totalFalhas += 1;
        }
      }

      setMsg(
        `Mês ${mes}: geração concluída ✅ ` +
          `Criados: ${totalCriados} • Fechados: ${totalFechados} • Falhas: ${totalFalhas}`
      );

      await carregarTudo();
    } finally {
      setGerandoMes(false);
      setTrabalhandoDia("");
    }
  },
});

return;
  }

  async function zerarDia(data: string) {
    if (!id || !user?.uid) return;

setConfirmData({
  mensagem:
    `Zerar horários do dia (${data})?\n\n` +
    `Isso vai REMOVER todos os slots do dia que NÃO estão reservados.\n` +
    `Slots com reserva serão mantidos.`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg(null);
      setTrabalhandoDia(data);

      const lista = porDia[data] ?? [];
      if (lista.length === 0) {
        setMsg("Não há horários nesse dia.");
        return;
      }

      const apagaveis = lista.filter((x) => !x.reservadoPorUid);
      const protegidos = lista.length - apagaveis.length;

      if (apagaveis.length === 0) {
        setMsg("Nenhum slot pode ser removido: todos estão reservados.");
        return;
      }

      await Promise.all(
        apagaveis.map((d) =>
          updateDoc(doc(db, "disponibilidades", d.id), {
            removido: true,
            ativo: false,
            bloqueado: false,
            bloqueadoPorUid: null,
          })
        )
      );

      setMsg(`Dia ${data}: removidos ${apagaveis.length} slots. Protegidos (reservados): ${protegidos}. ✅`);
      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao zerar dia.");
    } finally {
      setTrabalhandoDia("");
    }
  },
});

return;
  }

  async function zerarMesAtual() {
    if (!id || !user?.uid) return;

    setConfirmData({
  mensagem:
    `Zerar TODOS os horários deste mês (${mes})?\n\n` +
    `Isso vai REMOVER todos os slots do mês que NÃO estão reservados.\n` +
    `Slots com reserva serão mantidos.`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg(null);
      setZerandoMes(true);

      const apagaveis = disps.filter((x) => !x.reservadoPorUid);
      const protegidos = disps.length - apagaveis.length;

      if (apagaveis.length === 0) {
        setMsg("Nenhum slot pode ser removido: todos estão reservados (ou não existe nada).");
        return;
      }

      for (let i = 0; i < apagaveis.length; i += 400) {
        const chunk = apagaveis.slice(i, i + 400);
        await Promise.all(
          chunk.map((d) =>
            updateDoc(doc(db, "disponibilidades", d.id), {
              removido: true,
              ativo: false,
              bloqueado: false,
              bloqueadoPorUid: null,
            })
          )
        );
      }

      setMsg(`Mês ${mes}: removidos ${apagaveis.length} slots. Protegidos (reservados): ${protegidos}. ✅`);
      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao zerar mês.");
    } finally {
      setZerandoMes(false);
    }
  },
});

return;
  }

  async function bloquearDia(data: string) {
    if (!id || !user?.uid) return;

    setConfirmData({
  mensagem:
    `Bloquear o dia inteiro (${data})?\n\nIsso desativa TODOS os horários ATIVOS do dia.\n(Reservas já feitas não são alteradas.)`,
  onConfirm: async () => {
    try {
      setMsg(null);
      setErro(null);
      setTrabalhandoDia(data);

      const lista = porDia[data] ?? [];
      if (lista.length === 0) {
        setMsg("Não há horários nesse dia. Gere o dia primeiro.");
        return;
      }

      const promises: Promise<any>[] = [];
      for (const disp of lista) {
        if (disp.reservadoPorUid) continue;
        if (disp.ativo !== true) continue;

        promises.push(
          updateDoc(doc(db, "disponibilidades", disp.id), {
            ativo: false,
            bloqueado: true,
            bloqueadoPorUid: user.uid,
          })
        );
      }

      await Promise.all(promises);
      setMsg(`Dia ${data} bloqueado ✅`);
      await carregarTudo();
    } catch (e) {
      console.error(e);
      setErro("Erro ao bloquear o dia.");
    } finally {
      setTrabalhandoDia("");
    }
  },
});

return;
  }

  async function desbloquearDia(data: string) {
    if (!id || !user?.uid) return;

setConfirmData({
  mensagem:
    `Desbloquear o dia inteiro (${data})?\n\nIsso reativa TODOS os horários bloqueados do dia.`,
  onConfirm: async () => {
    try {
      setMsg(null);
      setErro(null);
      setTrabalhandoDia(data);

      const lista = porDia[data] ?? [];
      if (lista.length === 0) {
        setMsg("Não há horários nesse dia. Gere o dia primeiro.");
        return;
      }

      const promises: Promise<any>[] = [];
      for (const disp of lista) {
        if (disp.reservadoPorUid) continue;
        if (!disp.bloqueado) continue;

        promises.push(
          updateDoc(doc(db, "disponibilidades", disp.id), {
            ativo: true,
            bloqueado: false,
            bloqueadoPorUid: null,
          })
        );
      }

      await Promise.all(promises);
      setMsg(`Dia ${data} desbloqueado ✅`);
      await carregarTudo();
    } catch (e) {
      console.error(e);
      setErro("Erro ao desbloquear o dia.");
    } finally {
      setTrabalhandoDia("");
    }
  },
});

return;
  }

  if (loading) return <p>Carregando usuário...</p>;
  if (!user) return <p>Você precisa estar logado.</p>;

  const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <Etapa2GerarHorariosBanner
            onGerarMes={gerandoMes ? undefined : onGerarMes}
            textoExtra={gerandoMes ? `Gerando mês... aguarde (dia atual: ${trabalhandoDia || "—"})` : undefined}
          />

          <div style={styles.hero}>
            <div style={styles.heroBadge}>Etapa 2 do cadastro</div>
            <h1 style={styles.heroTitle}>Gerenciar horários do mês</h1>
            <p style={styles.heroText}>
              Configure o funcionamento da quadra, gere horários por dia ou para o mês inteiro,
              bloqueie datas específicas e finalize o cadastro quando estiver tudo pronto.
            </p>

            {quadraNome ? (
              <div
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                Quadra: {quadraNome}
              </div>
            ) : null}
          </div>

          <div style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h2 style={styles.sectionTitle}>Painel de horários</h2>
                <p style={styles.sectionText}>
                  Ajuste o funcionamento semanal e controle a grade de horários do mês.
                </p>
              </div>

              <div style={styles.topActions}>
                <Link to={`/quadra/${id}`} style={{ textDecoration: "none" }}>
                  <button style={styles.neutralBtn}>Voltar</button>
                </Link>

                <Link to={`/dono/quadra/${id}/editar`} style={{ textDecoration: "none" }}>
                  <button style={styles.neutralBtn}>Editar quadra</button>
                </Link>
              </div>
            </div>

            <div
              style={{
                ...styles.workingCard,
                border: semPermissao ? "1px solid #fecaca" : "1px solid #e2e8f0",
                background: semPermissao ? "#fff5f5" : "#f8fafc",
              }}
            >
              {semPermissao ? (
                <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>
                  Você não tem permissão para gerenciar horários desta quadra.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 16, color: "#0f172a" }}>
                        Funcionamento semanal
                      </strong>
                      <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                        {resumoFuncionamento(funcUI)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setMostrarEditorFunc((v) => !v)}
                        style={styles.neutralBtn}
                      >
                        {mostrarEditorFunc ? "Fechar editor" : "Editar funcionamento semanal"}
                      </button>

                      <button
                        onClick={zerarMesAtual}
                        disabled={zerandoMes || gerandoMes}
                        style={styles.redBtn}
                      >
                        {zerandoMes ? "Zerando..." : `Zerar mês (${mes})`}
                      </button>
                    </div>
                  </div>

                  {mostrarEditorFunc ? (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: "1px dashed #cbd5e1",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={funcUI.mesmoHorarioTodosOsDias}
                          onChange={(e) => {
  const checked = e.target.checked;

  setFuncUI((prev) => {
    const novo = { ...prev, mesmoHorarioTodosOsDias: checked };

    if (checked) {
      // aplica padrão em tudo
      novo.semana = { ...prev.semana, abre: prev.padrao.abre, fecha: prev.padrao.fecha };
      novo.sabado = { ...prev.sabado, abre: prev.padrao.abre, fecha: prev.padrao.fecha };
      novo.domingo = { ...prev.domingo, abre: prev.padrao.abre, fecha: prev.padrao.fecha };
    }

    return novo;
  });
}}
                        />
                        Mesmo horário todos os dias
                      </label>
<div
  style={{
    marginTop: 14,
    display: "grid",
    gap: 14,
  }}
>
  {funcUI.mesmoHorarioTodosOsDias ? (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "end",
      }}
    >
      <label style={styles.field}>
        <span style={styles.label}>Abre</span>
        <input
          type="time"
          value={funcUI.padrao.abre}
          onChange={(e) => {
            setMsg(null);
            setErro(null);
            setFuncUI((p) => ({
              ...p,
              padrao: { ...p.padrao, abre: e.target.value },
            }));
          }}
          style={styles.input}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Fecha</span>
        <input
          type="time"
          value={funcUI.padrao.fecha}
          onChange={(e) => {
            setMsg(null);
            setErro(null);
            setFuncUI((p) => ({
              ...p,
              padrao: { ...p.padrao, fecha: e.target.value },
            }));
          }}
          style={styles.input}
        />
      </label>

      <button
        onClick={salvarFuncionamento}
        disabled={salvandoFunc || gerandoMes}
        style={styles.greenBtn}
      >
        {salvandoFunc ? "Salvando..." : "Salvar funcionamento semanal"}
      </button>
    </div>
  ) : (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
            Semana (seg–sex)
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Abre</span>
            <input
              type="time"
              value={funcUI.semana.abre}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  semana: { ...p.semana, abre: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>

          <label style={{ ...styles.field, marginTop: 10 }}>
            <span style={styles.label}>Fecha</span>
            <input
              type="time"
              value={funcUI.semana.fecha}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  semana: { ...p.semana, fecha: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
            Sábado
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Abre</span>
            <input
              type="time"
              value={funcUI.sabado.abre}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  sabado: { ...p.sabado, abre: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>

          <label style={{ ...styles.field, marginTop: 10 }}>
            <span style={styles.label}>Fecha</span>
            <input
              type="time"
              value={funcUI.sabado.fecha}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  sabado: { ...p.sabado, fecha: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
            Domingo
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Abre</span>
            <input
              type="time"
              value={funcUI.domingo.abre}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  domingo: { ...p.domingo, abre: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>

          <label style={{ ...styles.field, marginTop: 10 }}>
            <span style={styles.label}>Fecha</span>
            <input
              type="time"
              value={funcUI.domingo.fecha}
              onChange={(e) => {
                setMsg(null);
                setErro(null);
                setFuncUI((p) => ({
                  ...p,
                  domingo: { ...p.domingo, fecha: e.target.value },
                }));
              }}
              style={styles.input}
            />
          </label>
        </div>
      </div>

      <div>
        <button
          onClick={salvarFuncionamento}
          disabled={salvandoFunc || gerandoMes}
          style={styles.greenBtn}
        >
          {salvandoFunc ? "Salvando..." : "Salvar funcionamento semanal"}
        </button>
      </div>
    </>
  )}
</div>
                      <p style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                        Fechar em <strong>00:00</strong> significa até o fim do dia
                        (ex: 16:00–00:00).
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {!semPermissao ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "end",
                    marginTop: 16,
                  }}
                >
                  <label style={styles.field}>
                    <span style={styles.label}>Mês</span>
                    <input
                      type="month"
                      value={mes}
                      onChange={(e) => {
                        setMsg(null);
                        setErro(null);
                        setMes(e.target.value);
                      }}
                      style={styles.input}
                    />
                  </label>

                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      minHeight: 44,
                      padding: "0 4px",
                      fontWeight: 700,
                      color: "#334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={mostrarSomenteDiasComHorarios}
                      onChange={(e) => setMostrarSomenteDiasComHorarios(e.target.checked)}
                    />
                    Mostrar só dias com horários
                  </label>

                  <button
                    onClick={carregarTudo}
                    disabled={carregando || gerandoMes}
                    style={styles.neutralBtn}
                  >
                    {carregando ? "Atualizando..." : "Atualizar"}
                  </button>

                  <button
                    onClick={onGerarMes}
                    disabled={gerandoMes || semPermissao}
                    style={styles.blueBtn}
                  >
                    {gerandoMes ? "Gerando mês..." : "Gerar horários do mês"}
                  </button>
                </div>

                <div style={styles.statusBox}>
                  {erro ? (
                    <span style={{ color: "#b91c1c" }}>{erro}</span>
                  ) : msg ? (
                    <span style={{ color: "#15803d" }}>{msg}</span>
                  ) : (
                    <span style={{ color: "#64748b" }}>—</span>
                  )}
                </div>

                {carregando ? (
                  <div style={{ marginTop: 20, color: "#475569", fontWeight: 700 }}>
                    Carregando mês...
                  </div>
                ) : (
                  <>
                    {!mostrarSomenteDiasComHorarios ? (
                      <div style={styles.gridViewport}>
                        <div style={styles.weekGrid}>
                          {DIAS_SEMANA.map((d) => (
                            <div key={d} style={styles.weekHeader}>
                              {d}
                            </div>
                          ))}
                        </div>

                        <div style={styles.monthGrid}>
                          {gridDias.map((diaOrNull, idx) => {
                            if (!diaOrNull) {
                              return <div key={`blank-${idx}`} style={styles.blankDay} />;
                            }

                            const dia = diaOrNull;
                            const lista = porDia[dia] ?? [];
                            const total = lista.length;

                            const ativos = lista.filter((x) => x.ativo === true).length;
                            const bloqueados = lista.filter((x) => x.bloqueado === true).length;
                            const reservados = lista.filter((x) => !!x.reservadoPorUid).length;

                            const busy = trabalhandoDia === dia || gerandoMes;
                            const temHorarios = total > 0;
                            const diaNum = dayNumberFromISO(dia);
                            const passado = isPastDay(dia);

                            const exResumo = resumoExcecao(dia);

                            return (
                              <div
                                key={dia}
                                style={{
                                  ...(temHorarios ? styles.dayCardActive : styles.dayCardEmpty),
                                  opacity: passado ? 0.72 : 1,
                                }}
                              >
                                <div style={styles.dayTop}>
                                  <div style={styles.dayHeader}>
                                    <div style={styles.dayNumber}>{diaNum}</div>

                                    <div style={styles.dayMeta}>
                                      {temHorarios ? (
                                        <>
                                          <strong>{total}</strong> horários no dia
                                        </>
                                      ) : passado ? (
                                        "Dia passado"
                                      ) : (
                                        "Sem horários"
                                      )}
                                    </div>

                                    {temHorarios ? (
                                      <div style={styles.dayStatsWrap}>
                                        <div style={styles.statBadgeRow}>
                                          <span style={styles.statGreen}>🟢 {ativos} ativos</span>
                                          <span style={styles.statRed}>🔒 {bloqueados} bloqueados</span>
                                          <span style={styles.statBlue}>📅 {reservados} reservados</span>
                                        </div>
                                      </div>
                                    ) : null}

                                    {exResumo ? (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          fontSize: 12,
                                          color: "#334155",
                                          fontWeight: 800,
                                          padding: "6px 8px",
                                          borderRadius: 10,
                                          background: "#f8fafc",
                                          border: "1px solid #e2e8f0",
                                          display: "inline-block",
                                        }}
                                      >
                                        {exResumo}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div
  style={{
    ...styles.dayActions,
    alignItems: "center",
  }}
>
                                    <button
                                      onClick={() => gerarDia(dia)}
                                      disabled={busy || passado}
                                      style={styles.smallGreenBtn}
                                    >
                                      {busy ? "..." : "⚡ Gerar"}
                                    </button>

                                  <Link
  to={`/dono/quadra/${id}/horarios-dia/${dia}`}
  style={{
    textDecoration: "none",
    display: "block",
    width: "100%",
  }}
>
  <div
    style={{
      ...styles.smallBtn,
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      boxSizing: "border-box",
      textAlign: "center",
    }}
  >
    <span>📅</span>
    <span>Abrir dia</span>
  </div>
</Link>

                                    <button
                                      onClick={() => bloquearDia(dia)}
                                      disabled={busy || !temHorarios}
                                      style={styles.smallBtn}
                                    >
                                      🔒 Bloq.
                                    </button>

                                    <button
                                      onClick={() => desbloquearDia(dia)}
                                      disabled={busy || !temHorarios}
                                      style={styles.smallBtn}
                                    >
                                      🔓 Desbloq.
                                    </button>

                                    <button
                                      onClick={() => zerarDia(dia)}
                                      disabled={busy || !temHorarios}
                                      style={styles.smallRedBtn}
                                    >
                                      🧹 Zerar
                                    </button>

                                    <button
                                      onClick={() => editarDia(dia)}
                                      disabled={busy}
                                      style={styles.smallBtn}
                                    >
                                      ✏️ Editar
                                    </button>
                                  </div>

                                  {temHorarios ? (
                                    <div style={styles.miniSlots}>
                                      <div style={styles.slotsHint}>Prévia dos horários</div>

                                      {lista.slice(0, 2).map((s) => (
                                        <div
                                          key={s.id}
                                          style={{
                                            ...styles.miniSlotRow,
                                            opacity: s.ativo ? 1 : 0.8,
                                          }}
                                        >
                                          <span>
                                            {s.horaInicio}–{s.horaFim}
                                          </span>

                                          <span
                                            style={{
                                              color: s.reservadoPorUid
                                                ? "#334155"
                                                : s.bloqueado
                                                ? "#b91c1c"
                                                : s.ativo
                                                ? "#15803d"
                                                : "#64748b",
                                              fontWeight: 800,
                                            }}
                                          >
                                            {s.reservadoPorUid
                                              ? "reservado"
                                              : s.bloqueado
                                              ? "bloqueado"
                                              : s.ativo
                                              ? "ativo"
                                              : "off"}
                                          </span>
                                        </div>
                                      ))}

                                      {total > 2 ? (
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: "#64748b",
                                            fontWeight: 700,
                                          }}
                                        >
                                          +{total - 2} horários…
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={styles.singleColumnGrid}>
                        {gridDias.map((diaOrNull, idx) => {
                          if (!diaOrNull) {
                            return <div key={`blank-${idx}`} style={styles.blankDay} />;
                          }

                          const dia = diaOrNull;
                          const lista = porDia[dia] ?? [];
                          const total = lista.length;

                          const ativos = lista.filter((x) => x.ativo === true).length;
                          const bloqueados = lista.filter((x) => x.bloqueado === true).length;
                          const reservados = lista.filter((x) => !!x.reservadoPorUid).length;

                          const busy = trabalhandoDia === dia || gerandoMes;
                          const temHorarios = total > 0;
                          const diaNum = dayNumberFromISO(dia);
                          const passado = isPastDay(dia);

                          const exResumo = resumoExcecao(dia);

                          return (
                            <div
                              key={dia}
                              style={{
                                ...(temHorarios ? styles.dayCardActive : styles.dayCardEmpty),
                                opacity: passado ? 0.72 : 1,
                              }}
                            >
                              <div style={styles.dayTop}>
                                <div style={styles.dayHeader}>
                                  <div style={styles.dayNumber}>{diaNum}</div>

                                  <div style={styles.dayMeta}>
                                    {temHorarios ? (
                                      <>
                                        <strong>{total}</strong> horários no dia
                                      </>
                                    ) : passado ? (
                                      "Dia passado"
                                    ) : (
                                      "Sem horários"
                                    )}
                                  </div>

                                  {temHorarios ? (
                                    <div style={styles.dayStatsWrap}>
                                      <div style={styles.statBadgeRow}>
                                        <span style={styles.statGreen}>🟢 {ativos} ativos</span>
                                        <span style={styles.statRed}>🔒 {bloqueados} bloqueados</span>
                                        <span style={styles.statBlue}>📅 {reservados} reservados</span>
                                      </div>
                                    </div>
                                  ) : null}

                                  {exResumo ? (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        color: "#334155",
                                        fontWeight: 800,
                                        padding: "6px 8px",
                                        borderRadius: 10,
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        display: "inline-block",
                                      }}
                                    >
                                      {exResumo}
                                    </div>
                                  ) : null}
                                </div>

                                <div style={styles.dayActions}>
                                  <button
                                    onClick={() => gerarDia(dia)}
                                    disabled={busy || passado}
                                    style={styles.smallGreenBtn}
                                  >
                                    {busy ? "..." : "⚡ Gerar"}
                                  </button>

                                  <button
                                    onClick={() => bloquearDia(dia)}
                                    disabled={busy || !temHorarios}
                                    style={styles.smallBtn}
                                  >
                                    🔒 Bloq.
                                  </button>

                                  <button
                                    onClick={() => desbloquearDia(dia)}
                                    disabled={busy || !temHorarios}
                                    style={styles.smallBtn}
                                  >
                                    🔓 Desbloq.
                                  </button>

                                  <button
                                    onClick={() => zerarDia(dia)}
                                    disabled={busy || !temHorarios}
                                    style={styles.smallRedBtn}
                                  >
                                    🧹 Zerar
                                  </button>

                                  <button
                                    onClick={() => editarDia(dia)}
                                    disabled={busy}
                                    style={styles.smallBtn}
                                  >
                                    ✏️ Editar
                                  </button>
                                </div>

                                {temHorarios ? (
                                  <div style={styles.miniSlots}>
                                    <div style={styles.slotsHint}>Prévia dos horários</div>

                                    {lista.slice(0, 2).map((s) => (
                                      <div
                                        key={s.id}
                                        style={{
                                          ...styles.miniSlotRow,
                                          opacity: s.ativo ? 1 : 0.8,
                                        }}
                                      >
                                        <span>
                                          {s.horaInicio}–{s.horaFim}
                                        </span>

                                        <span
                                          style={{
                                            color: s.reservadoPorUid
                                              ? "#334155"
                                              : s.bloqueado
                                              ? "#b91c1c"
                                              : s.ativo
                                              ? "#15803d"
                                              : "#64748b",
                                            fontWeight: 800,
                                          }}
                                        >
                                          {s.reservadoPorUid
                                            ? "reservado"
                                            : s.bloqueado
                                            ? "bloqueado"
                                            : s.ativo
                                            ? "ativo"
                                            : "off"}
                                        </span>
                                      </div>
                                    ))}

                                    {total > 2 ? (
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: "#64748b",
                                          fontWeight: 700,
                                        }}
                                      >
                                        +{total - 2} horários…
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>

          <div style={styles.bottomFinalize}>
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 24, color: "#0f172a" }}>
              Finalizar cadastro da quadra
            </h3>

            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              Após finalizar, a quadra será considerada pronta para receber reservas.
            </p>

            <button
              style={styles.greenBtn}
              onClick={async () => {
                if (!id) return;
setConfirmData({
  mensagem: "Tem certeza que deseja finalizar o cadastro da quadra?",
  onConfirm: async () => {
    try {
      await updateDoc(doc(db, "quadras", id), {
        cadastroFinalizado: true,
      });

      alert("Quadra finalizada com sucesso ✅");
      window.location.href = "/dono";
    } catch (e) {
      console.error(e);
      alert("Erro ao finalizar cadastro.");
    }
  },
});

return;
              }}
            >
              ✅ Finalizar cadastro
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={!!confirmData}
        title="Confirmar ação"
        message={confirmData?.mensagem ?? ""}
        confirmText="Confirmar"
        cancelText="Voltar"
        onConfirm={async () => {
          if (!confirmData) return;
          await confirmData.onConfirm();
          setConfirmData(null);
        }}
        onCancel={() => setConfirmData(null)}
      />
    </>
  );
}