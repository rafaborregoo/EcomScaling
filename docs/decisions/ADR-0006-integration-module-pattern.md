# ADR-0006 - Patron reutilizable para modulos de integracion (Shopify, Meta Ads, Klaviyo...)

## Estado

Aprobada.

## Contexto

El modulo Shopify se construyo de forma iterativa: primero el sync inicial, luego sync manual, luego bloques independientes, luego Bulk Operations, luego webhooks, luego metricas, y solo al final una pasada de rendimiento (indices que faltaban, una tabla append-only que crecia sin limite, refunds que no se restaban). Cada mejora se aplico "a mano" despues de encontrar el problema en produccion, no antes.

Para Meta Ads, Klaviyo y cualquier integracion futura, el objetivo es que estos puntos se decidan **al diseñar el modulo**, no despues de que ya duela.

## Decision

Todo modulo de integracion nuevo sigue esta estructura desde el primer commit:

### 1. Estado actual vs historico (regla mas importante)

Si una tabla representa "el valor ahora mismo" de algo (stock, saldo, estado de una campana), es una tabla con **upsert in-place** (`unique` constraint sobre la clave natural, `onConflict` en cada escritura). Nunca una tabla append-only que se lee con `DISTINCT ON`/`ORDER BY ... LIMIT 1` para sacar "lo ultimo". Ver `shopify_inventory_current_state` vs el error inicial (`shopify_inventory_level_snapshots` creciendo en cada sync y cada webhook).

Si de verdad hace falta historico (para graficas de tendencia), esa es una tabla *distinta y explicita*, con una politica de retencion pensada desde el dia uno (particionado, borrado programado, o agregacion a un grano mas grueso), no una tabla que "por si acaso" guarda cada evento para siempre.

### 2. Sync en bloques independientes, no un job monolitico

Cada dominio de datos (catalogo, pedidos, audiencias, campanas...) es su propio "bloque": su propia fila en `integration_sync_runs` (columna `sync_scope`), su propio try/catch, su propio estado visible en el frontend. Un fallo en un bloque no debe impedir que los demas terminen. Ver `apps/api/src/shopify-sync.ts`.

### 3. Import completo vs incremental, explicitos desde el principio

- Import completo (`initial_import`/`manual`): trae todo el historico disponible via bulk/export API del proveedor si existe (Shopify Bulk Operations, Meta Ads Insights async reports, etc.), sin limite de paginas arbitrario.
- Incremental (`incremental`): mismo codigo, pero con un filtro `updated_at >= last_sync_at` pasado a la query del proveedor. Se dispara desde reconciliacion periodica, no solo manualmente.

No implementar solo el import completo "por ahora" y dejar el incremental para despues: es el mismo codigo con un parametro, hacerlo aparte duplica logica.

### 4. Webhooks + reconciliacion, nunca solo webhooks

Los webhooks se pueden perder (el proveedor no garantiza entrega). Todo modulo con webhooks necesita tambien un job periodico (`apps/worker`, cola `ecomscaling-default`, ver `shopify-reconcile`) que vuelva a sincronizar en modo incremental. El endpoint interno que dispara esto se protege con un secreto compartido (`INTERNAL_API_SECRET`), nunca con auth de usuario.

### 5. Rate limiting del proveedor, no opcional

El cliente HTTP/GraphQL de cada proveedor implementa backoff ante 429/5xx/throttling desde el primer commit (ver `apps/api/src/shopify-client.ts`). No se anade "cuando falle en produccion".

### 6. Metricas: agregar en Postgres, no en Node

Los KPIs de dashboard son funciones SQL `language sql stable`, **sin `security definer`**, para que la RLS de las tablas base siga aplicando aunque alguien manipule el `target_organization_id`. El backend solo hace `supabase.rpc(...)`. Nunca traer miles de filas a Node para sumarlas ahi.

Cualquier query de metricas que filtre por rango de fechas necesita un indice que calce exactamente con el predicado usado (columna compuesta o expresion, con `where` parcial si aplica), creado en la misma migracion que la funcion, no despues.

### 7. Escrituras siempre por service role con autorizacion manual

Las tablas de un modulo de integracion solo tienen policy de `select` para `authenticated` (RLS via `private.can_access_org`). Las escrituras (sync, webhooks, endpoints de mutacion como costes/config) usan el cliente con `SUPABASE_SERVICE_ROLE_KEY` y comprueban a mano membership + rol (`owner`/`manager`/`platform_admin`) antes de escribir. Ver `assertCanManage` en `shopify-product-costs.ts` como plantilla.

### 8. No se valida sin una cuenta real conectada

Bulk exports y webhooks de proveedores externos tienen comportamientos que la documentacion no siempre deja 100% claros (p. ej. como se agrupan filas anidadas en Shopify Bulk Operations). Todo modulo nuevo se prueba contra una cuenta de pruebas real (dev store, ad account de test, etc.) antes de darlo por cerrado. Mientras tanto, el codigo deja logs de diagnostico que hacen evidente si un supuesto de la documentacion no se cumplio (ver los `logger.error` de "grouping produced zero child lines" en `shopify-sync.ts`).

## Consecuencias

- Meta Ads e Klaviyo (siguientes en el roadmap) arrancan usando esta checklist, no reinventando la estructura.
- El coste de "hacerlo bien" se paga una vez por modulo, al principio, en vez de N veces conforme se descubren los mismos problemas (tabla que crece sin limite, refunds que no se restan, falta de indice) en cada integracion nueva.
- Root `CLAUDE.md` referencia este documento para que se cargue automaticamente en cualquier sesion de trabajo sobre el repo.
