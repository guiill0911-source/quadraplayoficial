import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Header from "../../components/Header";
import { db, storage } from "../../services/firebase";
import { useAuth } from "../../services/authContext";

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

type Quadra = {
  id: string;
  ownerId: string;
  nome?: string;
  cidade?: string;
  endereco?: string;
  numero?: string;
  observacoes?: string;
  fotoCapaUrl?: string | null;
  fotoCapaPath?: string | null;
  ativo?: boolean;
  comodidades?: Comodidades;
  esportes?: string[];
  valoresPorEsporte?: Record<string, number>;
  funcionamento?: any;
};

type FormState = {
  nome: string;
  cidade: string;
  endereco: string;
  numero: string;
  observacoes: string;
  ativo: boolean;
};

type DiaKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
const DIAS: { key: DiaKey; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type DiaUI = {
  fechado: boolean;
  abre: string;
  fecha: string;
};

type FuncUI = {
  mesmoHorarioTodosOsDias: boolean;
  padrao: { abre: string; fecha: string };
  dias: Record<DiaKey, DiaUI>;
};

function defaultFuncUI(): FuncUI {
  const dia: DiaUI = { fechado: false, abre: "08:00", fecha: "22:00" };
  return {
    mesmoHorarioTodosOsDias: true,
    padrao: { abre: "08:00", fecha: "22:00" },
    dias: {
      seg: { ...dia },
      ter: { ...dia },
      qua: { ...dia },
      qui: { ...dia },
      sex: { ...dia },
      sab: { ...dia },
      dom: { ...dia },
    },
  };
}

function toFuncUI(raw: any): FuncUI {
  const ui = defaultFuncUI();
  if (!raw || typeof raw !== "object") return ui;

  if (raw.padrao && typeof raw.padrao === "object") {
    if (typeof raw.padrao.abre === "string") ui.padrao.abre = raw.padrao.abre;
    if (typeof raw.padrao.fecha === "string") ui.padrao.fecha = raw.padrao.fecha;
  }

  if (typeof raw.mesmoHorarioTodosOsDias === "boolean") {
    ui.mesmoHorarioTodosOsDias = raw.mesmoHorarioTodosOsDias;
  }

  for (const d of DIAS) {
    const v = raw[d.key];
    if (v && typeof v === "object") {
      if (typeof v.fechado === "boolean") ui.dias[d.key].fechado = v.fechado;
      if (typeof v.abre === "string") ui.dias[d.key].abre = v.abre;
      if (typeof v.fecha === "string") ui.dias[d.key].fecha = v.fecha;
    }
  }

  if (raw.dias && typeof raw.dias === "object") {
    for (const d of DIAS) {
      const v = raw.dias[d.key];
      if (v && typeof v === "object") {
        if (typeof v.fechado === "boolean") ui.dias[d.key].fechado = v.fechado;
        if (typeof v.abre === "string") ui.dias[d.key].abre = v.abre;
        if (typeof v.fecha === "string") ui.dias[d.key].fecha = v.fecha;
      }
    }
  }

  return ui;
}

function fromFuncUI(ui: FuncUI) {
  const out: any = {
    mesmoHorarioTodosOsDias: ui.mesmoHorarioTodosOsDias,
    padrao: { abre: ui.padrao.abre, fecha: ui.padrao.fecha },
    dias: {},
  };

  for (const d of DIAS) {
    const dia = ui.mesmoHorarioTodosOsDias
      ? { fechado: false, abre: ui.padrao.abre, fecha: ui.padrao.fecha }
      : ui.dias[d.key];

    (out.dias as any)[d.key] = {
      fechado: !!dia.fechado,
      abre: dia.abre,
      fecha: dia.fecha,
    };
  }

  return out;
}

function isTimeValid(t: string) {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

async function uploadFotoSuperSeguro(quadraId: string, file: File, timeoutMs = 45000) {
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
  },
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "18px 16px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
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
  heroActions: {
    marginTop: 18,
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
  darkGhostBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  greenBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "none",
    background: "#8ae809",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(16,185,129,0.18)",
  },
  card: {
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#03122e",
    fontWeight: 900,
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
  layout: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
    gap: 18,
    alignItems: "start",
  },
  stack: {
    display: "grid",
    gap: 18,
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
  minHeight: 48,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  padding: "0 14px",
  background: "#fff",
  color: "#0f172a",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
},
  textarea: {
    minHeight: 110,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
  },
  sectionBox: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 18,
    padding: 16,
  },
  sectionBoxTitle: {
    margin: 0,
    color: "#03122e",
    fontSize: 18,
    fontWeight: 900,
  },
  helper: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  chipWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
  chip: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  dayRow: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    background: "#fff",
  },
  dayTitle: {
    minWidth: 120,
    fontWeight: 800,
    color: "#0f172a",
  },
  previewImg: {
    marginTop: 12,
    width: "100%",
    maxHeight: 260,
    objectFit: "cover",
    borderRadius: 16,
    display: "block",
    border: "1px solid #e2e8f0",
  },
  summaryBox: {
    display: "grid",
    gap: 12,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  summaryKey: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },
  summaryValue: {
    color: "#03122e",
    fontSize: 14,
    fontWeight: 900,
  },
  statusBox: {
    marginTop: 14,
    minHeight: 22,
    fontSize: 13,
    fontWeight: 700,
  },
  permissionBox: {
    border: "1px solid #fecaca",
    background: "#fff5f5",
    padding: 14,
    borderRadius: 16,
    color: "#b91c1c",
    fontWeight: 800,
  },
};

