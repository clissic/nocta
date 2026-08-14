/** Plantillas HTML dark estilo Nocta (fondo #0a0a0b, acento #d6ff4b). */

const COLORS = {
  bg: "#0a0a0b",
  panel: "#121214",
  panelAlt: "#18181b",
  border: "rgba(242,240,235,0.10)",
  text: "#f2f0eb",
  muted: "rgba(242,240,235,0.65)",
  muted2: "rgba(242,240,235,0.45)",
  primary: "#d6ff4b",
  primarySoft: "rgba(214,255,75,0.14)",
  ink: "#111111",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:${COLORS.primary};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;text-align:center;background:linear-gradient(180deg, ${COLORS.primarySoft} 0%, ${COLORS.panel} 70%);">
              <div style="font-size:32px;font-weight:800;letter-spacing:-0.04em;line-height:1;">
                Noc<span style="color:${COLORS.primary};">ta</span>
              </div>
              <p style="margin:10px 0 0;color:${COLORS.muted};font-size:13px;letter-spacing:0.01em;">
                Salí. Publicate. Matcheá.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${COLORS.border};text-align:center;color:${COLORS.muted2};font-size:12px;line-height:1.5;">
              Si no pediste este mail, podés ignorarlo.<br/>
              © Nocta
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:22px;padding:13px 24px;background:${COLORS.primary};color:${COLORS.ink};text-decoration:none;font-weight:700;border-radius:999px;font-size:14px;letter-spacing:-0.01em;">${escapeHtml(label)}</a>`;
}

export function verificationEmailHtml(opts: {
  name?: string;
  code: string;
  ttlMinutes: number;
}): string {
  const greet = opts.name ? `Hola ${escapeHtml(opts.name)}` : "Hola";
  const digits = opts.code
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 4px;">
          <div style="min-width:36px;padding:12px 0;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;font-size:22px;font-weight:700;color:${COLORS.primary};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;">
            ${escapeHtml(d)}
          </div>
        </td>`
    )
    .join("");

  return layout(
    "Confirmá tu email — Nocta",
    `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;letter-spacing:-0.03em;color:${COLORS.text};">Confirmá tu email</h1>
    <p style="margin:0;color:${COLORS.muted};font-size:15px;line-height:1.55;">
      ${greet}, gracias por unirte a Nocta. Ingresá este código en la app para verificar tu cuenta. Válido por <strong style="color:${COLORS.text};">${opts.ttlMinutes} minutos</strong>.
    </p>
    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:28px auto 10px;">
      <tr>${digits}</tr>
    </table>
    <p style="margin:14px 0 0;text-align:center;color:${COLORS.muted2};font-size:12px;">
      Código · <span style="color:${COLORS.primary};letter-spacing:0.28em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:700;">${escapeHtml(opts.code)}</span>
    </p>
    `
  );
}

export function passwordResetEmailHtml(opts: {
  name?: string;
  resetUrl: string;
}): string {
  const greet = opts.name ? `Hola ${escapeHtml(opts.name)}` : "Hola";
  return layout(
    "Restablecer contraseña — Nocta",
    `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;letter-spacing:-0.03em;color:${COLORS.text};">Restablecer contraseña</h1>
    <p style="margin:0;color:${COLORS.muted};font-size:15px;line-height:1.55;">
      ${greet}, recibimos un pedido para cambiar tu contraseña. El link expira en 1 hora.
    </p>
    <div style="text-align:center;">${ctaButton(opts.resetUrl, "Elegir nueva contraseña")}</div>
    <p style="margin:22px 0 0;color:${COLORS.muted2};font-size:12px;line-height:1.5;word-break:break-all;">
      O copiá este link:<br/>
      <a href="${escapeHtml(opts.resetUrl)}" style="color:${COLORS.primary};text-decoration:none;">${escapeHtml(opts.resetUrl)}</a>
    </p>
    `
  );
}
