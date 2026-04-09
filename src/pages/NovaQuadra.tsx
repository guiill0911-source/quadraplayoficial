import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../services/firebase";
import { funcionamentoPadrao } from "../types/funcionamento";
import type { Funcionamento } from "../types/funcionamento";
import { useAuth } from "../services/authContext";
import Header from "../components/Header";

type Comodidades = {
  chuveiro: boolean;
  churrasqueira: boolean;
  mesaSinuca: boolean;
  iluminacao: boolean;
  coletes: boolean;
};

const comodidadesPadrao: Comodidades = {
  chuveiro: false,
  churrasqueira: false,
  mesaSinuca: false,
  iluminacao: false,
  coletes: false,
};

const ESPORTES_OPCOES = [
  { id: "futsal", label: "Futsal" },
  { id: "society_5", label: "Society 5" },
  { id: "society_7", label: "Society 7" },
  { id: "campo_11", label: "Campo 11" },
  { id: "volei", label: "Vôlei" },
  { id: "futevolei", label: "Futevôlei" },
  { id: "futmesa", label: "Futmesa" },
  { id: "beach_tenis", label: "Beach Tênis" },
] as const;

type EsporteId = (typeof ESPORTES_OPCOES)[number]["id"];

function parseMoneyToNumber(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.replace(",", "."));
  if (isNaN(n) || n < 0) return null;
  return n;
}

function onlyDigits(s: string) {
  return String(s ?? "").replace(/\D+/g, "");
}

function buildEnderecoCompleto(params: {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}) {
  const rua = (params.rua ?? "").trim();
  const numero = (params.numero ?? "").trim();
  const bairro = (params.bairro ?? "").trim();
  const cidade = (params.cidade ?? "").trim();
  const uf = (params.uf ?? "").trim();

  const linha1 = [rua, numero ? `nº ${numero}` : ""].filter(Boolean).join(", ");
  const linha2 = [bairro, cidade, uf].filter(Boolean).join(" • ");

  return [linha1, linha2].filter(Boolean).join(" — ");
}

async function uploadFotoSuperSeguro(quadraId: string, file: File, timeoutMs = 180000) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `quadras/${quadraId}/capa-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, caminho);

  console.log("[UPLOAD] start", { caminho, size: file.size });

  const task = uploadBytesResumable(storageRef, file);

  const uploadPromise = new Promise<{ url: string; caminho: string }>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        console.log("[UPLOAD] progress", snap.bytesTransferred, "/", snap.totalBytes);
      },
      (error) => {
        console.log("[UPLOAD] error", error);
        reject(error);
      },
      async () => {
        console.log("[UPLOAD] complete");
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          console.log("[UPLOAD] url ok");
          resolve({ url, caminho });
        } catch (e) {
          reject(e);
        }
      }
    );
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(() => {
      console.log("[UPLOAD] TIMEOUT -> cancel");
      try {
        task.cancel();
      } catch {}
      reject(new Error("Upload da foto demorou demais e foi cancelado. Tente novamente."));
    }, timeoutMs);

    uploadPromise.finally(() => clearTimeout(t));
  });

  return Promise.race([uploadPromise, timeoutPromise]);
}

async function uploadFotosQuadra(quadraId: string, files: File[]) {
  const uploads = await Promise.all(
    files.map(async (file, index) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const caminho = `quadras/${quadraId}/galeria-${Date.now()}-${index}-${safeName}`;
      const storageRef = ref(storage, caminho);

      const task = uploadBytesResumable(storageRef, file);

      const result = await new Promise<{ url: string; caminho: string }>((resolve, reject) => {
        task.on(
          "state_changed",
          () => {},
          (error) => reject(error),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              resolve({ url, caminho });
            } catch (e) {
              reject(e);
            }
          }
        );
      });

      return result;
    })
  );

  return uploads;
}

type ViaCepResp = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

async function buscarEnderecoPorCep(cep8: string): Promise<ViaCepResp> {
  const url = `https://viacep.com.br/ws/${cep8}/json/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao consultar CEP.");
  return (await res.json()) as ViaCepResp;
}

async function geocodarEnderecoNominatim(
  enderecoCompleto: string
): Promise<{ lat: number; lng: number } | null> {
  const tentativas = [
    enderecoCompleto.trim(),
    enderecoCompleto.replace(/CEP\s*\d+/gi, "").trim(),
    enderecoCompleto.split(",").slice(-2).join(", ").trim(),
  ].filter(Boolean);

  for (const q of tentativas) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
        `&q=${encodeURIComponent(q)}&accept-language=pt-BR`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      const first = data?.[0];
      if (!first) continue;

      const lat = Number(first.lat);
      const lng = Number(first.lon);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    } catch (e) {
      console.warn("[GEO] tentativa falhou:", q, e);
    }
  }

  return null;
}

