/**
 * Accesos de un cliente desde la vista del consultor.
 *
 * Dos piezas que fallan en silencio:
 *
 *  1. `leavesClientWithoutOwner`: dejar un cliente sin ningun propietario
 *     activo no da error -- la fila se guarda, la pantalla no se queja, y el
 *     cliente se queda sin nadie que pueda aceptar condiciones ni recuperar la
 *     cuenta. Recuperarlo exige entrar por platform admin.
 *  2. El gate de `inviteClientMember`: invitar a alguien crea un usuario de
 *     Auth y una membresia. Si el gate se relaja, cualquiera con sesion mete
 *     gente en la organizacion de otro.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  leavesClientWithoutOwner,
  inviteClientMember,
  setClientMemberRole,
} from "./consultant.js";
import type { AuthContext } from "./auth-context.js";

// --- El ultimo propietario ------------------------------------------------

test("degradar o desactivar al unico owner activo se bloquea", () => {
  const solo = ["user-1"];
  assert.equal(
    leavesClientWithoutOwner(solo, "user-1", { role: "manager" }),
    true,
    "degradarlo a gestor deja el cliente sin owner",
  );
  assert.equal(
    leavesClientWithoutOwner(solo, "user-1", { is_active: false }),
    true,
    "quitarle el acceso deja el cliente sin owner",
  );
});

test("con otro owner activo el cambio pasa", () => {
  const dos = ["user-1", "user-2"];
  assert.equal(leavesClientWithoutOwner(dos, "user-1", { role: "manager" }), false);
  assert.equal(leavesClientWithoutOwner(dos, "user-1", { is_active: false }), false);
});

test("al unico owner se le pueden cambiar otras cosas sin bloquearlo", () => {
  // Reafirmarlo como owner, o reactivarlo, no le quita la propiedad a nadie.
  assert.equal(leavesClientWithoutOwner(["user-1"], "user-1", { role: "owner" }), false);
  assert.equal(
    leavesClientWithoutOwner(["user-1"], "user-1", { is_active: true }),
    false,
  );
});

test("tocar a OTRO miembro nunca se bloquea por esta regla", () => {
  // El guardia mira al ultimo owner, no a cualquiera: bloquear de mas dejaria
  // al consultor sin poder retirar el acceso de un empleado que se fue.
  assert.equal(
    leavesClientWithoutOwner(["user-1"], "user-9", { is_active: false }),
    false,
  );
  assert.equal(
    leavesClientWithoutOwner([], "user-9", { role: "member" }),
    false,
    "un cliente que ya no tiene owner activo no se queda mas bloqueado por esto",
  );
});

// --- El gate -------------------------------------------------------------

const ORG = "org-accesos";
const env = {} as Parameters<typeof inviteClientMember>[0];

function contextFor(
  platformRole: string,
  organizationId = ORG,
  memberRole?: string,
): AuthContext {
  return {
    user: { id: "user-actor" },
    profile: {
      id: "user-actor",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [
      {
        organization_id: organizationId,
        role:
          memberRole ??
          (platformRole === "consultant" ? "consultant" : "owner"),
        accessSource: "membership",
        organization: null,
      },
    ],
    subscriptions: [],
  } as unknown as AuthContext;
}

const failure = (result: { ok: boolean; error?: string }) =>
  result.ok === false ? result.error : null;

test("propietario, gestor o consultor asignado gestiona el equipo; miembro no", async () => {
  // Sin el secreto configurado se corta antes del IO. Ese resultado demuestra
  // que owner y manager han pasado la autorización; member debe caer antes.
  const owner = await inviteClientMember(env, contextFor("user"), ORG, {
    email: "alguien@tienda.com",
  });
  assert.equal(failure(owner), "invite_codes_not_configured");

  const manager = await inviteClientMember(
    env,
    contextFor("user", ORG, "manager"),
    ORG,
    { email: "alguien@tienda.com" },
  );
  assert.equal(failure(manager), "invite_codes_not_configured");

  const member = await inviteClientMember(
    env,
    contextFor("user", ORG, "member"),
    ORG,
    { email: "alguien@tienda.com" },
  );
  assert.equal(failure(member), "organization_manage_denied");

  // Y un consultor no toca una organizacion que no tiene asignada.
  const ajena = await inviteClientMember(
    env,
    contextFor("consultant", "otra-org"),
    ORG,
    { email: "alguien@tienda.com" },
  );
  assert.equal(failure(ajena), "organization_access_denied");
});

test("un correo o un rol invalidos se rechazan antes de crear la cuenta", async () => {
  // Importa el orden: `generateLink` crea un usuario de Auth de verdad, asi
  // que validar despues dejaria cuentas huerfanas por cada error de tecleo.
  const consultant = contextFor("consultant");
  for (const email of ["", "sin-arroba", "a@b"]) {
    const result = await inviteClientMember(env, consultant, ORG, { email });
    assert.equal(failure(result), "invalid_email", `paso el correo "${email}"`);
  }

  const rol = await inviteClientMember(env, consultant, ORG, {
    email: "alguien@tienda.com",
    role: "administrador_supremo",
  });
  assert.equal(failure(rol), "invalid_role");
});

test("cambiar un rol sin decir que cambiar no toca nada", async () => {
  const result = await setClientMemberRole(
    env,
    contextFor("consultant"),
    ORG,
    "user-1",
    {},
  );
  assert.equal(failure(result), "empty_update");
});
