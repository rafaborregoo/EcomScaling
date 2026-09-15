/**
 * Reparto de cartera entre dos consultores socios.
 *
 * Equivocar la diferencia de conjuntos no da error: o el socio se queda fuera
 * de tiendas que cree llevar -- y no lo descubre hasta que un cliente le
 * escribe --, o se reasigna lo que ya estaba y se pisa el `is_primary`, que es
 * quien decide a que consultor ve el cliente como interlocutor.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  missingAssignments,
  addConsultantPartner,
  decidePartnerPromotion,
  type AssignmentRow,
} from "./consultant-partners.js";
import type { AuthContext } from "./auth-context.js";
import { isAuthEmailRateLimit } from "./consultant.js";
import { hasInviteSmtp, sendInviteMail } from "./invite-mailer.js";

const A = "consultor-a";
const B = "consultor-b";

const row = (org: string, user: string): AssignmentRow => ({
  organization_id: org,
  consultant_user_id: user,
});

test("reconoce el límite de correo de Supabase sin ocultarlo como invite_failed", () => {
  assert.equal(
    isAuthEmailRateLimit({ message: "email rate limit exceeded" }),
    true,
  );
  assert.equal(
    isAuthEmailRateLimit({ status: 429, message: "too many requests" }),
    true,
  );
  assert.equal(
    isAuthEmailRateLimit({ status: 500, message: "smtp unavailable" }),
    false,
  );
});

test("el SMTP de invitaciones exige usuario y clave", () => {
  assert.equal(hasInviteSmtp({}), false);
  assert.equal(hasInviteSmtp({ SMTP_USER: "mailer@example.com" }), false);
  assert.equal(
    hasInviteSmtp({
      SMTP_USER: "mailer@example.com",
      SMTP_BREVO: "smtp-secret",
    }),
    true,
  );
});

test("sin SMTP devuelve fallback sin intentar enviar", async () => {
  const result = await sendInviteMail(
    {},
    {
      to: "client@example.com",
      title: "Invitación",
      intro: "Te han invitado.",
      actionLabel: "Aceptar",
      actionUrl: "https://example.com/acceso",
    },
  );
  assert.deepEqual(result, { sent: false, reason: "smtp_not_configured" });
});

test("cada socio recibe las tiendas que solo lleva el otro", () => {
  const missing = missingAssignments(
    [row("tienda-1", A), row("tienda-2", A), row("tienda-3", B)],
    A,
    B,
  );

  assert.deepEqual(
    missing.sort((x, y) => x.organization_id.localeCompare(y.organization_id)),
    [
      { organization_id: "tienda-1", consultant_user_id: B },
      { organization_id: "tienda-2", consultant_user_id: B },
      { organization_id: "tienda-3", consultant_user_id: A },
    ],
  );
});

test("lo que ya comparten no se vuelve a asignar", () => {
  // Reasignar una fila existente pisaria su `is_primary` y cambiaria a quien
  // ve el cliente como su consultor.
  assert.deepEqual(
    missingAssignments([row("tienda-1", A), row("tienda-1", B)], A, B),
    [],
  );
});

test("un socio sin tiendas recibe toda la cartera del otro", () => {
  const missing = missingAssignments([row("tienda-1", A)], A, B);
  assert.deepEqual(missing, [
    { organization_id: "tienda-1", consultant_user_id: B },
  ]);
});

test("dos consultores sin tiendas no generan nada", () => {
  assert.deepEqual(missingAssignments([], A, B), []);
});

test("las asignaciones de un tercero no se cuelan en el reparto", () => {
  // La consulta filtra por los dos socios, pero si algun dia deja de hacerlo,
  // esto impide repartir en silencio las tiendas de otro consultor.
  const missing = missingAssignments(
    [row("tienda-1", A), row("tienda-ajena", "consultor-c")],
    A,
    B,
  );
  assert.deepEqual(missing, [
    { organization_id: "tienda-1", consultant_user_id: B },
  ]);
});

// --- El gate ---------------------------------------------------------------

const env = {} as Parameters<typeof addConsultantPartner>[0];

function contextFor(platformRole: string): AuthContext {
  return {
    user: { id: A },
    profile: {
      id: A,
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [],
    subscriptions: [],
  } as unknown as AuthContext;
}

const failure = (result: { ok: boolean; error?: string }) =>
  result.ok === false ? result.error : null;

test("solo un consultor comparte cartera, y no consigo mismo", async () => {
  // Emparejarse asigna tiendas: no es una preferencia de perfil.
  assert.equal(
    failure(
      await addConsultantPartner(env, contextFor("user"), {
        email: "otro@agencia.com",
      }),
    ),
    "consultant_access_required",
  );

  for (const email of ["", "sin-arroba", 42]) {
    assert.equal(
      failure(
        await addConsultantPartner(env, contextFor("consultant"), { email }),
      ),
      "invalid_email",
      `paso el correo ${String(email)}`,
    );
  }
});

// --- Quien puede pasar a consultor ------------------------------------------
//
// Esta regla decide si a alguien le cambia el rol por escribir su correo. El
// fallo realista es una errata, asi que lo que se prueba sobre todo es que
// nada se convierte sin haberlo pedido dos veces.

const perfil = (platform_role: string, is_active = true) => ({
  platform_role,
  is_active,
});

test("un consultor activo se empareja y nada mas", () => {
  assert.deepEqual(decidePartnerPromotion(perfil("consultant"), false), {
    kind: "pair",
  });
  // Ni siquiera pidiendo promote: ya lo es, no hay nada que tocar.
  assert.deepEqual(decidePartnerPromotion(perfil("consultant"), true), {
    kind: "pair",
  });
});

test("un admin no se promociona por aqui: se empareja", () => {
  assert.deepEqual(decidePartnerPromotion(perfil("platform_admin"), true), {
    kind: "pair",
  });
});

test("una cuenta de cliente se pregunta antes de tocarla", () => {
  assert.deepEqual(decidePartnerPromotion(perfil("user"), false), {
    kind: "ask_promote",
  });
  assert.deepEqual(decidePartnerPromotion(perfil("user"), true), {
    kind: "promote",
  });
});

test("una cuenta desactivada no se empareja ni se convierte", () => {
  assert.deepEqual(decidePartnerPromotion(perfil("consultant", false), false), {
    kind: "refuse",
    error: "consultant_inactive",
  });
  assert.deepEqual(decidePartnerPromotion(perfil("user", false), true), {
    kind: "refuse",
    error: "account_inactive",
  });
  // Sin confirmar, a una cuenta desactivada se le pregunta igual: el consultor
  // se entera de que esta desactivada al confirmar, no antes de saber de quien
  // es la cuenta.
  assert.deepEqual(decidePartnerPromotion(perfil("user", false), false), {
    kind: "ask_promote",
  });
});

test("sin perfil no se inventa nada", () => {
  assert.deepEqual(decidePartnerPromotion(null, true), {
    kind: "refuse",
    error: "profile_missing",
  });
});
