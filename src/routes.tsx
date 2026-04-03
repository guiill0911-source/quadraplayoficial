import { Routes, Route, Navigate } from "react-router-dom";
import EmBreve from "./pages/EmBreve";
import Home from "./pages/Home";
import EmailVerificado from "./pages/EmailVerificado";
import NovaQuadra from "./pages/NovaQuadra";
import Quadra from "./pages/Quadra";
import Perfil from "./pages/Perfil";
import PagamentoPix from "./pages/PagamentoPix";

import DonoHome from "./pages/dono/DonoHome";
import DonoReservasQuadra from "./pages/dono/DonoReservasQuadra";
import EditarQuadra from "./pages/dono/EditarQuadra";
import GerenciarHorariosMes from "./pages/dono/GerenciarHorariosMes";
import CentralProprietario from "./pages/dono/CentralProprietario";
import DonoFinanceiro from "./pages/dono/DonoFinanceiro";

import MinhasReservas from "./pages/MinhasReservas";
import AvaliarReserva from "./pages/AvaliarReserva";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";

import Termos from "./pages/Termos";
import PoliticaCancelamento from "./pages/PoliticaCancelamento";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import QuemSomos from "./pages/QuemSomos";
import PagamentosRegras from "./pages/PagamentosRegras";
import AceiteTermos from "./pages/AceiteTermos";

import RequireAuth from "./services/RequireAuth";
import RequireRole from "./services/RequireRole";
import RequireTerms from "./services/RequireTerms";
import HorariosDoDia from "./pages/dono/HorariosDoDia";

// CEO
import CeoQuadras from "./pages/ceo/CeoQuadras";
import CeoFinanceiro from "./pages/ceo/CeoFinanceiro";
import CeoDashboard from "./pages/ceo/CeoDashboard";

function WhatsAppButton() {
  const numero = "5551999999999";
  const mensagem = encodeURIComponent(
    "Olá! Vim pelo Quadra Play e preciso de ajuda."
  );

  const link = `https://wa.me/${numero}?text=${mensagem}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        border: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          display: "block",
          flexShrink: 0,
        }}
      >
        <path
          fill="#25D366"
          d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.62 2 2.21 6.4 2.21 11.82c0 1.73.45 3.42 1.31 4.91L2 22l5.42-1.49a9.8 9.8 0 0 0 4.61 1.17h.01c5.41 0 9.82-4.4 9.82-9.82 0-2.62-1.02-5.08-2.81-6.95Zm-7.02 15.1h-.01a8.15 8.15 0 0 1-4.14-1.13l-.3-.18-3.22.89.86-3.14-.2-.32a8.16 8.16 0 0 1-1.25-4.31c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.22.84 5.76 2.39a8.1 8.1 0 0 1 2.39 5.77c0 4.5-3.66 8.17-8.16 8.17Zm4.48-6.11c-.25-.13-1.47-.73-1.7-.82-.23-.08-.39-.13-.56.13-.16.25-.64.82-.78.98-.14.16-.29.18-.54.06-.25-.13-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.16 1.72 2.62 4.16 3.67.58.25 1.03.39 1.38.5.58.18 1.1.15 1.52.09.46-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z"
        />
      </svg>
    </a>
  );
}

export default function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/email-verificado" element={<EmailVerificado />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/politica-cancelamento" element={<PoliticaCancelamento />} />
        <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/quem-somos" element={<QuemSomos />} />
        <Route path="/pagamentos-e-regras" element={<PagamentosRegras />} />

        <Route
          path="/aceite-termos"
          element={
            <RequireAuth>
              <AceiteTermos />
            </RequireAuth>
          }
        />

    <Route path="/" element={<Home />} />
    <Route path="/home" element={<Home />} />

        <Route
          path="/quadra/:id"
          element={
            <RequireAuth>
              <RequireTerms>
                <Quadra />
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/pagamento/pix"
          element={
            <RequireAuth>
              <RequireTerms>
                <PagamentoPix />
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/perfil"
          element={
            <RequireAuth>
              <RequireTerms>
                <Perfil />
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/minhas-reservas"
          element={
            <RequireAuth>
              <RequireTerms>
                <MinhasReservas />
              </RequireTerms>
            </RequireAuth>
          }
        />
        <Route
  path="/dono/reservas"
  element={
    <RequireAuth>
      <RequireTerms>
        <RequireRole role="dono">
          <MinhasReservas />
        </RequireRole>
      </RequireTerms>
    </RequireAuth>
  }
/>

        <Route
          path="/atleta/avaliar"
          element={
            <RequireAuth>
              <RequireTerms>
                <AvaliarReserva />
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono/central"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <CentralProprietario />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/nova-quadra"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <NovaQuadra />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <DonoHome />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono/financeiro"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <DonoFinanceiro />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono/quadra/:id/reservas"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <DonoReservasQuadra />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono/quadra/:id/editar"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <EditarQuadra />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/dono/quadra/:id/horarios"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="dono">
                  <GerenciarHorariosMes />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
  path="/dono/quadra/:id/horarios-dia/:data"
  element={
    <RequireAuth>
      <RequireTerms>
        <RequireRole role="dono">
          <HorariosDoDia />
        </RequireRole>
      </RequireTerms>
    </RequireAuth>
  }
/>

        <Route
          path="/ceo/financeiro"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="ceo">
                  <CeoFinanceiro />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/ceo"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="ceo">
                  <CeoDashboard />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route
          path="/ceo/quadras"
          element={
            <RequireAuth>
              <RequireTerms>
                <RequireRole role="ceo">
                  <CeoQuadras />
                </RequireRole>
              </RequireTerms>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
<WhatsAppButton />
    </>
  );
}