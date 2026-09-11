import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOPIFY_SCOPES_USED,
  describeShopifyMissingScopes,
  explainShopifyError,
  isShopifyAccessDeniedError,
  missingShopifyScopes,
  parseShopifyScopes,
  shopifyScopesInError,
} from "./shopify-permissions.js";

const TODOS = SHOPIFY_SCOPES_USED.map((item) => item.scope);

test("los scopes se leen igual con comas o con espacios", () => {
  assert.deepEqual(parseShopifyScopes("read_orders,read_products"), [
    "read_orders",
    "read_products",
  ]);
  assert.deepEqual(parseShopifyScopes("read_orders read_orders  read_products"), [
    "read_orders",
    "read_products",
  ]);
});

test("solo falta lo que se pidió y no llegó", () => {
  const missing = missingShopifyScopes(TODOS, TODOS);
  assert.deepEqual(missing, []);

  // Una instalación que pide menos no puede fallar por lo que nunca solicitó.
  assert.deepEqual(
    missingShopifyScopes(["read_orders"], ["read_orders", "read_products"]),
    [],
  );
});

test("read_all_orders sin aprobar no tumba la conexión, pero se reporta", () => {
  const granted = TODOS.filter((scope) => scope !== "read_all_orders");
  const missing = missingShopifyScopes(TODOS, granted);

  assert.deepEqual(
    missing.map((item) => item.scope),
    ["read_all_orders"],
  );
  assert.equal(missing.filter((item) => item.required).length, 0);
  assert.match(describeShopifyMissingScopes(missing), /60 días/);
});

test("un permiso imprescindible que falta sí es bloqueante", () => {
  const missing = missingShopifyScopes(
    TODOS,
    TODOS.filter((scope) => scope !== "read_orders"),
  );
  assert.equal(missing.filter((item) => item.required).length, 1);
  assert.match(describeShopifyMissingScopes(missing), /Pedidos \(read_orders\)/);
});

test("el ACCESS_DENIED de Shopify se distingue de un error cualquiera", () => {
  const denied =
    "Access denied for orders field. Required access: `read_orders` access scope.";
  assert.equal(isShopifyAccessDeniedError(denied), true);
  assert.equal(isShopifyAccessDeniedError("shopify_graphql_http_403"), true);
  assert.equal(isShopifyAccessDeniedError("shopify_graphql_timeout"), false);
  assert.equal(isShopifyAccessDeniedError("shopify_graphql_http_500"), false);
  assert.deepEqual(shopifyScopesInError(denied), ["read_orders"]);
});

test("el error del sync explica el permiso y conserva el original", () => {
  const denied =
    "Access denied for orders field. Required access: `read_orders` access scope.";
  const explained = explainShopifyError(denied);
  assert.match(explained, /Faltan permisos de Shopify: Pedidos \(read_orders\)/);
  assert.match(explained, /Access denied for orders field/);

  // Lo que no es de permisos se deja intacto: alguien lo escribió sabiendo qué pasaba.
  assert.equal(
    explainShopifyError("shopify_graphql_timeout"),
    "shopify_graphql_timeout",
  );
});

test("el catálogo cubre los scopes que pide shopify.app.toml", () => {
  for (const scope of [
    "read_products",
    "read_inventory",
    "read_locations",
    "read_orders",
    "read_all_orders",
    "read_returns",
    "read_customers",
    "read_reports",
  ]) {
    assert.ok(TODOS.includes(scope), `falta ${scope} en SHOPIFY_SCOPES_USED`);
  }
});

test("no acusa a un permiso que la tienda SI tiene", () => {
  // Caso real: Shopify rechaza ShopifyQL aunque read_reports esta concedido
  // (falta el acceso a datos protegidos). Decir "falta read_reports" ahi es
  // mentir, y encima contradice al mensaje que ya lo explicaba.
  const propio =
    "shopify_reports_access_denied: Shopify ha rechazado ShopifyQL aunque la conexión tiene read_reports.";
  assert.equal(explainShopifyError(propio, ["read_reports"]), propio);
  assert.equal(isShopifyAccessDeniedError(propio), false);

  const deShopify =
    "Access denied for shopifyqlQuery field. Required access: `read_reports` access scope.";
  assert.equal(explainShopifyError(deShopify, ["read_reports"]), deShopify);
  assert.match(
    explainShopifyError(deShopify, []),
    /Faltan permisos de Shopify: Sesiones y analítica/,
  );
});
