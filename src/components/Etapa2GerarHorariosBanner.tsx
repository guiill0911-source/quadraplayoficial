import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type Props = {
  onGerarMes?: () => void | Promise<void>;
  textoExtra?: string;
};

export default function Etapa2GerarHorariosBanner({ onGerarMes, textoExtra }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const isStep2 = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("step") === "2";
  }, [location.search]);

  if (!isStep2) return null;

  function ocultar() {
    const sp = new URLSearchParams(location.search);
    sp.delete("step");
    navigate(`${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`, { replace: true });
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        background: "#f6ffed",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Etapa 2: gerar horários</div>
          <div style={{ fontSize: 13, color: "#444" }}>
            Agora gere os horários para o mês (ou para os dias que quiser) para essa quadra aparecer disponível pros atletas.
          </div>
          {textoExtra ? (
            <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>{textoExtra}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {onGerarMes ? (
            <button
              onClick={onGerarMes}
              style={{ fontWeight: 800, border: "1px solid #2e7d32" }}
            >
              Gerar horários do mês
            </button>
          ) : null}

          <Link to="/dono">
            <button style={{ fontWeight: 800 }}>Concluir / Minhas quadras</button>
          </Link>

          <button onClick={ocultar} style={{ border: "1px solid #999" }}>
            Ocultar
          </button>
        </div>
      </div>
    </div>
  );
}
