import { sentryEnabled } from "./instrument";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastProvider";
import App from "./App";
import "./theme.css";

function AppErrorFallback() {
  return (
    <div className="app-shell">
      <div className="app-frame d-flex align-items-center justify-content-center p-4">
        <div className="text-center">
          <h1 className="h4 mb-3">Algo salió mal</h1>
          <p className="text-body-secondary mb-4">
            Recargá la página para seguir. Si el problema continúa, probá de
            nuevo en un rato.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}

const rootOptions = sentryEnabled
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : undefined;

createRoot(document.getElementById("root")!, rootOptions).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
