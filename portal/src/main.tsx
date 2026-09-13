import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// A lazy-loaded chunk (e.g. the certificate PDF generator) can 404 after a
// new deploy replaces the old build's hashed files while this tab is still
// open. Reload once to pick up the current build instead of surfacing the
// fetch failure to the user.
window.addEventListener("vite:preloadError", () => {
  const reloadedKey = "portal:reloaded-after-preload-error";
  if (sessionStorage.getItem(reloadedKey)) return;
  sessionStorage.setItem(reloadedKey, "1");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
