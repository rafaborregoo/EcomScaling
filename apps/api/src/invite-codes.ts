import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Codigos de vinculacion: como se generan, como se guardan y que se responde
 * cuando no valen (§21, §23, §51 y §53 del modelo de planes).
 *
 * Nada de red ni de base de datos aqui: esto es lo que se puede probar solo, y
 * es donde estan las dos decisiones que importan -- que en la base no haya un
 * codigo en claro, y que el que prueba codigos no aprenda nada probando.
 */

// Sin O/0/I/1/L: el codigo se dicta por telefono y se copia a mano.
const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Huella del codigo, para guardar en vez del codigo.
 *
 * Es HMAC y no un hash a secas porque el codigo solo tiene ~40 bits de
 * entropia (8 caracteres de 31): un SHA-256 pelado de una fila filtrada se
 * revienta por fuerza bruta en un minuto de GPU. Con la clave fuera de la base
 * de datos, quien se lleve la tabla no tiene por donde empezar.
 *
 * Por eso mismo la clave no tiene valor por defecto: un fallback silencioso
 * convertiria esto en el SHA-256 pelado que precisamente no vale, y nadie se
 * enteraria.
 */
export function hashInviteCode(secret: string, code: string): string {
  if (!secret) {
    throw new Error("INVITE_CODE_SECRET es obligatorio para firmar codigos");
  }
  return createHmac("sha256", secret)
    .update(code.trim().toUpperCase())
    .digest("hex");
}

/** Comparacion en tiempo constante de dos huellas en hex. */
export function inviteHashMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * La unica respuesta a un codigo que no sirve.
 *
 * Antes habia cuatro: no existe (404), ya usado (409), caducado (410) y el
 * email no coincide (403). Las cuatro juntas son un oraculo: se prueban
 * codigos hasta que uno deja de decir "no existe", y ahi ya se sabe que ese
 * codigo es real; con el email pasa igual. Una sola respuesta para todo
 * cuesta un poco de comodidad a quien se equivoca de verdad y le quita el
 * juego entero a quien no.
 *
 * El motivo real no se pierde: va a los logs del servidor, que es donde hace
 * falta para dar soporte.
 */
export type InviteRejection = {
  ok: false;
  statusCode: number;
  error: "invite_invalid";
  message: string;
};

export type InviteRejectionReason =
  "not_found" | "already_used" | "expired" | "email_mismatch" | "malformed";

export function rejectInvite(
  /**
   * El motivo NO viaja en la respuesta: `sendServiceFailure` serializa el
   * objeto entero en los 4xx, asi que un campo de mas aqui devolveria el
   * oraculo que esta funcion existe para cerrar. Se recibe para que quien
   * rechaza tenga que nombrarlo, y se registra en el log del servidor.
   */
  reason: InviteRejectionReason,
): InviteRejection {
  void reason;
  return {
    ok: false,
    statusCode: 404,
    error: "invite_invalid",
    message: "El código no es válido o ya no está disponible.",
  };
}

/** Forma del codigo antes de tocar la base de datos. */
export function isInviteCodeShaped(code: string): boolean {
  return new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(
    code,
  );
}
