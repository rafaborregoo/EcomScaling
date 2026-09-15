import nodemailer from "nodemailer";

export type InviteMailEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_BREVO?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
};

type InviteMessage = {
  to: string;
  recipientName?: string | null;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
};

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function hasInviteSmtp(env: InviteMailEnv): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_BREVO);
}

export async function sendInviteMail(
  env: InviteMailEnv,
  message: InviteMessage,
): Promise<{ sent: true } | { sent: false; reason: string }> {
  if (!hasInviteSmtp(env)) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const host = env.SMTP_HOST ?? "smtp-relay.brevo.com";
  const port = env.SMTP_PORT ?? 587;
  const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER!;
  const fromName = env.SMTP_FROM_NAME ?? "EcomScaling";
  const greeting = message.recipientName
    ? `Hola ${html(message.recipientName)},`
    : "Hola,";

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_BREVO! },
    });
    await transporter.sendMail({
      from: `"${fromName.replaceAll('"', "")}" <${fromEmail}>`,
      to: message.to,
      subject: message.title,
      text: `${message.intro}\n\n${message.actionLabel}: ${message.actionUrl}\n\nSi no esperabas esta invitación, ignora este mensaje.`,
      html: `<p>${greeting}</p><p>${html(message.intro)}</p><p><a href="${html(message.actionUrl)}" style="display:inline-block;padding:12px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">${html(message.actionLabel)}</a></p><p style="color:#6b7280;font-size:12px">Si no esperabas esta invitación, ignora este mensaje.</p>`,
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "smtp_send_failed",
    };
  }
}
