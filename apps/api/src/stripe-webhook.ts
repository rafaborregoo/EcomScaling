import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe NO habla Standard Webhooks.
 *
 * Fathom y Whop firman con `webhook-id` / `webhook-timestamp` /
 * `webhook-signature` y el secreto en base64 detras de `whsec_`
 * (`standard-webhook.ts`). Stripe usa una cabecera sola, `Stripe-Signature`,
 * con pares `t=` y `v1=`, el HMAC en hex, y el secreto como **texto plano
 * incluido el prefijo `whsec_`** -- no en base64.
 *
 * Los dos prefijos se llaman igual y significan cosas distintas, que es
 * exactamente el tipo de parecido que hace que alguien reutilice el
 * verificador de al lado y se pase meses con las firmas fallando sin entender
 * por que. De ahi que esto sea un fichero aparte y no un parametro del otro.
 *
 * No se usa el SDK de Stripe por lo mismo que no se usa en Shopify, Klaviyo ni
 * Meta: todas las integraciones de esta casa son `fetch` contra la API. Son 30
 * lineas de crypto y una dependencia menos que auditar en el camino del dinero.
 */

const DEFAULT_TOLERANCE_SECONDS = 300;

export type StripeWebhookHeaders = {
  "stripe-signature"?: string | null;
};

type ParsedSignature = { timestamp: number; signatures: string[] };

/** `t=1492774577,v1=5257a86...,v1=otra` -> timestamp y firmas candidatas. */
export function parseStripeSignatureHeader(
  header: string | null | undefined,
): ParsedSignature | null {
  if (typeof header !== "string" || !header.trim()) return null;

  let timestamp = NaN;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (!key || !value) continue;
    if (key === "t") timestamp = Number.parseInt(value, 10);
    // Varias `v1` en la misma cabecera es como Stripe rota un secreto sin
    // tirar eventos: durante la rotacion manda la firma de los dos.
    else if (key === "v1") signatures.push(value);
  }

  if (!Number.isSafeInteger(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verifica sobre el cuerpo EN CRUDO, sin parsear ni reserializar: cualquier
 * `JSON.parse` + `JSON.stringify` por el camino cambia el HMAC y todo empieza
 * a fallar sin un motivo visible.
 */
export function verifyStripeWebhookSignature(
  secret: string,
  headers: StripeWebhookHeaders,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!secret) return false;

  const parsed = parseStripeSignatureHeader(headers["stripe-signature"]);
  if (!parsed) return false;

  // La ventana es lo que impide reenviar un evento valido de hace un mes.
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected);

  return parsed.signatures.some((candidate) => {
    const actualBytes = Buffer.from(candidate);
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  });
}
