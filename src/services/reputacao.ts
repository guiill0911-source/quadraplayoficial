// src/services/reputacao.ts
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export type ResumoReputacao = {
  score: number;
  nivel: "excelente" | "bom" | "regular" | "ruim";
  cancelUltimaHora: number;
  noShows: number;
  multaPendenteCentavos: number;
  suspenso: boolean;
};

function normalizarNivel(score: number, nivelRaw?: string): "excelente" | "bom" | "regular" | "ruim" {
  const nivel = String(nivelRaw ?? "").toLowerCase().trim();

  if (nivel === "excelente" || nivel === "bom" || nivel === "regular" || nivel === "ruim") {
    return nivel;
  }

  if (score >= 90) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "regular";
  return "ruim";
}

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function resumoReputacaoPadrao(): ResumoReputacao {
  return {
    score: 100,
    nivel: "excelente",
    cancelUltimaHora: 0,
    noShows: 0,
    multaPendenteCentavos: 0,
    suspenso: false,
  };
}

export function ouvirResumoReputacaoDoUsuario(
  uid: string,
  onChange: (resumo: ResumoReputacao) => void,
  onError?: (err: unknown) => void
) {
  const ref = doc(db, "users", uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(resumoReputacaoPadrao());
        return;
      }

      const data = snap.data() as any;

      const score = toNumber(data?.reputacao?.score, 100);
      const nivel = normalizarNivel(score, data?.reputacao?.nivel);

      const cancelUltimaHora = toNumber(
        data?.penalidades?.cancelamentosUltimaHora ?? data?.cancelamentosUltimaHora,
        0
      );

      const noShows = toNumber(
        data?.penalidades?.noShows ?? data?.noshowCount90d,
        0
      );

      const multaPendenteCentavos = toNumber(data?.multaPendenteCentavos, 0);

      const suspenso = Boolean(data?.suspensoAte || data?.suspensoMotivo || multaPendenteCentavos > 0);

      onChange({
        score,
        nivel,
        cancelUltimaHora,
        noShows,
        multaPendenteCentavos,
        suspenso,
      });
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}