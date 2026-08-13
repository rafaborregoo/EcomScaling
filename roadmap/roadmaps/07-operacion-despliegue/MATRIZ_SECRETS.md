# Matriz de secretos por entorno

> Creado 2026-08-03. Entregable pendiente de OPS-00 ("secrets separados por entorno", "no hay matriz de
> secrets por entorno"). Extraida de `packages/config/src/index.ts` (reglas reales de validacion) y de los
> bloques `env:` reales de `.github/workflows/`, no de una lista deseada.

## Los tres consumidores

| Consumidor              | Como recibe los secretos                  | Que valida                               |
| ----------------------- | ----------------------------------------- | ---------------------------------------- |
| `apps/api` (Vercel)     | Variables de entorno del proyecto Vercel  | `loadApiEnv` al arrancar el servidor     |
| `apps/web` (Vercel)     | Solo variables `NEXT_PUBLIC_*`            | Ninguna clave privada llega al navegador |
| Crones (GitHub Actions) | Bloque `env:` de cada workflow, uno a uno | `loadApiEnv` al arrancar cada entrypoint |

El tercero es el que mas se rompe: GitHub Actions **no hereda** secretos, cada workflow declara los suyos.
Un cron al que le falte una variable requerida no falla "un poco": aborta antes de leer una sola fila, y
en el historial aparece como un job rojo que es facil confundir con un fallo del proveedor externo.
`apps/worker/src/cron-workflow-env.test.ts` protege exactamente eso.

## Requeridas siempre (todos los entornos y todos los crones)

`loadApiEnv` aborta si falta cualquiera de estas, **sin importar que hace el proceso**:

| Variable                                                    | Por que es obligatoria                                |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `SUPABASE_URL` **o** `NEXT_PUBLIC_SUPABASE_URL`             | Proyecto Supabase destino.                            |
| `SUPABASE_PUBLISHABLE_KEY` **o** su variante `NEXT_PUBLIC_` | Cliente scoped al usuario para lecturas con RLS.      |
| `SHOPIFY_API_KEY`                                           | Requerida por `loadApiEnv` aunque el proceso no toque |
| `SHOPIFY_API_SECRET`                                        | Shopify. Es la causa del fallo real de 2026-08-03 en  |
| `SHOPIFY_SCOPES`                                            | `klaviyo-reconcile.yml` y `meta-reconcile.yml`: ambos |
| `SHOPIFY_REDIRECT_URI`                                      | abortaban al arrancar por no declararlas.             |

`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET` no las exige el schema, pero todo cron escribe con el
service client: sin ellas el proceso arranca y falla en la primera consulta, que es peor que fallar pronto.

## Grupos todo-o-nada

Ninguna es obligatoria, pero si aparece una del grupo tienen que estar todas o `loadApiEnv` aborta. Evita
publicar en la UI un flujo OAuth que no puede completarse:

| Grupo          | Variables                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Shopify custom | `SHOPIFY_CUSTOM_API_KEY`, `SHOPIFY_CUSTOM_API_SECRET`, `SHOPIFY_CUSTOM_SCOPES`, `SHOPIFY_CUSTOM_REDIRECT_URI` |
| Meta           | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (`META_SCOPES` tiene default en codigo)                 |
| Klaviyo        | `KLAVIYO_CLIENT_ID`, `KLAVIYO_CLIENT_SECRET`, `KLAVIYO_REDIRECT_URI` (`KLAVIYO_SCOPES` tiene default)         |

## Opcionales con degradacion honesta

| Variable                    | Si falta                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Los endpoints de IA devuelven 503; el resto de la plataforma funciona. |
| `OPENAI_API_KEY`/`_MODEL`   | Sin fallback de proveedor LLM: un fallo de Anthropic es un fallo.      |
| `VOYAGE_API_KEY`            | Ingestion y busqueda de conocimiento devuelven 503 (RAG apagado).      |
| `REDIS_URL`                 | Rate limit en memoria por instancia en vez de centralizado.            |
| `INTEGRATION_FEATURE_FLAGS` | **Se habilitan todos** los proveedores disponibles del catalogo.       |
| `INTERNAL_API_SECRET`       | Las rutas internas (`/v1/internal/*`) quedan sin llamador autorizado.  |

`INTEGRATION_FEATURE_FLAGS` es el unico cuyo valor por defecto es _mas_ permisivo, no menos: dejarlo vacio
en un entorno donde Meta o Klaviyo no estan validados es lo contrario de lo que parece.

## Que declara hoy cada cron

| Workflow                      | Ademas de las requeridas siempre                        |
| ----------------------------- | ------------------------------------------------------- |
| `shopify-reconcile.yml`       | Grupo Shopify custom completo                           |
| `klaviyo-reconcile.yml`       | Grupo Klaviyo + `INTEGRATION_FEATURE_FLAGS`             |
| `meta-reconcile.yml`          | Grupo Meta + `INTEGRATION_FEATURE_FLAGS`                |
| `memory-ingestion.yml`        | `VOYAGE_API_KEY`                                        |
| `alert-rules.yml`             | —                                                       |
| `ops-health-check.yml`        | —                                                       |
| `purge-expired-deletions.yml` | —                                                       |
| `backup-database.yml`         | Solo `SUPABASE_DB_URL` (usa `pg_dump`, no `loadApiEnv`) |

## Separacion por entorno

Hoy hay un unico entorno real (R-015: sin staging, aceptado). Cuando exista, la regla es que **ningun
secreto se comparte**: proyecto Supabase propio, apps OAuth propias en Shopify/Meta/Klaviyo con sus
`*_REDIRECT_URI` apuntando al dominio de ese entorno, y `INTEGRATION_FEATURE_FLAGS` mas restrictivo en
staging que en produccion, nunca al reves. Reutilizar credenciales entre entornos convierte una prueba en
una escritura sobre la cuenta real de un cliente.

## Rotacion

No hay rotacion automatica de ninguna clave. `integration_credentials` guarda `encryption_key_version`
pero no existe rotacion real implementada (ver DB-04). Rotar hoy es manual: cambiar el secreto en el
proveedor, actualizarlo en Vercel y en GitHub Secrets, y relanzar los crones afectados.
