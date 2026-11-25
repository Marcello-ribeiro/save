import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <p>SaveVault {__APP_VERSION__}</p>
  </StrictMode>
);
