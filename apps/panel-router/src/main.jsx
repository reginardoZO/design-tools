import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MVPanelLoadRouter from "../mv-panel-load-router.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MVPanelLoadRouter />
  </StrictMode>,
);