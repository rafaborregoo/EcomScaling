/**
 * Un codigo de vinculacion da acceso de owner a la organizacion de un cliente.
 * Lo que se prueba aqui son las dos propiedades que lo sostienen: que en la
 * base de datos no queda el codigo en claro, y que probar codigos no enseña
 * nada a quien los prueba.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  generateInviteCode,
  hashInviteCode,
  inviteHashMatches,
  isInviteCodeShaped,
  rejectInvite,
} from "./invite-codes.js";

const SECRETO = "secreto-de-pruebas";

test("el codigo generado tiene la forma esperada y no repite", () => {
  const codigos = new Set(
    Array.from({ length: 200 }, () => generateInviteCode()),
  );
  for (const codigo of codigos) {
    assert.ok(isInviteCodeShaped(codigo), `forma invalida: ${codigo}`);
  }
  // 31^8 posibilidades: 200 sorteos con repeticion serian un generador roto.
  assert.ok(codigos.size > 195);
});

test("el alfabeto evita los caracteres que se confunden al dictarlo", () => {
  const codigos = Array.from({ length: 200 }, () => generateInviteCode()).join(
    "",
  );
  for (const confuso of ["O", "0", "I", "1", "L"]) {
    assert.ok(!codigos.includes(confuso), `sale ${confuso} en los codigos`);
  }
});

test("la huella no depende de mayusculas ni de espacios pegados", () => {
  const base = hashInviteCode(SECRETO, "ABCD2345");
  assert.equal(hashInviteCode(SECRETO, "abcd2345"), base);
  assert.equal(hashInviteCode(SECRETO, "  ABCD2345 "), base);
});

test("sin clave no se firma: no hay hash pelado de repuesto", () => {
  // Un fallback silencioso dejaria un SHA-256 de 40 bits de entropia, que se
  // revienta por fuerza bruta. Mejor romper que fingir que hay seguridad.
  assert.throws(() => hashInviteCode("", "ABCD2345"), /INVITE_CODE_SECRET/);
});

test("con otra clave el mismo codigo da otra huella", () => {
  assert.notEqual(
    hashInviteCode(SECRETO, "ABCD2345"),
    hashInviteCode("otra-clave", "ABCD2345"),
  );
});

test("comparar huellas distintas o basura no revienta ni acierta", () => {
  const a = hashInviteCode(SECRETO, "ABCD2345");
  assert.equal(inviteHashMatches(a, a), true);
  assert.equal(
    inviteHashMatches(a, hashInviteCode(SECRETO, "ABCD2346")),
    false,
  );
  assert.equal(inviteHashMatches(a, ""), false);
  assert.equal(inviteHashMatches(a, "no-es-hex"), false);
});

test("los cuatro motivos de rechazo dan la misma respuesta al cliente", () => {
  const respuestas = (
    ["not_found", "already_used", "expired", "email_mismatch"] as const
  ).map((reason) => rejectInvite(reason));

  for (const respuesta of respuestas) {
    assert.equal(respuesta.statusCode, 404);
    assert.equal(respuesta.error, "invite_invalid");
    assert.equal(respuesta.message, respuestas[0]!.message);
  }
});

test("el motivo NO viaja en la respuesta", () => {
  // `sendServiceFailure` serializa el objeto entero en los 4xx: un campo
  // `reason` aqui devolveria al cliente justo el oraculo que el mensaje
  // uniforme cierra. El motivo va al log del servidor, no a la respuesta.
  for (const reason of ["expired", "email_mismatch", "not_found"] as const) {
    assert.deepEqual(Object.keys(rejectInvite(reason)).sort(), [
      "error",
      "message",
      "ok",
      "statusCode",
    ]);
  }
});
