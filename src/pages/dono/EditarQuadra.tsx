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
  observacoes?: string;
  fotoCapaUrl?: string | null;
  fotoCapaPath?: string | null;
  ativo?: boolean;
  comodidades?: Comodidades;

  esportes?: string[];
  valoresPorEsporte?: Record<string, number>;

  funcionamento?: any; // manter compatível
};

type FormState = {
  nome: string;
  cidade: string;
  endereco: string;
  observacoes: string;
  ativo: boolean;
};

// ---------- Funcionamento UI (MVP bonito) ----------
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
  abre: string; // "08:00"
  fecha: string; // "22:00"
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

// Tenta entender formatos antigos/soltos e traduzir pra UI
function toFuncUI(raw: any): FuncUI {
  const ui = defaultFuncUI();

  if (!raw || typeof raw !== "object") return ui;

  // Caso "padrao" já exista
  if (raw.padrao && typeof raw.padrao === "object") {
    if (typeof raw.padrao.abre === "string") ui.padrao.abre = raw.padrao.abre;
    if (typeof raw.padrao.fecha === "string") ui.padrao.fecha = raw.padrao.fecha;
  }

  // Caso tenha "mesmoHorarioTodosOsDias"
  if (typeof raw.mesmoHorarioTodosOsDias === "boolean") {
    ui.mesmoHorarioTodosOsDias = raw.mesmoHorarioTodosOsDias;
  }

  // Caso tenha dias no formato { seg: { fechado, abre, fecha }, ... }
  for (const d of DIAS) {
    const v = raw[d.key];
    if (v && typeof v === "object") {
      if (typeof v.fechado === "boolean") ui.dias[d.key].fechado = v.fechado;
      if (typeof v.abre === "string") ui.dias[d.key].abre = v.abre;
      if (typeof v.fecha === "string") ui.dias[d.key].fecha = v.fecha;
    }
  }

  // Se tiver "dias" dentro
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

  // Se não veio nada de dias, mas veio só padrao, mantém todos os dias com padrao e modo "todos os dias"
  // (fica ok)

  return ui;
}

// Converte UI para objeto salvo no Firestore (padrao + dias)
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

