// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { buscarQuadras } from "../services/quadras";
import { buscarQuadrasDisponiveis } from "../services/disponibilidadesBusca";
import { useAuth } from "../services/authContext";
import {
  ouvirResumoReputacaoDoUsuario,
  resumoReputacaoPadrao,
  type ResumoReputacao,
} from "../services/reputacao";
import { db } from "../services/firebase";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

if (typeof document !== "undefined" && !document.getElementById("qp-install-card-anim")) {
  const styleAnim = document.createElement("style");
  styleAnim.id = "qp-install-card-anim";
  styleAnim.innerHTML = `
    @keyframes qpInstallSlideUp {
      from {
        transform: translateY(18px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(styleAnim);
}

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

  latitude?: number | null;
  longitude?: number | null;

  Latitude?: number | null;
  Longitude?: number | null;
}

const ESPORTES_OPCOES = [
  { id: "futsal", label: "Futsal" },
  { id: "society_5", label: "Society 5" },
  { id: "society_7", label: "Society 7" },
  { id: "campo_11", label: "Campo 11" },
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

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function getLatLng(q: Quadra): { lat: number; lng: number } | null {
  const latRaw = (q.latitude ?? (q as any).Latitude) as any;
  const lngRaw = (q.longitude ?? (q as any).Longitude) as any;

  const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getGeoPositionWithRetry(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(Object.assign(new Error("Geolocalização não suportada."), { code: -1 }));
      return;
    }

    const tentar = (opts: PositionOptions, onFail: (err: any) => void) => {
      navigator.geolocation.getCurrentPosition(resolve, onFail, opts);
    };

    tentar(
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      () => {
        tentar(
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 30000 },
          (err2) => reject(err2)
        );
      }
    );
  });
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getNivelColors(score: number) {
  if (score >= 90) {
    return {
      bg: "#e8fff2",
      text: "#15803d",
      border: "#bbf7d0",
    };
  }

  if (score >= 70) {
    return {
      bg: "#fff8e6",
      text: "#a16207",
      border: "#fde68a",
    };
  }

  if (score >= 40) {
    return {
      bg: "#fff1e8",
      text: "#c2410c",
      border: "#fdba74",
    };
  }

  return {
    bg: "#ffeaea",
    text: "#b91c1c",
    border: "#fecaca",
  };
}

function formatDistance(userLoc: { lat: number; lng: number } | null, q: Quadra) {
  if (!userLoc) return null;
  const ll = getLatLng(q);
  if (!ll) return null;

  const km = distanciaKm(userLoc.lat, userLoc.lng, ll.lat, ll.lng);
  if (!Number.isFinite(km)) return null;

  const fmt = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return `${fmt} km`;
}

function getStartingPrice(q: Quadra): number | null {
  if (typeof q.valorHora === "number" && q.valorHora > 0) return q.valorHora;

  const valores = Object.values(q.valoresPorEsporte ?? {}).filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  ) as number[];

  if (!valores.length) return null;
  return Math.min(...valores);
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarSaldo(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function chipComodidades(q: Quadra): string[] {
  const c = q.comodidades;
  if (!c) return [];

  const arr: string[] = [];
  if (c.chuveiro) arr.push("Chuveiro");
  if (c.churrasqueira) arr.push("Churrasqueira");
  if (c.mesaSinuca) arr.push("Sinuca");
  if (c.iluminacao) arr.push("Iluminação");
  if (c.coletes) arr.push("Coletes");

  return arr;
}

export default function Home() {
  const { user } = useAuth();

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordenacao, setOrdenacao] = useState<"padrao" | "preco">("padrao");
  const [menoresValores, setMenoresValores] = useState<Record<string, number>>({});

  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [esportesInput, setEsportesInput] = useState<string[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [comodidadesInput, setComodidadesInput] = useState<(keyof Comodidades)[]>([]);
  const [dataInput, setDataInput] = useState(hojeISO());
  const [horaInput, setHoraInput] = useState("");

  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [esportesBusca, setEsportesBusca] = useState<string[]>([]);
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [comodidadesBusca, setComodidadesBusca] = useState<(keyof Comodidades)[]>([]);
  const [dataBusca, setDataBusca] = useState("");
  const [horaBusca, setHoraBusca] = useState("");

  const [quadraIdsDisponiveis, setQuadraIdsDisponiveis] = useState<Set<string> | null>(null);

  const [buscandoDisponibilidade, setBuscandoDisponibilidade] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const [quadrasDisponiveisHoje, setQuadrasDisponiveisHoje] = useState<Set<string> | null>(null);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErro, setGeoErro] = useState<string | null>(null);

  const [reputacao, setReputacao] = useState<ResumoReputacao>(resumoReputacaoPadrao());

  const [chipsEsportes, setChipsEsportes] = useState<string[]>([]);
  const [chipsComodidades, setChipsComodidades] = useState<(keyof Comodidades)[]>([]);
  const [chipPertoDeMim, setChipPertoDeMim] = useState(false);

  const [favoritasIds, setFavoritasIds] = useState<string[]>([]);
  const [saldoCentavos, setSaldoCentavos] = useState<number>(0);
  const [carregandoSaldo, setCarregandoSaldo] = useState(true);
  const [favoritaSavingId, setFavoritaSavingId] = useState<string | null>(null);
  const [mostrarCardPrimeiraReserva, setMostrarCardPrimeiraReserva] = useState(false);

  const [hoveredQuadraId, setHoveredQuadraId] = useState<string | null>(null);
  const isIosSafari =
  /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
  /Safari/i.test(navigator.userAgent) &&
  !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

const [mostrarInstallCard, setMostrarInstallCard] = useState(
  isIosSafari && localStorage.getItem("qp_install_card_closed") !== "true"
);
  const [hoveredButton, setHoveredButton] = useState<
    null | "geo" | "disableGeo" | "buscarQuadra"
  >(null);
  const quadrasScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  quadrasScrollRef.current?.scrollTo({
    left: 0,
    behavior: "smooth",
  });
}, [ordenacao]);

function scrollQuadras(direction: "left" | "right") {
  const el = quadrasScrollRef.current;
  if (!el) return;

  const amount = 340;
  el.scrollBy({
    left: direction === "left" ? -amount : amount,
    behavior: "smooth",
  });
}


  useEffect(() => {
    async function carregar() {
      const dados = await buscarQuadras();
      setQuadras(dados as Quadra[]);
      setLoading(false);
    }
    carregar();
  }, []);

  useEffect(() => {
    async function carregarDisponiveisHoje() {
      try {
        const ids = await buscarQuadrasDisponiveis({ data: hojeISO() });
        setQuadrasDisponiveisHoje(new Set(ids));
      } catch (e) {
        console.error(e);
        setQuadrasDisponiveisHoje(null);
      }
    }
    carregarDisponiveisHoje();
  }, []);

  useEffect(() => {
  async function carregarMenoresValoresHoje() {
    try {
      const col = collection(db, "disponibilidades");
      const q = query(
        col,
        where("data", "==", hojeISO()),
        where("ativo", "==", true)
      );

      const snap = await getDocs(q);

      const mapa: Record<string, number> = {};

      snap.forEach((doc) => {
        const x = doc.data() as any;

        if (x?.bloqueado === true) return;
        if (x?.removido === true) return;

        const quadraId = String(x?.quadraId ?? "");
        const promocaoAtiva = x?.promocaoAtiva === true;
const valorBase = Number(x?.valor ?? 0);
const valorPromo = Number(x?.valorPromocional ?? 0);

const valor =
  promocaoAtiva && valorPromo > 0
    ? valorPromo
    : valorBase;

        if (!quadraId || !valor) return;

        if (mapa[quadraId] == null || valor < mapa[quadraId]) {
          mapa[quadraId] = valor;
        }
      });

      setMenoresValores(mapa);
    } catch (e) {
      console.error("Erro ao carregar menores valores:", e);
      setMenoresValores({});
    }
  }

  carregarMenoresValoresHoje();
}, []);

  useEffect(() => {
    const uid = (user as any)?.uid;
    if (!uid) {
      setReputacao(resumoReputacaoPadrao());
      return;
    }

    const unsubscribe = ouvirResumoReputacaoDoUsuario(
      uid,
      (resumo) => {
        setReputacao(resumo);
      },
      (err) => {
        console.error("Erro ao ouvir reputação do usuário:", err);
      }
    );

    return unsubscribe;
  }, [user]);

 useEffect(() => {
  async function carregarSaldo() {
    if (!user?.uid) {
      setSaldoCentavos(0);
      setMostrarCardPrimeiraReserva(false);
      setCarregandoSaldo(false);
      return;
    }

    try {
      setCarregandoSaldo(true);
      const snap = await getDoc(doc(db, "users", user.uid));

      if (snap.exists()) {
        const data = snap.data() as any;

        setSaldoCentavos(Number(data?.saldo ?? 0));

        const ehAtleta = String(data?.role ?? "") === "atleta";
        const descontoJaUsado = data?.primeiraReservaDescontoUsado === true;

        setMostrarCardPrimeiraReserva(ehAtleta && !descontoJaUsado);
      } else {
        setSaldoCentavos(0);
        setMostrarCardPrimeiraReserva(false);
      }
    } catch (e) {
      console.error("Erro ao carregar saldo:", e);
      setSaldoCentavos(0);
      setMostrarCardPrimeiraReserva(false);
    } finally {
      setCarregandoSaldo(false);
    }
  }

  carregarSaldo();
}, [user?.uid]);

  useEffect(() => {
    async function carregarFavoritas() {
      const uid = (user as any)?.uid;
      if (!uid) {
        setFavoritasIds([]);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        const ids = Array.isArray(data?.quadrasFavoritasIds)
          ? data.quadrasFavoritasIds.map(String)
          : [];
        setFavoritasIds(ids);
      } catch (err) {
        console.error("Erro ao carregar favoritas:", err);
        setFavoritasIds([]);
      }
    }

    carregarFavoritas();
  }, [user]);

  function toggleEsporte(id: string) {
    setEsportesInput((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleComodidade(id: keyof Comodidades) {
    setComodidadesInput((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleChipEsporte(id: string) {
    setChipsEsportes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleChipComodidade(id: keyof Comodidades) {
    setChipsComodidades((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function limparBusca() {
    setEsportesInput([]);
    setCidadeInput("");
    setComodidadesInput([]);
    setDataInput(hojeISO());
    setHoraInput("");

    setBuscaAtiva(false);
    setEsportesBusca([]);
    setCidadeBusca("");
    setComodidadesBusca([]);
    setDataBusca("");
    setHoraBusca("");

    setQuadraIdsDisponiveis(null);

    setBuscandoDisponibilidade(false);
    setErroBusca(null);

    setMostrarFiltros(false);

    setChipsEsportes([]);
    setChipsComodidades([]);
  }

  async function buscar() {
    setErroBusca(null);

    const hoje = hojeISO();
    if (dataInput && dataInput < hoje) {
      setBuscaAtiva(true);
      setMostrarFiltros(false);
      setQuadraIdsDisponiveis(new Set());
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

  async function pedirLocalizacao() {
    setGeoErro(null);
    setGeoLoading(true);

    try {
      const pos = await getGeoPositionWithRetry();
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (err: any) {
      console.error(err);

      if (err?.code === 1) {
        setGeoErro("Permissão negada. Ative a localização no navegador.");
      } else if (err?.code === 2) {
        setGeoErro("Não foi possível obter sua localização agora.");
      } else if (err?.code === 3) {
        setGeoErro("Demorou demais para localizar. Tente novamente.");
      } else {
        setGeoErro("Erro ao obter localização.");
      }
    } finally {
      setGeoLoading(false);
    }
  }

  function desativarLocalizacao() {
    setUserLoc(null);
    setGeoErro(null);
    setGeoLoading(false);
    setChipPertoDeMim(false);
  }

  async function toggleFavorita(e: React.MouseEvent, quadraId: string) {
    e.preventDefault();
    e.stopPropagation();

    const uid = (user as any)?.uid;
    if (!uid) return;

    const jaFavorita = favoritasIds.includes(quadraId);
    const proximas = jaFavorita
      ? favoritasIds.filter((id) => id !== quadraId)
      : [...favoritasIds, quadraId];

    const anteriores = favoritasIds;

    try {
      setFavoritaSavingId(quadraId);
      setFavoritasIds(proximas);

      await setDoc(
        doc(db, "users", uid),
        { quadrasFavoritasIds: proximas, updatedAt: new Date() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao salvar favoritas:", err);
      setFavoritasIds(anteriores);
    } finally {
      setFavoritaSavingId(null);
    }
  }

  const esportesAtivos = useMemo(
    () => Array.from(new Set([...esportesBusca, ...chipsEsportes])),
    [esportesBusca, chipsEsportes]
  );

  const comodidadesAtivas = useMemo(
    () => Array.from(new Set([...comodidadesBusca, ...chipsComodidades])),
    [comodidadesBusca, chipsComodidades]
  );

 const cidadesDisponiveis = useMemo(() => {
  const mapa = new Map<string, string>();

  for (const q of quadras) {
    const cidadeRaw = (q.cidade ?? "").trim();
    const ufRaw = ((q as any).uf ?? "").trim().toUpperCase();
    const cidadeExibicaoRaw = ((q as any).cidadeExibicao ?? "").trim();

    if (!cidadeRaw) continue;

    const cidadeSemUf = cidadeRaw.replace(/\s*-\s*[A-Za-z]{2}$/, "").trim();

    const chave = cidadeSemUf
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const valorExibicaoBase =
      cidadeExibicaoRaw ||
      (ufRaw ? `${cidadeSemUf} - ${ufRaw}` : cidadeSemUf);

    if (!mapa.has(chave)) {
      mapa.set(chave, valorExibicaoBase);
    } else {
      const existente = mapa.get(chave)!;

      const novoTemAcento = /[^\u0000-\u007f]/.test(valorExibicaoBase);
      const existenteTemAcento = /[^\u0000-\u007f]/.test(existente);

      if (novoTemAcento && !existenteTemAcento) {
        mapa.set(chave, valorExibicaoBase);
      }
    }
  }

  return Array.from(mapa.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}, [quadras]);

  const quadrasFiltradas = useMemo(() => {
    let lista = quadras.filter((q) => q.ativo !== false);

    if (buscaAtiva && cidadeBusca.trim()) {
  const cidadeBuscaNormalizada = normalizarTexto(cidadeBusca);

  lista = lista.filter((q) => {
    const cidadeBase = (q.cidade ?? "").trim();
    const ufBase = ((q as any).uf ?? "").trim().toUpperCase();
    const cidadeExibicaoBase = ((q as any).cidadeExibicao ?? "").trim();

    const valorComparacao =
      cidadeExibicaoBase || (ufBase ? `${cidadeBase} - ${ufBase}` : cidadeBase);

    return normalizarTexto(valorComparacao) === cidadeBuscaNormalizada;
  });
}
    if (buscaAtiva && quadraIdsDisponiveis) {
      lista = lista.filter((q) => quadraIdsDisponiveis.has(q.id));
    }

    function score(q: Quadra) {
      let s = 0;
      const esportesDaQuadra = (q.esportes ?? q.tipos ?? []).map(String);

      if (esportesAtivos.length > 0) {
        s += esportesAtivos.filter((e) => esportesDaQuadra.includes(e)).length * 10;
      }

      if (comodidadesAtivas.length > 0) {
        s += comodidadesAtivas.filter((c) => q.comodidades?.[c]).length * 5;
      }

      return s;
    }

    if (esportesAtivos.length > 0 || comodidadesAtivas.length > 0) {
      lista = lista.filter((q) => score(q) > 0);
    }

    return [...lista].sort((a, b) => score(b) - score(a));
  }, [
    quadras,
    buscaAtiva,
    cidadeBusca,
    quadraIdsDisponiveis,
    esportesAtivos,
    comodidadesAtivas,
  ]);

  const quadrasOrdenadas = useMemo(() => {
  let lista = [...quadrasFiltradas];

  if (ordenacao === "preco") {
    lista.sort((a, b) => {
      const va = menoresValores[a.id] ?? getStartingPrice(a) ?? 999999;
const vb = menoresValores[b.id] ?? getStartingPrice(b) ?? 999999;
      return va - vb;
    });
  }

  const usarProximidade = !!userLoc && chipPertoDeMim;

  if (usarProximidade) {
    lista.sort((a, b) => {
      const aLoc = getLatLng(a);
      const bLoc = getLatLng(b);

      const da = aLoc ? distanciaKm(userLoc!.lat, userLoc!.lng, aLoc.lat, aLoc.lng) : Infinity;
      const db = bLoc ? distanciaKm(userLoc!.lat, userLoc!.lng, bLoc.lat, bLoc.lng) : Infinity;

      return da - db;
    });
  }

  return lista;
}, [quadrasFiltradas, userLoc, chipPertoDeMim, ordenacao, menoresValores]);

  const semResultados =
    !loading &&
    (buscaAtiva || esportesAtivos.length > 0 || comodidadesAtivas.length > 0) &&
    quadrasOrdenadas.length === 0;

  const temPenalidade =
    reputacao.cancelUltimaHora > 0 ||
    reputacao.noShows > 0 ||
    reputacao.multaPendenteCentavos > 0 ||
    reputacao.suspenso ||
    reputacao.score < 100;

  const badgeStyle = useMemo(() => getNivelColors(reputacao.score), [reputacao.score]);
const score = reputacao.score ?? 0;

let status = "Neutro";
let cor = "#64748b";
let mensagem = "";

if (score >= 90) {
  status = "Excelente";
  cor = "#22c55e";
  mensagem = "🔥 Você é um jogador confiável";
} else if (score >= 70) {
  status = "Bom";
  cor = "#eab308";
  mensagem = "👍 Continue assim";
} else {
  status = "Atenção";
  cor = "#ef4444";
  mensagem = "⚠️ Evite cancelamentos e faltas";
}
  return (
    <>
      <Header />

{mostrarInstallCard ? (
  <div
    style={{
      position: "fixed",
      left: 12,
      right: 12,
      bottom: 104,
      zIndex: 9998,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
      animation: "qpInstallSlideUp 0.35s ease",
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 390,
        background: "linear-gradient(135deg, rgba(5,63,249,0.92), rgba(3,18,46,0.92))",
        color: "#ffffff",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 20px 50px rgba(2, 6, 23, 0.42)",
        padding: "12px 12px 10px",
        pointerEvents: "auto",
        backdropFilter: "blur(16px)",
      }}
    >
      <button
        type="button"
        onClick={() => {
  localStorage.setItem("qp_install_card_closed", "true");
  setMostrarInstallCard(false);
}}
        aria-label="Fechar tutorial de instalação"
        style={{
          position: "absolute",
          right: 10,
          top: 8,
          width: 34,
          height: 34,
          borderRadius: 999,
          border: "none",
          background: "transparent",
          color: "#ffffff",
          fontSize: 24,
          lineHeight: 1,
          cursor: "pointer",
          opacity: 0.92,
        }}
      >
        ×
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "64px 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: "#8ae809",
            color: "#03122e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          ↓
        </div>

        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 8,
              paddingRight: 28,
            }}
          >
            Instalar Quadra Play
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#d4d4d8",
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            Para instalar o app no seu iPhone:
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                1
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Toque em{" "}
                <span style={{ color: "#60a5fa", fontWeight: 900 }}>⇪</span>{" "}
                Compartilhar
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                2
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Role e toque em{" "}
                <span style={{ color: "#60a5fa", fontWeight: 900 }}>＋</span>{" "}
                Adicionar à Tela de Início
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                3
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Toque em Adicionar
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
) : null}

      <div
        style={{
          minHeight: "100vh",
          background:
  "linear-gradient(180deg, #03122e 0px, #053ff9 170px, #f8fbff 170px, #ffffff 58%, #f8fbff 100%)",
          padding: "16px 12px 140px",
        }}
      >
        {saldoCentavos > 0 ? (
          <div
            style={{
              marginTop: 12,
              background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
              border: "1px solid #a7f3d0",
              borderRadius: 20,
              padding: "18px 20px",
              boxShadow: "0 10px 28px rgba(16,185,129,0.10)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#166534",
                    marginBottom: 6,
                  }}
                >
                  Saldo disponível
                </div>

                <div
                  style={{
                    fontSize: 28,
                    lineHeight: 1.1,
                    fontWeight: 900,
                    color: "#065f46",
                  }}
                >
                  {formatarSaldo(saldoCentavos)}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "#166534",
                    fontWeight: 600,
                  }}
                >
                  Use este saldo em suas próximas reservas no aplicativo.
                </div>
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.65)",
                  color: "#065f46",
                  fontWeight: 900,
                  fontSize: 13,
                  border: "1px solid #bbf7d0",
                }}
              >
                Crédito ativo
              </div>
            </div>
          </div>
        ) : null}

        <div
  style={{
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    overflowX: "hidden",
  }}
>
          <div
            style={{
              background: "linear-gradient(135deg, #03122e, #053ff9, #2d6bff)",
              color: "#ffffff",
              borderRadius: 24,
              padding: "14px 14px",
              boxShadow: "0 18px 45px rgba(15,23,42,0.20)",
              marginTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ maxWidth: 700 }}>
                <div
                  style={{
                    display: "inline-flex",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.10)",
                    fontWeight: 800,
                    fontSize: 11,
                    marginBottom: 8,
                  }}
                >
                  Quadra Play
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(20px, 6vw, 26px)",
                    fontWeight: 900,
                    letterSpacing: -0.5,
                    lineHeight: 1.1,
                  }}
                >
                  Sua próxima partida começa aqui.
                </h1>

               {mostrarCardPrimeiraReserva ? (
  <div
    style={{
      marginTop: 10,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "linear-gradient(135deg, #8ae809, #6fd306)",
      color: "#ffff",
      fontWeight: 900,
      fontSize: 12,
      boxShadow: "0 10px 20px rgba(16,185,129,0.25)",
    }}
  >
    🔥 5% OFF na sua primeira reserva
  </div>
) : null}

                <p
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    color: "#cbd5e1",
                    fontSize: 12,
                    lineHeight: 1.4,
                    opacity: 0.9,
                  }}
                >
                Busque, reserve e jogue com facilidade.
                </p>
              </div>

          <div
  style={{
    width: "100%",
    minWidth: 0,
    flex: "1 1 100%",
    maxWidth: 220,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 10,
    backdropFilter: "blur(6px)",
  }}
>
                <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 13}}>
                  Sua reputação
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  

                  <div
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 11,
                      background: badgeStyle.bg,
                      color: badgeStyle.text,
                      border: `1px solid ${badgeStyle.border}`,
                    }}
                  >
                    {String(reputacao.nivel).toUpperCase()}
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 11, color: "#e2e8f0", lineHeight: 1.35 }}>
                  Cancelamentos e faltas reduzem sua reputação.
                </div>

                {temPenalidade ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#f8fafc" }}>
                    Cancelamentos última hora: <strong>{reputacao.cancelUltimaHora}</strong> |
                    No-shows: <strong>{reputacao.noShows}</strong>
                  </div>
                ) : null}

                {reputacao.multaPendenteCentavos > 0 ? (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 13,
                      color: "#fecaca",
                      fontWeight: 800,
                      background: "rgba(127,29,29,0.25)",
                      border: "1px solid rgba(254,202,202,0.18)",
                      padding: "10px 12px",
                      borderRadius: 14,
                    }}
                  >
                    Há uma multa pendente vinculada à sua conta.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              background: "linear-gradient(180deg, #ffffff, #f8fbff)",
              borderRadius: 26,
              padding: 28,
              border: "1px solid rgba(5, 63, 249, 0.10)",
              boxShadow: "0 25px 60px rgba(3,18,46,0.10)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 18,
              }}
            >

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
<div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <button
                    onClick={() => setMostrarFiltros((v) => !v)}
                    onMouseEnter={() => setHoveredButton("buscarQuadra")}
                    onMouseLeave={() => setHoveredButton(null)}
                    style={{
                      minHeight: 60,
                      width: "100%",
                      maxWidth: 460,
                      padding: "0 32px",
                      borderRadius: 20,
                      border: "none",
                      background: "linear-gradient(135deg, #8ae809 0%, #6fd306 100%)",
                      color: "#ffffff",
                      fontWeight: 900,
                      fontSize: 16,
                      letterSpacing: 0.2,
                      cursor: "pointer",
                      boxShadow:
                        hoveredButton === "buscarQuadra"
                          ? "0 24px 48px rgba(34,197,94,0.42)"
                          : "0 18px 40px rgba(34,197,94,0.34)",
                      transform:
                        hoveredButton === "buscarQuadra" ? "scale(1.02)" : "scale(1)",
                      transition:
                        "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
                      filter:
                        hoveredButton === "buscarQuadra" ? "brightness(1.03)" : "brightness(1)",
                    }}
                  >
                    {mostrarFiltros ? "Fechar busca" : "Buscar quadras"}
                  </button>

                  {(buscaAtiva ||
                    chipsEsportes.length > 0 ||
                    chipsComodidades.length > 0 ||
                    chipPertoDeMim) ? (
                    <button
                      onClick={limparBusca}
                      style={{
                        minHeight: 48,
                        padding: "0 18px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fff5f5",
                        color: "#dc2626",
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: "pointer",
                        boxShadow: "0 8px 18px rgba(220,38,38,0.08)",
                      }}
                    >
                      Limpar busca
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

                  <button
                    onClick={pedirLocalizacao}
                    onMouseEnter={() => setHoveredButton("geo")}
                    onMouseLeave={() => setHoveredButton(null)}
                    disabled={geoLoading}
                    style={{
                      minHeight: 48,
                      padding: "0 18px",
                      borderRadius: 16,
                      border: userLoc ? "1px solid #86efac" : "1px solid #bfdbfe",
                      background: userLoc ? "#ecfdf5" : "#ffffff",
                      color: userLoc ? "#166534" : "#1d4ed8",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: "pointer",
                      boxShadow:
                        hoveredButton === "geo"
                          ? userLoc
                            ? "0 14px 28px rgba(34,197,94,0.18)"
                            : "0 14px 28px rgba(37,99,235,0.14)"
                          : userLoc
                          ? "0 8px 20px rgba(34,197,94,0.12)"
                          : "0 8px 20px rgba(37,99,235,0.08)",
                      transform: hoveredButton === "geo" ? "scale(1.015)" : "scale(1)",
                      transition:
                        "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border 0.18s ease",
                    }}
                  >
                    {geoLoading
                      ? "Obtendo localização..."
                      : userLoc
                      ? "Atualizar minha localização"
                      : "Usar minha localização"}
                  </button>

                  {userLoc ? (
                    <button
                      onClick={desativarLocalizacao}
                      onMouseEnter={() => setHoveredButton("disableGeo")}
                      onMouseLeave={() => setHoveredButton(null)}
                      disabled={geoLoading}
                      style={{
                        minHeight: 48,
                        padding: "0 18px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fff5f5",
                        color: "#dc2626",
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow:
                          hoveredButton === "disableGeo"
                            ? "0 12px 24px rgba(220,38,38,0.14)"
                            : "0 8px 18px rgba(220,38,38,0.08)",
                        transform:
                          hoveredButton === "disableGeo" ? "scale(1.012)" : "scale(1)",
                        transition:
                          "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
                      }}
                    >
                      Desativar localização
                    </button>
                  ) : null}
                </div>

                

            <div style={{ marginTop: 12 }}>
              {userLoc ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "#ecfdf5",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Localização ativa ✅
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  Filtre por localização, esporte, horário, e comodidades.
                </span>
              )}

              {geoErro ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    color: "#be123c",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {geoErro}
                  <button
                    onClick={pedirLocalizacao}
                    disabled={geoLoading}
                    style={{
                      marginLeft: 10,
                      border: "1px solid #fda4af",
                      background: "#fff",
                      color: "#9f1239",
                      borderRadius: 10,
                      padding: "6px 10px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 22,
                background: "linear-gradient(180deg, #ffffff, #f8fbff)",
                border: "1px solid rgba(5, 63, 249, 0.08)",
                boxShadow: "0 8px 24px rgba(3,18,46,0.08)",
                position: "relative",
              }}
            >

{/* FADE ESQUERDA */}
<div
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    background: "linear-gradient(to right, #ffffff, transparent)",
    zIndex: 2,
    pointerEvents: "none",
  }}
/>

{/* FADE DIREITA */}
<div
  style={{
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
    background: "linear-gradient(to left, #ffffff, transparent)",
    zIndex: 2,
    pointerEvents: "none",
  }}
/>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#334155",
                  marginBottom: 12,
                  letterSpacing: 0.2,
                  textTransform: "uppercase",
                }}
              >
                Filtros rápidos
              </div>

              <div
  style={{
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 6,
    whiteSpace: "nowrap",
    paddingLeft: 16,
paddingRight: 16,
flex: "0 0 auto",
scrollSnapAlign: "start",
scrollbarWidth: "none",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
  }}
>
                {["🔥", "futsal", "society_7", "volei", "futevolei"].map((id) => {
                  const ativo = id === "🔥" ? ordenacao === "preco" : chipsEsportes.includes(id);
                  const label =
  id === "🔥"
    ? "Melhores preços"
    : ESPORTES_OPCOES.find((x) => x.id === id)?.label ?? id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
 if (id === "🔥") {
  setOrdenacao((prev) => (prev === "preco" ? "padrao" : "preco"));
} else {
  toggleChipEsporte(id);
}
}}
                      style={{
  padding: "10px 16px",
  borderRadius: 999,
background: ativo
  ? "#053ff9"
  : "rgba(5, 63, 249, 0.06)",

color: ativo ? "#ffffff" : "#053ff9",

border: ativo
  ? "1px solid #053ff9"
  : "1px solid rgba(5, 63, 249, 0.12)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: ativo
    ? "0 6px 18px rgba(37,99,235,0.35)"
    : "0 8px 22px rgba(37,99,235,0.45)",
  transition: "all 0.2s ease",
}}

onMouseEnter={(e) => {
  if (!ativo) {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  }
}}
onMouseLeave={(e) => {
  if (!ativo) {
    e.currentTarget.style.transform = "translateY(0px)";
    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
  }
}}
                    >
                      {label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    if (!userLoc && !chipPertoDeMim) {
                      pedirLocalizacao();
                    }
                    setChipPertoDeMim((v) => !v);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 999,
                    border: chipPertoDeMim
  ? "1px solid #053ff9"
  : "1px solid rgba(5, 63, 249, 0.12)",

background: chipPertoDeMim
  ? "#053ff9"
  : "rgba(5, 63, 249, 0.06)",

color: chipPertoDeMim ? "#ffffff" : "#053ff9",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Perto de mim
                </button>
              </div>
            </div>

            {mostrarFiltros ? (
              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gap: 16,
                  padding: 16,
                  borderRadius: 18,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <strong style={{ color: "#0f172a" }}>Esportes</strong>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
  <label
    style={{
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
      padding: "10px 12px",
      borderRadius: 999,
      background: ordenacao === "preco" ? "#dbeafe" : "#fff",
      border: ordenacao === "preco" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
      color: ordenacao === "preco" ? "#1d4ed8" : "#334155",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    <input
      type="checkbox"
      checked={ordenacao === "preco"}
      onChange={() =>
        setOrdenacao((prev) => (prev === "preco" ? "padrao" : "preco"))
      }
    />
    Melhores preços
  </label>
</div>


                    {ESPORTES_OPCOES.map((op) => {
                      const ativo = esportesInput.includes(op.id);
                      return (
                        <label
                          key={op.id}
                          style={{
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                            padding: "10px 12px",
                            borderRadius: 999,
                            background: ativo ? "#dbeafe" : "#fff",
                            border: ativo ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                            color: ativo ? "#1d4ed8" : "#334155",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => toggleEsporte(op.id)}
                          />
                          {op.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "#0f172a" }}>Data</strong>
                    <input
                      type="date"
                      value={dataInput}
                      min={hojeISO()}
                      onChange={(e) => setDataInput(e.target.value)}
                      style={{
                        minHeight: 46,
                        borderRadius: 14,
                        border: "1px solid #cbd5e1",
                        padding: "0 14px",
                        background: "#fff",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "#0f172a" }}>Horário</strong>
                    <select
                      value={horaInput}
                      onChange={(e) => setHoraInput(e.target.value)}
                      style={{
                        minHeight: 46,
                        borderRadius: 14,
                        border: "1px solid #cbd5e1",
                        padding: "0 14px",
                        background: "#fff",
                      }}
                    >
                      <option value="">Qualquer</option>
                      {HORARIOS_1H.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
  <strong style={{ color: "#0f172a" }}>Cidade</strong>
  <select
    value={cidadeInput}
    onChange={(e) => setCidadeInput(e.target.value)}
    style={{
      minHeight: 46,
      borderRadius: 14,
      border: "1px solid #cbd5e1",
      padding: "0 14px",
      background: "#fff",
    }}
  >
    <option value="">Qualquer</option>
    {cidadesDisponiveis.map((cidade) => (
      <option key={cidade} value={cidade}>
        {cidade}
      </option>
    ))}
  </select>
</div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <strong style={{ color: "#0f172a" }}>Comodidades</strong>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {COMODIDADES_OPCOES.map((op) => {
                      const ativo = comodidadesInput.includes(op.id);
                      return (
                        <label
                          key={op.id}
                          style={{
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                            padding: "10px 12px",
                            borderRadius: 999,
                            background: ativo ? "#ecfeff" : "#fff",
                            border: ativo ? "1px solid #a5f3fc" : "1px solid #e2e8f0",
                            color: ativo ? "#155e75" : "#334155",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => toggleComodidade(op.id)}
                          />
                          {op.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={buscar}
                    disabled={buscandoDisponibilidade}
                    style={{
                      minHeight: 46,
                      padding: "0 18px",
                      borderRadius: 14,
                      border: "none",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 10px 20px rgba(16,185,129,0.18)",
                    }}
                  >
                    {buscandoDisponibilidade ? "Buscando..." : "Buscar"}
                  </button>

                  {buscaAtiva ? (
                    <button
                      onClick={limparBusca}
                      disabled={buscandoDisponibilidade}
                      style={{
                        minHeight: 46,
                        padding: "0 18px",
                        borderRadius: 14,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                {erroBusca ? (
                  <div
                    style={{
                      color: "#b91c1c",
                      fontSize: 13,
                      fontWeight: 700,
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  >
                    {erroBusca}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 18 }}>
            {loading ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: 18,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
                  color: "#475569",
                  fontWeight: 700,
                }}
              >
                Carregando…
              </div>
            ) : (
              <>
                {semResultados ? (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 20,
                      padding: 18,
                      border: "1px dashed #cbd5e1",
                      color: "#64748b",
                    }}
                  >
                    <strong style={{ color: "#0f172a" }}>Nenhuma quadra encontrada</strong>
                    <div style={{ marginTop: 8 }}>
                      Tente mudar a data, o horário, remover filtros ou escolher outra cidade.
                    </div>
                  </div>
                ) : null}

               <div
  style={{
    position: "relative",
  }}
>
  <button
    type="button"
    onClick={() => scrollQuadras("left")}
    style={{
      position: "absolute",
      left: 6,
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 3,
      width: 42,
      height: 42,
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.28)",
      background: "rgba(255,255,255,0.72)",
      color: "#0f172a",
      fontSize: 24,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
      backdropFilter: "blur(6px)",
    }}
    aria-label="Voltar quadras"
    title="Voltar"
  >
    ‹
  </button>

  <div
    ref={quadrasScrollRef}
    style={{
      display: "flex",
      gap: 16,
      overflowX: "auto",
      padding: "4px 52px 12px",
      scrollBehavior: "smooth",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      scrollSnapType: "x proximity",
    }}
  >
               {quadrasOrdenadas.map((q) => {
  const disponivelHoje = quadrasDisponiveisHoje
    ? quadrasDisponiveisHoje.has(q.id)
    : null;

  const distTxt = formatDistance(userLoc, q);
  const precoInicial = menoresValores[q.id] ?? getStartingPrice(q);
  const comodidades = chipComodidades(q);
  const esportes = (q.esportes ?? q.tipos ?? []).slice(0, 3);
  const favorita = favoritasIds.includes(q.id);
  const favoritaSalvando = favoritaSavingId === q.id;
  const isHovered = hoveredQuadraId === q.id;

  return (
    <Link
      key={q.id}
      to={`/quadra/${q.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        minWidth: 252,
        maxWidth: 272,
        flex: "0 0 272px",
        scrollSnapAlign: "start",
      }}
    >
      <div
        onMouseEnter={() => setHoveredQuadraId(q.id)}
        onMouseLeave={() => setHoveredQuadraId(null)}
        style={{
          background: "linear-gradient(180deg, #ffffff, #f8fbff)",
          borderRadius: 22,
          overflow: "hidden",
          border: isHovered
  ? "1px solid rgba(5, 63, 249, 0.22)"
  : "1px solid rgba(5, 63, 249, 0.08)",
          boxShadow: isHovered
  ? "0 20px 42px rgba(3,18,46,0.16)"
  : "0 10px 24px rgba(3,18,46,0.10)",
          transition:
            "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1), border 0.22s ease",
          transform: isHovered ? "scale(1.02)" : "scale(1)",
          height: "100%",
          minHeight: 100,
          willChange: "transform, box-shadow",
        }}
      >
        <div
          style={{
            position: "relative",
            height: 188,
            background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
            overflow: "hidden",
          }}
        >
          {q.fotoCapaUrl ? (
            <img
              src={q.fotoCapaUrl}
              alt={`Capa ${q.nome}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transform: isHovered ? "scale(1.04)" : "scale(1)",
                transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          ) : null}

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(15,23,42,0.76), rgba(15,23,42,0.14))",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: isHovered
                ? "linear-gradient(to top, rgba(29,78,216,0.14), rgba(255,255,255,0.02))"
                : "transparent",
              transition: "background 0.22s ease",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              top: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {precoInicial != null ? (
                <span
                  style={{
                    background: "rgba(255,255,255,0.94)",
                    color: "#0f172a",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  A partir de {formatBRL(precoInicial)}
                </span>
              ) : (
                <span
                  style={{
                    background: "rgba(255,255,255,0.94)",
                    color: "#0f172a",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  Consultar preço
                </span>
              )}

              {disponivelHoje === null ? null : (
                <span
                  style={{
                    background: disponivelHoje
                      ? "rgba(220,252,231,0.95)"
                      : "rgba(255,255,255,0.94)",
                    color: disponivelHoje ? "#166534" : "#475569",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  {disponivelHoje ? "Disponível hoje" : "Sem horários hoje"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => toggleFavorita(e, q.id)}
              disabled={favoritaSalvando}
              aria-label={
                favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              title={
                favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                border: favorita
                  ? "1px solid rgba(251,113,133,0.38)"
                  : "1px solid rgba(255,255,255,0.32)",
                background: favorita
                  ? "rgba(255,241,242,0.96)"
                  : "rgba(255,255,255,0.92)",
                color: favorita ? "#e11d48" : "#334155",
                fontSize: 12,
                fontWeight: 900,
                cursor: favoritaSalvando ? "wait" : "pointer",
                boxShadow: "0 6px 14px rgba(15,23,42,0.14)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(6px)",
                transform: isHovered ? "scale(1.04)" : "scale(1)",
                transition: "transform 0.18s ease",
                padding: 0,
                lineHeight: 1,
              }}
            >
              {favorita ? "♥" : "♡"}
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>
              {q.nome}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#e2e8f0",
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center",
                lineHeight: 1.2,
              }}
            >
              <span>{q.cidade}</span>
              {distTxt ? (
                <span>• 📍 {distTxt}</span>
              ) : userLoc ? (
                <span>• localização indisponível</span>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ padding: 12 }}>
          {q.endereco ? (
            <div
              style={{
                color: "#64748b",
                fontSize: 11,
                lineHeight: 1.4,
                marginBottom: 10,
              }}
            >
              {q.endereco}
            </div>
          ) : null}

          {esportes.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {esportes.map((esp) => {
                const label =
                  ESPORTES_OPCOES.find((x) => x.id === esp)?.label ?? esp;

                return (
                  <span
                    key={esp}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 10,
                      fontWeight: 800,
                      border: "1px solid #bfdbfe",
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          ) : null}

          {comodidades.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {comodidades.slice(0, 4).map((c) => (
                <span
                  key={c}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 999,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 10,
                    fontWeight: 700,
                    border: "1px solid #e2e8f0",
                    lineHeight: 1,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 2,
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Toque para ver horários
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 32,
                padding: "0 12px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #8ae809, #6fd306)",
                color: "#03122e",
                fontWeight: 900,
                fontSize: 11,
                boxShadow: isHovered
                  ? "0 10px 18px rgba(16,185,129,0.22)"
                  : "0 6px 14px rgba(16,185,129,0.16)",
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
                lineHeight: 1,
              }}
            >
              Ver quadra
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
})}
                </div>

                <button
                  type="button"
                  onClick={() => scrollQuadras("right")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 3,
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.28)",
                    background: "rgba(255,255,255,0.72)",
                    color: "#0f172a",
                    fontSize: 24,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
                    backdropFilter: "blur(6px)",
                  }}
                  aria-label="Avançar quadras"
                  title="Avançar"
                >
                  ›
                </button>
              </div>
              </>
            )}
          </div>

          <div
  style={{
    marginTop: 32,
    borderRadius: 28,
    padding: "28px 20px",
    background: "linear-gradient(135deg, #03122e 0%, #053ff9 100%)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 50px rgba(3,18,46,0.22)",
    overflow: "hidden",
  }}
>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.10)",
                    fontWeight: 800,
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  Plataforma oficial
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "clamp(24px, 7vw, 30px)",
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  O futuro das reservas esportivas já começou
                </h2>

                <p
                  style={{
                    marginTop: 14,
                    marginBottom: 0,
                    color: "#cbd5e1",
                    fontSize: 15,
                    lineHeight: 1.7,
                    maxWidth: 560,
                  }}
                >
                  O Quadra Play conecta atletas e quadras com uma experiência rápida,
                  confiável e profissional. Reserve em segundos e encontre o lugar
                  ideal para o seu jogo.
                </p>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 22,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    marginBottom: 12,
                  }}
                >
                  Por que usar o Quadra Play?
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    "⚡ Reservas rápidas e intuitivas",
                    "📍 Busca por cidade, horário e proximidade",
                    "💳 Mais praticidade para organizar seu jogo",
                    "🏟️ Estrutura profissional para atletas e donos",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.06)",
                        color: "#e2e8f0",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: "rgba(37,99,235,0.16)",
                    border: "1px solid rgba(96,165,250,0.26)",
                    color: "#dbeafe",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.6,
                  }}
                >
                  Quer anunciar sua quadra no Quadra Play? Fale com a gente pelo botão do WhatsApp.
                </div>
              </div>
            </div>
          </div>

          <footer
            style={{
              marginTop: 18,
              marginBottom: 12,
              borderRadius: 22,
              background: "linear-gradient(135deg, #03122e 0%, #0a1f4d 100%)",
              color: "#cbd5e1",
              border: "1px solid rgba(148,163,184,0.12)",
              padding: "24px 20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 24,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#fff",
                  }}
                >
                  Quadra Play
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: "#cbd5e1",
                    lineHeight: 1.7,
                    maxWidth: 280,
                  }}
                >
                  Sua quadra. Seu jogo. Sua jogada. Plataforma feita para conectar atletas e
                  quadras com mais praticidade, organização e confiança.
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#fff",
                    marginBottom: 12,
                  }}
                >
                  Institucional
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <Link
                    to="/quem-somos"
                    style={{
                      color: "#cbd5e1",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Quem Somos
                  </Link>

                  <Link
                    to="/politica-privacidade"
                    style={{
                      color: "#cbd5e1",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Política de Privacidade
                  </Link>

                  <Link
                    to="/termos"
                    style={{
                      color: "#cbd5e1",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Termos de Uso
                  </Link>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#fff",
                    marginBottom: 12,
                  }}
                >
                  Regras da plataforma
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <Link
                    to="/pagamentos-e-regras"
                    style={{
                      color: "#cbd5e1",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Pagamentos e Regras
                  </Link>

                  <Link
                    to="/politica-cancelamento"
                    style={{
                      color: "#cbd5e1",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Política de Cancelamento
                  </Link>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(5, 63, 249, 0.18)",
                boxShadow: "0 25px 60px rgba(3,18,46,0.28)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#cbd5e1",
                  fontWeight: 700,
                }}
              >
                © {new Date().getFullYear()} Quadra Play. Todos os direitos reservados.
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                MVP em evolução contínua
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}