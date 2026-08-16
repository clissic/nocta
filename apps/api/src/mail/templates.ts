/** Plantillas HTML dark estilo Nocta (fondo #0a0a0b, acento #d6ff4b). */

const COLORS = {
  bg: "#0a0a0b",
  panel: "#111113",
  panelAlt: "#18181b",
  border: "#303034",
  text: "#f2f0eb",
  muted: "#aaa8aa",
  muted2: "#817f82",
  primary: "#d6ff4b",
  primarySoft: "#202816",
  ink: "#111111",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(
  title: string,
  bodyHtml: string,
  footerHtml = "Si no pediste este mail, podés ignorarlo.<br/>© Nocta"
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${escapeHtml(title)}</title>
  <style>
    @media only screen and (max-width: 520px) {
      .email-header { padding: 36px 20px 14px !important; }
      .email-content { padding: 18px 20px 30px !important; }
      .email-footer { padding: 22px 20px 26px !important; }
      .email-title { font-size: 25px !important; }
      .email-copy { font-size: 16px !important; }
      .digit-cell { padding: 0 3px !important; }
      .digit-box { width: 36px !important; padding: 14px 0 !important; font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:22px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:650px;background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:22px;overflow:hidden;">
          <tr>
            <td style="height:10px;background:${COLORS.primary};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:46px 36px 16px;text-align:center;background:${COLORS.panel};background-image:linear-gradient(180deg, ${COLORS.primarySoft} 0%, ${COLORS.panel} 72%);">
              <div style="font-size:40px;font-weight:800;letter-spacing:-0.05em;line-height:1;">
                Noc<span style="color:${COLORS.primary};">ta</span>
              </div>
              <p style="margin:14px 0 0;color:${COLORS.muted};font-size:15px;letter-spacing:0.01em;">
                Salí. Publicate. Matcheá.
              </p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:20px 36px 36px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:26px 36px 32px;border-top:1px solid ${COLORS.border};text-align:center;color:${COLORS.muted2};font-size:14px;line-height:1.55;">
              ${footerHtml}
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
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:28px;padding:15px 28px;background:${COLORS.primary};color:${COLORS.ink};text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;letter-spacing:-0.01em;">${escapeHtml(label)}</a>`;
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
        `<td class="digit-cell" style="padding:0 5px;">
          <div class="digit-box" style="width:46px;padding:18px 0;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:12px;font-size:26px;font-weight:700;color:${COLORS.primary};font-family:Consolas,'Courier New',monospace;text-align:center;">
            ${escapeHtml(d)}
          </div>
        </td>`
    )
    .join("");

  return layout(
    "Confirmá tu email — Nocta",
    `
    <h1 class="email-title" style="margin:0 0 20px;font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${COLORS.text};">Confirmá tu email</h1>
    <p class="email-copy" style="margin:0;color:${COLORS.muted};font-size:18px;line-height:1.55;">
      ${greet}, gracias por unirte a Nocta. Ingresá este código en la app para verificar tu cuenta. Válido por <strong style="color:${COLORS.text};">${opts.ttlMinutes} minutos</strong>.
    </p>
    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:36px auto 12px;">
      <tr>${digits}</tr>
    </table>
    <p style="margin:18px 0 0;text-align:center;color:${COLORS.muted2};font-size:14px;">
      Código · <span style="color:${COLORS.primary};letter-spacing:0.25em;font-family:Consolas,'Courier New',monospace;font-weight:700;">${escapeHtml(opts.code)}</span>
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
    <h1 class="email-title" style="margin:0 0 20px;font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${COLORS.text};">Restablecer contraseña</h1>
    <p class="email-copy" style="margin:0;color:${COLORS.muted};font-size:18px;line-height:1.55;">
      ${greet}, recibimos un pedido para cambiar tu contraseña. El link expira en 1 hora.
    </p>
    <div style="text-align:center;">${ctaButton(opts.resetUrl, "Elegir nueva contraseña")}</div>
    <p style="margin:28px 0 0;color:${COLORS.muted2};font-size:13px;line-height:1.55;word-break:break-all;">
      O copiá este link:<br/>
      <a href="${escapeHtml(opts.resetUrl)}" style="color:${COLORS.primary};text-decoration:none;">${escapeHtml(opts.resetUrl)}</a>
    </p>
    `
  );
}

export function venueRequestNotificationHtml(opts: {
  requestId: string;
  venueName: string;
  venueType: string;
  address: string;
  city: string;
  geocodedAddress?: string;
  description?: string;
  requesterName?: string;
  requesterEmail: string;
  contactEmail?: string;
  contactPhone?: string;
  adminUrl: string;
  hasPhoto: boolean;
}): string {
  const row = (label: string, value?: string) =>
    value
      ? `<tr>
          <td style="padding:9px 12px;color:${COLORS.muted};font-size:13px;border-bottom:1px solid ${COLORS.border};vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:9px 12px;color:${COLORS.text};font-size:14px;border-bottom:1px solid ${COLORS.border};vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`
      : "";

  const requester = [
    opts.requesterName,
    opts.requesterEmail,
  ].filter(Boolean).join(" · ");

  return layout(
    `Nueva solicitud de Espacio — ${opts.venueName}`,
    `
    <p style="margin:0 0 10px;color:${COLORS.primary};font-size:13px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Nueva solicitud</p>
    <h1 class="email-title" style="margin:0 0 16px;font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${COLORS.text};">${escapeHtml(opts.venueName)}</h1>
    <p class="email-copy" style="margin:0 0 24px;color:${COLORS.muted};font-size:17px;line-height:1.55;">
      Hay un nuevo Espacio esperando revisión. Los datos ya quedaron guardados en Nocta.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;background:${COLORS.panelAlt};">
      ${row("Tipo", opts.venueType)}
      ${row("Dirección para mostrar", opts.address)}
      ${row("Ciudad", opts.city)}
      ${row("Dirección detectada", opts.geocodedAddress)}
      ${row("Descripción", opts.description)}
      ${row("Solicitante", requester)}
      ${row("Email de contacto", opts.contactEmail)}
      ${row("Teléfono", opts.contactPhone)}
      ${row("Foto", opts.hasPhoto ? "Incluida como archivo adjunto" : "Sin foto")}
      ${row("ID", opts.requestId)}
    </table>

    <div style="text-align:center;">${ctaButton(opts.adminUrl, "Revisar y autorizar Espacio")}</div>
    <p style="margin:24px 0 0;text-align:center;color:${COLORS.muted2};font-size:13px;line-height:1.5;">
      El enlace requiere iniciar sesión con un perfil administrador.
    </p>
    `,
    `Notificación interna para administradores de Nocta.<br/>© Nocta`
  );
}

export function venueRequestRejectedHtml(opts: {
  venueName: string;
  venueType: string;
  city: string;
  requesterName?: string;
  adminNote?: string;
  profileUrl: string;
}): string {
  const greet = opts.requesterName
    ? `Hola ${escapeHtml(opts.requesterName)}`
    : "Hola";
  const noteBlock = opts.adminNote?.trim()
    ? `
    <p style="margin:0 0 10px;color:${COLORS.muted};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Motivo del rechazo</p>
    <div style="margin:0 0 24px;padding:16px 18px;border:1px solid ${COLORS.border};border-radius:12px;background:${COLORS.panelAlt};color:${COLORS.text};font-size:16px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(opts.adminNote.trim())}</div>
    `
    : `
    <p class="email-copy" style="margin:0 0 24px;color:${COLORS.muted};font-size:17px;line-height:1.55;">
      El equipo no dejó un comentario adicional. Si querés más detalles, respondé este mail o enviá una nueva solicitud con más información.
    </p>
    `;

  return layout(
    `Solicitud de Espacio rechazada — ${opts.venueName}`,
    `
    <p style="margin:0 0 10px;color:${COLORS.primary};font-size:13px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Solicitud revisada</p>
    <h1 class="email-title" style="margin:0 0 16px;font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${COLORS.text};">No pudimos aprobar tu Espacio</h1>
    <p class="email-copy" style="margin:0 0 20px;color:${COLORS.muted};font-size:17px;line-height:1.55;">
      ${greet}, revisamos tu solicitud para <strong style="color:${COLORS.text};">${escapeHtml(opts.venueName)}</strong>
      (${escapeHtml(opts.venueType)} · ${escapeHtml(opts.city)}) y por ahora no la aprobamos.
    </p>
    ${noteBlock}
    <p class="email-copy" style="margin:0;color:${COLORS.muted};font-size:16px;line-height:1.55;">
      Podés corregir los datos y volver a enviar una solicitud desde tu perfil.
    </p>
    <div style="text-align:center;">${ctaButton(opts.profileUrl, "Ir a mi perfil")}</div>
    `,
    `Te escribimos porque enviaste una solicitud de Espacio en Nocta.<br/>© Nocta`
  );
}

export function venueRequestApprovedHtml(opts: {
  venueName: string;
  venueType: string;
  city: string;
  address: string;
  requesterName?: string;
  adminNote?: string;
  venueUrl: string;
}): string {
  const greet = opts.requesterName
    ? `Hola ${escapeHtml(opts.requesterName)}`
    : "Hola";
  const noteBlock = opts.adminNote?.trim()
    ? `
    <p style="margin:0 0 10px;color:${COLORS.muted};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Nota del equipo</p>
    <div style="margin:0 0 24px;padding:16px 18px;border:1px solid ${COLORS.border};border-radius:12px;background:${COLORS.panelAlt};color:${COLORS.text};font-size:16px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(opts.adminNote.trim())}</div>
    `
    : "";

  return layout(
    `Tu Espacio fue autorizado — ${opts.venueName}`,
    `
    <p style="margin:0 0 10px;color:${COLORS.primary};font-size:13px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Solicitud aprobada</p>
    <h1 class="email-title" style="margin:0 0 16px;font-size:29px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${COLORS.text};">¡Tu Espacio ya está en Nocta!</h1>
    <p class="email-copy" style="margin:0 0 20px;color:${COLORS.muted};font-size:17px;line-height:1.55;">
      ${greet}, autorizamos <strong style="color:${COLORS.text};">${escapeHtml(opts.venueName)}</strong>
      (${escapeHtml(opts.venueType)} · ${escapeHtml(opts.city)}). Ya figurás como organizador y el espacio quedó publicado.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;background:${COLORS.panelAlt};">
      <tr>
        <td style="padding:9px 12px;color:${COLORS.muted};font-size:13px;border-bottom:1px solid ${COLORS.border};vertical-align:top;">Dirección</td>
        <td style="padding:9px 12px;color:${COLORS.text};font-size:14px;border-bottom:1px solid ${COLORS.border};vertical-align:top;">${escapeHtml(opts.address)}</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;color:${COLORS.muted};font-size:13px;vertical-align:top;">Ciudad</td>
        <td style="padding:9px 12px;color:${COLORS.text};font-size:14px;vertical-align:top;">${escapeHtml(opts.city)}</td>
      </tr>
    </table>
    ${noteBlock}
    <p class="email-copy" style="margin:0;color:${COLORS.muted};font-size:16px;line-height:1.55;">
      Entrá a ver la ficha y empezá a gestionar tu Espacio.
    </p>
    <div style="text-align:center;">${ctaButton(opts.venueUrl, "Ver mi Espacio")}</div>
    `,
    `Te escribimos porque enviaste una solicitud de Espacio en Nocta.<br/>© Nocta`
  );
}
