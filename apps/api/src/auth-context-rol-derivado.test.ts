/**
 * El rol ya no se lee de una columna: se deriva (20261006090000, y desde
 * 20261018090000 de pertenecer a una consultora con plan vigente).
 * Esta regla decide, para cada peticion de la plataforma, si alguien entra como
 * staff, como consultor o como cliente -- asi que lo que se prueba aqui no es
 * una funcion mas, es el gate de todo.
 *
 * Los dos casos que mas importan:
 *  - staff NO depende de una suscripcion. Si dependiera, cancelar una fila de
 *    facturacion dejaria la plataforma sin administradores.
 *  - consultor SI depende, y deja de serlo cuando caduca, sin que nadie tenga
 *    que acordarse de bajar nada. Eso era justo la deriva que habia antes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { derivePlatformRole } from "./auth-context.js";

test("sin consultora detras se entra como cliente", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: false, isConsultant: false }),
    "user",
  );
});

test("siendo miembro de una consultora con plan vigente se es consultor", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: false, isConsultant: true }),
    "consultant",
  );
});

test("el staff no depende de tener plan: cancelarlo no quita la plataforma", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: true, isConsultant: false }),
    "platform_admin",
  );
  assert.equal(
    derivePlatformRole({ isPlatformStaff: true, isConsultant: true }),
    "platform_admin",
  );
});
