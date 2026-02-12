import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>App abriu corretamente ✅</div>} />
        <Route path="*" element={<div>Rota não encontrada</div>} />
      </Routes>
    </BrowserRouter>
  );
}
