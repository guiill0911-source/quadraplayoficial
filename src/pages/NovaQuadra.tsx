import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../services/firebase";
import { funcionamentoPadrao } from "../types/funcionamento";
import type { Funcionamento } from "../types/funcionamento";
import { useAuth } from "../services/authContext";

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

// ✅ Upload SUPER robusto: progresso + watchdog + timeout + cancel
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

export default function NovaQuadra() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [endereco, setEndereco] = useState("");

  const [valorHora, setValorHora] = useState(""); // opcional
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

  async function salvar() {
    if (loading) return;

    const uid = user?.uid;
    if (!uid) {
      alert("Você precisa estar logado para cadastrar uma quadra.");
      return;
    }

    if (user?.role !== "dono") {
      alert("Apenas usuários com perfil DONO podem cadastrar quadras.");
      return;
    }

    if (!nome.trim() || !cidade.trim()) {
      alert("Preencha nome e cidade.");
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

      await setDoc(quadraRef, {
        ownerId: uid,
        nome: nome.trim(),
        cidade: cidade.trim(),
        endereco: endereco.trim(),
        observacoes: observacoes.trim(),

        esportes,
        valoresPorEsporte: valoresConvertidos,

        valorHora: valorGeralNumero,
        comodidades,
        funcionamento,

        fotoCapaUrl,
        fotoCapaPath,

        ativo: true,
        createdAt: serverTimestamp(),
      });

      console.log("[SALVAR] setDoc ok");

      // reset
      setNome("");
      setCidade("");
      setEndereco("");
      setObservacoes("");
      setValorHora("");
      setEsportes([]);
      setValoresPorEsporte({});
      setComodidades(comodidadesPadrao);
      setFotoCapa(null);
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
      setFotoPreviewUrl(null);

      navigate(`/quadra/${quadraRef.id}`);
    } catch (err: any) {
      console.error("ERRO AO SALVAR QUADRA:", err);
      alert(`Erro ao salvar: ${err?.code || err?.message || err}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Nova Quadra</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        <input placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />

        <textarea
          placeholder="Observações (opcional)"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={4}
        />

        <input
          placeholder="Valor geral por hora (opcional) — ex: 120"
          value={valorHora}
          onChange={(e) => setValorHora(e.target.value)}
        />

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <strong>Esportes (marque os disponíveis)</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {ESPORTES_OPCOES.map((op) => (
              <label key={op.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={esportes.includes(op.id)} onChange={() => toggleEsporte(op.id)} />
                {op.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <strong>Valores por esporte (R$/hora)</strong>
          <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#666" }}>
            Para cada esporte marcado, preencha o valor.
          </p>

          {esportesSelecionadosOrdenados.length === 0 ? (
            <p style={{ color: "#666" }}>Marque pelo menos 1 esporte acima.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
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

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
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
            <input type="checkbox" checked={comodidades.mesaSinuca} onChange={() => toggleComodidade("mesaSinuca")} />{" "}
            Mesa de sinuca
          </label>

          <label style={{ display: "block" }}>
            <input type="checkbox" checked={comodidades.iluminacao} onChange={() => toggleComodidade("iluminacao")} />{" "}
            Iluminação
          </label>

          <label style={{ display: "block" }}>
            <input type="checkbox" checked={comodidades.coletes} onChange={() => toggleComodidade("coletes")} /> Coletes
          </label>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <strong>Foto de capa (opcional)</strong>

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
            style={{ display: "block", marginTop: 8 }}
          />

          {fotoCapa && (
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Selecionada: <strong>{fotoCapa.name}</strong>
            </p>
          )}

          {fotoPreviewUrl && (
            <img
              src={fotoPreviewUrl}
              alt="Preview da capa"
              style={{ marginTop: 10, width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8 }}
            />
          )}
        </div>

        <button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