// ✅ Mesmo padrão do NovaQuadra: progresso + watchdog + timeout + cancel
async function uploadFotoSuperSeguro(quadraId: string, file: File, timeoutMs = 45000) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `quadras/${quadraId}/capa-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, caminho);

  console.log("[UPLOAD] start", { caminho, size: file.size });

  const task = uploadBytesResumable(storageRef, file);

  // watchdog: se ficar 8s sem progresso, cancela
  let lastBytes = 0;
  let lastChangeAt = Date.now();
  const watchdog = setInterval(() => {
    const bytes = task.snapshot.bytesTransferred ?? 0;
    if (bytes !== lastBytes) {
      lastBytes = bytes;
      lastChangeAt = Date.now();
    } else {
      if (Date.now() - lastChangeAt > 8000) {
        console.log("[UPLOAD] STALL detected -> cancel");
        try {
          task.cancel();
        } catch {}
      }
    }
  }, 1000);

  const uploadPromise = new Promise<{ url: string; caminho: string }>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        console.log("[UPLOAD] progress", snap.bytesTransferred, "/", snap.totalBytes);
      },
      (error) => {
        clearInterval(watchdog);
        console.log("[UPLOAD] error", error);
        reject(error);
      },
      async () => {
        clearInterval(watchdog);
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
      clearInterval(watchdog);
      reject(new Error("Upload da foto demorou demais e foi cancelado. Tente uma imagem menor."));
    }, timeoutMs);

    uploadPromise.finally(() => clearTimeout(t));
  });

  return Promise.race([uploadPromise, timeoutPromise]);
}

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
    observacoes: "",
    ativo: true,
  });

  const [comodidades, setComodidades] = useState<Comodidades>(comodidadesPadrao);

  // Esportes + valores
  const [esportes, setEsportes] = useState<EsporteId[]>([]);
  const [valoresPorEsporte, setValoresPorEsporte] = useState<Record<string, string>>({});

  // Funcionamento UI
  const [funcUI, setFuncUI] = useState<FuncUI>(defaultFuncUI());

  const esportesSelecionadosOrdenados = useMemo(() => {
    return ESPORTES_OPCOES.filter((e) => esportes.includes(e.id)).map((e) => e.id);
  }, [esportes]);

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

  const [salvando, setSalvando] = useState(false);

  // Foto
  const [fotoNova, setFotoNova] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);

  const semPermissao = useMemo(() => {
    if (!user || !quadra) return false;
    return quadra.ownerId !== user.uid;
  }, [user, quadra]);

  function toggleComodidade(chave: keyof Comodidades) {
    setMsg(null);
    setErro(null);
    setComodidades((prev) => ({ ...prev, [chave]: !prev[chave] }));
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
          ownerId: data.ownerId,
          nome: data.nome,
          cidade: data.cidade,
          endereco: data.endereco,
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

        // funcionamento -> UI
        setFuncUI(toFuncUI(q.funcionamento));

        // limpa foto
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
      if (quadra.ownerId !== user.uid) return setErro("Você não tem permissão para editar esta quadra.");

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

      // valida funcionamento UI
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

  if (loading) return <p>Carregando usuário...</p>;
  if (!user) return <p>Você precisa estar logado.</p>;

  return (
    <>
      <Header />

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Editar Quadra</h1>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/dono">
              <button>Voltar</button>
            </Link>

            {id && (
              <Link to={`/dono/quadra/${id}/reservas`}>
                <button>Ver reservas</button>
              </Link>
            )}
          </div>
        </div>

        <hr style={{ margin: "16px 0" }} />

        {carregando && <p>Carregando quadra...</p>}

        {!carregando && !erro && quadra && (
          <>
            {semPermissao ? (
              <div style={{ border: "1px solid #f2c2c2", background: "#fff5f5", padding: 12, borderRadius: 12 }}>
                <p style={{ margin: 0, color: "#a00" }}>Você não tem permissão para editar esta quadra.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {quadra.fotoCapaUrl ? (
                  <img
                    src={quadra.fotoCapaUrl}
                    alt="Foto de capa"
                    style={{ width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid #ddd" }}
                  />
                ) : (
                  <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                    <p style={{ margin: 0 }}>Sem foto de capa.</p>
                  </div>
                )}

                {/* Foto */}
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                  <strong>Trocar foto de capa</strong>

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
                    style={{ display: "block", marginTop: 8 }}
                  />

                  {fotoNova && (
                    <p style={{ marginTop: 8, fontSize: 14 }}>
                      Selecionada: <strong>{fotoNova.name}</strong>
                    </p>
                  )}

                  {fotoPreviewUrl && (
                    <img
                      src={fotoPreviewUrl}
                      alt="Preview da nova capa"
                      style={{
                        marginTop: 10,
                        width: "100%",
                        maxHeight: 220,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                      }}
                    />
                  )}

                  <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Dica: imagens até 1MB ficam bem mais rápidas.</p>
                </div>

                {/* Esportes */}
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                  <strong>Esportes</strong>
                  <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#666" }}>
                    Marque os esportes disponíveis e preencha o valor (R$/hora) de cada um.
                  </p>

                  <div style={{ display: "grid", gap: 6 }}>
                    {ESPORTES_OPCOES.map((op) => (
                      <label key={op.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" checked={esportes.includes(op.id)} onChange={() => toggleEsporte(op.id)} />
                        {op.label}
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, borderTop: "1px dashed #ddd", paddingTop: 12 }}>
                    <strong style={{ fontSize: 14 }}>Valores por esporte</strong>

                    {esportesSelecionadosOrdenados.length === 0 ? (
                      <p style={{ color: "#666", marginTop: 8 }}>Marque pelo menos 1 esporte acima.</p>
                    ) : (
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        {esportesSelecionadosOrdenados.map((espId) => {
                          const label = ESPORTES_OPCOES.find((e) => e.id === espId)?.label ?? espId;
                          return (
                            <div key={espId} style={{ display: "grid", gap: 4 }}>
                              <label style={{ fontWeight: 600 }}>{label}</label>
                              <input
                                placeholder="Ex: 120"
                                value={valoresPorEsporte[espId] ?? ""}
                                onChange={(e) => setValorDoEsporte(espId, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comodidades */}
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                  <strong>Comodidades</strong>

                  <label style={{ display: "block", marginTop: 8 }}>
                    <input type="checkbox" checked={comodidades.chuveiro} onChange={() => toggleComodidade("chuveiro")} />{" "}
                    Chuveiro
                  </label>

                  <label style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={comodidades.churrasqueira}
                      onChange={() => toggleComodidade("churrasqueira")}
                    />{" "}
                    Churrasqueira
                  </label>

                  <label style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={comodidades.mesaSinuca}
                      onChange={() => toggleComodidade("mesaSinuca")}
                    />{" "}
                    Mesa de sinuca
                  </label>

                  <label style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={comodidades.iluminacao}
                      onChange={() => toggleComodidade("iluminacao")}
                    />{" "}
                    Iluminação
                  </label>

                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={comodidades.coletes} onChange={() => toggleComodidade("coletes")} />{" "}
                    Coletes
                  </label>
                </div>

                {/* ✅ Funcionamento UI */}
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                  <strong>Funcionamento</strong>
                  <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#666" }}>
                    Configure o horário padrão ou por dia. Isso será usado para gerar horários.
                  </p>

                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                    <span>Mesmo horário todos os dias</span>
                  </label>

                  <div style={{ marginTop: 10, borderTop: "1px dashed #ddd", paddingTop: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Abre</span>
                        <input
                          type="time"
                          value={funcUI.padrao.abre}
                          onChange={(e) => {
                            setMsg(null);
                            setErro(null);
                            const v = e.target.value;
                            setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, abre: v } }));
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
                            const v = e.target.value;
                            setFuncUI((p) => ({ ...p, padrao: { ...p.padrao, fecha: v } }));
                          }}
                        />
                      </div>
                    </div>

                    {!funcUI.mesmoHorarioTodosOsDias && (
                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        {DIAS.map((d) => {
                          const dia = funcUI.dias[d.key];
                          return (
                            <div
                              key={d.key}
                              style={{
                                border: "1px solid #eee",
                                borderRadius: 10,
                                padding: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ minWidth: 120, fontWeight: 700 }}>{d.label}</div>

                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={dia.fechado}
                                  onChange={(e) => {
                                    setMsg(null);
                                    setErro(null);
                                    const fechado = e.target.checked;
                                    setFuncUI((p) => ({
                                      ...p,
                                      dias: { ...p.dias, [d.key]: { ...p.dias[d.key], fechado } },
                                    }));
                                  }}
                                />
                                <span>Fechado</span>
                              </label>

                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, color: "#666" }}>Abre</span>
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
                                        dias: { ...p.dias, [d.key]: { ...p.dias[d.key], abre } },
                                      }));
                                    }}
                                  />
                                </div>

                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, color: "#666" }}>Fecha</span>
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
                                        dias: { ...p.dias, [d.key]: { ...p.dias[d.key], fecha } },
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados básicos + salvar */}
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                  <p style={{ marginTop: 0, color: "#666" }}>
                    Editar dados básicos (nome/cidade/endereço/observações/status).
                  </p>

                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Nome</span>
                      <input
                        value={form.nome}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setForm((p) => ({ ...p, nome: e.target.value }));
                        }}
                        placeholder="Nome da quadra"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Cidade</span>
                      <input
                        value={form.cidade}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setForm((p) => ({ ...p, cidade: e.target.value }));
                        }}
                        placeholder="Cidade"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Endereço</span>
                      <input
                        value={form.endereco}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setForm((p) => ({ ...p, endereco: e.target.value }));
                        }}
                        placeholder="Endereço"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span>Observações</span>
                      <textarea
                        value={form.observacoes}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setForm((p) => ({ ...p, observacoes: e.target.value }));
                        }}
                        rows={4}
                        placeholder="Observações"
                      />
                    </label>

                    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(e) => {
                          setMsg(null);
                          setErro(null);
                          setForm((p) => ({ ...p, ativo: e.target.checked }));
                        }}
                      />
                      <span>Quadra ativa</span>
                    </label>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 6,
                        paddingTop: 10,
                        borderTop: "1px dashed #ddd",
                      }}
                    >
                      <div style={{ minHeight: 18, fontSize: 13 }}>
                        {erro ? (
                          <span style={{ color: "crimson" }}>{erro}</span>
                        ) : msg ? (
                          <span style={{ color: "green" }}>{msg}</span>
                        ) : (
                          <span style={{ color: "#666" }}>—</span>
                        )}
                      </div>

                      <button onClick={salvar} disabled={salvando}>
                        {salvando ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!carregando && erro && !quadra && <p style={{ color: "crimson" }}>{erro}</p>}
      </div>
    </>
  );
}
