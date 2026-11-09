import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AvisosProvider } from "./components/Avisos";
import Caja from "./pages/Caja";
import Productos from "./pages/Productos";
import Respaldo from "./pages/Respaldo";

// Los gráficos (Recharts) se cargan solo al abrir el Dashboard
const Dashboard = lazy(() => import("./pages/Dashboard"));

const SECCIONES = [
  { ruta: "/caja", nombre: "Caja", icono: "🧾" },
  { ruta: "/productos", nombre: "Productos", icono: "📦" },
  { ruta: "/dashboard", nombre: "Dashboard", icono: "📊" },
  { ruta: "/respaldo", nombre: "Respaldo", icono: "💾" },
];

function Layout() {
  // El carrito vive aquí para no perderse al cambiar de pantalla
  const [carrito, setCarrito] = useState([]);
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.toggle("v-caja", pathname === "/caja");
  }, [pathname]);

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand"><span className="brand-dot">▦</span>Mi Caja</div>
          <nav className="tabs" aria-label="Secciones">
            {SECCIONES.map((s) => <NavLink key={s.ruta} to={s.ruta}>{s.nombre}</NavLink>)}
          </nav>
          <div className="conn ok"><i /><span>Guardado en este dispositivo</span></div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/caja" element={<Caja carrito={carrito} setCarrito={setCarrito} />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/dashboard" element={<Suspense fallback={<div className="empty">Cargando…</div>}><Dashboard /></Suspense>} />
          <Route path="/respaldo" element={<Respaldo />} />
          <Route path="*" element={<Navigate to="/caja" replace />} />
        </Routes>
      </main>
      <nav className="bottom" aria-label="Secciones">
        {SECCIONES.map((s) => <NavLink key={s.ruta} to={s.ruta}><span className="i">{s.icono}</span>{s.nombre}</NavLink>)}
      </nav>
    </>
  );
}

export default function App() {
  return (
    <AvisosProvider>
      <HashRouter>
        <Layout />
      </HashRouter>
    </AvisosProvider>
  );
}
