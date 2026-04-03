import { useEffect, useState } from "react";
import {
  formatDateTimeBR,
  isSuspensoAgora,
  listenUserStatus,
} from "../services/userStatus";

import type { UserStatus } from "../services/userStatus";

export default function SuspensaoBanner() {
  const [st, setSt] = useState<UserStatus | null>(null);

  useEffect(() => {
    const unsub = listenUserStatus(setSt);
    return () => unsub();
  }, []);

  if (!st) return null;

  const suspenso = isSuspensoAgora(st);
  const multa = Number(st.multaPendenteCentavos ?? 0) > 0;

  if (!suspenso && !multa) return null;

  return (
    <div
      style={{
        margin: "10px 16px 0",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #ffd0d0",
        background: "#ffecec",
        color: "#7a0000",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {suspenso ? (
        <>
          <strong>🚫 Conta suspensa</strong>
          <span>
            até <strong>{formatDateTimeBR(st.suspensoAteMs!)}</strong>
            {st.suspensoMotivo ? ` — Motivo: ${st.suspensoMotivo}` : ""}
          </span>
        </>
      ) : (
        <>
          <strong>⚠️ Multa pendente</strong>
          <span>Você tem multa pendente. (Aviso — ainda não bloqueia reserva)</span>
        </>
      )}
    </div>
  );
}