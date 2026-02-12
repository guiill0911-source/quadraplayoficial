import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { buscarQuadras } from "../services/quadras";
import { buscarQuadrasDisponiveis } from "../services/disponibilidadesBusca";
import { useAuth } from "../services/authContext";
import { logout } from "../services/authService";

type Comodidades = {
  chuveiro?: boolean;
  churrasqueira?: boolean;
  mesaSinuca?: boolean;
  iluminacao?: boolean;
  coletes?: boolean;
};

interface Quadra {
  id: string;
  nome: string;
  cidade: string;
  endereco?: string;
  ativo?: boolean;

  esportes?: string[];
  tipos?: string[];

  valoresPorEsporte?: Record<string, number>;
  valorHora?: number | null;

  comodidades?: Comodidades;

  fotoCapaUrl?: string | null;
}

const ESPORTES_OPCOES = [
  { id: "futsal", label: "Futsal" },
  { id: "society_5", label: "Society 5" },
  { id: "society_7", label: "Society 7" },
  { id: "volei", label: "Vôlei" },
  { id: "futevolei", label: "Futevôlei" },
  { id: "futmesa", label: "Futmesa" },
  { id: "beach_tenis", label: "Beach Tênis" },
];

const COMODIDADES_OPCOES: Array<{ id: keyof Comodidades; label: string }> = [
  { id: "chuveiro", label: "Chuveiro" },
  { id: "churrasqueira", label: "Churrasqueira" },
  { id: "mesaSinuca", label: "Mesa de sinuca" },
  { id: "iluminacao", label: "Iluminação" },
  { id: "coletes", label: "Coletes" },
];