const COLORS = {
  primary: "#053ff9",
  accent: "#8ae809",
  white: "#ffffff",
  dark: "#03122e",
  page: "#eef4ff",
  card: "#ffffff",
  line: "#d9e4ff",
  muted: "#6b7a99",
  softBlue: "#edf3ff",
  softGreen: "#f4ffd9",
  shadow: "0 20px 55px rgba(3, 18, 46, 0.12)",
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${COLORS.dark} 0px, ${COLORS.dark} 210px, ${COLORS.page} 210px, ${COLORS.page} 100%)`,
    overflowX: "hidden",
  },
  container: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "20px 16px 48px",
    boxSizing: "border-box",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    background: `linear-gradient(135deg, ${COLORS.primary} 0%, #2f67ff 55%, #4d84ff 100%)`,
    color: COLORS.white,
    borderRadius: 30,
    padding: "30px 28px",
    boxShadow: "0 24px 65px rgba(5,63,249,0.28)",
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.14)",
  },
  heroGlow: {
    position: "absolute",
    right: -80,
    top: -80,
    width: 240,
    height: 240,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },
  heroGlow2: {
    position: "absolute",
    left: -60,
    bottom: -90,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(138,232,9,0.16)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    color: COLORS.white,
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    margin: 0,
    fontSize: 42,
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    position: "relative",
    zIndex: 1,
  },
  heroText: {
    marginTop: 12,
    marginBottom: 0,
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 680,
    position: "relative",
    zIndex: 1,
  },
  heroMiniStats: {
    marginTop: 22,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  },
  heroPill: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(3,18,46,0.22)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: COLORS.white,
    fontWeight: 700,
    fontSize: 13,
  },
  layout: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.8fr)",
    gap: 20,
    alignItems: "start",
  },
  mainCard: {
  background: COLORS.card,
  borderRadius: 28,
  padding: 22,
  border: `1px solid ${COLORS.line}`,
  boxShadow: COLORS.shadow,
  minWidth: 0,
},
  sideCard: {
  background: COLORS.card,
  borderRadius: 28,
  padding: 22,
  border: `1px solid ${COLORS.line}`,
  boxShadow: COLORS.shadow,
  position: "sticky",
  top: 18,
  minWidth: 0,
},
  sectionHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
    color: COLORS.dark,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "10px 0 0",
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 1.65,
    maxWidth: 720,
  },
  progressBox: {
    minWidth: 180,
    background: COLORS.softBlue,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 18,
    padding: "12px 14px",
  },
  progressLabel: {
    color: COLORS.primary,
    fontWeight: 800,
    fontSize: 12,
    marginBottom: 4,
  },
  progressValue: {
    color: COLORS.dark,
    fontWeight: 900,
    fontSize: 18,
  },
  blocks: {
    display: "grid",
    gap: 18,
    marginTop: 22,
  },
  block: {
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  border: `1px solid ${COLORS.line}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 10px 30px rgba(3,18,46,0.05)",
  minWidth: 0,
},
  blockHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  blockHeaderLeft: {
    display: "grid",
    gap: 6,
  },
  blockBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: COLORS.softBlue,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.primary,
    fontWeight: 800,
    fontSize: 12,
  },
  blockTitle: {
    margin: 0,
    color: COLORS.dark,
    fontSize: 23,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  blockText: {
    margin: 0,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 1.55,
  },
  blockAccent: {
    padding: "10px 12px",
    borderRadius: 16,
    background: COLORS.softGreen,
    border: "1px solid rgba(138,232,9,0.35)",
    color: "#3d5f00",
    fontWeight: 800,
    fontSize: 12,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 7,
  },
  label: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: 800,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    border: `1px solid ${COLORS.line}`,
    padding: "0 16px",
    background: "#f9fbff",
    color: COLORS.dark,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  textarea: {
    minHeight: 128,
    borderRadius: 16,
    border: `1px solid ${COLORS.line}`,
    padding: "14px 16px",
    background: "#f9fbff",
    color: COLORS.dark,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
  },
  helper: {
    margin: 0,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 1.5,
  },
  helperInfo: {
    padding: "12px 14px",
    borderRadius: 16,
    background: COLORS.softBlue,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: 700,
  },
  chipWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },
  uploadBox: {
    border: `1.5px dashed ${COLORS.line}`,
    background: "linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%)",
    borderRadius: 22,
    padding: 18,
  },
  uploadActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
  },
  fakeUploadBtn: {
    minHeight: 48,
    padding: "0 18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    background: COLORS.primary,
    color: COLORS.white,
    fontWeight: 900,
    fontSize: 14,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(5,63,249,0.22)",
  },
  fileName: {
    color: COLORS.dark,
    fontSize: 14,
    fontWeight: 700,
  },
  previewImg: {
    marginTop: 16,
    width: "100%",
    maxHeight: 300,
    objectFit: "cover",
    borderRadius: 20,
    display: "block",
    border: `1px solid ${COLORS.line}`,
    boxShadow: "0 12px 30px rgba(3,18,46,0.08)",
  },
  sideTopBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: COLORS.softBlue,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.primary,
    fontWeight: 800,
    fontSize: 12,
    marginBottom: 12,
  },
  sideTitle: {
    margin: 0,
    color: COLORS.dark,
    fontWeight: 900,
    fontSize: 28,
    letterSpacing: "-0.02em",
  },
  sideText: {
    margin: "10px 0 0",
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 1.6,
  },
  summaryBox: {
    display: "grid",
    gap: 12,
    marginTop: 18,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: 18,
    background: "#fbfdff",
    border: `1px solid ${COLORS.line}`,
  },
  summaryKeyWrap: {
    display: "grid",
    gap: 3,
  },
  summaryKey: {
    color: COLORS.dark,
    fontSize: 14,
    fontWeight: 800,
  },
  summarySub: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: 600,
  },
  summaryValue: {
  color: COLORS.dark,
  fontSize: 14,
  fontWeight: 900,
  maxWidth: "100%",
  wordBreak: "break-word",
  textAlign: "right",
  minWidth: 0,
},
  infoBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    background: `linear-gradient(180deg, ${COLORS.softBlue} 0%, #ffffff 100%)`,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.dark,
    lineHeight: 1.6,
    fontSize: 14,
    fontWeight: 700,
  },
  ctaBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 22,
    background: `linear-gradient(135deg, ${COLORS.dark} 0%, #082050 100%)`,
    color: COLORS.white,
    boxShadow: "0 18px 38px rgba(3,18,46,0.18)",
  },
  ctaTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
  },
  ctaText: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 1.55,
  },
  actionBtn: {
    width: "100%",
    minHeight: 56,
    marginTop: 16,
    padding: "0 22px",
    borderRadius: 18,
    border: "none",
    background: `linear-gradient(135deg, ${COLORS.accent} 0%, #79cf08 100%)`,
    color: COLORS.dark,
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(138,232,9,0.28)",
  },
};

