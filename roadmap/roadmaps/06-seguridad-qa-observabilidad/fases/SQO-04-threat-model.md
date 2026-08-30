# SQO-04 - Threat model

> **Corrección de evidencia 2026-08-24:** las filas históricas deben leerse junto con el estado actual:
> IDOR organizacional ya tiene cobertura Fastify real en `be-01-cross-tenant-route-manipulation.test.ts`
> y `be-01-cross-tenant-write-endpoints.test.ts`; supply-chain ya tiene `audit-guard.mjs` en CI además de
> Gitleaks, SBOM CycloneDX y escaneo de imágenes con Trivy están cubiertos en CI; prompt injection tiene
> el eval BE-07. Los riesgos que permanecen parciales, como la revalidación DNS SSRF en fetchers y la
> política concreta de retención/borrado, siguen abiertos para validación operativa.

> **Supply-chain 2026-08-24:** CI genera un SBOM CycloneDX de dependencias de producción, construye las
> imágenes API/worker y las escanea con Trivy para vulnerabilidades HIGH/CRITICAL no corregidas. El control
> es manual junto con el workflow, no implica despliegue.

> **Mitigación SSRF 2026-08-24:** los enlaces de grabación pasan por `parseSafeExternalHttpUrl`, que rechaza
> esquemas activos, credenciales embebidas, localhost y rangos privados. Cualquier futura descarga server-side
> deberá además resolver y validar la IP final, bloquear redirects y limitar destino/tiempo.

> **Correccion vigente 2026-08-24:** el escaneo de imagenes y el SBOM ya no son pendientes documentales: el CI manual genera SBOM CycloneDX, construye API/worker y ejecuta Trivy. No implica despliegue.

> **Estado vigente 2026-08-24:** `implemented_partial`. La matriz ya es un
> inventario vivo de 17 amenazas con controles y tests reales; no debe leerse
> como una fase no iniciada. El alcance restante es cobertura sistematica de
> service-role, superficies futuras (Fathom/media), escaneo de imagenes y
> runbooks operativos. Los riesgos externos o diferidos permanecen marcados y
> no se presentan como mitigados.

> **Corrección vigente 2026-08-26 — prompt injection y evals:** la fila 6 ya no
> carece de control específico ni de dataset local. `packages/ai/src/untrusted-context.ts`
> delimita y neutraliza instrucciones en RAG, Playbook, conocimiento interno,
> conectores y resultados de tools; `agent-eval-dataset.ts` y `agent-evals.ts`
> mantienen una matriz versionada para los diez agentes con casos de inyección
> directa/indirecta, datos ausentes, tenant y abstención. La evidencia queda
> preparada para persistencia mediante AI-26 y el release gate puede exigir
> cobertura completa. Las evals live con proveedores reales siguen pendientes
> hasta disponer de credenciales y datos, por lo que la fila permanece parcial.

> Correccion cross-tenant 2026-08-02: `upsertProductCost` verifica ahora el
> `inventoryItemId` explícito con `organization_id` antes de insertar. Un ID de
> inventario de otra organización devuelve `404 inventory_item_not_found` y no
> puede quedar enlazado a un coste del tenant actual. Este patrón debe aplicarse
> a cualquier futura escritura que reciba IDs de recursos relacionados.

> Correccion 2026-08-02: esta matriz es un inventario vivo. Ya existen pruebas
> Fastify reales de aislamiento de rutas y privilegios (`be-01-cross-tenant-
route-manipulation.test.ts`, `be-01-cross-tenant-write-endpoints.test.ts`,
> `be-01-consultant-cross-tenant-write.test.ts` y
> `sqo-04-platform-admin-privilege-escalation.test.ts`). Tambien existe el
> limite diario de IA por organizacion con bloqueo fail-closed. Las filas que
> siguen marcadas como riesgo abierto no deben interpretarse como resueltas por
> esta nota.

