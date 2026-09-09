import nodemailer, { type Transporter } from "nodemailer";
import { existsSync } from "node:fs";
import { join } from "node:path";
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
} from "./templates.js";

let transporter: Transporter | null = null;

function hasSmtp() {
  return Boolean(config.mail.host && config.mail.user && config.mail.pass);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const port = config.mail.port;
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port,
    secure: port === 465,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
    ...(port === 587
      ? { requireTLS: true, tls: { minVersion: "TLSv1.2" as const } }
      : {}),
  });

  return transporter;
}

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}) {
  if (!hasSmtp() || config.mail.devLog) {
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

  if (!hasSmtp()) {
    console.warn("[mail] SMTP no configurado — mail no enviado");
    return;
  }

  const info = await getTransporter().sendMail({
    from: config.mail.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });

  console.log(`[mail] enviado a ${opts.to} messageId=${info.messageId}`);
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
  if (!hasSmtp() || config.mail.devLog) {
    console.log(`[mail] código verificación ${opts.to}: ${opts.code}`);
  }
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name?: string;
  token: string;
}) {
  const resetUrl = `${config.clientOrigin}/auth/reset-password?token=${encodeURIComponent(opts.token)}`;
  await sendMail({
    to: opts.to,
    subject: "Restablecer contraseña — Nocta",
    html: passwordResetEmailHtml({ name: opts.name, resetUrl }),
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

/** Verifica credenciales SMTP al boot (no aborta si falla). */
export async function verifyMailTransport() {
  if (!hasSmtp()) {
    console.log("[mail] SMTP off — modo consola (MAIL_DEV_LOG / sin credenciales)");
    return;
  }
  try {
    await getTransporter().verify();
    console.log(
      `[mail] SMTP OK (${config.mail.host}:${config.mail.port} as ${config.mail.user})`
    );
  } catch (err) {
    console.error(
      "[mail] SMTP verify falló:",
      err instanceof Error ? err.message : err
    );
  }
}
