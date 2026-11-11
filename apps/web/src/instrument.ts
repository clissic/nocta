import * as Sentry from "@sentry/react";

function tracesSampleRate(): number {
  const raw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw === "") return 0.1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0.1;
}

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";

/** true cuando hay DSN y Sentry quedó inicializado. */
export const sentryEnabled = Boolean(dsn);

if (sentryEnabled && !Sentry.getClient()) {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    tracesSampleRate: tracesSampleRate(),
    // v11 reemplazó sendDefaultPii por dataCollection. Conservador: sin PII por defecto.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
    },
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [/^\//, ...(apiUrl ? [apiUrl] : [])],
  });
}