> Correccion de borrado 2026-08-02: `purgeExpiredDeletions` solo selecciona
> filas `pending_deletion` cuyo `scheduled_purge_at` ya vencio. La suite
> `db-08-purge-cascade.test.ts` verifica tanto la purga real con configuracion
> financiera como la conservacion de una organizacion cuya gracia aun no ha
> expirado. La purga de backups externos sigue fuera del alcance del worker.

> Correccion SSRF 2026-08-02: la descarga de resultados Shopify Bulk ya valida
> HTTPS, elimina credenciales embebidas y permite solo `storage.googleapis.com`
> (`apps/api/src/shopify-bulk.ts`, `shopify-bulk-url.test.ts`). Esto cubre la
> superficie concreta de resultados Bulk; otras futuras descargas de URLs deben
> reutilizar el mismo criterio y no llamar a `fetch` directamente.

## Estado

> Verificacion vigente 2026-08-24: el typecheck del API vuelve a pasar. Se
> corrigio el narrowing de octetos en `external-url.ts`; las pruebas de URLs
> externas siguen rechazando esquemas peligrosos, credenciales y destinos
> locales. La validacion DNS/redirect sigue siendo responsabilidad de futuros
> fetchers server-side.

- **Estado real:** `implemented_partial` (matriz y controles documentados; quedan gaps explícitos de
  cobertura sistemática y validaciones operativas externas).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** SQO-00, SQO-01, SQO-02, SQO-03, AI-03
- **Bloqueador:** ninguno
- **Evidencia:** este documento es un mapeo, no una implementacion nueva. Cada fila de la matriz cita el
  archivo/test real que ya existe hoy (2026-07-22) — donde no hay evidencia, se marca "sin control" o "sin
  test" explicitamente, no se asume cobertura.

## Objetivo

Invertir el orden en que se ha probado seguridad hasta ahora: en vez de partir de los controles que ya
existen y confirmar que funcionan (lo que hacen bien SQO-00/01), partir de un inventario de amenazas y
verificar cuales **no** tienen control, test u observabilidad — incluidas las que hoy nadie ha probado
porque no se les ha ocurrido.

## Matriz de amenazas

