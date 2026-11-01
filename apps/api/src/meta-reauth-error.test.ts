import assert from "node:assert/strict";
import test from "node:test";
import {
  isMetaAppSecretProofError,
  isMetaTokenExpiredError,
  metaConnectionErrorMessage,
} from "./meta-sync.js";

// Mensaje literal de la API el 2026-09-10, con el que TODOS los bloques de
// Meta llevaban fallando bajo un `meta_sync_partial_failure` mudo.
const PROOF_INVALIDO = "Invalid appsecret_proof provided in the API argument";
const CAMPOS_MAL =
  "(#100) publisher_platform, platform_position, device_platform are not valid for fields param";

test("an application deleted at Meta requires a valid app and reauthorization", () => {
  assert.equal(isMetaTokenExpiredError("Application has been deleted"), true);
  assert.match(metaConnectionErrorMessage(["Application has been deleted"]), /^meta_reauth_required:.*aplicación.*eliminada/);
});

test("un token que no es de esta app se reconoce como reautorizacion", () => {
  assert.equal(isMetaAppSecretProofError(PROOF_INVALIDO), true);
  assert.equal(isMetaAppSecretProofError(CAMPOS_MAL), false);
  assert.equal(isMetaTokenExpiredError("Session has expired on Monday"), true);
});

test("la conexion dice que hay que reconectar, no solo que algo fallo", () => {
  const mensaje = metaConnectionErrorMessage([CAMPOS_MAL, PROOF_INVALIDO]);
  assert.match(mensaje, /^meta_reauth_required/);
  assert.match(mensaje, /Reconecta Meta Ads/);
});

test("un fallo que NO es de credenciales conserva el mensaje generico", () => {
  // Que un desglose falle no debe mandar al usuario a reconectar: la conexion
  // esta bien y reconectar no arreglaria nada.
  assert.equal(
    metaConnectionErrorMessage([CAMPOS_MAL]),
    "meta_sync_partial_failure",
  );
  assert.equal(metaConnectionErrorMessage([]), "meta_sync_partial_failure");
});
