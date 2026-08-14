import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";
import {
  passwordResetEmailHtml,
  verificationEmailHtml,
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
}) {
  if (!hasSmtp() || config.mail.devLog) {
    console.log("\n========== MAIL (dev) ==========");
    console.log(`To: ${opts.to}`);
    console.log(`Subject: ${opts.subject}`);
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
