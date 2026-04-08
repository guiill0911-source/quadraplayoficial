import { useEffect, useState, useRef, type CSSProperties } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { sendEmailVerification, getAuth } from "firebase/auth";

import { db, app } from "../services/firebase";
import { buscarSlotsDisponiveisDaQuadra } from "../services/disponibilidadesBusca";
import type { SlotDisponibilidade } from "../services/disponibilidadesBusca";
import { reservarHorario } from "../services/reservas";
import { useAuth } from "../services/authContext";

import {
  criarAvaliacao,
  buscarResumoAvaliacoesDaQuadra,
} from "../services/avaliacoes";

import { verifyAndBindCpf } from "../services/cpf";
import ConfirmModal from "../components/ConfirmModal";

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
  fotos?: string[];
  comodidades?: Comodidades;
};

type ReservaDoc = {
  id: string;
  quadraId: string;
  clienteUid: string;

  status?: string;
  data: string;
  horaInicio: string;
  horaFim: string;

  naoCompareceu?: boolean;
  avaliadaEm?: any;
};

type MpConnectionStatus = "not_connected" | "pending" | "connected" | "error";

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

const RESERVA_TIMEOUT_MS = 15000;
const TOAST_MS = 7000;

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

function stars(media: number) {
  const rounded = Math.round(media);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}

function onlyDigits(s: string) {
  return String(s ?? "").replace(/\D/g, "");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTimeBR(date: Date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

function humanizeFirestoreError(e: any): string {
  const msg = String(e?.message ?? "Erro");
  if (msg.toLowerCase().includes("unauth")) return "Faça login novamente.";
  return msg;
}

function getValorBadge(valor: number) {
  if (valor >= 150) return "Premium";
  if (valor >= 100) return "Popular";
  return "Bom preço";
}

/* =======================
   STYLES
======================= */

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #0f172a 0%, #111827 180px, #f8fafc 180px, #f8fafc 100%)",
  } as CSSProperties,

  container: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "12px 12px 96px",
    boxSizing: "border-box",
  } as CSSProperties,

  topLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#e5e7eb",
    textDecoration: "none",
    fontWeight: 600,
    marginBottom: 14,
  } as CSSProperties,

  heroCard: {
    background: "#ffffff",
    borderRadius: 22,
    overflow: "hidden",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
    border: "1px solid rgba(255,255,255,0.08)",
  } as CSSProperties,

  coverWrap: {
    position: "relative",
    width: "100%",
    height: 340,
    background: "linear-gradient(135deg, #0f766e, #1d4ed8)",
  } as CSSProperties,

  coverImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  } as CSSProperties,

  heroFloatingInfo: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    flexWrap: "wrap",
    zIndex: 2,
  } as CSSProperties,

  heroTitleWrap: {
    display: "grid",
    gap: 8,
  } as CSSProperties,

  heroTitleOnImage: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.05,
    color: "#fff",
    fontWeight: 700,
    letterSpacing: -0.3,
    textShadow: "0 4px 12px rgba(15,23,42,0.25)",
  } as CSSProperties,

  heroSubOnImage: {
    margin: 0,
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    opacity: 0.85,
    fontWeight: 600,
    textShadow: "0 6px 18px rgba(15,23,42,0.35)",
  } as CSSProperties,

  heroMiniStats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  } as CSSProperties,

  heroMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 500,
    boxShadow: "0 4px 10px rgba(15,23,42,0.12)",
  } as CSSProperties,

  coverOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to top, rgba(15,23,42,0.75), rgba(15,23,42,0.18))",
  } as CSSProperties,

  galleryNavLeft: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(15,23,42,0.55)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSProperties,

  galleryNavRight: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(15,23,42,0.55)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSProperties,

  galleryDots: {
    position: "absolute",
    left: "50%",
    bottom: 12,
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
    zIndex: 4,
  } as CSSProperties,

  galleryDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.55)",
    cursor: "pointer",
    padding: 0,
  } as CSSProperties,

  galleryDotActive: {
    background: "#ffffff",
    transform: "scale(1.2)",
  } as CSSProperties,

  heroContent: {
    padding: 22,
  } as CSSProperties,

