// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "react-day-picker/dist/style.css"; // ← 先に読み込む
import "./index.css";                     // ← 上書きは後

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
