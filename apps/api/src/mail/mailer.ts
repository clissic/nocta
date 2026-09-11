import nodemailer, { type Transporter } from "nodemailer";
import { existsSync, readFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { join } from "node:path";
import { Resend } from "resend";
import { VENUE_TYPE_LABELS, type VenueType } from "@nocta/shared";
import { config } from "../config.js";
import { UPLOADS_DIR } from "../uploads/paths.js";
import { safeUploadBasename } from "../uploads/validate.js";
import {
  passwordResetEmailHtml,
  accountSuspendedEmailHtml,
  reportResolutionEmailHtml,
  verificationEmailHtml,
  venueRequestApprovedHtml,
  venueRequestNotificationHtml,
  venueRequestRejectedHtml,
  identityVerificationSubmittedHtml,
  identityVerificationApprovedHtml,
  identityVerificationRejectedHtml,
} from "./templates.js";

let transporter: Transporter | null = null;
let transporterReady: Promise<Transporter> | null = null;
let resendClient: Resend | null = null;

function hasResend() {
  return Boolean(config.mail.resendApiKey);
}

function hasSmtp() {
  return Boolean(config.mail.host && config.mail.user && config.mail.pass);
}

function hasMailTransport() {
  return useResend() || useSmtp();
}

/** Resend solo si hay key y el modo no fuerza SMTP. */
function useResend() {
  if (!hasResend()) return false;
  if (config.mail.transport === "smtp") return false;
  if (config.mail.transport === "resend") return true;
  // auto: Resend gana si hay key
  return true;
}

function useSmtp() {
  if (!hasSmtp()) return false;
  if (config.mail.transport === "resend") return false;
  if (config.mail.transport === "smtp") return true;
  return !hasResend();
}

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(config.mail.resendApiKey);
  }
  return resendClient;
}

async function buildSmtpTransporter(): Promise<Transporter> {
  const hostName = config.mail.host;
  const port = config.mail.port;
  // Forzar A-record IPv4: Node/Railway a menudo eligen AAAA → ENETUNREACH.
  let connectHost = hostName;
  try {
    const { address } = await lookup(hostName, { family: 4 });
    connectHost = address;
    console.log(`[mail] SMTP DNS IPv4 ${hostName} → ${address}`);
  } catch (err) {
    console.warn(
      `[mail] no se pudo resolver IPv4 de ${hostName}, uso hostname:`,
      err instanceof Error ? err.message : err
    );
  }

  return nodemailer.createTransport({
    host: connectHost,
    port,
    secure: port === 465,
    name: hostName,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
    tls: {
      servername: hostName,
      minVersion: "TLSv1.2",
    },
    ...(port === 587 ? { requireTLS: true } : {}),
  } as nodemailer.TransportOptions);
}

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;
  if (!transporterReady) {
    transporterReady = buildSmtpTransporter().then((t) => {
      transporter = t;
      return t;
    });
  }
  return transporterReady;
}

type MailAttachment = {
  filename: string;
  path: string;
};

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  const attachments = opts.attachments?.map((item) => ({
    filename: item.filename,
    content: readFileSync(item.path),
  }));

  const { data, error } = await getResend().emails.send({
    from: config.mail.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments,
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }

  console.log(`[mail] enviado (resend) a ${opts.to} id=${data?.id ?? "?"}`);
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: config.mail.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });

  console.log(`[mail] enviado (smtp) a ${opts.to} messageId=${info.messageId}`);
}

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  if (!hasMailTransport() || config.mail.devLog) {
    console.log("\n========== MAIL (dev) ==========");
    console.log(`To: ${opts.to}`);
    console.log(`Subject: ${opts.subject}`);
    if (opts.attachments?.length) {
      console.log(
        `Attachments: ${opts.attachments.map((item) => item.filename).join(", ")}`
      );
    }
    console.log(opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    console.log("================================\n");
  }

  if (!hasMailTransport()) {
    console.warn(
      "[mail] sin transporte — mail no enviado (configurá SMTP_* o RESEND_API_KEY)"
    );
    return;
  }

  if (useResend()) {
    await sendViaResend(opts);
    return;
  }

  await sendViaSmtp(opts);
}

