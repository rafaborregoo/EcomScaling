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
  /** Quien invita. Un correo que dice quien esta al otro lado se abre; uno que
   *  llega de "la plataforma" parece automatico y se ignora. */
  senderName?: string | null;
  /** Caducidad del enlace o del codigo, si la tiene. */
  expiresAt?: string | null;
};

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const BRAND = "#1d4ed8";
const BRAND_TINT = "#f5f8ff";
const INK = "#111827";
const MUTED = "#6b7280";
const EDGE = "#e5e7eb";

// Sin webfont: en correo no se puede servir IBM Plex de forma fiable (Gmail y
// Outlook las descartan), asi que se cae a la pila del sistema en vez de dejar
// que cada cliente elija un serif por su cuenta.
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function formatExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(ms));
}

export function hasInviteSmtp(env: InviteMailEnv): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_BREVO);
}

/**
 * Cuerpo del correo. Maquetado con tablas y estilos en linea a proposito: es lo
 * unico que Outlook renderiza igual que el resto, y flex/grid o un <style> en
 * el head no sobreviven a Gmail.
 *
 * Tres cosas que no son decoracion:
 *  - el preheader (el texto que el buzon enseña junto al asunto): sin el, la
 *    lista de correos muestra el primer texto que pille, que suele ser basura;
 *  - la URL visible debajo del boton, porque un boton que no pinta deja el
 *    correo inservible y el enlace es justo lo que la persona necesita;
 *  - quien invita y cuando caduca, que es lo que evita el "me ha llegado esto,
 *    que es" y el "el enlace no me funciona".
 */
export function renderInviteHtml(message: InviteMessage): string {
  const greeting = message.recipientName
    ? `Hola ${html(message.recipientName)},`
    : "Hola,";
  const url = html(message.actionUrl);
  const expiry = formatExpiry(message.expiresAt);
  const preheader = message.senderName
    ? `${message.senderName} te ha invitado a EcomScaling.`
    : message.intro;

  const senderLine = message.senderName
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK}">
         <strong>${html(message.senderName)}</strong> te ha invitado a EcomScaling.
       </p>`
    : "";

  const expiryLine = expiry
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MUTED}">
         El enlace caduca el ${html(expiry)}. Si se te pasa, pide uno nuevo a quien te invitó.
       </p>`
    : "";

  return `<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${html(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_TINT};margin:0;padding:24px 12px;font-family:${FONT}">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${EDGE};border-radius:10px">
        <tr>
          <td style="padding:28px 32px 0">
            <span style="font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${BRAND}">EcomScaling</span>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0">
            <h1 style="margin:0 0 16px;font-size:21px;line-height:1.35;font-weight:600;color:${INK}">${html(message.title)}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK}">${greeting}</p>
            ${senderLine}
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK}">${html(message.intro)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${BRAND};border-radius:6px">
                  <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${html(message.actionLabel)}</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED}">
              Si el botón no funciona, copia esta dirección en tu navegador:<br>
              <a href="${url}" style="color:${BRAND};word-break:break-all">${url}</a>
            </p>
            ${expiryLine}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 28px">
            <div style="border-top:1px solid ${EDGE};padding-top:16px">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">
                Si no esperabas este correo, puedes ignorarlo: sin abrir el enlace no se crea ningún acceso.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Version en texto plano. No es un formalismo: los filtros de spam penalizan
 *  el correo que solo trae HTML, y hay quien lee en clientes sin formato. */
export function renderInviteText(message: InviteMessage): string {
  const expiry = formatExpiry(message.expiresAt);
  return [
    message.recipientName ? `Hola ${message.recipientName},` : "Hola,",
    "",
    message.senderName
      ? `${message.senderName} te ha invitado a EcomScaling.`
      : null,
    message.intro,
    "",
    `${message.actionLabel}: ${message.actionUrl}`,
    expiry ? `` : null,
    expiry
      ? `El enlace caduca el ${expiry}. Si se te pasa, pide uno nuevo a quien te invitó.`
      : null,
    "",
    "Si no esperabas este correo, puedes ignorarlo: sin abrir el enlace no se crea ningún acceso.",
    "",
    "EcomScaling",
  ]
    .filter((line) => line !== null)
    .join("\n");
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
      text: renderInviteText(message),
      html: renderInviteHtml(message),
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "smtp_send_failed",
    };
  }
}