export default function EditarQuadra() {
  const { id } = useParams();
  const { user, loading } = useAuth();

  const [quadra, setQuadra] = useState<Quadra | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    nome: "",
    cidade: "",
    endereco: "",
    numero: "",
    observacoes: "",
    ativo: true,
  });

  const [comodidades, setComodidades] = useState<Comodidades>(comodidadesPadrao);
  const [esportes, setEsportes] = useState<EsporteId[]>([]);
  const [valoresPorEsporte, setValoresPorEsporte] = useState<Record<string, string>>({});
  const [funcUI, setFuncUI] = useState<FuncUI>(defaultFuncUI());

  const esportesSelecionadosOrdenados = useMemo(() => {
    return ESPORTES_OPCOES.filter((e) => esportes.includes(e.id)).map((e) => e.id);
  }, [esportes]);

  const [salvando, setSalvando] = useState(false);
  const [fotoNova, setFotoNova] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);

  const semPermissao = useMemo(() => {
    if (!user || !quadra) return false;
    return String(quadra.ownerId ?? "") !== String(user.uid ?? "");
  }, [user, quadra]);

  function toggleComodidade(chave: keyof Comodidades) {
    setMsg(null);
    setErro(null);
    setComodidades((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function toggleEsporte(id: EsporteId) {
    setMsg(null);
    setErro(null);

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

  function setValorDoEsporte(esporteId: string, valor: string) {
    setMsg(null);
    setErro(null);
    setValoresPorEsporte((prev) => ({ ...prev, [esporteId]: valor }));
  }

  useEffect(() => {
    async function carregar() {
      try {
        setMsg(null);
        setErro(null);
        setCarregando(true);

        if (!id) {
          setErro("ID da quadra não informado.");
          return;
        }

        const refDoc = doc(db, "quadras", id);
        const snap = await getDoc(refDoc);

        if (!snap.exists()) {
          setErro("Quadra não encontrada.");
          return;
        }

        const data = snap.data() as any;

        const q: Quadra = {
          id: snap.id,
          ownerId: String(data.ownerId ?? ""),
          nome: data.nome,
          cidade: data.cidade,
          endereco: data.endereco,
          numero: data.numero ?? "",
          observacoes: data.observacoes,
          fotoCapaUrl: data.fotoCapaUrl ?? null,
          fotoCapaPath: data.fotoCapaPath ?? null,
          ativo: data.ativo,
          comodidades: data.comodidades ?? comodidadesPadrao,
          esportes: Array.isArray(data.esportes) ? data.esportes : [],
          valoresPorEsporte: data.valoresPorEsporte ?? {},
          funcionamento: data.funcionamento ?? null,
        };

        setQuadra(q);

        setForm({
          nome: q.nome ?? "",
          cidade: q.cidade ?? "",
          endereco: q.endereco ?? "",
          numero: q.numero ?? "",
          observacoes: q.observacoes ?? "",
          ativo: q.ativo !== false,
        });

        setComodidades(q.comodidades ?? comodidadesPadrao);

        const esportesValidos = (q.esportes ?? []).filter((e) =>
          ESPORTES_OPCOES.some((op) => op.id === e)
        ) as EsporteId[];
        setEsportes(esportesValidos);

        const mapa: Record<string, string> = {};
        for (const esp of esportesValidos) {
          const n = q.valoresPorEsporte?.[esp];
          mapa[esp] = typeof n === "number" ? String(n) : "";
        }
        setValoresPorEsporte(mapa);

        setFuncUI(toFuncUI(q.funcionamento));

        setFotoNova(null);
        if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
        setFotoPreviewUrl(null);
      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar quadra. Veja o console.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
    };
  }, [fotoPreviewUrl]);

  async function salvar() {
    try {
      setMsg(null);
      setErro(null);

      if (!id) return setErro("ID da quadra não informado.");
      if (!user) return setErro("Você precisa estar logado.");
      if (!quadra) return setErro("Quadra não carregada.");
      if (String(quadra.ownerId) !== String(user.uid)) {
        return setErro("Você não tem permissão para editar esta quadra.");
      }

      if (!form.nome.trim()) return setErro("Informe o nome da quadra.");
      if (!form.cidade.trim()) return setErro("Informe a cidade.");
      if (esportes.length === 0) return setErro("Selecione pelo menos 1 esporte.");

      const valoresConvertidos: Record<string, number> = {};
      for (const esp of esportes) {
        const valStr = valoresPorEsporte[esp] ?? "";
        const valNum = parseMoneyToNumber(valStr);
        if (valNum === null) {
          const label = ESPORTES_OPCOES.find((x) => x.id === esp)?.label ?? esp;
          return setErro(`Informe um valor válido para o esporte: ${label}`);
        }
        valoresConvertidos[esp] = valNum;
      }

      if (!isTimeValid(funcUI.padrao.abre) || !isTimeValid(funcUI.padrao.fecha)) {
        return setErro("Funcionamento: horário padrão inválido.");
      }

      if (!funcUI.mesmoHorarioTodosOsDias) {
        for (const d of DIAS) {
          const dia = funcUI.dias[d.key];
          if (!dia.fechado) {
            if (!isTimeValid(dia.abre) || !isTimeValid(dia.fecha)) {
              return setErro(`Funcionamento: horário inválido em ${d.label}.`);
            }
          }
        }
      }

      const funcionamentoObj = fromFuncUI(funcUI);

      if (fotoNova && fotoNova.size > 5 * 1024 * 1024) {
        return setErro("Imagem muito grande. Use uma foto de até 5MB (ideal: 1MB).");
      }

      setSalvando(true);

      let fotoCapaUrl = quadra.fotoCapaUrl ?? null;
      let fotoCapaPath = quadra.fotoCapaPath ?? null;

      if (fotoNova) {
        const up = await uploadFotoSuperSeguro(id, fotoNova, 45000);
        fotoCapaUrl = up.url;
        fotoCapaPath = up.caminho;
      }

      const refDoc = doc(db, "quadras", id);

      await updateDoc(refDoc, {
        nome: form.nome.trim(),
        cidade: form.cidade.trim(),
        endereco: form.endereco.trim(),
        numero: form.numero.trim(),
        observacoes: form.observacoes.trim(),
        ativo: form.ativo,
        fotoCapaUrl,
        fotoCapaPath,
        comodidades,
        esportes,
        valoresPorEsporte: valoresConvertidos,
        funcionamento: funcionamentoObj,
      });

      setQuadra((prev) =>
        prev
          ? {
              ...prev,
              nome: form.nome.trim(),
              cidade: form.cidade.trim(),
              endereco: form.endereco.trim(),
              numero: form.numero.trim(),
              observacoes: form.observacoes.trim(),
              ativo: form.ativo,
              fotoCapaUrl,
              fotoCapaPath,
              comodidades,
              esportes,
              valoresPorEsporte: valoresConvertidos,
              funcionamento: funcionamentoObj,
            }
          : prev
      );

      setFotoNova(null);
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
      setFotoPreviewUrl(null);

      setMsg("Salvo com sucesso ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ? `Erro ao salvar: ${e.message}` : "Erro ao salvar. Veja o console.");
    } finally {
      setSalvando(false);
    }
  }

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

  if (loading) return <p>Carregando usuário...</p>;
  if (!user) return <p>Você precisa estar logado.</p>;

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.heroBadge}>Gestão da quadra</div>
            <h1 style={styles.heroTitle}>Editar quadra</h1>
            <p style={styles.heroText}>
              Atualize foto, esportes, comodidades, funcionamento e informações do espaço
              para manter sua quadra sempre pronta para reservas.
            </p>

            <div style={styles.heroActions}>
              <Link to="/dono" style={{ textDecoration: "none" }}>
                <button style={styles.darkGhostBtn}>Voltar ao painel</button>
              </Link>

              {id ? (
                <Link to={`/dono/quadra/${id}/reservas`} style={{ textDecoration: "none" }}>
                  <button style={styles.darkGhostBtn}>Ver reservas</button>
                </Link>
              ) : null}
            </div>
          </div>

          {carregando ? (
            <div style={{ ...styles.card, marginTop: 18 }}>
              <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>Carregando quadra...</p>
            </div>
          ) : null}

          {!carregando && erro && !quadra ? (
            <div style={{ ...styles.card, marginTop: 18 }}>
              <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>{erro}</p>
            </div>
          ) : null}

          {!carregando && !erro && quadra ? (
            <>
              {semPermissao ? (
                <div style={{ ...styles.card, marginTop: 18 }}>
                  <div style={styles.permissionBox}>
                    Você não tem permissão para editar esta quadra.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    ...styles.layout,
                    gridTemplateColumns: "1fr",
                  }}
                >
                  <div style={styles.stack}>
                    <div style={styles.card}>
                      <h2 style={styles.sectionTitle}>Informações principais</h2>
                      <p style={styles.sectionText}>
                        Atualize os dados principais que aparecem no anúncio da quadra.
                      </p>

                      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                        <label style={styles.field}>
                          <span style={styles.label}>Nome da quadra</span>
                          <input
                            value={form.nome}
                            onChange={(e) => {
                              setMsg(null);
                              setErro(null);
                              setForm((p) => ({ ...p, nome: e.target.value }));
                            }}
                            placeholder="Nome da quadra"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Cidade</span>
                          <input
                            value={form.cidade}
                            onChange={(e) => {
                              setMsg(null);
                              setErro(null);
                              setForm((p) => ({ ...p, cidade: e.target.value }));
                            }}
                            placeholder="Cidade"
                            style={styles.input}
                          />
                        </label>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 10,
                          }}
                        >
                          <label style={styles.field}>
                            <span style={styles.label}>Endereço (Rua)</span>
                            <input
                              value={form.endereco}
                              onChange={(e) => {
                                setMsg(null);
                                setErro(null);
                                setForm((p) => ({ ...p, endereco: e.target.value }));
                              }}
                              placeholder="Rua / Logradouro"
                              style={styles.input}
                            />
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Número</span>
                            <input
                              value={form.numero}
                              onChange={(e) => {
                                setMsg(null);
                                setErro(null);
                                setForm((p) => ({ ...p, numero: e.target.value }));
                              }}
                              placeholder="Ex: 123"
                              style={styles.input}
                            />
                          </label>
                        </div>

                        <label style={styles.field}>
                          <span style={styles.label}>Observações</span>
                          <textarea
                            value={form.observacoes}
                            onChange={(e) => {
                              setMsg(null);
                              setErro(null);
                              setForm((p) => ({ ...p, observacoes: e.target.value }));
                            }}
                            rows={4}
                            placeholder="Observações"
                            style={styles.textarea}
                          />
                        </label>

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
                            checked={form.ativo}
                            onChange={(e) => {
                              setMsg(null);
                              setErro(null);
                              setForm((p) => ({ ...p, ativo: e.target.checked }));
                            }}
                          />
                          Quadra ativa
                        </label>
                      </div>
                    </div>

                    <div style={styles.card}>
                      <h2 style={styles.sectionTitle}>Esportes e valores</h2>
                      <p style={styles.sectionText}>
                        Defina os esportes disponíveis e o valor cobrado por hora em cada um.
                      </p>

                      <div style={styles.sectionBox}>
                        <h3 style={styles.sectionBoxTitle}>Esportes</h3>
                        <p style={styles.helper}>Marque os esportes disponíveis nesta quadra.</p>

                        <div style={styles.chipWrap}>
                          {ESPORTES_OPCOES.map((op) => {
                            const ativo = esportes.includes(op.id);
                            return (
                              <label
                                key={op.id}
                                style={{
                                  ...styles.chip,
                                  background: ativo ? "#dbeafe" : "#fff",
                                  border: ativo ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                  color: ativo ? "#1d4ed8" : "#334155",
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

                      <div style={{ ...styles.sectionBox, marginTop: 14 }}>
                        <h3 style={styles.sectionBoxTitle}>Valores por esporte (R$/hora)</h3>
                        <p style={styles.helper}>
                          Para cada esporte marcado, informe o valor correspondente.
                        </p>

                        {esportesSelecionadosOrdenados.length === 0 ? (
                          <div
                            style={{
                              marginTop: 12,
                              padding: "14px",
                              borderRadius: 14,
                              background: "#fff",
                              border: "1px dashed #cbd5e1",
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            Marque pelo menos 1 esporte acima.
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                            {esportesSelecionadosOrdenados.map((espId) => {
                              const label =
                                ESPORTES_OPCOES.find((e) => e.id === espId)?.label ?? espId;
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

                    <div style={styles.card}>
                      <h2 style={styles.sectionTitle}>Comodidades e funcionamento</h2>
                      <p style={styles.sectionText}>
                        Ajuste a estrutura da quadra e como ela funciona ao longo da semana.
                      </p>

                      <div style={styles.sectionBox}>
                        <h3 style={styles.sectionBoxTitle}>Comodidades</h3>
                        <p style={styles.helper}>Selecione o que a quadra oferece.</p>

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
                              <label
                                key={item.key}
                                style={{
                                  ...styles.chip,
                                  background: ativo ? "#ecfeff" : "#fff",
                                  border: ativo ? "1px solid #a5f3fc" : "1px solid #e2e8f0",
                                  color: ativo ? "#155e75" : "#334155",
                                }}
                              >
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
                      </div>

                      <div style={{ ...styles.sectionBox, marginTop: 14 }}>
                        <h3 style={styles.sectionBoxTitle}>Funcionamento</h3>
                        <p style={styles.helper}>
                          Configure o horário padrão ou personalize por dia.
                        </p>

                        <label
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            marginTop: 12,
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={funcUI.mesmoHorarioTodosOsDias}
                            onChange={(e) => {
                              setMsg(null);
                              setErro(null);
                              const v = e.target.checked;
                              setFuncUI((p) => ({ ...p, mesmoHorarioTodosOsDias: v }));
                            }}
                          />
                          Mesmo horário todos os dias
                        </label>

                        <div
                          style={{
                            marginTop: 14,
                            display: "flex",
                            gap: 10,
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
                                const v = e.target.value;
                                setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, abre: v } }));
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
                                const v = e.target.value;
                                setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, fecha: v } }));
                              }}
                              style={styles.input}
                            />
                          </label>
                        </div>

                        {!funcUI.mesmoHorarioTodosOsDias ? (
                          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                            {DIAS.map((d) => {
                              const dia = funcUI.dias[d.key];
                              return (
                                <div key={d.key} style={styles.dayRow}>
                                  <div style={styles.dayTitle}>{d.label}</div>

                                  <label
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                      fontWeight: 700,
                                      color: "#334155",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={dia.fechado}
                                      onChange={(e) => {
                                        setMsg(null);
                                        setErro(null);
                                        const fechado = e.target.checked;
                                        setFuncUI((p) => ({
                                          ...p,
                                          dias: {
                                            ...p.dias,
                                            [d.key]: { ...p.dias[d.key], fechado },
                                          },
                                        }));
                                      }}
                                    />
                                    Fechado
                                  </label>

                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                    }}
                                  >
                                    <label style={styles.field}>
                                      <span style={styles.label}>Abre</span>
                                      <input
                                        type="time"
                                        value={dia.abre}
                                        disabled={dia.fechado}
                                        onChange={(e) => {
                                          setMsg(null);
                                          setErro(null);
                                          const abre = e.target.value;
                                          setFuncUI((p) => ({
                                            ...p,
                                            dias: {
                                              ...p.dias,
                                              [d.key]: { ...p.dias[d.key], abre },
                                            },
                                          }));
                                        }}
                                        style={styles.input}
                                      />
                                    </label>

                                    <label style={styles.field}>
                                      <span style={styles.label}>Fecha</span>
                                      <input
                                        type="time"
                                        value={dia.fecha}
                                        disabled={dia.fechado}
                                        onChange={(e) => {
                                          setMsg(null);
                                          setErro(null);
                                          const fecha = e.target.value;
                                          setFuncUI((p) => ({
                                            ...p,
                                            dias: {
                                              ...p.dias,
                                              [d.key]: { ...p.dias[d.key], fecha },
                                            },
                                          }));
                                        }}
                                        style={styles.input}
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
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

                      <div style={{ marginTop: 10 }}>
                        <button onClick={salvar} disabled={salvando} style={styles.greenBtn}>
                          {salvando ? "Salvando..." : "Salvar alterações"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.stack}>
                    <div style={styles.card}>
                      <h2 style={styles.sectionTitle}>Foto da quadra</h2>
                      <p style={styles.sectionText}>
                        Troque a imagem principal para manter o anúncio atualizado e atrativo.
                      </p>

                      {quadra.fotoCapaUrl ? (
                        <img
                          src={quadra.fotoCapaUrl}
                          alt="Foto de capa"
                          style={styles.previewImg}
                        />
                      ) : (
                        <div
                          style={{
                            marginTop: 14,
                            border: "1px dashed #cbd5e1",
                            borderRadius: 16,
                            padding: 16,
                            color: "#64748b",
                            fontWeight: 700,
                            background: "#f8fafc",
                          }}
                        >
                          Sem foto de capa.
                        </div>
                      )}

                      <div style={{ ...styles.sectionBox, marginTop: 14 }}>
                        <h3 style={styles.sectionBoxTitle}>Trocar foto de capa</h3>
                        <p style={styles.helper}>
                          Dica: imagens até 1MB costumam ficar bem mais rápidas.
                        </p>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setMsg(null);
                            setErro(null);
                            setFotoNova(file);

                            if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);

                            if (file) {
                              const preview = URL.createObjectURL(file);
                              setFotoPreviewUrl(preview);
                            } else {
                              setFotoPreviewUrl(null);
                            }
                          }}
                          style={{ display: "block", marginTop: 12 }}
                        />

                        {fotoNova ? (
                          <p style={{ marginTop: 10, fontSize: 14, color: "#334155" }}>
                            Selecionada: <strong>{fotoNova.name}</strong>
                          </p>
                        ) : null}

                        {fotoPreviewUrl ? (
                          <img
                            src={fotoPreviewUrl}
                            alt="Preview da nova capa"
                            style={styles.previewImg}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div style={styles.card}>
                      <h2 style={styles.sectionTitle}>Resumo da quadra</h2>
                      <p style={styles.sectionText}>
                        Confira rapidamente como a quadra está configurada agora.
                      </p>

                      <div style={{ ...styles.summaryBox, marginTop: 18 }}>
                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Nome</div>
                          <div style={styles.summaryValue}>{form.nome.trim() || "—"}</div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Cidade</div>
                          <div style={styles.summaryValue}>{form.cidade.trim() || "—"}</div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Endereço</div>
                          <div style={styles.summaryValue}>
                            {[form.endereco.trim(), form.numero.trim()].filter(Boolean).join(", ") || "—"}
                          </div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Status</div>
                          <div style={styles.summaryValue}>{form.ativo ? "Ativa" : "Inativa"}</div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Esportes</div>
                          <div style={styles.summaryValue}>
                            {esportesSelecionadosOrdenados.length > 0
                              ? esportesSelecionadosOrdenados
                                  .map((id) => ESPORTES_OPCOES.find((e) => e.id === id)?.label ?? id)
                                  .join(", ")
                              : "—"}
                          </div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Comodidades</div>
                          <div style={styles.summaryValue}>
                            {comodidadesAtivas.length > 0 ? comodidadesAtivas.join(", ") : "—"}
                          </div>
                        </div>

                        <div style={styles.summaryRow}>
                          <div style={styles.summaryKey}>Foto nova</div>
                          <div style={styles.summaryValue}>{fotoNova ? "Selecionada" : "Sem troca"}</div>
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            padding: 16,
                            borderRadius: 16,
                            background: "linear-gradient(180deg, #eff6ff, #ffffff)",
                            border: "1px solid #bfdbfe",
                            color: "#1e3a8a",
                            lineHeight: 1.6,
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Depois de salvar, a quadra mantém seus dados atualizados e prontos para
                          novas reservas dentro do Quadra Play.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}