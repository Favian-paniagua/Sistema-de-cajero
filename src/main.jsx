import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Pide al navegador no borrar los datos guardados (IndexedDB) cuando falte espacio
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
