import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AtlasPage } from "./pages/Atlas";
import { HomePage } from "./pages/Home";
import { LabsPage } from "./pages/Labs";
import { PillarsPage } from "./pages/Pillars";
import { ShipPage } from "./pages/Ship";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/atlas" element={<AtlasPage />} />
        <Route path="/pillars" element={<PillarsPage />} />
        <Route path="/ship" element={<ShipPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}