| #   | Amenaza                                                                       | Activo en riesgo                                                     | Control real hoy                                                                                                                                                             | Test/evidencia real                                                                                                                                                                                                                       | Estado                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cross-tenant: usuario de A lee/escribe datos de B                             | Todas las tablas de negocio                                          | RLS + `private.can_access_org` (DB-02); en Node, `organization_id` explicito antes de escribir (auditado 2026-07-22 en `addTaskComment`/`saveTranscript`/`consulting_calls`) | `rls-tenant-isolation.test.ts` (19+ casos)                                                                                                                                                                                                | Verificado en `organizations`/`tasks`/`alerts`/RAG/SQL Gateway; **sin cubrir**: configuracion financiera, conexiones, llamadas, planes (ver SQO-00)                                                                                                                                                                                                                                                                                                                    |
| 2   | Abuso de `service_role` sin scoping                                           | Cualquier tabla accedida desde backend                               | Regla en BE-README (seccion 1): todo uso de `service_role` debe llevar `organization_id` explicito                                                                           | Auditoria manual puntual (SQO-00, 2026-07-22), **sin test automatizado que lo garantice de forma sistemica**                                                                                                                              | Sin test — depende de disciplina de code review, no de una barrera automatica                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Robo/filtracion de tokens OAuth                                               | Credenciales Shopify/Meta                                            | `encryptShopifyCredential`/`decryptShopifyCredential` (`shopify-oauth.ts`) se reutiliza para Shopify, Klaviyo y Meta; schema `private` sin acceso de `anon`/`authenticated`                                            | `db-00-private-schema-permissions.test.ts` (aislamiento de rol) + pruebas de stores OAuth                                                                                                                                                                           | Cifrado AES-256-GCM verificado para los tres proveedores. Pendiente únicamente la gestión externa de secretos maestros y su rotación operativa.                                                                                                                                                                                                                                                                                                                                               |
| 4   | Webhook falsificado o repetido                                                | `private.webhook_events`, efectos de negocio derivados               | HMAC dual-secret (publico/custom), indice unico por fingerprint                                                                                                              | `db-04-webhook-idempotency.test.ts` (2 peticiones concurrentes idénticas -> 1 procesada, mas "rechaza un webhook con HMAC invalido antes de tocar la base de datos" anadido 2026-07-29)                                                   | **Resuelto 2026-07-29**: verificado contra Supabase remoto real que un HMAC incorrecto devuelve 401/`invalid_hmac` sin insertar fila en `webhook_events`                                                                                                                                                                                                                                                                                                               |
| 5   | SSRF via URL controlada por el usuario (Loom/Fathom, media, paginacion opaca) | Red interna, servicios no expuestos                                  | `parseSafeExternalHttpUrl` bloquea protocolos peligrosos, credenciales embebidas, localhost, nombres internos y rangos privados; los fetchers deben revalidar DNS y desactivar redirects                                                                                                                                  | `external-url.test.ts`; queda pendiente una prueba de fetcher con resolución DNS/redirect                                                                                                                                                                                                                                   | Control de entrada implementado; endurecimiento de red todavía parcial hasta cubrir resolución DNS y redirects en cada fetcher                                                                                                                                                                                                                                                                                                                                        |
| 6   | Prompt injection documental (RAG) o en transcripcion                          | Salidas de agentes, acciones propuestas                              | Ninguno especifico; el modelo no tiene escritura directa (solo `proposed_writes` con aprobacion humana, AI-00)                                                               | Ninguno                                                                                                                                                                                                                                   | Sin dataset de evaluacion (AI-06); la aprobacion humana es la unica barrera hoy                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | SQL generado malicioso via SQL Gateway (A03)                                  | Base de datos completa                                               | Validador AST (`sql-gateway.ts`): allowlist de tipos top-level, `FORBIDDEN_FUNCTIONS`, bloqueo de `pg_*`, filtro de tenant a nivel de RPC (`agent_sql_gateway`)              | `sql-gateway.test.ts` (32 casos, incluye el nuevo test de `generate_series`/`regexp_split_to_table`/`jsonb_path_query`) + `be-07-sql-gateway-tenant-isolation.test.ts` (aislamiento end-to-end)                                           | **Resuelto 2026-07-29**: la parte de `FORBIDDEN_FUNCTIONS` del gap ya esta cerrada. La otra mitad del gap citado el 2026-07-22 (`TOP_LEVEL_ALLOWED_TYPES` incluyendo `"with recursive"`) resulto ser **una lectura obsoleta al revisar el codigo actual** — `TOP_LEVEL_ALLOWED_TYPES` solo tiene `select`/`union`/`union all`/`with`/`values`; `"with recursive"` esta en `FORBIDDEN_NODE_TYPES` (rechazado siempre), no en la allowlist. No hay accion pendiente ahi. |
| 8   | Exposicion de transcripciones/resumenes a quien no debe                       | `call_transcripts`, `call_ai_summaries`, `call_internal_notes`       | RLS: cliente ve solo `published`, notas internas solo consultor/admin (DB-08)                                                                                                | Cubierto en `rls-tenant-isolation.test.ts` (draft vs. published)                                                                                                                                                                          | Verificado el acceso; **sin politica de retencion/redaccion de PII en transcripciones** (SQO-03)                                                                                                                                                                                                                                                                                                                                                                       |
| 9   | IDOR en rutas organizacionales (organizationId manipulado en URL/body/query)  | Cualquier endpoint de negocio                                        | `AuthContext` + verificacion en bootstrap/listado consultor                                                                                                                  | **Sin test de integracion contra el servidor Fastify real con `organizationId` manipulado** (gap ya reconocido en BE-01)                                                                                                                  | Sin test — es el riesgo P0 mas citado y menos probado de todo el sistema                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | Elevacion de privilegios (consultor actuando como `platform_admin`)           | Operaciones de administracion (borrar/restaurar/editar organizacion) | `requirePlatformAdmin` en 8 puntos de `consultant.ts` (recontado 2026-07-29, no 5 como decia la nota anterior)                                                               | `sqo-04-platform-admin-privilege-escalation.test.ts` (2026-07-29): servidor Fastify real, usuario con `platform_role = 'user'` (el default) que es _owner_ de su propia organizacion, las 8 rutas devuelven 403 `platform_admin_required` | **Resuelto 2026-07-29**. Nota de proceso: el primer intento de este test fallaba con 409 `membership_missing` en las 8 rutas -- `private.can_access_org()` exige `is_active_org_member()` **y** `has_valid_subscription()`, asi que sin una fila real en `service_subscriptions` la RLS deja la membership invisible antes de llegar siquiera a `requirePlatformAdmin`. Verificado contra Supabase remoto real.                                                        |
| 11  | Borrado destructivo irreversible                                              | Organizaciones, tiendas                                              | Soft-delete + `pending_deletion` + rutas de restore (R-008)                                                                                                                  | Existencia de las rutas confirmada (FE-07); **sin test de que el periodo de gracia se respete o de que el borrado fisico posterior sea correcto**                                                                                         | Parcial                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 12  | Supply-chain (dependencia comprometida)                                       | Todo el monorepo                                                     | `gitleaks` en CI (secret scanning de git, no de dependencias)                                                                                                                | `ci.yml` job `secret-scan`                                                                                                                                                                                                                | **Sin `npm audit`/Dependabot/Renovate, sin SBOM, sin escaneo de imagenes Docker**                                                                                                                                                                                                                                                                                                                                                                                      |
| 13  | Secretos en artefactos de build                                               | Imagenes Docker, bundles de `apps/web`                               | Ninguno mas alla de gitleaks sobre el repo Git                                                                                                                               | Ninguno                                                                                                                                                                                                                                   | Sin control — los Dockerfiles de BE-00 nunca se han construido de verdad (ver BE-00)                                                                                                                                                                                                                                                                                                                                                                                   |
| 14  | Rate-limit bypass / abuso de endpoints caros                                  | API, coste de infraestructura                                        | `@fastify/rate-limit`: 120 req/min global + 10 req/min por organizacion en 6 endpoints de IA (`apps/api/src/server.ts`, 2026-07-22)                                          | Verificado en vivo (`curl` contra `/health`, headers `x-ratelimit-*`)                                                                                                                                                                     | **No distribuido en produccion**: no existe Redis en produccion hoy (corregido 2026-07-27, una nota anterior asumia que si por error), el limite es por instancia serverless, no global. **Aceptado 2026-07-27**: sin clientes reales todavia, se difiere provisionar Redis hasta que haya trafico real de Piloto 1 (ver SQO-00)                                                                                                                                       |
| 15  | Abuso de coste IA (loop de tool calls, prompt caro)                           | Presupuesto de API de modelo                                         | `evaluateAgentBudget` corta el turno (`AgentBudgetExceededError`), `DEFAULT_AGENT_BUDGET` (maxCostUsd 1, maxToolCalls 10) aplicado en los 3 puntos de entrada de agentes     | Tests de `evaluateAgentBudget` en `packages/ai/src/index.test.ts`                                                                                                                                                                         | Bien cubierto; limite plano para todos los agentes (afinar por agente/organizacion es AI-09, no implementado)                                                                                                                                                                                                                                                                                                                                                          |
| 16  | Contaminacion de conocimiento privado entre organizaciones (RAG)              | `knowledge_search`, respuestas de A08/A09                            | Filtro por `target_organization_id` a nivel de funcion SQL                                                                                                                   | `db-11-knowledge-search-isolation.test.ts`                                                                                                                                                                                                | Verificado para el caso sintetico mas grave; sin dataset de `recall@k`/precision de citas (AI-04/AI-06)                                                                                                                                                                                                                                                                                                                                                                |
| 17  | Persistencia de datos tras borrado de organizacion (derecho al olvido)        | Embeddings, backups, agent runs, payloads de webhook                 | Soft-delete de organizacion/tienda (R-008)                                                                                                                                   | Ninguno mas alla de la existencia del soft-delete                                                                                                                                                                                         | **Sin purga real verificada**: sin tombstone de embeddings (AI-04), sin proceso de exportacion/borrado documentado (SQO-03)                                                                                                                                                                                                                                                                                                                                            |