export async function sendVerificationEmail(opts: {
  to: string;
  name?: string;
  code: string;
  ttlMinutes: number;
}) {
  await sendMail({
    to: opts.to,
    subject: `Tu código Nocta: ${opts.code}`,
    html: verificationEmailHtml({
      name: opts.name,
      code: opts.code,
      ttlMinutes: opts.ttlMinutes,
    }),
  });
  if (!hasMailTransport() || config.mail.devLog) {
    console.log(`[mail] código verificación ${opts.to}: ${opts.code}`);
  }
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name?: string;
  token: string;
  ttlMinutes?: number;
}) {
  const resetUrl = `${config.clientOrigin}/auth/reset-password?token=${encodeURIComponent(opts.token)}`;
  await sendMail({
    to: opts.to,
    subject: "Restablecer contraseña — Nocta",
    html: passwordResetEmailHtml({
      name: opts.name,
      resetUrl,
      ttlMinutes: opts.ttlMinutes,
    }),
  });
  return resetUrl;
}

export async function sendReportResolutionEmail(opts: {
  to: string;
  reporterName?: string;
  reportId: string;
  action: "dismiss" | "suspend";
  resolutionReason: string;
}) {
  await sendMail({
    to: opts.to,
    subject: "Resultado de tu denuncia — Nocta",
    html: reportResolutionEmailHtml(opts),
  });
}

export async function sendAccountSuspendedEmail(opts: {
  to: string;
  userName?: string;
  suspendedAt: string;
  suspendedUntil?: string;
  durationLabel: string;
  resolutionReason: string;
}) {
  await sendMail({
    to: opts.to,
    subject: "Tu cuenta fue suspendida — Nocta",
    html: accountSuspendedEmailHtml(opts),
  });
}

function localPhotoAttachment(photoUrl?: string) {
  if (!photoUrl) return null;
  const filename = safeUploadBasename(photoUrl);
  if (!filename) return null;
  const path = join(UPLOADS_DIR, filename);
  if (!existsSync(path)) return null;
  return { filename, path };
}

export async function sendVenueRequestNotificationEmail(opts: {
  request: {
    requestType?: "create" | "claim";
    wantsToManage?: boolean;
    id: string;
    name: string;
    type: VenueType;
    address: string;
    city: string;
    geocodedAddress?: string;
    description?: string;
    managementMessage?: string;
    contactEmail?: string;
    contactPhone?: string;
    photoUrl?: string;
    evidenceCount?: number;
  };
  requester: {
    email: string;
    name?: string;
  };
}) {
  const adminUrl = `${config.clientOrigin}/admin/venue-requests/${encodeURIComponent(
    opts.request.id
  )}`;
  const attachment = localPhotoAttachment(opts.request.photoUrl);
  const requestLabel =
    opts.request.requestType === "claim"
      ? "Nueva reclamación"
      : opts.request.wantsToManage === false
        ? "Nueva sugerencia de Espacio"
        : "Nueva solicitud de administración";

  await sendMail({
    to: config.mail.notifyTo,
    subject: `${requestLabel}: ${opts.request.name}`,
    html: venueRequestNotificationHtml({
      requestType: opts.request.requestType,
      wantsToManage: opts.request.wantsToManage,
      requestId: opts.request.id,
      venueName: opts.request.name,
      venueType: VENUE_TYPE_LABELS[opts.request.type],
      address: opts.request.address,
      city: opts.request.city,
      geocodedAddress: opts.request.geocodedAddress,
      description: opts.request.description,
      managementMessage: opts.request.managementMessage,
      requesterName: opts.requester.name,
      requesterEmail: opts.requester.email,
      contactEmail: opts.request.contactEmail,
      contactPhone: opts.request.contactPhone,
      adminUrl,
      hasPhoto: Boolean(attachment),
      evidenceCount: opts.request.evidenceCount,
    }),
    attachments: attachment ? [attachment] : undefined,
  });

  return adminUrl;
}

