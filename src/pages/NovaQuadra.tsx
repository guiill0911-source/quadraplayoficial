import { useEffect, useMemo, useState } from "react";
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
  const linha2 = [bairro].filter(Boolean).join(" - ");

  return [linha1, linha2].filter(Boolean).join(" - ");
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
  layout: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "1.2fr 0.85fr",
    gap: 18,
    alignItems: "start",
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
    color: "#0f172a",
    fontWeight: 900,
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
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
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
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
    marginTop: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 16,
  },
  sectionBoxTitle: {
    margin: 0,
    color: "#0f172a",
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
  actionBtn: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(16,185,129,0.18)",
  },
  secondaryBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
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
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },
};

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

  const [comodidades, setComodidades] = useState<Comodidades>(comodidadesPadrao);
  const [funcionamento] = useState<Funcionamento>(funcionamentoPadrao);

  const [salvando, setSalvando] = useState(false);

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

  useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
    };
  }, [fotoPreviewUrl]);

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
      setMsgEndereco("Endereço encontrado ✅ Preencha o número.");
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
        alert(`Informe um valor válido para o esporte: ${esp}`);
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

      if (fotoCapa) {
        const up = await uploadFotoSuperSeguro(quadraRef.id, fotoCapa, 45000);
        fotoCapaUrl = up.url;
        fotoCapaPath = up.caminho;
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

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.heroBadge}>Cadastro de nova quadra</div>
            <h1 style={styles.heroTitle}>Nova Quadra</h1>
            <p style={styles.heroText}>
              Cadastre seu espaço com endereço, esportes, valores, comodidades e foto de capa.
              Depois disso, você segue para a etapa de geração de horários.
            </p>
          </div>

          <div
            style={{
              ...styles.layout,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Informações da quadra</h2>
              <p style={styles.sectionText}>
                Preencha os dados principais para publicar sua quadra no aplicativo.
              </p>

              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                <label style={styles.field}>
                  <span style={styles.label}>Nome da quadra</span>
                  <input
                    placeholder="Ex: Arena Litoral BC"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <div style={styles.sectionBox}>
                  <h3 style={styles.sectionBoxTitle}>Endereço</h3>
                  <p style={styles.helper}>
                    Busque pelo CEP para preencher automaticamente ou informe manualmente.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(160px, 180px) auto 1fr",
                      gap: 10,
                      marginTop: 14,
                      alignItems: "end",
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

                    <button onClick={onBuscarCep} disabled={buscandoCep} style={styles.secondaryBtn}>
                      {buscandoCep ? "Buscando..." : "Buscar CEP"}
                    </button>

                    <div
                      style={{
                        fontSize: 13,
                        color: msgEndereco.includes("✅")
                          ? "#15803d"
                          : msgEndereco
                          ? "#475569"
                          : "#64748b",
                        fontWeight: msgEndereco ? 700 : 500,
                      }}
                    >
                      {msgEndereco || "Digite o CEP e busque para preencher automaticamente."}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(260px, 1fr) 140px",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <label style={styles.field}>
                      <span style={styles.label}>Rua</span>
                      <input
                        placeholder="Rua / Logradouro"
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Número</span>
                      <input
                        placeholder="Ex: 123"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 120px",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
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
                      <span style={styles.label}>Cidade</span>
                      <input
                        placeholder="Cidade"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
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

                  <div
                    style={{
                      marginTop: 12,
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontSize: 13,
                    }}
                  >
                    Endereço salvo: <strong>{enderecoPreview || "—"}</strong>
                  </div>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Observações</span>
                  <textarea
                    placeholder="Ex: ambiente familiar, estacionamento amplo, vestiário reformado..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                    style={styles.textarea}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Valor geral por hora (opcional)</span>
                  <input
                    placeholder="Ex: 120"
                    value={valorHora}
                    onChange={(e) => setValorHora(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <div style={styles.sectionBox}>
                  <h3 style={styles.sectionBoxTitle}>Esportes</h3>
                  <p style={styles.helper}>Marque todos os esportes disponíveis nesta quadra.</p>

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

                <div style={styles.sectionBox}>
                  <h3 style={styles.sectionBoxTitle}>Valores por esporte (R$/hora)</h3>
                  <p style={styles.helper}>
                    Para cada esporte marcado, informe o valor específico.
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
                        const label = ESPORTES_OPCOES.find((e) => e.id === espId)?.label ?? espId;
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

                <div style={styles.sectionBox}>
                  <h3 style={styles.sectionBoxTitle}>Comodidades</h3>
                  <p style={styles.helper}>Selecione o que a sua quadra oferece.</p>

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

                <div style={styles.sectionBox}>
                  <h3 style={styles.sectionBoxTitle}>Foto de capa</h3>
                  <p style={styles.helper}>
                    Adicione uma imagem bonita da quadra para destacar o anúncio.
                  </p>

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
                    style={{ display: "block", marginTop: 12 }}
                  />

                  {fotoCapa ? (
                    <p style={{ marginTop: 10, fontSize: 14, color: "#334155" }}>
                      Selecionada: <strong>{fotoCapa.name}</strong>
                    </p>
                  ) : null}

                  {fotoPreviewUrl ? (
                    <img
                      src={fotoPreviewUrl}
                      alt="Preview da capa"
                      style={styles.previewImg}
                    />
                  ) : null}
                </div>

                <button onClick={salvar} disabled={salvando} style={styles.actionBtn}>
                  {salvando ? "Salvando..." : "Salvar e ir para Etapa 2 (Gerar horários)"}
                </button>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Resumo do cadastro</h2>
              <p style={styles.sectionText}>
                Veja um resumo rápido do que já foi preenchido antes de salvar.
              </p>

              <div style={{ ...styles.summaryBox, marginTop: 18 }}>
                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Nome</div>
                  <div style={styles.summaryValue}>{nome.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Cidade</div>
                  <div style={styles.summaryValue}>{cidade.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Endereço</div>
                  <div style={styles.summaryValue}>{enderecoPreview || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Esportes selecionados</div>
                  <div style={styles.summaryValue}>
                    {esportesSelecionadosOrdenados.length > 0
                      ? esportesSelecionadosOrdenados
                          .map((id) => ESPORTES_OPCOES.find((e) => e.id === id)?.label ?? id)
                          .join(", ")
                      : "—"}
                  </div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Valor geral por hora</div>
                  <div style={styles.summaryValue}>{valorHora.trim() || "—"}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Comodidades</div>
                  <div style={styles.summaryValue}>
                    {comodidadesAtivas.length > 0 ? comodidadesAtivas.join(", ") : "—"}
                  </div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryKey}>Foto de capa</div>
                  <div style={styles.summaryValue}>{fotoCapa ? "Selecionada" : "Não enviada"}</div>
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
                  Após salvar, você seguirá direto para a etapa de geração de horários da quadra.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}