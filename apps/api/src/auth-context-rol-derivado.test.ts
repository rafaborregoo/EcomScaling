/**
 * El rol ya no se lee de una columna: se deriva (migracion 20261006090000).
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

test("sin suscripcion propia se entra como cliente", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: false, hasOwnSubscription: false }),
    "user",
  );
});

test("con suscripcion propia vigente se es consultor", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: false, hasOwnSubscription: true }),
    "consultant",
  );
});

test("el staff no depende de tener plan: cancelarlo no quita la plataforma", () => {
  assert.equal(
    derivePlatformRole({ isPlatformStaff: true, hasOwnSubscription: false }),
    "platform_admin",
  );
  assert.equal(
    derivePlatformRole({ isPlatformStaff: true, hasOwnSubscription: true }),
    "platform_admin",
  );
});
