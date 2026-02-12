import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "../../components/Header";
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

type Disp = {
  id: string;
  quadraId: string;
  data: string; // YYYY-MM-DD
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

// --------- Funcionamento semanal (editor simples na grade) ---------
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
  dias: Record<DiaLongo, DiaUI>;
};

function defaultFuncUI(): FuncUI {
  const dia: DiaUI = { fechado: false, abre: "08:00", fecha: "22:00" };
  return {
    mesmoHorarioTodosOsDias: true,
    padrao: { abre: "08:00", fecha: "22:00" },
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

  if (typeof raw.mesmoHorarioTodosOsDias === "boolean") ui.mesmoHorarioTodosOsDias = raw.mesmoHorarioTodosOsDias;

  // ✅ aceita abre/fecha e inicio/fim
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
  };

  for (const d of DIAS_LONGOS) {
    const dia = ui.mesmoHorarioTodosOsDias
      ? { fechado: false, abre: ui.padrao.abre, fecha: ui.padrao.fecha }
      : ui.dias[d.key];

    if (dia.fechado) out[d.key] = { aberto: false };
    else out[d.key] = { aberto: true, inicio: dia.abre, fim: dia.fecha };
  }

  return out;
}

function resumoFuncionamento(ui: FuncUI) {
  if (ui.mesmoHorarioTodosOsDias) return `Todos os dias: ${ui.padrao.abre}–${ui.padrao.fecha}`;
  return DIAS_LONGOS.map((d) => {
    const dia = ui.dias[d.key];
    return dia.fechado ? `${d.short} fechado` : `${d.short} ${dia.abre}–${dia.fecha}`;
  }).join(" • ");
}

// ---------------------------------------------------------------