const HORARIOS_1H = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Home() {
  const { user } = useAuth();

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // inputs
  const [esportesInput, setEsportesInput] = useState<string[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [comodidadesInput, setComodidadesInput] = useState<(keyof Comodidades)[]>([]);
  const [dataInput, setDataInput] = useState(hojeISO());
  const [horaInput, setHoraInput] = useState("");

  // busca aplicada
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [esportesBusca, setEsportesBusca] = useState<string[]>([]);
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [comodidadesBusca, setComodidadesBusca] = useState<(keyof Comodidades)[]>([]);
  const [dataBusca, setDataBusca] = useState("");
  const [horaBusca, setHoraBusca] = useState("");

  const [quadraIdsDisponiveis, setQuadraIdsDisponiveis] = useState<Set<string> | null>(null);

  // status de busca (UX profissional)
  const [buscandoDisponibilidade, setBuscandoDisponibilidade] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  // ✅ badge "disponível hoje"
  const [quadrasDisponiveisHoje, setQuadrasDisponiveisHoje] = useState<Set<string> | null>(null);

  useEffect(() => {
    async function carregar() {
      const dados = await buscarQuadras();
      setQuadras(dados as Quadra[]);
      setLoading(false);
    }
    carregar();
  }, []);

  // ✅ carrega 1 vez quem tem horários HOJE (para o badge no card)
  useEffect(() => {
    async function carregarDisponiveisHoje() {
      try {
        const ids = await buscarQuadrasDisponiveis({ data: hojeISO() });
        setQuadrasDisponiveisHoje(new Set(ids));
      } catch (e) {
        console.error(e);
        // não trava a home por isso
        setQuadrasDisponiveisHoje(null);
      }
    }
    carregarDisponiveisHoje();
  }, []);

  function toggleEsporte(id: string) {
    setEsportesInput((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleComodidade(id: keyof Comodidades) {
    setComodidadesInput((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function limparBusca() {
    // inputs
    setEsportesInput([]);
    setCidadeInput("");
    setComodidadesInput([]);
    setDataInput(hojeISO());
    setHoraInput("");

    // busca aplicada
    setBuscaAtiva(false);
    setEsportesBusca([]);
    setCidadeBusca("");
    setComodidadesBusca([]);
    setDataBusca("");
    setHoraBusca("");

    // disponibilidade
    setQuadraIdsDisponiveis(null);

    // estados UX
    setBuscandoDisponibilidade(false);
    setErroBusca(null);

    // UI
    setMostrarFiltros(false);
  }

  async function buscar() {
    setErroBusca(null);

    // ✅ não deixa buscar data passada
    const hoje = hojeISO();
    if (dataInput && dataInput < hoje) {
      setBuscaAtiva(true);
      setMostrarFiltros(false);
      setQuadraIdsDisponiveis(new Set()); // força "sem resultados"
      setDataBusca(dataInput);
      setHoraBusca(horaInput);
      setEsportesBusca(esportesInput);
      setCidadeBusca(cidadeInput);
      setComodidadesBusca(comodidadesInput);
      setErroBusca("Escolha uma data de hoje ou futura.");
      return;
    }

    setBuscaAtiva(true);
    setMostrarFiltros(false);

    setEsportesBusca(esportesInput);
    setCidadeBusca(cidadeInput);
    setComodidadesBusca(comodidadesInput);
    setDataBusca(dataInput);
    setHoraBusca(horaInput);

    const precisaDisponibilidade = dataInput && (horaInput !== "" || esportesInput.length > 0);

    if (!precisaDisponibilidade) {
      setQuadraIdsDisponiveis(null);
      return;
    }

    try {
      setBuscandoDisponibilidade(true);

      const ids = await buscarQuadrasDisponiveis({
        data: dataInput,
        horaInicio: horaInput || undefined,
        esportes: esportesInput.length > 0 ? esportesInput : undefined,
      });

      setQuadraIdsDisponiveis(new Set(ids));
    } catch (e) {
      console.error(e);
      setErroBusca("Erro ao buscar disponibilidade. Veja o console.");
      setQuadraIdsDisponiveis(new Set());
    } finally {
      setBuscandoDisponibilidade(false);
    }
  }

  const quadrasFiltradas = useMemo(() => {
    let lista = quadras.filter((q) => q.ativo !== false);

    if (!buscaAtiva) return lista;

    if (cidadeBusca.trim()) {
      lista = lista.filter((q) => q.cidade?.toLowerCase().includes(cidadeBusca.toLowerCase()));
    }

    if (quadraIdsDisponiveis) {
      lista = lista.filter((q) => quadraIdsDisponiveis.has(q.id));
    }

    function score(q: Quadra) {
      let s = 0;
      const esportesDaQuadra = (q.esportes ?? q.tipos ?? []).map(String);

      if (esportesBusca.length > 0) {
        s += esportesBusca.filter((e) => esportesDaQuadra.includes(e)).length * 10;
      }

      if (comodidadesBusca.length > 0) {
        s += comodidadesBusca.filter((c) => q.comodidades?.[c]).length * 5;
      }

      return s;
    }

    if (esportesBusca.length > 0 || comodidadesBusca.length > 0) {
      lista = lista.filter((q) => score(q) > 0);
    }

    return [...lista].sort((a, b) => score(b) - score(a));
  }, [quadras, buscaAtiva, cidadeBusca, esportesBusca, comodidadesBusca, quadraIdsDisponiveis]);

  async function sair() {
    await logout();
  }

  const semResultados = !loading && buscaAtiva && quadrasFiltradas.length === 0;

  return (
    <>
      <Header />

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Olá, {user?.nome}</strong>
          <button onClick={sair}>Sair</button>
        </div>

        <hr />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setMostrarFiltros((v) => !v)}>{mostrarFiltros ? "FECHAR" : "BUSCAR QUADRA"}</button>

          {buscaAtiva && (
            <button onClick={limparBusca} style={{ border: "1px solid #999" }}>
              Limpar busca
            </button>
          )}
        </div>

        {mostrarFiltros && (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <strong>Esportes</strong>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ESPORTES_OPCOES.map((op) => (
                  <label key={op.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={esportesInput.includes(op.id)}
                      onChange={() => toggleEsporte(op.id)}
                    />
                    {op.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <strong>Data</strong>
                <input type="date" value={dataInput} min={hojeISO()} onChange={(e) => setDataInput(e.target.value)} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <strong>Horário</strong>
                <select value={horaInput} onChange={(e) => setHoraInput(e.target.value)}>
                  <option value="">Qualquer</option>
                  {HORARIOS_1H.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <strong>Cidade</strong>
                <input value={cidadeInput} onChange={(e) => setCidadeInput(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <strong>Comodidades</strong>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COMODIDADES_OPCOES.map((op) => (
                  <label key={op.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={comodidadesInput.includes(op.id)}
                      onChange={() => toggleComodidade(op.id)}
                    />
                    {op.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={buscar} disabled={buscandoDisponibilidade}>
                {buscandoDisponibilidade ? "Buscando..." : "Buscar"}
              </button>

              {buscaAtiva && (
                <button onClick={limparBusca} disabled={buscandoDisponibilidade}>
                  Limpar
                </button>
              )}
            </div>

            {erroBusca ? <div style={{ color: "crimson", fontSize: 13 }}>{erroBusca}</div> : null}
          </div>
        )}

        <hr />

        {loading && <p>Carregando…</p>}

        {!loading && (
          <>
            {semResultados ? (
              <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12, color: "#666" }}>
                <strong>Nenhuma quadra encontrada</strong>
                <div style={{ marginTop: 6 }}>Tente mudar a data/horário, remover filtros ou escolher outra cidade.</div>
              </div>
            ) : null}

            {quadrasFiltradas.map((q) => {
              const disponivelHoje = quadrasDisponiveisHoje ? quadrasDisponiveisHoje.has(q.id) : null;

              return (
                <Link key={q.id} to={`/quadra/${q.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ border: "1px solid #ccc", marginBottom: 10, padding: 10, borderRadius: 10 }}>
                    {q.fotoCapaUrl ? (
                      <img
                        src={q.fotoCapaUrl}
                        alt={`Capa ${q.nome}`}
                        style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                      />
                    ) : null}

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <strong>{q.nome}</strong> — {q.cidade}
                      </div>

                      {/* ✅ badge disponibilidade hoje */}
                      {disponivelHoje === null ? null : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #ddd",
                            color: disponivelHoje ? "green" : "#777",
                          }}
                        >
                          {disponivelHoje ? "Disponível hoje" : "Sem horários hoje"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