function getEsporteLabel(id: string) {
  return ESPORTES_OPCOES.find((e) => e.id === id)?.label ?? id;
}

function renderChipStyle(ativo: boolean, variant: "blue" | "green" = "blue"): CSSProperties {
  if (variant === "green") {
    return {
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
      padding: "11px 14px",
      borderRadius: 999,
      background: ativo ? COLORS.softGreen : "#ffffff",
      border: ativo ? "1px solid rgba(138,232,9,0.50)" : `1px solid ${COLORS.line}`,
      color: ativo ? "#3d5f00" : COLORS.dark,
      fontWeight: 800,
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: ativo ? "0 8px 18px rgba(138,232,9,0.14)" : "none",
    };
  }

  return {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    padding: "11px 14px",
    borderRadius: 999,
    background: ativo ? COLORS.softBlue : "#ffffff",
    border: ativo ? `1px solid rgba(5,63,249,0.28)` : `1px solid ${COLORS.line}`,
    color: ativo ? COLORS.primary : COLORS.dark,
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: ativo ? "0 8px 18px rgba(5,63,249,0.10)" : "none",
  };
}

export default function NovaQuadra() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [nome, setNome] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [msgEndereco, setMsgEndereco] = useState<string>("");

  const [valorHora, setValorHora] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [esportes, setEsportes] = useState<EsporteId[]>([]);
  const [valoresPorEsporte, setValoresPorEsporte] = useState<Record<string, string>>({});

  const [fotoCapa, setFotoCapa] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);

  const [fotosQuadra, setFotosQuadra] = useState<File[]>([]);
  const [fotosQuadraPreview, setFotosQuadraPreview] = useState<string[]>([]);

  const [comodidades, setComodidades] = useState<Comodidades>(comodidadesPadrao);
  const [funcionamento] = useState<Funcionamento>(funcionamentoPadrao);

  const [salvando, setSalvando] = useState(false);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);