export async function sendVenueRequestRejectedEmail(opts: {
  requestType?: "create" | "claim";
  wantsToManage?: boolean;
  to: string;
  requesterName?: string;
  venueName: string;
  venueType: VenueType;
  city: string;
  adminNote?: string;
}) {
  const profileUrl = `${config.clientOrigin}/profile`;
  await sendMail({
    to: opts.to,
    subject: `${
      opts.requestType === "claim"
        ? "Tu reclamación fue rechazada"
        : opts.wantsToManage === false
          ? "Tu sugerencia de Espacio fue rechazada"
          : "Tu solicitud de Espacio fue rechazada"
    } — ${opts.venueName}`,
    html: venueRequestRejectedHtml({
      requestType: opts.requestType,
      wantsToManage: opts.wantsToManage,
      venueName: opts.venueName,
      venueType: VENUE_TYPE_LABELS[opts.venueType],
      city: opts.city,
      requesterName: opts.requesterName,
      adminNote: opts.adminNote,
      profileUrl,
    }),
  });
}

export async function sendVenueRequestApprovedEmail(opts: {
  requestType?: "create" | "claim";
  wantsToManage?: boolean;
  to: string;
  requesterName?: string;
  venueId: string;
  venueName: string;
  venueType: VenueType;
  city: string;
  address: string;
  adminNote?: string;
}) {
  const canManage =
    opts.requestType === "claim" || opts.wantsToManage !== false;
  const venueUrl = `${config.clientOrigin}/venues/${encodeURIComponent(
    opts.venueId
  )}${canManage ? "/manage" : ""}`;
  await sendMail({
    to: opts.to,
    subject: `${
      opts.requestType === "claim" || opts.wantsToManage !== false
        ? "Administración autorizada"
        : "Tu sugerencia fue aprobada"
    } — ${opts.venueName}`,
    html: venueRequestApprovedHtml({
      requestType: opts.requestType,
      wantsToManage: opts.wantsToManage,
      venueName: opts.venueName,
      venueType: VENUE_TYPE_LABELS[opts.venueType],
      city: opts.city,
      address: opts.address,
      requesterName: opts.requesterName,
      adminNote: opts.adminNote,
      venueUrl,
    }),
  });
}

export async function sendIdentityVerificationSubmittedEmail(opts: {
  userId: string;
  email: string;
  name?: string;
}) {
  const adminUrl = `${config.clientOrigin}/admin/verifications`;
  await sendMail({
    to: config.mail.notifyTo,
    subject: `Nueva verificación de identidad: ${opts.name || opts.email}`,
    html: identityVerificationSubmittedHtml({
      userName: opts.name,
      userEmail: opts.email,
      userId: opts.userId,
      adminUrl,
    }),
  });
  return adminUrl;
}

export async function sendIdentityVerificationApprovedEmail(opts: {
  to: string;
  name?: string;
}) {
  const profileUrl = `${config.clientOrigin}/profile`;
  await sendMail({
    to: opts.to,
    subject: "Tu cuenta fue verificada — Nocta",
    html: identityVerificationApprovedHtml({
      name: opts.name,
      profileUrl,
    }),
  });
}

export async function sendIdentityVerificationRejectedEmail(opts: {
  to: string;
  name?: string;
  reason: string;
}) {
  const profileUrl = `${config.clientOrigin}/profile`;
  await sendMail({
    to: opts.to,
    subject: "Verificación no aprobada — Nocta",
    html: identityVerificationRejectedHtml({
      name: opts.name,
      reason: opts.reason,
      profileUrl,
    }),
  });
}

/** Verifica transporte de mail al boot (no aborta si falla). */
export async function verifyMailTransport() {
  if (useResend()) {
    console.log(
      `[mail] usando Resend (MAIL_TRANSPORT=${config.mail.transport})`
    );
    return;
  }
  if (!useSmtp()) {
    console.log(
      "[mail] sin transporte — modo consola (SMTP_* / RESEND_API_KEY / MAIL_DEV_LOG)"
    );
    return;
  }
  try {
    const transport = await getTransporter();
    await transport.verify();
    console.log(
      `[mail] SMTP OK (${config.mail.host}:${config.mail.port} as ${config.mail.user}, IPv4)`
    );
  } catch (err) {
    console.error(
      "[mail] SMTP verify falló:",
      err instanceof Error ? err.message : err
    );
    console.error(
      "[mail] Tip Railway: probá SMTP_PORT=465. Si sigue ETIMEDOUT, el host bloquea SMTP → usá Resend + dominio."
    );
  }
}
