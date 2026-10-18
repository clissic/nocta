import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors, spacing } from "../theme/tokens";

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
const BASE_URL =
  process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL?.trim() || "http://localhost";

export function turnstileEnabled() {
  return /^0x[A-Za-z0-9_-]+$/.test(SITE_KEY);
}

function widgetHtml(siteKey: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, #widget { margin: 0; padding: 0; width: 100%; background: ${colors.canvas}; }
    </style>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
  </head>
  <body>
    <div id="widget"></div>
    <script>
      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      function mount() {
        if (!window.turnstile) {
          setTimeout(mount, 40);
          return;
        }
        window.turnstile.render("#widget", {
          sitekey: "${siteKey}",
          theme: "dark",
          size: "normal",
          appearance: "always",
          callback: function (token) { post({ token: token }); },
          "expired-callback": function () { post({ failed: true }); },
          "error-callback": function () { post({ failed: true }); }
        });
      }
      mount();
    </script>
  </body>
</html>`;
}

type Props = {
  resetKey: number;
  onToken: (token: string) => void;
  onError?: () => void;
};

export function TurnstileField({ resetKey, onToken, onError }: Props) {
  const html = useMemo(() => widgetHtml(SITE_KEY), []);
  if (!turnstileEnabled()) return null;

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        token?: unknown;
        failed?: unknown;
      };
      if (typeof data.token === "string" && data.token) onToken(data.token);
      if (data.failed === true) onError?.();
    } catch {
      onError?.();
    }
  }

  return (
    <View style={styles.host}>
      <WebView
        key={resetKey}
        originWhitelist={["*"]}
        source={{ html, baseUrl: BASE_URL }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 300,
    maxWidth: "100%",
    alignSelf: "center",
    height: 65,
    marginVertical: spacing.md,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  web: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
