import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      size: "normal";
      appearance: "always";
      retry: "never";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (errorCode?: number) => boolean;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileEnabled() {
  return Boolean(SITE_KEY);
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

type Props = {
  resetKey: number;
  onToken: (token: string) => void;
  onError?: () => void;
};

export function TurnstileField({ resetKey, onToken, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!SITE_KEY) return;
    const host = hostRef.current;
    if (!host) return;
    let widgetId = "";
    let cancelled = false;

    void loadTurnstile()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(hostRef.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          size: "normal",
          appearance: "always",
          retry: "never",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => {
            if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
          },
          "error-callback": () => {
            onErrorRef.current?.();
            return true;
          },
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={hostRef} className="turnstile-field is-screen" />;
}