useEffect(() => {
  function onResize() {
    setIsMobile(window.innerWidth <= 900);
  }

  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

  function toggleComodidade(chave: keyof Comodidades) {
    setComodidades((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function toggleEsporte(id: EsporteId) {
    setEsportes((prev) => {
      const jaTem = prev.includes(id);
      const novo = jaTem ? prev.filter((x) => x !== id) : [...prev, id];

      if (jaTem) {
        setValoresPorEsporte((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
      } else {
        setValoresPorEsporte((m) => ({ ...m, [id]: m[id] ?? "" }));
      }

      return novo;
    });
  }

  const esportesSelecionadosOrdenados = useMemo(() => {
    return ESPORTES_OPCOES.filter((e) => esportes.includes(e.id)).map((e) => e.id);
  }, [esportes]);

  function setValorDoEsporte(esporteId: string, valor: string) {
    setValoresPorEsporte((prev) => ({ ...prev, [esporteId]: valor }));
  }

  function handleFotosQuadraChange(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files;
  if (!files) return;

  const arquivos = Array.from(files);

  setFotosQuadra((prev) => [...prev, ...arquivos]);

  const previews = arquivos.map((file) => URL.createObjectURL(file));
  setFotosQuadraPreview((prev) => [...prev, ...previews]);
}

useEffect(() => {
  return () => {
    if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
    fotosQuadraPreview.forEach((url) => URL.revokeObjectURL(url));
  };
}, [fotoPreviewUrl, fotosQuadraPreview]);

  async function onBuscarCep() {
    setMsgEndereco("");

    const c = onlyDigits(cep);
    if (c.length !== 8) {
      setMsgEndereco("CEP inválido. Digite 8 números.");
      return;
    }

    try {
      setBuscandoCep(true);
      const r = await buscarEnderecoPorCep(c);
      if (r.erro) {
        setMsgEndereco("CEP não encontrado.");
        return;
      }

      setRua(r.logradouro ?? "");
      setBairro(r.bairro ?? "");
      setCidade(r.localidade ?? "");
      setUf(r.uf ?? "");
      setMsgEndereco("Endereço encontrado com sucesso. Agora preencha o número.");
    } catch (e: any) {
      console.error(e);
      setMsgEndereco(e?.message ?? "Erro ao buscar CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    if (loading) return;

    const uid = user?.uid;
    if (!uid) {
      alert("Você precisa estar logado para cadastrar uma quadra.");
      return;
    }

    if ((user as any)?.role !== "dono") {
      alert("Apenas usuários com perfil DONO podem cadastrar quadras.");
      return;
    }

    if (!nome.trim()) {
      alert("Preencha o nome.");
      return;
    }

    if (!cidade.trim()) {
      alert("Preencha a cidade (ou busque pelo CEP).");
      return;
    }

    if (esportes.length === 0) {
      alert("Selecione pelo menos 1 esporte.");
      return;
    }

    if (fotoCapa && fotoCapa.size > 5 * 1024 * 1024) {
      alert("Imagem muito grande. Use uma foto de até 5MB (ideal: 1MB).");
      return;
    }

    const valorGeralNumero = valorHora.trim() === "" ? null : parseMoneyToNumber(valorHora);
    if (valorHora.trim() !== "" && valorGeralNumero === null) {
      alert("Valor por hora (geral) inválido.");
      return;
    }

    const valoresConvertidos: Record<string, number> = {};
    for (const esp of esportes) {
      const valStr = valoresPorEsporte[esp] ?? "";
      const valNum = parseMoneyToNumber(valStr);
      if (valNum === null) {
        alert(`Informe um valor válido para o esporte: ${getEsporteLabel(esp)}`);
        return;
      }
      valoresConvertidos[esp] = valNum;
    }

    const enderecoStr = buildEnderecoCompleto({
      rua,
      numero,
      bairro,
      cidade,
      uf,
    });

    const geoQuery = [
      rua?.trim(),
      numero?.trim(),
      bairro?.trim(),
      cidade?.trim(),
      uf?.trim(),
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    setSalvando(true);
    console.log("[SALVAR] inicio", { temFoto: !!fotoCapa, nome: fotoCapa?.name, size: fotoCapa?.size });

    try {
      const quadraRef = doc(collection(db, "quadras"));

      let fotoCapaUrl: string | null = null;
      let fotoCapaPath: string | null = null;

      let fotosQuadraUrls: string[] = [];
      let fotosQuadraPaths: string[] = [];

      if (fotoCapa) {
       const up = await uploadFotoSuperSeguro(quadraRef.id, fotoCapa, 180000);
        fotoCapaUrl = up.url;
        fotoCapaPath = up.caminho;
      }

      if (fotosQuadra.length > 0) {
  const uploads = await uploadFotosQuadra(quadraRef.id, fotosQuadra);
  fotosQuadraUrls = uploads.map((u) => u.url);
  fotosQuadraPaths = uploads.map((u) => u.caminho);
}

      console.log("[SALVAR] upload terminou", { fotoCapaUrl, fotoCapaPath });

      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const ll = await geocodarEnderecoNominatim(geoQuery);

        if (ll) {
          latitude = ll.lat;
          longitude = ll.lng;
          console.log("[GEO] sucesso:", { geoQuery, latitude, longitude });
        } else {
          console.warn("[GEO] não encontrou coordenadas para:", geoQuery);
        }
      } catch (e) {
        console.warn("[GEO] falhou", e);
      }

      if (latitude == null || longitude == null) {
        throw new Error(
          "Não foi possível localizar este endereço no mapa. Revise rua, número, cidade e UF antes de salvar."
        );
      }

      await setDoc(quadraRef, {
        ownerId: uid,
        nome: nome.trim(),
        cep: onlyDigits(cep) || null,
        rua: rua.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        uf: uf.trim(),
        cidade: cidade.trim(),
        endereco: enderecoStr,
        observacoes: observacoes.trim(),
        latitude,
        longitude,
        esportes,
        valoresPorEsporte: valoresConvertidos,
        valorHora: valorGeralNumero,
        comodidades,
        funcionamento,
        fotoCapaUrl,
        fotoCapaPath,
        fotos: fotosQuadraUrls,
fotosPaths: fotosQuadraPaths,
        configEsportes: {
          society_7: {
            ativo: true,
            duracaoMinutos: 60,
            usarFuncionamentoProprio: false,
          },
          volei: {
            ativo: true,
            duracaoMinutos: 60,
            usarFuncionamentoProprio: false,
          },
          campo_11: {
            ativo: true,
            duracaoMinutos: 90,
            usarFuncionamentoProprio: false,
          },
        },
        ativo: true,
        createdAt: serverTimestamp(),
      });

      console.log("[SALVAR] setDoc ok");

      setNome("");
      setCep("");
      setRua("");
      setNumero("");
      setBairro("");
      setCidade("");
      setUf("");
      setMsgEndereco("");

      setObservacoes("");
      setValorHora("");
      setEsportes([]);
      setValoresPorEsporte({});
      setComodidades(comodidadesPadrao);

      setFotoCapa(null);
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
      setFotoPreviewUrl(null);

      navigate(`/dono/quadra/${quadraRef.id}/horarios`);
    } catch (err: any) {
      console.error("ERRO AO SALVAR QUADRA:", err);
      alert(`Erro ao salvar: ${err?.code || err?.message || err}`);
    } finally {
      setSalvando(false);
    }
  }

  const enderecoPreview = buildEnderecoCompleto({ rua, numero, bairro, cidade, uf });

  const comodidadesAtivas = Object.entries(comodidades)
    .filter(([, ativo]) => ativo)
    .map(([k]) => {
      if (k === "chuveiro") return "Chuveiro";
      if (k === "churrasqueira") return "Churrasqueira";
      if (k === "mesaSinuca") return "Mesa de sinuca";
      if (k === "iluminacao") return "Iluminação";
      if (k === "coletes") return "Coletes";
      return k;
    });

  const progressoCampos =
    [
      nome.trim(),
      cidade.trim(),
      enderecoPreview.trim(),
      esportes.length > 0 ? "ok" : "",
      valorHora.trim(),
      fotoCapa ? "ok" : "",
    ].filter(Boolean).length;

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div
  style={{
    ...styles.hero,
    padding: isMobile ? "24px 18px" : "30px 28px",
    borderRadius: isMobile ? 24 : 30,
  }}
>
            <div style={styles.heroGlow} />
            <div style={styles.heroGlow2} />

            <div style={styles.heroBadge}>Cadastro premium de nova quadra</div>
            <h1
  style={{
    ...styles.heroTitle,
    fontSize: isMobile ? 30 : 42,
    lineHeight: isMobile ? 1.08 : 1.02,
  }}
>
  Nova Quadra
</h1>
            <p
  style={{
    ...styles.heroText,
    fontSize: isMobile ? 15 : 16,
    maxWidth: "100%",
  }}
>
              Cadastre sua quadra com uma apresentação forte, organizada e profissional.
              Depois de salvar, você já segue direto para a etapa de geração de horários.
            </p>

            <div style={styles.heroMiniStats}>
              <div style={styles.heroPill}>Visual mais premium</div>
              <div style={styles.heroPill}>Cadastro mais claro</div>
              <div style={styles.heroPill}>Pronto para reservas</div>
            </div>
          </div>

          <div
  style={{
    ...styles.layout,
    gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.35fr) minmax(320px, 0.8fr)",
  }}
>
           <div
  style={{
    ...styles.mainCard,
    order: isMobile ? 1 : 0,
  }}
>
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 style={styles.sectionTitle}>Informações da quadra</h2>
                  <p style={styles.sectionText}>
                    Organize os dados principais do anúncio. A ideia aqui é deixar a sua quadra
                    bonita, completa e pronta para passar confiança logo no primeiro olhar.
                  </p>
                </div>

                <div style={styles.progressBox}>
                  <div style={styles.progressLabel}>Preenchimento atual</div>
                  <div style={styles.progressValue}>{progressoCampos}/6 blocos principais</div>
                </div>
              </div>

              <div style={styles.blocks}>
                <section style={styles.block}>
                  <div style={styles.blockHeader}>
                    <div style={styles.blockHeaderLeft}>
                      <div style={styles.blockBadge}>Identidade</div>
                      <h3 style={styles.blockTitle}>Nome e apresentação</h3>
                      <p style={styles.blockText}>
                        Escolha um nome forte e, se quiser, adicione uma observação curta que valorize a quadra.
                      </p>
                    </div>
                    <div style={styles.blockAccent}>Primeira impressão importa</div>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    <label style={styles.field}>
                      <span style={styles.label}>Nome da quadra</span>
                      <input
                        placeholder="Ex: Arena Litoral BC"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Observações</span>
                      <textarea
                        placeholder="Ex: ambiente familiar, estacionamento amplo, vestiário reformado, iluminação profissional..."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        rows={4}
                        style={styles.textarea}
                      />
                    </label>
                  </div>
                </section>

                <section style={styles.block}>
                  <div style={styles.blockHeader}>
                    <div style={styles.blockHeaderLeft}>
                      <div style={styles.blockBadge}>Localização</div>
                      <h3 style={styles.blockTitle}>Endereço da quadra</h3>
                      <p style={styles.blockText}>
                        Busque pelo CEP para agilizar o preenchimento ou informe tudo manualmente.
                      </p>
                    </div>
                    <div style={styles.blockAccent}>Mapa mais preciso</div>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    <div
  style={{
    ...styles.grid2,
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
  }}
>
                      <label style={styles.field}>
                        <span style={styles.label}>CEP</span>
                        <input
                          placeholder="Ex: 01001000"
                          value={cep}
                          onChange={(e) => setCep(e.target.value)}
                          style={styles.input}
                        />
                      </label>

                      <div style={{ ...styles.field, alignSelf: "end" }}>
                        <span style={styles.label}>Buscar endereço</span>
                        <button
                          onClick={onBuscarCep}
                          disabled={buscandoCep}
                          style={{
                            ...styles.fakeUploadBtn,
                            width: "100%",
                            background: COLORS.white,
                            color: COLORS.dark,
                            border: `1px solid ${COLORS.line}`,
                            boxShadow: "none",
                          }}
                        >
                          {buscandoCep ? "Buscando..." : "Buscar CEP"}
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.helperInfo,
                        background: msgEndereco
                          ? msgEndereco.toLowerCase().includes("sucesso") ||
                            msgEndereco.toLowerCase().includes("encontrado")
                            ? COLORS.softGreen
                            : "#fff7ed"
                          : COLORS.softBlue,
                        border:
                          msgEndereco &&
                          (msgEndereco.toLowerCase().includes("sucesso") ||
                            msgEndereco.toLowerCase().includes("encontrado"))
                            ? "1px solid rgba(138,232,9,0.40)"
                            : msgEndereco
                            ? "1px solid #fdba74"
                            : `1px solid ${COLORS.line}`,
                      }}
                    >
                      {msgEndereco || "Dica: ao preencher pelo CEP, finalize com o número para melhorar a geolocalização."}
                    </div>

                    <label style={styles.field}>
                      <span style={styles.label}>Rua / Logradouro</span>
                      <input
                        placeholder="Rua / Logradouro"
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <div
  style={{
    ...styles.grid3,
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
  }}
>
                      <label style={styles.field}>
                        <span style={styles.label}>Número</span>
                        <input
                          placeholder="Ex: 123"
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>Bairro</span>
                        <input
                          placeholder="Bairro"
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                          style={styles.input}
                        />
                      </label>

                      <label style={styles.field}>
                        <span style={styles.label}>UF</span>
                        <input
                          placeholder="UF"
                          value={uf}
                          onChange={(e) => setUf(e.target.value)}
                          style={styles.input}
                        />
                      </label>
                    </div>

                    <label style={styles.field}>
                      <span style={styles.label}>Cidade</span>
                      <input
                        placeholder="Cidade"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <div style={styles.helperInfo}>
                      Endereço montado: <strong>{enderecoPreview || "—"}</strong>
                    </div>
                  </div>
                </section>

                <section style={styles.block}>
                  <div style={styles.blockHeader}>
                    <div style={styles.blockHeaderLeft}>
                      <div style={styles.blockBadge}>Oferta esportiva</div>
                      <h3 style={styles.blockTitle}>Esportes e preços</h3>
                      <p style={styles.blockText}>
                        Selecione os esportes disponíveis e defina o valor por hora de cada um.
                      </p>
                    </div>
                    <div style={styles.blockAccent}>Mais clareza para o atleta</div>
                  </div>

                  <div style={{ display: "grid", gap: 18 }}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={styles.label}>Esportes disponíveis</label>
                      <div style={styles.chipWrap}>
                        {ESPORTES_OPCOES.map((op) => {
                          const ativo = esportes.includes(op.id);
                          return (
                            <label key={op.id} style={renderChipStyle(ativo, "blue")}>
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

                    <label style={styles.field}>
                      <span style={styles.label}>Valor geral por hora (opcional)</span>
                      <input
                        placeholder="Ex: 120"
                        value={valorHora}
                        onChange={(e) => setValorHora(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={styles.label}>Valores por esporte (R$/hora)</label>

                      {esportesSelecionadosOrdenados.length === 0 ? (
                        <div style={styles.helperInfo}>
                          Marque pelo menos 1 esporte acima para liberar a definição de preços específicos.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                          {esportesSelecionadosOrdenados.map((espId) => {
                            const label = getEsporteLabel(espId);
                            return (
                              <label key={espId} style={styles.field}>
                                <span style={styles.label}>{label}</span>
                                <input
                                  placeholder="Ex: 120"
                                  value={valoresPorEsporte[espId] ?? ""}
                                  onChange={(e) => setValorDoEsporte(espId, e.target.value)}
                                  style={styles.input}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section style={styles.block}>
                  <div style={styles.blockHeader}>
                    <div style={styles.blockHeaderLeft}>
                      <div style={styles.blockBadge}>Diferenciais</div>
                      <h3 style={styles.blockTitle}>Comodidades da quadra</h3>
                      <p style={styles.blockText}>
                        Marque tudo que ajuda sua quadra a se destacar e gerar mais valor percebido.
                      </p>
                    </div>
                    <div style={styles.blockAccent}>Mais atratividade no anúncio</div>
                  </div>

                  <div style={styles.chipWrap}>
                    {[
                      { key: "chuveiro", label: "Chuveiro" },
                      { key: "churrasqueira", label: "Churrasqueira" },
                      { key: "mesaSinuca", label: "Mesa de sinuca" },
                      { key: "iluminacao", label: "Iluminação" },
                      { key: "coletes", label: "Coletes" },
                    ].map((item) => {
                      const ativo = comodidades[item.key as keyof Comodidades];
                      return (
                        <label key={item.key} style={renderChipStyle(ativo, "green")}>
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => toggleComodidade(item.key as keyof Comodidades)}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section style={styles.block}>
                  <div style={styles.blockHeader}>
                    <div style={styles.blockHeaderLeft}>
                      <div style={styles.blockBadge}>Imagem principal</div>
                      <h3 style={styles.blockTitle}>Foto de capa</h3>
                      <p style={styles.blockText}>
                        Escolha uma imagem bonita da quadra. Essa foto ajuda muito na percepção de qualidade.
                      </p>
                    </div>
                    <div style={styles.blockAccent}>Quanto melhor a foto, melhor a conversão</div>
                  </div>

                  <div style={styles.uploadBox}>
                    <p style={styles.helper}>
                      Use uma imagem clara, bem enquadrada e que mostre o espaço com aparência profissional.
                    </p>

                    <div style={styles.uploadActions}>
                      <label style={styles.fakeUploadBtn}>
                        Escolher imagem
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setFotoCapa(file);

                            if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);

                            if (file) {
                              const preview = URL.createObjectURL(file);
                              setFotoPreviewUrl(preview);
                            } else {
                              setFotoPreviewUrl(null);
                            }
                          }}
                          style={{ display: "none" }}
                        />
                      </label>

                      <span style={styles.fileName}>
                        {fotoCapa ? fotoCapa.name : "Nenhuma imagem selecionada"}
                      </span>
                    </div>

                    {fotoPreviewUrl ? (
                      <img
                        src={fotoPreviewUrl}
                        alt="Preview da capa"
                        style={styles.previewImg}
                      />
                    ) : null}
                  </div>
                </section>
                <section style={styles.block}>
  <div style={styles.blockHeader}>
    <div style={styles.blockHeaderLeft}>
      <div style={styles.blockBadge}>Galeria da quadra</div>
      <h3 style={styles.blockTitle}>Fotos da quadra</h3>
      <p style={styles.blockText}>
        Adicione mais imagens do espaço para mostrar melhor a quadra, ambiente,
        iluminação, estrutura e diferenciais.
      </p>
    </div>
    <div style={styles.blockAccent}>Mais confiança no anúncio</div>
  </div>

  <div style={styles.uploadBox}>
    <p style={styles.helper}>
      Envie fotos do espaço interno, quadra, vestiário, churrasqueira,
      iluminação e outros diferenciais.
    </p>

    <div style={styles.uploadActions}>
      <label style={styles.fakeUploadBtn}>
        Adicionar fotos
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFotosQuadraChange}
          style={{ display: "none" }}
        />
      </label>

      <span style={styles.fileName}>
        {fotosQuadra.length > 0
          ? `${fotosQuadra.length} foto(s) selecionada(s)`
          : "Nenhuma foto adicional selecionada"}
      </span>
    </div>

    {fotosQuadraPreview.length > 0 ? (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
          gap: 12,
          marginTop: 16,
        }}
      >
        {fotosQuadraPreview.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={url}
            alt={`Preview da quadra ${index + 1}`}
            style={{
              width: "100%",
              height: 140,
              objectFit: "cover",
              borderRadius: 16,
              border: `1px solid ${COLORS.line}`,
              boxShadow: "0 10px 24px rgba(3,18,46,0.08)",
            }}
          />
        ))}
      </div>
    ) : null}
  </div>
</section>
              </div>
            </div>

           <aside
  style={{
    ...styles.sideCard,
    position: isMobile ? "relative" : "sticky",
    top: isMobile ? 0 : 18,
    order: isMobile ? 2 : 0,
  }}
>
              <div style={styles.sideTopBadge}>Resumo ao vivo</div>
              <h2 style={styles.sideTitle}>Resumo do cadastro</h2>
              <p style={styles.sideText}>
                Veja em tempo real como a sua quadra está ficando antes de salvar e seguir para a etapa 2.
              </p>

              <div style={styles.summaryBox}>
                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Nome</div>
                    <div style={styles.summarySub}>Identidade principal</div>
                  </div>
                  <div style={styles.summaryValue}>{nome.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Cidade</div>
                    <div style={styles.summarySub}>Local de operação</div>
                  </div>
                  <div style={styles.summaryValue}>{cidade.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Endereço</div>
                    <div style={styles.summarySub}>Base da geolocalização</div>
                  </div>
                  <div style={styles.summaryValue}>{enderecoPreview || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Esportes</div>
                    <div style={styles.summarySub}>O que a quadra oferece</div>
                  </div>
                  <div style={styles.summaryValue}>
                    {esportesSelecionadosOrdenados.length > 0
                      ? esportesSelecionadosOrdenados.map((id) => getEsporteLabel(id)).join(", ")
                      : "—"}
                  </div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Valor geral</div>
                    <div style={styles.summarySub}>Preço base opcional</div>
                  </div>
                  <div style={styles.summaryValue}>{valorHora.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Comodidades</div>
                    <div style={styles.summarySub}>Diferenciais do espaço</div>
                  </div>
                  <div style={styles.summaryValue}>
                    {comodidadesAtivas.length > 0 ? comodidadesAtivas.join(", ") : "—"}
                  </div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKeyWrap}>
                    <div style={styles.summaryKey}>Foto de capa</div>
                    <div style={styles.summarySub}>Imagem principal</div>
                  </div>
                  <div style={styles.summaryValue}>{fotoCapa ? "Selecionada" : "Não enviada"}</div>
                </div>
              </div>
              <div style={styles.summaryRow}>
  <div style={styles.summaryKeyWrap}>
    <div style={styles.summaryKey}>Fotos da quadra</div>
    <div style={styles.summarySub}>Galeria complementar</div>
  </div>
  <div style={styles.summaryValue}>
    {fotosQuadra.length > 0 ? `${fotosQuadra.length} selecionada(s)` : "Nenhuma"}
  </div>
</div>

              <div style={styles.infoBox}>
                Após salvar, você seguirá direto para a etapa de geração de horários da quadra.
              </div>

              <div style={styles.ctaBox}>
                <h3 style={styles.ctaTitle}>Próxima etapa</h3>
                <p style={styles.ctaText}>
                  A próxima tela será a parte operacional: gerar horários, bloquear períodos e deixar a agenda pronta para reservas reais.
                </p>

                <button onClick={salvar} disabled={salvando} style={styles.actionBtn}>
                  {salvando ? "Salvando..." : "Salvar e ir para Etapa 2"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}