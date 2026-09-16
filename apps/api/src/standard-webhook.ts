import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks (standardwebhooks.com): la firma va en tres cabeceras y el
 * HMAC se calcula sobre `id.timestamp.body` con el secreto en base64 detras de
 * `whsec_`. Lo hablan Fathom y Whop -- y lo habla media industria -- asi que el
 * verificador vive aqui y no dentro del modulo de un proveedor: duplicar
 * criptografia es como se acaba teniendo una copia que no compara en tiempo
 * constante o que se olvida de la ventana de tiempo.
 */
export type StandardWebhookHeaders = {
  "webhook-id"?: string | null;
  "webhook-timestamp"?: string | null;
  "webhook-signature"?: string | null;
};

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

export function standardWebhookHeaderValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeWebhookSecret(secret: string) {
  const encoded = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  return Buffer.from(encoded, "base64");
}

/**
 * Verifica sin parsear ni normalizar el cuerpo: cualquier reserializacion
 * cambia el HMAC. Se aceptan varias firmas `v1,...` en la misma cabecera, que
 * es como se rota un secreto sin tirar eventos.
 */
export function verifyStandardWebhookSignature(
  secret: string,
  headers: StandardWebhookHeaders,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
) {
  const webhookId = standardWebhookHeaderValue(headers["webhook-id"]);
  const timestampText = standardWebhookHeaderValue(
    headers["webhook-timestamp"],
  );
  const signatureHeader = standardWebhookHeaderValue(
    headers["webhook-signature"],
  );
  const timestamp = timestampText ? Number.parseInt(timestampText, 10) : NaN;

  if (
    !webhookId ||
    !timestampText ||
    !signatureHeader ||
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const expected = createHmac("sha256", decodeWebhookSecret(secret))
    .update(`${webhookId}.${timestampText}.${rawBody}`)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);

  return signatureHeader.split(/\s+/).some((candidate) => {
    const [, encodedSignature = candidate] = candidate.split(",", 2);
    const actualBytes = Buffer.from(encodedSignature);
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  });
}
