import { BrowserRouter, Routes, Route } from "react-router-dom";
import TermsGate from "./components/TermsGate";

import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";



export default function App() {
  return (
    <BrowserRouter>
      <TermsGate>
        <>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />

            <Route path="*" element={<div>Rota não encontrada</div>} />
          </Routes>

        </>
      </TermsGate>
    </BrowserRouter>
  );
}