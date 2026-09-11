/**
 * Lectura de los permisos de Shopify: que falta, y como se dice.
 *
 * El catalogo (`SHOPIFY_SCOPES_USED`) vive en @ecomscaling/contracts porque la
 * interfaz tambien lo necesita. Aqui esta la parte que solo usa el servidor.
 *
 * Igual que en Klaviyo: el mensaje crudo de Shopify ("Access denied for orders
 * field. Required access: `read_orders` access scope.") es correcto pero llega
 * en ingles, dentro de una cadena tecnica y a destiempo -- en un sync, dias
 * despues de instalar.
 */
import {
  SHOPIFY_SCOPES_USED,
  shopifyScopeInfo,
  type ShopifyScopeInfo,
} from "@ecomscaling/contracts";

export { SHOPIFY_SCOPES_USED, shopifyScopeInfo, type ShopifyScopeInfo };

/** Shopify devuelve los scopes separados por coma; el env los admite con espacios. */
export function parseShopifyScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Lo que se pidió y no se concedió.
 *
 * Se compara contra lo pedido (`SHOPIFY_SCOPES`), no contra la tabla entera: si
 * una instalación pide menos, no puede fallar por algo que nunca solicitó.
 */
export function missingShopifyScopes(
  requestedScopes: readonly string[],
  grantedScopes: readonly string[],
): ShopifyScopeInfo[] {
  const granted = new Set(grantedScopes);
  return requestedScopes
    .filter((scope) => !granted.has(scope))
    .map(
      (scope) =>
        shopifyScopeInfo(scope) ?? {
          scope,
          label: scope,
          required: true,
        },
    );
}

/**
 * Shopify denegando por permisos, con SU propia redaccion: el 403 del Admin
 * API o el `Access denied for <campo> field. Required access: `read_x` access
 * scope.` de GraphQL.
 *
 * Los codigos propios (`shopify_algo_access_denied: ...`) NO cuentan: los
 * escribio alguien que ya sabia lo que pasaba y traen su explicacion. Envolver
 * esos mensajes producia contradicciones del tipo "faltan permisos: read_reports"
 * encima de un texto que decia "la conexion SI tiene read_reports".
 */
export function isShopifyAccessDeniedError(message: string): boolean {
  if (/^shopify_[a-z0-9_]+:/i.test(message.trim())) return false;
  return (
    /ACCESS_DENIED/.test(message) ||
    /access denied for .+access scope/is.test(message) ||
    /shopify_graphql_http_40[13]/.test(message)
  );
}

/** Los `read_x` que Shopify nombra en su propio mensaje de error. */
export function shopifyScopesInError(message: string): string[] {
  return [...new Set(message.match(/read_[a-z_]+/g) ?? [])];
}

export function describeShopifyMissingScopes(
  missing: readonly ShopifyScopeInfo[],
): string {
  const detalle = missing
    .map((item) =>
      item.note
        ? `${item.label} (${item.scope}) — ${item.note}`
        : `${item.label} (${item.scope})`,
    )
    .join("; ");
  return `Faltan permisos de Shopify: ${detalle}. Vuelve a instalar la app desde Integraciones y acepta todos los permisos en la pantalla de Shopify.`;
}

/**
 * Traduce el error de un bloque de sync.
 *
 * `grantedScopes` evita la acusacion falsa: si la tienda TIENE el permiso que
 * Shopify nombra, el problema es otro (acceso a datos protegidos pendiente de
 * aprobacion, por ejemplo) y el mensaje original se deja intacto.
 */
export function explainShopifyError(
  message: string,
  grantedScopes: readonly string[] = [],
): string {
  if (!isShopifyAccessDeniedError(message)) return message;
  const granted = new Set(grantedScopes);
  const missing = shopifyScopesInError(message)
    .filter((scope) => !granted.has(scope))
    .map(
      (scope) =>
        shopifyScopeInfo(scope) ?? { scope, label: scope, required: true },
    );
  if (missing.length > 0) {
    return `${describeShopifyMissingScopes(missing)} (${message})`;
  }
  // Shopify denego, pero no por un permiso que falte en la instalacion.
  return shopifyScopesInError(message).length > 0
    ? message
    : `Shopify denego el acceso. Si la tienda tiene los permisos concedidos, revisa el acceso a datos protegidos en el Partner Dashboard. (${message})`;
}