## Correcciones de filas vigentes 2026-08-24

- **Fila 5 (SSRF):** mitigación mínima aplicada para URLs de grabación; no existe todavía descarga
  server-side de Fathom/media. La fila sigue parcial, no sin control absoluto.
- **Fila 9 (IDOR):** los tests Fastify de manipulación de `organizationId` ya existen; la cobertura total
  de endpoints sigue parcial.
- **Fila 12 (supply-chain):** `audit-guard.mjs` bloquea vulnerabilidades high/critical de producción;
  CI también genera SBOM CycloneDX, construye API/worker y ejecuta Trivy. Falta únicamente validar el
  resultado contra el entorno de despliegue real.
- **Fila 3 (OAuth):** el cifrado AES-256-GCM se comparte entre Shopify, Klaviyo y Meta mediante
  `encryptShopifyCredential`; el pendiente es operativo: rotación y gestión externa del secreto maestro.
- **Fila 13 (artefactos):** los Dockerfiles de API/worker existen y CI construye ambas imágenes antes de
  escanearlas. La verificación pendiente es de despliegue real, no de ausencia de control local.
- **Fila 6 (prompt injection):** el dataset transversal de eval de los 10 agentes y las barreras de
  contexto no confiable ya existen; la validación live con proveedores reales queda pendiente.