badgeRow: {
  position: "absolute",
  top: 14,
  left: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  zIndex: 3,
} as CSSProperties,

  pillDark: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#0f172a",
    color: "#fff",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 600,
  } as CSSProperties,

  pillSoft: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#ecfeff",
    color: "#155e75",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 500,
    border: "1px solid #bae6fd",
  } as CSSProperties,

  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.1,
    color: "#0f172a",
  } as CSSProperties,

  subtitle: {
    marginTop: 8,
    marginBottom: 0,
    color: "#475569",
    fontSize: 15,
  } as CSSProperties,

  gridMain: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.9fr",
    gap: 18,
    marginTop: 18,
  } as CSSProperties,

  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e5e7eb",
  } as CSSProperties,

  sectionTitle: {
    margin: 0,
    fontSize: 21,
    color: "#0f172a",
  } as CSSProperties,

  sectionText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 0,
  } as CSSProperties,

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginTop: 16,
  } as CSSProperties,

  infoBox: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
  } as CSSProperties,

  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 700,
  } as CSSProperties,

  infoValue: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: 800,
  } as CSSProperties,

  chipsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  } as CSSProperties,

  chip: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 600,
    fontSize: 13,
  } as CSSProperties,

  alertDanger: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #fecaca",
    background: "linear-gradient(180deg, #fff5f5, #fef2f2)",
    color: "#7f1d1d",
    whiteSpace: "pre-line",
  } as CSSProperties,

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 16,
  } as CSSProperties,

  field: {
    display: "grid",
    gap: 6,
  } as CSSProperties,

  label: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 700,
  } as CSSProperties,

  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#fff",
    minHeight: 48,
    padding: "0 14px",
    outline: "none",
    fontSize: 15,
    color: "#0f172a",
    boxSizing: "border-box",
  } as CSSProperties,

  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#fff",
    minHeight: 110,
    padding: "12px 14px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
    boxSizing: "border-box",
    resize: "vertical",
  } as CSSProperties,

  radioWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  } as CSSProperties,

  radioCard: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontWeight: 600,
    color: "#0f172a",
  } as CSSProperties,

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(16, 185, 129, 0.22)",
  } as CSSProperties,

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  } as CSSProperties,

  dangerText: {
    color: "#dc2626",
    whiteSpace: "pre-line",
    fontWeight: 600,
    marginTop: 12,
    marginBottom: 0,
  } as CSSProperties,

  helperText: {
    color: "#64748b",
    marginTop: 10,
    marginBottom: 0,
    fontSize: 14,
  } as CSSProperties,

  toast: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, #ecfdf5, #d1fae5)",
    border: "1px solid #86efac",
    color: "#065f46",
    fontWeight: 800,
    fontSize: 16,
    whiteSpace: "pre-line",
    boxShadow: "0 10px 28px rgba(16, 185, 129, 0.12)",
  } as CSSProperties,

  slotsList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  } as CSSProperties,

  slotCard: {
    border: "1px solid #e2e8f0",
    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  } as CSSProperties,

  slotTime: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  } as CSSProperties,

  slotMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
  } as CSSProperties,

  subtleBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    fontSize: 13,
    border: "1px solid #e2e8f0",
  } as CSSProperties,

  divider: {
    margin: "18px 0",
    border: "none",
    borderTop: "1px solid #e5e7eb",
  } as CSSProperties,

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.6)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 9999,
  } as CSSProperties,

  modalCard: {
    width: "100%",
    maxWidth: 540,
    background: "#fff",
    borderRadius: 22,
    padding: 20,
    border: "1px solid #e5e7eb",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  } as CSSProperties,

  modalActions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
    flexWrap: "wrap",
  } as CSSProperties,

  rightSticky: {
    display: "grid",
    gap: 18,
    alignSelf: "start",
    position: "sticky",
    top: 16,
  } as CSSProperties,

  slotLeft: {
    display: "grid",
    gap: 6,
  } as CSSProperties,

  slotRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as CSSProperties,

  slotPriceBig: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  } as CSSProperties,

  slotBadgeStrong: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#ecfdf5",
    color: "#065f46",
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid #86efac",
  } as CSSProperties,

  emailPopup: {
    position: "fixed",
    top: 76,
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 32px)",
    maxWidth: 420,
    padding: "12px 14px",
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.4,
    zIndex: 3000,
    boxShadow: "0 14px 30px rgba(15,23,42,0.18)",
    textAlign: "center",
  } as CSSProperties,
};

/* =======================
   COMPONENTE
======================= */

export default function Quadra() {
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [quadra, setQuadra] = useState<QuadraDoc | null>(null);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [mpStatus, setMpStatus] = useState<MpConnectionStatus>("not_connected");
  const [erro, setErro] = useState<string | null>(null);

  const [dataReserva, setDataReserva] = useState(hojeISO());
  const [esporte, setEsporte] = useState("");
  const [slots, setSlots] = useState<SlotDisponibilidade[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [pagamentoTipo, setPagamentoTipo] = useState<"presencial" | "pix">("presencial");
  const [criandoPix, setCriandoPix] = useState(false);

  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");

  const [reservandoId, setReservandoId] = useState("");
  const [msg, setMsg] = useState("");
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [erroReserva, setErroReserva] = useState("");
  const [emailWarning, setEmailWarning] = useState(false);

  const [resumo, setResumo] = useState<{ total: number; media: number }>({
    total: 0,
    media: 0,
  });
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [reservaElegivel, setReservaElegivel] = useState<ReservaDoc | null>(null);
  const [jaAvaliouEssaReserva, setJaAvaliouEssaReserva] = useState(false);

  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [msgAvaliacao, setMsgAvaliacao] = useState<string>("");
  const [erroAvaliacao, setErroAvaliacao] = useState<string>("");

  const [cpfModalOpen, setCpfModalOpen] = useState(false);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfConsent, setCpfConsent] = useState(false);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfErro, setCpfErro] = useState<string>("");

  const [slotPendente, setSlotPendente] = useState<SlotDisponibilidade | null>(null);

  const [confirmData, setConfirmData] = useState<{
  mensagem: string;
  onConfirm: () => Promise<void>;
} | null>(null);

