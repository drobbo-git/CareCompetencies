import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Normalize share-link path before React Router.
// Pattern: "/<id>/index.html" -> "/<id>/"
// Reason: Router basename uses window.location.pathname and must point to the directory root.
// Runs before first render; uses history.replaceState (no network redirect).
if (window.location.pathname.endsWith('/index.html')) {
  const newPath = window.location.pathname.replace('/index.html', '/');
  window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);