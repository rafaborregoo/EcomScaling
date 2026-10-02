/**
 * Reglas del cliente: validacion de lo que entra en el contexto de CADA
 * respuesta del copiloto y de cada ejecucion de agente.
 *
 * A diferencia de un documento, una regla no compite por un sitio en el top-k:
 * se inyecta siempre. Eso hace que los limites de aqui no sean cosmetica --
 * si se relajan, el fallo no es un error visible sino un prompt que engorda en
 * todas partes, o una fila que se guarda y no hace nada.
 *
 * Sin VOYAGE ni Supabase: toda esta validacion corre antes de tocar la red, y
 * llegar mas alla ya significaria que un caso invalido paso el filtro.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createClientConstraint, updateClientConstraint } from "./client-constraints.js";
import type { AuthContext } from "./auth-context.js";

const ORG = "org-reglas";
const env = {} as Parameters<typeof createClientConstraint>[0];

function contextFor(platformRole: string, membershipRole = "owner"): AuthContext {
  return {
    user: { id: "user-reglas" },
    profile: {
      id: "user-reglas",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [
      {
        organization_id: ORG,
        role: membershipRole,
        accessSource: "membership",
        organization: null,
      },
    ],
    subscriptions: [],
  } as unknown as AuthContext;
}

const consultant = contextFor("consultant");

const failure = (result: Awaited<ReturnType<typeof createClientConstraint>>) =>
  result.ok === false ? result.error : null;

test("una regla vacia no llega a la base", async () => {
  for (const statement of ["", "   ", undefined, 42]) {
    const result = await createClientConstraint(env, consultant, ORG, {
      category: "discounts",
      statement,
    });
    assert.equal(failure(result), "statement_requerido");
  }
});

test("una regla larguisima se rechaza: entra en todos los prompts, no solo en uno", async () => {
  const result = await createClientConstraint(env, consultant, ORG, {
    category: "brand",
    statement: "x".repeat(401),
  });
  assert.equal(failure(result), "statement_demasiado_largo");

  // Justo en el limite si pasa: llega hasta el cliente de Supabase, que sin
  // env revienta. Que reviente AHI es la prueba de que paso la validacion --
  // si el limite estuviera mal puesto, habria devuelto un 400 sin llegar.
  await assert.rejects(
    () =>
      createClientConstraint(env, consultant, ORG, {
        category: "brand",
        statement: "x".repeat(400),
      }),
    /supabaseUrl is required/,
  );
});

test("una categoria inventada se rechaza antes de tocar nada", async () => {
  const result = await createClientConstraint(env, consultant, ORG, {
    category: "loquesea",
    statement: "No hacer descuentos por encima del 20%.",
  });
  assert.equal(failure(result), "categoria_invalida");
});

test("una fecha de fin ya pasada se rechaza: naceria muerta", async () => {
  // El check de DB (valid_until >= valid_from) devolveria un 500 opaco, y la
  // regla nunca se inyectaria porque el filtro de vigencia la descartaria en
  // el mismo instante en que se guarda.
  const result = await createClientConstraint(env, consultant, ORG, {
    category: "campaigns",
    statement: "No promocionar la coleccion Invierno.",
    validUntil: "2020-01-01",
  });
  assert.equal(failure(result), "fecha_pasada");

  const malFormada = await createClientConstraint(env, consultant, ORG, {
    category: "campaigns",
    statement: "No promocionar la coleccion Invierno.",
    validUntil: "31/12/2026",
  });
  assert.equal(failure(malFormada), "fecha_invalida");
});

test("quien no gestiona conocimiento tampoco escribe reglas", async () => {
  // Mismo gate que los documentos (requireKnowledgeManager): un miembro raso
  // del cliente no puede reescribir lo que el copiloto tiene siempre delante.
  const result = await createClientConstraint(
    env,
    contextFor("member", "viewer"),
    ORG,
    { category: "pricing", statement: "Margen minimo del 35%." },
  );
  assert.equal(failure(result), "knowledge_access_denied");

  // Y nadie escribe en una organizacion en la que no esta.
  const ajena = await createClientConstraint(env, consultant, "org-de-otro", {
    category: "pricing",
    statement: "Margen minimo del 35%.",
  });
  assert.equal(failure(ajena), "organization_access_denied");
});

test("editar una regla aplica los mismos limites que crearla", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const run = (payload: Parameters<typeof updateClientConstraint>[4]) =>
    updateClientConstraint(env, consultant, ORG, id, payload).then((r) => (r.ok === false ? r.error : null));

  assert.equal(await run({ statement: "   " }), "statement_requerido");
  assert.equal(await run({ statement: "x".repeat(401) }), "statement_demasiado_largo");
  assert.equal(await run({ category: "inventada" }), "categoria_invalida");
  assert.equal(await run({ validUntil: "31/12/2026" }), "fecha_invalida");
  assert.equal(await run({ validUntil: "2000-01-01" }), "fecha_pasada");
  assert.equal(await run({ status: "borrada" }), "status_invalido");
  assert.equal(await run({}), "sin_cambios");

  const denied = await updateClientConstraint(env, contextFor("member", "viewer"), ORG, id, { status: "inactive" });
  assert.equal(denied.ok === false ? denied.error : null, "knowledge_access_denied");
});