const [toastInfo, setToastInfo] = useState<{
  type: "success" | "error";
  message: string;
} | null>(null);

  const [bloqueioInfo, setBloqueioInfo] = useState<{
    suspenso: boolean;
    ateMs: number | null;
    motivo: string | null;
    multaCentavos: number;
    texto: string | null;
  }>({
    suspenso: false,
    ateMs: null,
    motivo: null,
    multaCentavos: 0,
    texto: null,
  });

  const suspensoInfo = bloqueioInfo;
  const toastTimerRef = useRef<any>(null);

  async function reenviarEmailVerificacao() {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    try {
      await sendEmailVerification(currentUser);
      showToast("✉️ Email de verificação reenviado.", TOAST_MS);
    } catch (e) {
      console.error(e);
      setErroReserva("Não consegui reenviar o email agora.");
    }
  }

  async function validarEmailAgora() {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return false;

    try {
      await currentUser.reload();
      return currentUser.emailVerified;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function showToast(message: string, ms: number = TOAST_MS) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setMsg(message);
    setMostrarSucesso(true);

    toastTimerRef.current = setTimeout(() => {
      setMostrarSucesso(false);
      setMsg("");
    }, ms);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mpStatus !== "connected" && pagamentoTipo === "pix") {
      setPagamentoTipo("presencial");
    }
  }, [mpStatus, pagamentoTipo]);

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
          setFotoIndex(0);

          if (q.ownerId) {
            const ownerRef = doc(db, "users", q.ownerId);
            const ownerSnap = await getDoc(ownerRef);

            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data() as any;
              const status = ownerData?.mpConnectionStatus;

              if (
                status === "not_connected" ||
                status === "pending" ||
                status === "connected" ||
                status === "error"
              ) {
                setMpStatus(status);
              } else {
                setMpStatus("not_connected");
              }
            } else {
              setMpStatus("not_connected");
            }
          } else {
            setMpStatus("not_connected");
          }

          setEsporte(q.esportes?.[0] ?? "");
        }

        if (user?.uid) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const u = userSnap.data() as any;

            const nomeCompleto = [u?.nome, u?.sobrenome]
              .filter(Boolean)
              .map((x) => String(x).trim())
              .join(" ")
              .trim();

            const telefoneCadastro =
              String(u?.telefone ?? u?.telefoneNormalizado ?? "").trim();

            setNomeCliente(nomeCompleto);
            setTelefoneCliente(telefoneCadastro);
          }
        }
      } catch (e) {
        console.error("ERRO AO CARREGAR QUADRA:", e);
        setErro("Erro ao carregar quadra");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [id, user?.uid]);

  /* =======================
     BLOQUEIO USER
  ======================= */

  useEffect(() => {
    if (!user?.uid) {
      setBloqueioInfo({
        suspenso: false,
        ateMs: null,
        motivo: null,
        multaCentavos: 0,
        texto: null,
      });
      return;
    }

    const userRef = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const u: any = snap.exists() ? snap.data() : null;

        const multaCentavos = Number(u?.multaPendenteCentavos ?? 0) || 0;
        const suspensoAte = u?.suspensoAte ?? null;
        const motivo = u?.suspensoMotivo ? String(u.suspensoMotivo) : null;

        let suspenso = false;
        let ateMs: number | null = null;
        let texto: string | null = null;

        if (suspensoAte && typeof suspensoAte?.toMillis === "function") {
          ateMs = suspensoAte.toMillis();
          if (ateMs && ateMs > Date.now()) {
            suspenso = true;
            texto = `Sua conta está suspensa até ${formatDateTimeBR(new Date(ateMs))}${
              motivo ? `.\nMotivo: ${motivo}` : "."
            }`;
          }
        }

        if (!suspenso && multaCentavos > 0) {
          texto = `Você possui multa pendente de ${formatBRL(multaCentavos / 100)}. Quite antes de reservar.`;
        }

        setBloqueioInfo({
          suspenso,
          ateMs,
          motivo,
          multaCentavos,
          texto,
        });
      },
      () => {
        setBloqueioInfo({
          suspenso: false,
          ateMs: null,
          motivo: null,
          multaCentavos: 0,
          texto: null,
        });
      }
    );

    return () => unsub();
  }, [user?.uid]);

  /* =======================
     RESUMO AVALIAÇÕES
  ======================= */

  useEffect(() => {
    async function carregarResumo() {
      if (!id) return;
      try {
        setLoadingResumo(true);
        const r = await buscarResumoAvaliacoesDaQuadra(id);
        setResumo({
          total: Number((r as any).total ?? 0),
          media: Number((r as any).media ?? 0),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingResumo(false);
      }
    }
    carregarResumo();
  }, [id]);

  /* =======================
     BUSCAR SLOTS
  ======================= */

  async function recarregarSlotsAtual() {
    if (!id || !dataReserva || !esporte) return;

    setLoadingSlots(true);
    setErroReserva("");
    setMsg("");
    setMostrarSucesso(false);

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

  useEffect(() => {
    recarregarSlotsAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dataReserva, esporte]);

  /* =======================
     ELEGIBILIDADE AVALIAR
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
        const col = collection(db, "reservas");
        const q = query(
          col,
          where("quadraId", "==", id),
          where("clienteUid", "==", user.uid)
        );
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
            naoCompareceu: Boolean(x.naoCompareceu),
            avaliadaEm: x.avaliadaEm ?? null,
          };
        });

        const elegiveis = lista
          .filter((r) => r.status === "finalizada")
          .filter((r) => r.naoCompareceu !== true)
          .filter((r) => !r.avaliadaEm);

        elegiveis.sort((a, b) =>
          `${b.data} ${b.horaFim}`.localeCompare(`${a.data} ${a.horaFim}`)
        );

        const escolhida = elegiveis[0] ?? null;
        if (!escolhida) return;

        setReservaElegivel(escolhida);
        setJaAvaliouEssaReserva(!!escolhida.avaliadaEm);

        try {
          const colAv = collection(db, "avaliacoes");
          const qAv = query(
            colAv,
            where("reservaId", "==", escolhida.id),
            where("clienteUid", "==", user.uid),
            limit(1)
          );
          const snapAv = await getDocs(qAv);
          if (!snapAv.empty) setJaAvaliouEssaReserva(true);
        } catch {
          // ignora
        }
      } catch (e: any) {
        console.error(e);
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
    setPagamentoTipo("presencial");
    setErroReserva("");
    setCriandoPix(false);

    setCpfModalOpen(false);
    setCpfInput("");
    setCpfConsent(false);
    setCpfErro("");
    setSlotPendente(null);

    setMostrarSucesso(false);
  }

  function abrirModalCpf(slot: SlotDisponibilidade) {
    setCpfErro("");
    setCpfInput("");
    setCpfConsent(false);
    setSlotPendente(slot);
    setCpfModalOpen(true);
  }

  async function confirmarCpfEContinuar() {
    setCpfErro("");
    if (!user?.uid) {
      setCpfErro("Você precisa estar logado.");
      return;
    }

    const cpfDigits = onlyDigits(cpfInput);
    if (!cpfDigits || cpfDigits.length !== 11) {
      setCpfErro("Informe um CPF válido (11 dígitos).");
      return;
    }
    if (!cpfConsent) {
      setCpfErro("Você precisa autorizar o uso do CPF para continuar.");
      return;
    }

    try {
      setCpfLoading(true);
      await verifyAndBindCpf({ cpf: cpfDigits, consent: true });

      setCpfModalOpen(false);
      setCpfInput("");
      setCpfConsent(false);
      setCpfErro("");

      const s = slotPendente;
      setSlotPendente(null);

      if (s) {
        await reservar(s);
      }
    } catch (e: any) {
      console.error(e);
      setCpfErro(humanizeFirestoreError(e));
    } finally {
      setCpfLoading(false);
    }
  }

  async function reservar(slot: SlotDisponibilidade) {
    setErroReserva("");
    setMsg("");
    setMostrarSucesso(false);

    const currentUser = getAuth().currentUser;

    if (!currentUser?.uid) {
      setErroReserva("Você precisa estar logado para reservar.");
      return;
    }

    if (!currentUser.emailVerified) {
      const okEmail = await validarEmailAgora();
      if (!okEmail) {
        setEmailWarning(true);

        setTimeout(() => {
          setEmailWarning(false);
        }, 5000);

        return;
      }
    }

    if (suspensoInfo.suspenso) {
      setErroReserva(suspensoInfo.texto ?? "Sua conta está suspensa no momento.");
      return;
    }

    if (pagamentoTipo === "pix" && !pixLiberado) {
      setErroReserva(
        "O pagamento via PIX não está disponível nesta quadra no momento. Escolha pagamento presencial."
      );
      return;
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const u: any = userSnap.exists() ? userSnap.data() : null;

      if (!u?.cpfHash) {
        abrirModalCpf(slot);
        return;
      }
    } catch {
      abrirModalCpf(slot);
      return;
    }

    if (!nomeCliente.trim()) {
      setErroReserva("Não encontramos seu nome no cadastro. Atualize seu perfil.");
      return;
    }

    const telDigits = onlyDigits(telefoneCliente);

    if (!telDigits || !(telDigits.length === 10 || telDigits.length === 11)) {
      setErroReserva("Não encontramos um telefone válido no seu cadastro.");
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

setConfirmData({
  mensagem:
    `Confirmar reserva?\n\n` +
    `Data: ${dataReserva}\n` +
    `Horário: ${slot.horaInicio}–${slot.horaFim}\n` +
    `Esporte: ${ESPORTES_LABELS[slot.esporte] ?? slot.esporte}\n` +
    `Valor: ${formatBRL(slot.valor)}\n` +
    `Pagamento: ${pagamentoTipo === "pix" ? "via PIX" : "presencial na quadra"}`,
  onConfirm: async () => {
    try {
      setReservandoId(slot.id);

      if (pagamentoTipo === "pix") {
        setCriandoPix(true);

        const functions = getFunctions(app, "us-central1");
        const reserveAndCreatePix = httpsCallable(functions, "reserveAndCreatePix");

        const resp: any = await withTimeout(
          reserveAndCreatePix({
            disponibilidadeId: slot.id,
            nomeCliente: nomeCliente.trim(),
            telefoneCliente: telefoneCliente.trim(),
          }),
          RESERVA_TIMEOUT_MS,
          "A reserva demorou demais para responder (rede). Tente novamente."
        );

        const data = (resp?.data ?? {}) as any;
        const reservaId = String(data?.reservaId ?? "");

        if (!reservaId) {
          throw new Error("Falha interna: reserveAndCreatePix não retornou reservaId.");
        }

        setConfirmData(null);

        navigate(
          `/pagamento/pix?reservaId=${encodeURIComponent(reservaId)}&quadraId=${encodeURIComponent(
            id ?? ""
          )}`
        );
        return;
      }

      await withTimeout(
        reservarHorario({
          disponibilidadeId: slot.id,
          nomeCliente: nomeCliente.trim(),
          telefoneCliente: telefoneCliente.trim(),
          pagamentoTipo: "presencial",
        } as any),
        RESERVA_TIMEOUT_MS,
        "A reserva demorou demais para responder (rede). Tente novamente."
      );

      setConfirmData(null);
      showToast("✅ Horário reservado com sucesso!", TOAST_MS);
      setSlots((s) => s.filter((x) => x.id !== slot.id));
    } catch (e: any) {
      console.error(e);
      setErroReserva(humanizeFirestoreError(e));
    } finally {
      setCriandoPix(false);
      setReservandoId("");
    }
  },
});

return;
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

      try {
        const r = await buscarResumoAvaliacoesDaQuadra(id);
        setResumo({
          total: Number((r as any).total ?? 0),
          media: Number((r as any).media ?? 0),
        });
      } catch {
        // ignora
      }
    } catch (e: any) {
      console.error(e);
      setErroAvaliacao(humanizeFirestoreError(e));
    } finally {
      setEnviandoAvaliacao(false);
    }
  }

  /* =======================
     RENDER
  ======================= */

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={{ margin: 0, color: "#475569", fontWeight: 700 }}>Carregando quadra...</p>
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={{ margin: 0, color: "#dc2626", fontWeight: 800 }}>{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!quadra) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={{ margin: 0, color: "#0f172a", fontWeight: 800 }}>Quadra não encontrada</p>
          </div>
        </div>
      </div>
    );
  }

  const comodidades = chipsComodidades(quadra.comodidades);
  const mediaStr = resumo.total > 0 ? resumo.media.toFixed(1) : "—";
  const bloqueadoPorMulta = (bloqueioInfo.multaCentavos ?? 0) > 0;
  const quadraInativa = quadra.ativo === false;
  const pixLiberado = mpStatus === "connected";
  const desabilitarReservas = Boolean(
    reservandoId ||
      criandoPix ||
      loadingSlots ||
      bloqueioInfo.suspenso ||
      bloqueadoPorMulta ||
      quadraInativa
  );

  const esportesLista = (quadra.esportes ?? []).map((e) => ESPORTES_LABELS[e] ?? e).join(" • ");
  const precoDestaque =
    typeof quadra.valorHora === "number" && quadra.valorHora > 0
      ? formatBRL(quadra.valorHora)
      : esporte && quadra.valoresPorEsporte?.[esporte]
      ? formatBRL(Number(quadra.valoresPorEsporte[esporte]))
      : null;

  const fotos =
    Array.isArray(quadra.fotos) && quadra.fotos.length > 0
      ? quadra.fotos.filter(Boolean)
      : quadra.fotoCapaUrl
      ? [quadra.fotoCapaUrl]
      : [];

  return (
    <div style={styles.page}>
      {emailWarning && (
        <div style={styles.emailPopup}>
          ⚠️ Verifique seu email para liberar reservas e pagamentos.
        </div>
      )}

      <div style={styles.container}>
        <Link to="/home" style={styles.topLink}>
          ← Voltar
        </Link>

        <div style={styles.heroCard}>
          <div style={styles.coverWrap}>
            {fotos.length > 0 ? (
              <img
                src={fotos[fotoIndex] ?? fotos[0]}
                alt={quadra.nome}
                style={styles.coverImg}
              />
            ) : null}

            <div style={styles.coverOverlay} />
            <div style={styles.badgeRow}>
                    <span style={styles.pillDark}>Quadra Play</span>
                    <span style={styles.pillSoft}>{quadra.cidade}</span>
                  </div>

            {fotos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setFotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1))
                  }
                  style={styles.galleryNavLeft}
                  aria-label="Foto anterior"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFotoIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1))
                  }
                  style={styles.galleryNavRight}
                  aria-label="Próxima foto"
                >
                  ›
                </button>
              </>
            ) : null}

            {fotoIndex === 0 && (
              <div style={styles.heroFloatingInfo}>
                <div style={styles.heroTitleWrap}>
                  

                  <h1 style={styles.heroTitleOnImage}>{quadra.nome}</h1>

                  <p style={styles.heroSubOnImage}>
                    {quadra.endereco?.trim()
                      ? `${quadra.endereco}`
                      : `Localizada em ${quadra.cidade}`}
                  </p>
                </div>

                <div style={styles.heroMiniStats}>
                  {precoDestaque ? (
                    <span style={styles.heroMiniPill}>💸 {precoDestaque}</span>
                  ) : null}

                  <span style={styles.heroMiniPill}>
                    ⭐ {loadingResumo ? "..." : mediaStr}
                  </span>

                  <span style={styles.heroMiniPill}>
                    🏟️ {(quadra.esportes ?? []).length} esporte(s)
                  </span>
                </div>
              </div>
            )}

            {fotos.length > 1 ? (
              <div style={styles.galleryDots}>
                {fotos.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setFotoIndex(index)}
                    style={{
                      ...styles.galleryDot,
                      ...(fotoIndex === index ? styles.galleryDotActive : {}),
                    }}
                    aria-label={`Ir para foto ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div style={styles.heroContent}>
            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span style={styles.infoLabel}>Avaliação</span>
                <div style={styles.infoValue}>
                  {loadingResumo ? "..." : mediaStr}
                </div>
                <div style={{ marginTop: 6, color: "#475569", fontWeight: 700 }}>
                  {loadingResumo
                    ? "Carregando avaliações..."
                    : resumo.total > 0
                    ? `${stars(resumo.media)} • ${resumo.total} avaliações`
                    : "Sem avaliações ainda"}
                </div>
              </div>

              <div style={styles.infoBox}>
                <span style={styles.infoLabel}>Esportes</span>
                <div style={{ ...styles.infoValue, fontSize: 16 }}>{esportesLista || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <span style={styles.infoLabel}>Status</span>
                <div
                  style={{
                    ...styles.infoValue,
                    color: quadra.ativo === false ? "#dc2626" : "#059669",
                  }}
                >
                  {quadra.ativo === false ? "Inativa" : "Disponível"}
                </div>
              </div>
            </div>

            {quadra.observacoes?.trim() ? (
              <div style={{ marginTop: 16 }}>
                <span style={styles.infoLabel}>Observações</span>
                <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.6 }}>
                  {quadra.observacoes}
                </p>
              </div>
            ) : null}

            <div style={styles.chipsWrap}>
              {(comodidades.length ? comodidades : ["Nenhuma comodidade cadastrada"]).map((item) => (
                <span key={item} style={styles.chip}>
                  {item}
                </span>
              ))}
            </div>

            {user?.uid && (bloqueioInfo.suspenso || bloqueadoPorMulta) ? (
              <div style={styles.alertDanger}>
                <strong style={{ display: "block", marginBottom: 6 }}>Reservas bloqueadas</strong>
                <div>
                  {bloqueioInfo.texto ??
                    "Sua conta está temporariamente bloqueada para novas reservas."}
                </div>

                {bloqueadoPorMulta ? (
                  <div style={{ marginTop: 12 }}>
                    <Link to="/minhas-reservas" style={{ textDecoration: "none" }}>
                      <button type="button" style={styles.primaryBtn}>
                        Pagar multa via PIX
                      </button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            ...styles.gridMain,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Reservar horário</h2>
            <p style={styles.sectionText}>
              Escolha a data, o esporte e a forma de pagamento para reservar sua quadra.
            </p>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Data</span>
                <input
                  type="date"
                  value={dataReserva}
                  onChange={(e) => {
                    setDataReserva(e.target.value);
                    setErroReserva("");
                  }}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Esporte</span>
                <select
                  value={esporte}
                  onChange={(e) => setEsporte(e.target.value)}
                  disabled={suspensoInfo.suspenso}
                  style={styles.input}
                >
                  {(quadra.esportes ?? []).map((e) => (
                    <option key={e} value={e}>
                      {ESPORTES_LABELS[e] ?? e}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 14 }}>
              <span style={styles.label}>Forma de pagamento</span>
              <div style={styles.radioWrap}>
                <label style={styles.radioCard}>
                  <input
                    type="radio"
                    value="presencial"
                    checked={pagamentoTipo === "presencial"}
                    onChange={() => {
                      setPagamentoTipo("presencial");
                    }}
                    disabled={suspensoInfo.suspenso}
                  />
                  Pagar na quadra
                </label>

                <label style={styles.radioCard}>
                  <input
                    type="radio"
                    value="pix"
                    checked={pagamentoTipo === "pix"}
                    onChange={() => {
                      if (pixLiberado) {
                        setPagamentoTipo("pix");
                      }
                    }}
                    disabled={suspensoInfo.suspenso || !pixLiberado}
                  />
                  {pixLiberado ? "Pagar via PIX" : "PIX indisponível"}
                </label>

                {!pixLiberado && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#7f1d1d",
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}
                  >
                    Pagamento via PIX indisponível no momento para esta quadra.
                    Utilize pagamento presencial.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button
                onClick={limparReserva}
                disabled={suspensoInfo.suspenso}
                style={styles.secondaryBtn}
              >
                Limpar seleção
              </button>
            </div>

            {pagamentoTipo === "pix" ? (
              <p style={styles.helperText}>
                Seus dados de cadastro serão usados automaticamente. Ao confirmar,
                você será redirecionado para uma tela exclusiva de pagamento PIX.
              </p>
            ) : (
              <p style={styles.helperText}>
                Seus dados de cadastro serão usados automaticamente. Ao escolher pagamento
                presencial, o pagamento será feito diretamente na quadra.
              </p>
            )}

            {erroReserva ? <p style={styles.dangerText}>{erroReserva}</p> : null}

            {mostrarSucesso && msg ? (
              <div style={styles.toast}>
                {msg}

                {msg.includes("Horário reservado com sucesso") ? (
                  <div style={{ marginTop: 12 }}>
                    <Link to="/minhas-reservas" style={{ textDecoration: "none" }}>
                      <button type="button" style={styles.primaryBtn}>
                        Ver minhas reservas
                      </button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            {criandoPix ? (
              <p style={styles.helperText}>Gerando sua tela de pagamento PIX...</p>
            ) : null}

            <hr style={styles.divider} />

            <h3 style={{ margin: 0, color: "#0f172a" }}>Horários disponíveis</h3>
            <p style={styles.sectionText}>
              Escolha o melhor horário para o seu jogo.
            </p>

            {loadingSlots ? (
              <p style={styles.helperText}>Carregando horários...</p>
            ) : slots.length === 0 ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 18,
                  borderRadius: 16,
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                Nenhum horário disponível.
              </div>
            ) : (
              <div style={styles.slotsList}>
                {slots.map((s) => (
                  <div key={s.id} style={styles.slotCard}>
                    <div style={styles.slotLeft}>
                      <p style={styles.slotTime}>
                        {s.horaInicio} – {s.horaFim}
                      </p>

                      <div style={styles.slotMeta}>
                        <span style={styles.slotBadgeStrong}>
                          {ESPORTES_LABELS[s.esporte] ?? s.esporte}
                        </span>

                        <span style={styles.subtleBadge}>{getValorBadge(s.valor)}</span>
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        {s.promocaoAtiva && s.valorPromocional != null ? (
                          <>
                            <div
                              style={{
                                fontSize: 14,
                                color: "#94a3b8",
                                textDecoration: "line-through",
                                fontWeight: 700,
                              }}
                            >
                              De: {formatBRL(Number(s.valorOriginal ?? s.valor ?? 0))}
                            </div>

                            <div
                              style={{
                                ...styles.slotPriceBig,
                                color: "#16a34a",
                              }}
                            >
                              Por: {formatBRL(Number(s.valorPromocional))}
                            </div>

                            <div
                              style={{
                                display: "inline-flex",
                                width: "fit-content",
                                borderRadius: 999,
                                padding: "6px 10px",
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
                          <div style={styles.slotPriceBig}>{formatBRL(Number(s.valor ?? 0))}</div>
                        )}
                      </div>
                    </div>

                    <div style={styles.slotRight}>
                      <button
                        onClick={() => reservar(s)}
                        disabled={reservandoId === s.id || desabilitarReservas}
                        style={{
                          ...styles.primaryBtn,
                          minWidth: 150,
                          height: 48,
                          fontSize: 15,
                          opacity: reservandoId === s.id || desabilitarReservas ? 0.7 : 1,
                          cursor:
                            reservandoId === s.id || desabilitarReservas
                              ? "not-allowed"
                              : "pointer",
                          background:
                            quadraInativa || bloqueioInfo.suspenso || bloqueadoPorMulta
                              ? "linear-gradient(135deg, #94a3b8, #64748b)"
                              : "linear-gradient(135deg, #10b981, #059669)",
                          boxShadow:
                            quadraInativa || bloqueioInfo.suspenso || bloqueadoPorMulta
                              ? "none"
                              : "0 12px 24px rgba(16, 185, 129, 0.28)",
                        }}
                        title={
                          quadraInativa
                            ? "Esta quadra está inativa no momento"
                            : bloqueioInfo.suspenso
                            ? "Conta suspensa: reservas bloqueadas"
                            : bloqueadoPorMulta
                            ? "Multa pendente: pague para liberar reservas"
                            : undefined
                        }
                      >
                        {reservandoId === s.id
                          ? "Reservando..."
                          : quadraInativa
                          ? "Indisponível"
                          : bloqueioInfo.suspenso || bloqueadoPorMulta
                          ? "Bloqueado"
                          : "Reservar agora"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.rightSticky}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Avaliações</h2>
              <p style={styles.sectionText}>
                Quem jogou aqui pode avaliar depois da reserva finalizada.
              </p>

              <div style={{ ...styles.infoBox, marginTop: 14 }}>
                <span style={styles.infoLabel}>Média atual</span>
                <div style={{ ...styles.infoValue, fontSize: 26 }}>
                  {loadingResumo ? "..." : mediaStr}
                </div>
                <div style={{ marginTop: 6, color: "#475569", fontWeight: 700 }}>
                  {loadingResumo
                    ? "Carregando..."
                    : resumo.total > 0
                    ? `${stars(resumo.media)} • ${resumo.total} avaliações`
                    : "Sem avaliações ainda"}
                </div>
              </div>

              {user?.uid ? (
                !reservaElegivel ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 16,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      lineHeight: 1.6,
                    }}
                  >
                    Você poderá avaliar após a reserva ser <strong>finalizada</strong>.
                    <br />
                    Se o dono marcar <strong>não compareceu</strong>, a avaliação não fica
                    disponível.
                  </div>
                ) : jaAvaliouEssaReserva ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 16,
                      background: "#ecfdf5",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                      fontWeight: 700,
                    }}
                  >
                    Você já avaliou seu último jogo nesta quadra ✅
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        marginTop: 14,
                        padding: 14,
                        borderRadius: 16,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        color: "#334155",
                      }}
                    >
                      Jogo apto: <strong>{reservaElegivel.data}</strong> •{" "}
                      {reservaElegivel.horaInicio}–{reservaElegivel.horaFim}
                    </div>

                    <div style={{ ...styles.field, marginTop: 14 }}>
                      <span style={styles.label}>Nota</span>
                      <select
                        value={nota}
                        onChange={(e) => setNota(Number(e.target.value))}
                        style={styles.input}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} ⭐
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ ...styles.field, marginTop: 12 }}>
                      <span style={styles.label}>Comentário</span>
                      <textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Ex: quadra bem iluminada, atendimento ótimo..."
                        style={styles.textarea}
                      />
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={enviarAvaliacao}
                        disabled={enviandoAvaliacao}
                        style={styles.primaryBtn}
                      >
                        {enviandoAvaliacao ? "Enviando..." : "Enviar avaliação"}
                      </button>
                    </div>

                    {erroAvaliacao ? (
                      <p style={styles.dangerText}>{erroAvaliacao}</p>
                    ) : null}

                    {msgAvaliacao && !erroAvaliacao ? (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 14,
                          borderRadius: 14,
                          background: "#ecfdf5",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          fontWeight: 700,
                        }}
                      >
                        {msgAvaliacao}
                      </div>
                    ) : null}
                  </>
                )
              ) : (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 16,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                  }}
                >
                  Faça login para reservar e avaliar.
                </div>
              )}
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Comodidades</h2>
              <p style={styles.sectionText}>
                O que essa quadra oferece para a experiência do jogo.
              </p>

              <div style={styles.chipsWrap}>
                {(comodidades.length ? comodidades : ["Nenhuma"]).map((item) => (
                  <span key={item} style={styles.chip}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {cpfModalOpen ? (
          <div style={styles.modalBackdrop}>
            <div style={styles.modalCard}>
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 24, color: "#0f172a" }}>
                Validação de identidade
              </h3>

              <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.6 }}>
                Para reservar no Quadra Play, precisamos validar seu CPF para prevenção de fraude e
                garantia de conta única.
              </p>

              <label style={{ ...styles.field, marginTop: 14 }}>
                <span style={styles.label}>CPF</span>
                <input
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value)}
                  placeholder="Somente números"
                  style={styles.input}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginTop: 14,
                  color: "#334155",
                  lineHeight: 1.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={cpfConsent}
                  onChange={(e) => setCpfConsent(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  Autorizo o uso do meu CPF para validação de identidade e prevenção de fraude.
                </span>
              </label>

              {cpfErro ? <p style={styles.dangerText}>{cpfErro}</p> : null}

              <div style={styles.modalActions}>
                <button
                  onClick={() => {
                    setCpfModalOpen(false);
                    setSlotPendente(null);
                  }}
                  disabled={cpfLoading}
                  style={styles.secondaryBtn}
                >
                  Cancelar
                </button>

                <button
                  onClick={confirmarCpfEContinuar}
                  disabled={cpfLoading}
                  style={styles.primaryBtn}
                >
                  {cpfLoading ? "Validando..." : "Confirmar CPF"}
                </button>
              </div>

              <p style={{ marginTop: 14, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Nós armazenamos apenas um identificador seguro do CPF (hash). O número completo não
                fica visível no app.
              </p>
            </div>
          </div>
        ) : null}
        <ConfirmModal
  open={!!confirmData}
  title="Confirmar reserva"
  message={confirmData?.mensagem ?? ""}
  confirmText={criandoPix || !!reservandoId ? "Processando..." : "Confirmar reserva"}
  cancelText="Cancelar"
  loading={criandoPix || !!reservandoId}
  onCancel={() => {
    if (criandoPix || reservandoId) return;
    setConfirmData(null);
  }}
  onConfirm={async () => {
    if (!confirmData) return;
    await confirmData.onConfirm();
  }}
/>
      </div>
    </div>
  );
}