## Como se usa esta matriz

> **Lectura vigente 2026-08-26:** las celdas históricas de las filas 6 y 12 que
> aún indiquen “ninguno”, ausencia de dataset, SBOM o escaneo deben leerse
> supersedidas por las correcciones de este documento. La fila 6 tiene ahora
> controles anti-injection y evals offline para diez agentes; la fila 12 tiene
> `audit-guard`, SBOM CycloneDX y Trivy en CI. Permanecen sólo las validaciones
> live/operativas y la cobertura sistemática que se indica en el estado.

- Una fila sin test propio (columna vacia o "Ninguno") es candidata directa para el proximo trabajo de
  SQO-01, priorizada por severidad de la amenaza, no por facilidad de implementacion.
- Cuando se cierre un gap de esta tabla, se actualiza la fila en el mismo cambio que anade el
  control/test — este documento no se deja desincronizado del codigo real, igual que se corrigio en
  DB-00/DB-04 (ver `DB-README.md`).
- Las filas 5 (SSRF), 9 (IDOR organizacional) y 12 (supply-chain) son las de mayor severidad con **cero**
  control hoy — no son las mas complejas de resolver, son las que nadie ha empezado a probar.

## Criterios de cierre

- Cada fila de la matriz tiene al menos un control real o esta explicitamente marcada como riesgo
  aceptado con owner y fecha de revision (no "pendiente" indefinido).
- Las 3 amenazas de severidad critica sin control (SSRF, IDOR organizacional, supply-chain) tienen al
  menos un test o mitigacion minima antes de aceptar clientes reales adicionales al piloto.
- Este documento se revisa cada vez que se añade una superficie nueva (integracion, agente, endpoint
  publico), no solo cuando se descubre un incidente.

## Fuera de alcance de este documento

- Implementar los controles que faltan — este documento identifica y prioriza, no corrige. Cada fila sin
  control es candidata a convertirse en una tarea de SQO-00/01/02/03 por separado.
- Definir SLOs, runbooks o el modelo de retencion de datos — eso es SQO-05/SQO-06 (propuestos en el README
  de este dominio, no creados todavia).