export default function GerenciarHorariosMes() {
  const { id } = useParams<{ id: string }>(); // quadraId
  const { user, loading } = useAuth();

  const [quadraNome, setQuadraNome] = useState<string>("");
  const [ownerIdDaQuadra, setOwnerIdDaQuadra] = useState<string>("");

  const [mes, setMes] = useState(() => monthKey(new Date())); // "YYYY-MM"
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

  // ✅ exceções por data
  const [excecoes, setExcecoes] = useState<Record<string, any>>({});

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
      return dias.filter((dia) => (porDia[dia as string]?.length ?? 0) > 0).map((d) => d as string | null);
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

      // 1) carrega quadra
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

      // 2) carrega disponibilidades do mês
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

      // ✅ ignora removidos
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

      // recarrega pra refletir no resumo de cima
      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao salvar funcionamento.");
    } finally {
      setSalvandoFunc(false);
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
        const abre = window.prompt("Abre (HH:MM)", (normalizeExcecao(excecoes?.[data])?.inicio as string) ?? "08:00") ?? "";
        const fecha = window.prompt("Fecha (HH:MM)", (normalizeExcecao(excecoes?.[data])?.fim as string) ?? "22:00") ?? "";

        if (!isTimeValid(abre) || !isTimeValid(fecha)) {
          setMsg("Horário inválido. Use HH:MM (ex: 22:00).");
          return;
        }

        await updateDoc(doc(db, "quadras", id), {
          [`excecoesFuncionamento.${data}`]: { aberto: true, inicio: abre, fim: fecha },
        });

        setMsg(`Exceção do dia ${data} salva: ${abre}–${fecha} ✅`);
        await carregarTudo();
        return;
      }

      if (escolha.trim() === "2") {
        await updateDoc(doc(db, "quadras", id), {
          [`excecoesFuncionamento.${data}`]: { aberto: false },
        });

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
        setMsg(`Dia ${data}: quadra FECHADA (motivo: ${r?.motivo ?? "regra"}). Nenhum horário criado.`);
      } else {
        setMsg(`Dia ${data}: horários criados: ${r.criados}`);
      }

      await carregarTudo();
    } catch (e) {
      console.error(e);
      setErro("Erro ao gerar horários do dia. Veja o console.");
    } finally {
      setTrabalhandoDia("");
    }
  }

  async function zerarDia(data: string) {
    if (!id || !user?.uid) return;

    const ok = window.confirm(
      `Zerar horários do dia (${data})?\n\n` +
        `Isso vai REMOVER todos os slots do dia que NÃO estão reservados.\n` +
        `Slots com reserva serão mantidos.`
    );
    if (!ok) return;

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
  }

  async function zerarMesAtual() {
    if (!id || !user?.uid) return;

    const ok = window.confirm(
      `Zerar TODOS os horários deste mês (${mes})?\n\n` +
        `Isso vai REMOVER todos os slots do mês que NÃO estão reservados.\n` +
        `Slots com reserva serão mantidos.`
    );
    if (!ok) return;

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
  }

  async function bloquearDia(data: string) {
    if (!id || !user?.uid) return;

    const ok = window.confirm(
      `Bloquear o dia inteiro (${data})?\n\nIsso desativa TODOS os horários ATIVOS do dia.\n(Reservas já feitas não são alteradas.)`
    );
    if (!ok) return;

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
  }

  async function desbloquearDia(data: string) {
    if (!id || !user?.uid) return;

    const ok = window.confirm(
      `Desbloquear o dia inteiro (${data})?\n\nIsso reativa apenas horários que foram bloqueados pelo dono.`
    );
    if (!ok) return;

    try {
      setMsg(null);
      setErro(null);
      setTrabalhandoDia(data);

      const lista = porDia[data] ?? [];
      if (lista.length === 0) {
        setMsg("Não há horários nesse dia.");
        return;
      }

      const promises: Promise<any>[] = [];
      for (const disp of lista) {
        if (disp.reservadoPorUid) continue;
        if (disp.bloqueado !== true) continue;

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
  }

  if (loading) return <p>Carregando usuário...</p>;
  if (!user) return <p>Você precisa estar logado.</p>;

  const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <>
      <Header />

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Gerenciar horários (mês)</h1>
            {quadraNome ? <div style={{ marginTop: 6, color: "#666" }}>Quadra: <strong>{quadraNome}</strong></div> : null}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to={`/quadra/${id}`}><button>Voltar</button></Link>
            <Link to={`/dono/quadra/${id}/editar`}><button>Editar quadra</button></Link>
          </div>
        </div>

        <hr style={{ margin: "16px 0" }} />

        {semPermissao ? (
          <div style={{ border: "1px solid #f2c2c2", background: "#fff5f5", padding: 12, borderRadius: 12 }}>
            <p style={{ margin: 0, color: "#a00" }}>Você não tem permissão para gerenciar horários desta quadra.</p>
          </div>
        ) : (
          <>
            <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 980 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <strong>Funcionamento semanal (usado na geração, quando não há exceção)</strong>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>{resumoFuncionamento(funcUI)}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setMostrarEditorFunc((v) => !v)}>
                    {mostrarEditorFunc ? "Fechar editor" : "Editar funcionamento semanal"}
                  </button>

                  <button onClick={zerarMesAtual} disabled={zerandoMes}>
                    {zerandoMes ? "Zerando..." : `Zerar mês (${mes})`}
                  </button>
                </div>
              </div>

              {mostrarEditorFunc && (
                <div style={{ marginTop: 12, borderTop: "1px dashed #ddd", paddingTop: 12 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={funcUI.mesmoHorarioTodosOsDias}
                      onChange={(e) => {
                        setMsg(null);
                        setErro(null);
                        setFuncUI((p) => ({ ...p, mesmoHorarioTodosOsDias: e.target.checked }));
                      }}
                    />
                    <span>Mesmo horário todos os dias</span>
                  </label>

                  <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Abre</span>
                      <input
                        type="time"
                        value={funcUI.padrao.abre}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, abre: e.target.value } }));
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Fecha</span>
                      <input
                        type="time"
                        value={funcUI.padrao.fecha}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, fecha: e.target.value } }));
                        }}
                      />
                    </div>

                    <button onClick={salvarFuncionamento} disabled={salvandoFunc}>
                      {salvandoFunc ? "Salvando..." : "Salvar funcionamento semanal"}
                    </button>
                  </div>

                  <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                    Observação: Fechar em <strong>00:00</strong> significa “até o fim do dia” (ex: 16:00–00:00).
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Mês</span>
                <input
                  type="month"
                  value={mes}
                  onChange={(e) => {
                    setMsg(null);
                    setErro(null);
                    setMes(e.target.value);
                  }}
                />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 20 }}>
                <input
                  type="checkbox"
                  checked={mostrarSomenteDiasComHorarios}
                  onChange={(e) => setMostrarSomenteDiasComHorarios(e.target.checked)}
                />
                Mostrar só dias com horários
              </label>

              <button onClick={carregarTudo} disabled={carregando} style={{ marginTop: 20 }}>
                {carregando ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            <div style={{ marginTop: 12, minHeight: 18, fontSize: 13 }}>
              {erro ? <span style={{ color: "crimson" }}>{erro}</span> : msg ? <span style={{ color: "green" }}>{msg}</span> : <span style={{ color: "#666" }}>—</span>}
            </div>

            <hr style={{ margin: "16px 0" }} />

            {carregando ? (
              <p>Carregando mês...</p>
            ) : (
              <>
                {!mostrarSomenteDiasComHorarios && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 8, maxWidth: 980 }}>
                    {DIAS_SEMANA.map((d) => (
                      <div key={d} style={{ fontSize: 12, fontWeight: 800, color: "#666", padding: "0 6px" }}>{d}</div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: mostrarSomenteDiasComHorarios ? "repeat(1, minmax(0, 1fr))" : "repeat(7, minmax(0, 1fr))",
                    gap: 8,
                    maxWidth: 980,
                  }}
                >
                  {gridDias.map((diaOrNull, idx) => {
                    if (!diaOrNull) {
                      return <div key={`blank-${idx}`} style={{ border: "1px dashed #eee", borderRadius: 12, padding: 10, minHeight: 90, background: "#fafafa" }} />;
                    }

                    const dia = diaOrNull;
                    const lista = porDia[dia] ?? [];
                    const total = lista.length;

                    const ativos = lista.filter((x) => x.ativo === true).length;
                    const bloqueados = lista.filter((x) => x.bloqueado === true).length;
                    const reservados = lista.filter((x) => !!x.reservadoPorUid).length;

                    const busy = trabalhandoDia === dia;
                    const temHorarios = total > 0;
                    const diaNum = dayNumberFromISO(dia);
                    const passado = isPastDay(dia);

                    const exResumo = resumoExcecao(dia);

                    return (
                      <div
                        key={dia}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 12,
                          padding: 10,
                          minHeight: 90,
                          background: temHorarios ? "#fff" : "#fcfcfc",
                          opacity: passado ? 0.75 : 1,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{diaNum}</div>

                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                              {temHorarios ? (
                                <>
                                  <strong>{total}</strong> horários • <strong>{ativos}</strong> ativos • <strong>{bloqueados}</strong> bloq. • <strong>{reservados}</strong> res.
                                </>
                              ) : passado ? (
                                "Dia passado"
                              ) : (
                                "Sem horários"
                              )}
                            </div>

                            {exResumo ? (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
                                <strong>{exResumo}</strong>
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <button onClick={() => gerarDia(dia)} disabled={busy || passado} style={{ padding: "6px 8px" }}>
                              {busy ? "..." : "Gerar"}
                            </button>

                            <button onClick={() => bloquearDia(dia)} disabled={busy || !temHorarios} style={{ padding: "6px 8px" }}>
                              Bloq.
                            </button>

                            <button onClick={() => desbloquearDia(dia)} disabled={busy || !temHorarios} style={{ padding: "6px 8px" }}>
                              Desbloq.
                            </button>

                            <button onClick={() => zerarDia(dia)} disabled={busy || !temHorarios} style={{ padding: "6px 8px" }}>
                              Zerar
                            </button>

                            <button onClick={() => editarDia(dia)} disabled={busy} style={{ padding: "6px 8px" }}>
                              Editar
                            </button>
                          </div>
                        </div>

                        {/* mini resumo (primeiros 2 slots) */}
                        {temHorarios ? (
                          <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 12, color: "#444", opacity: 0.9 }}>
                            {lista.slice(0, 2).map((s) => (
                              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, opacity: s.ativo ? 1 : 0.7 }}>
                                <span>{s.horaInicio}–{s.horaFim}</span>

                                <span style={{ color: s.reservadoPorUid ? "#444" : s.bloqueado ? "#b00020" : s.ativo ? "green" : "#999" }}>
                                  {s.reservadoPorUid ? "res." : s.bloqueado ? "bloq." : s.ativo ? "ativo" : "off"}
                                </span>
                              </div>
                            ))}

                            {total > 2 ? <div style={{ fontSize: 11, color: "#777" }}>+{total - 2} horários…</div> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
