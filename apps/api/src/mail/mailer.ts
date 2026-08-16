import nodemailer, { type Transporter } from "nodemailer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VENUE_TYPE_LABELS, type VenueType } from "@nocta/shared";
import { config } from "../config.js";
import { UPLOADS_DIR } from "../uploads/paths.js";
import { safeUploadBasename } from "../uploads/validate.js";
import {
  passwordResetEmailHtml,
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
    id: string;
    name: string;
    type: VenueType;
    address: string;
    city: string;
    geocodedAddress?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    photoUrl?: string;
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

  await sendMail({
    to: config.mail.notifyTo,
    subject: `Nueva solicitud de Espacio: ${opts.request.name}`,
    html: venueRequestNotificationHtml({
      requestId: opts.request.id,
      venueName: opts.request.name,
      venueType: VENUE_TYPE_LABELS[opts.request.type],
      address: opts.request.address,
      city: opts.request.city,
      geocodedAddress: opts.request.geocodedAddress,
      description: opts.request.description,
      requesterName: opts.requester.name,
      requesterEmail: opts.requester.email,
      contactEmail: opts.request.contactEmail,
      contactPhone: opts.request.contactPhone,
      adminUrl,
      hasPhoto: Boolean(attachment),
    }),
    attachments: attachment ? [attachment] : undefined,
  });

  return adminUrl;
}

export async function sendVenueRequestRejectedEmail(opts: {
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
    subject: `Tu solicitud de Espacio fue rechazada — ${opts.venueName}`,
    html: venueRequestRejectedHtml({
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
  to: string;
  requesterName?: string;
  venueId: string;
  venueName: string;
  venueType: VenueType;
  city: string;
  address: string;
  adminNote?: string;
}) {
  const venueUrl = `${config.clientOrigin}/venues/${encodeURIComponent(opts.venueId)}`;
  await sendMail({
    to: opts.to,
    subject: `Tu Espacio fue autorizado — ${opts.venueName}`,
    html: venueRequestApprovedHtml({
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
