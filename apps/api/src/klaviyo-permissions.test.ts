import assert from "node:assert/strict";
import test from "node:test";
import {
  KLAVIYO_CAPABILITIES,
  describeKlaviyoMissingPermissions,
  isKlaviyoPermissionError,
  klaviyoCapability,
  probeKlaviyoPermissions,
} from "./klaviyo-permissions.js";
import { permissionAwareSkipMessage } from "./klaviyo-sync.js";

/** Cliente de mentira: decide por ruta si responde, deniega o revienta. */
function fakeClient(outcome: (path: string) => "ok" | "denied" | "not_found" | "boom") {
  return {
    request: async (path: string) => {
      const result = outcome(path);
      if (result === "ok") return {} as never;
      if (result === "denied") {
        throw new Error('klaviyo_api_error:AUTH:403:{"errors":[]}');
      }
      if (result === "not_found") {
        throw new Error('klaviyo_api_error:AUTH:404:{"errors":[]}');
      }
      throw new Error("klaviyo_api_error:NETWORK");
    },
  };
}

test("un 403 es falta de permiso; un fallo de red no lo es", () => {
  assert.equal(
    isKlaviyoPermissionError('klaviyo_api_error:AUTH:403:{"errors":[]}'),
    true,
  );
  assert.equal(isKlaviyoPermissionError("klaviyo_api_error:AUTH:401:"), true);
  assert.equal(isKlaviyoPermissionError("klaviyo_api_error:NETWORK"), false);
  assert.equal(
    isKlaviyoPermissionError("klaviyo_api_error:RATE_LIMIT:429:"),
    false,
  );
});

test("la clave que solo lee no aparece como capaz de escribir plantillas", async () => {
  const probe = await probeKlaviyoPermissions(
    fakeClient((path) => (path.startsWith("/templates/0") ? "denied" : "ok")),
  );

  assert.ok(probe.granted.includes("campaigns:read"));
  assert.ok(!probe.granted.includes("templates:write"));
  assert.deepEqual(
    probe.missing.map((item) => item.key),
    ["templates:write"],
  );
  // Nada obligatorio falta: la conexion debe poder crearse igual.
  assert.equal(probe.missing.filter((item) => item.required).length, 0);
});

test("el 404 del sondeo de escritura cuenta como permiso concedido", async () => {
  const probe = await probeKlaviyoPermissions(
    fakeClient((path) =>
      path.startsWith("/templates/0") ? "not_found" : "ok",
    ),
  );
  assert.ok(probe.granted.includes("templates:write"));
  assert.equal(probe.missing.length, 0);
});

test("un fallo que no es de permisos no acusa a la clave", async () => {
  const probe = await probeKlaviyoPermissions(
    fakeClient((path) => (path.startsWith("/flows") ? "boom" : "ok")),
  );
  assert.equal(probe.missing.length, 0);
  assert.deepEqual(
    probe.inconclusive.map((item) => item.key).sort(),
    ["flows:read", "flows:write"],
  );
});

test("el mensaje nombra el permiso tal y como se ve en Klaviyo", () => {
  const flows = klaviyoCapability("flows:read");
  assert.ok(flows);
  const texto = describeKlaviyoMissingPermissions([flows], "api_key");
  assert.match(texto, /Flows \(Read\)/);
  assert.match(texto, /Settings -> API keys/);

  const oauth = describeKlaviyoMissingPermissions([flows], "oauth");
  assert.match(oauth, /flows:read/);
  assert.match(oauth, /autorizar/);
});

test("el run del sync explica el permiso, no solo el codigo", () => {
  const templates = klaviyoCapability("templates:read");
  assert.ok(templates);
  assert.equal(
    permissionAwareSkipMessage(["flows"], []),
    "klaviyo_recursos_no_traidos:flows",
  );
  const conPermiso = permissionAwareSkipMessage(["flows"], [templates]);
  assert.match(conPermiso, /Faltan permisos en Klaviyo: Templates \(Read\)/);
  assert.match(conPermiso, /klaviyo_recursos_no_traidos:flows/);
});

test("todo permiso obligatorio tiene sondeo y etiqueta", () => {
  for (const capability of KLAVIYO_CAPABILITIES) {
    assert.ok(capability.probePath.startsWith("/"), capability.key);
    assert.ok(capability.label.length > 0, capability.key);
  }
});
