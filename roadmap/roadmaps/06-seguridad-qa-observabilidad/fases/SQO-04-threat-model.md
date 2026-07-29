# SQO-04 - Threat model

## Estado

- **Estado real:** `planned` (no iniciado como documento — el roadmap ya lo preveia en el README de este
  dominio; los controles que mapea abajo si existen y estan verificados en SQO-00/01/02/03, AI-00, AI-03,
  BE-README, DB-README).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
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

| # | Amenaza | Activo en riesgo | Control real hoy | Test/evidencia real | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Cross-tenant: usuario de A lee/escribe datos de B | Todas las tablas de negocio | RLS + `private.can_access_org` (DB-02); en Node, `organization_id` explicito antes de escribir (auditado 2026-07-22 en `addTaskComment`/`saveTranscript`/`consulting_calls`) | `rls-tenant-isolation.test.ts` (19+ casos) | Verificado en `organizations`/`tasks`/`alerts`/RAG/SQL Gateway; **sin cubrir**: configuracion financiera, conexiones, llamadas, planes (ver SQO-00) |
| 2 | Abuso de `service_role` sin scoping | Cualquier tabla accedida desde backend | Regla en BE-README (seccion 1): todo uso de `service_role` debe llevar `organization_id` explicito | Auditoria manual puntual (SQO-00, 2026-07-22), **sin test automatizado que lo garantice de forma sistemica** | Sin test — depende de disciplina de code review, no de una barrera automatica |
| 3 | Robo/filtracion de tokens OAuth | Credenciales Shopify/Meta | `encryptShopifyCredential`/`decryptShopifyCredential` (`shopify-oauth.ts`), schema `private` sin acceso de `anon`/`authenticated` | `db-00-private-schema-permissions.test.ts` (aislamiento de rol) | Shopify: cifrado real verificado. **Meta: sin diseño de cifrado documentado** (ver DB-04 gap, `integration_credentials`) |
| 4 | Webhook falsificado o repetido | `private.webhook_events`, efectos de negocio derivados | HMAC dual-secret (publico/custom), indice unico por fingerprint | `db-04-webhook-idempotency.test.ts` (2 peticiones concurrentes idénticas -> 1 procesada, mas "rechaza un webhook con HMAC invalido antes de tocar la base de datos" anadido 2026-07-29) | **Resuelto 2026-07-29**: verificado contra Supabase remoto real que un HMAC incorrecto devuelve 401/`invalid_hmac` sin insertar fila en `webhook_events` |
| 5 | SSRF via URL controlada por el usuario (Loom/Fathom, media, paginacion opaca) | Red interna, servicios no expuestos | **Sin control documentado ni implementado** | Ninguno | Sin control — riesgo real, nadie lo ha probado todavia (INT-04) |
| 6 | Prompt injection documental (RAG) o en transcripcion | Salidas de agentes, acciones propuestas | Ninguno especifico; el modelo no tiene escritura directa (solo `proposed_writes` con aprobacion humana, AI-00) | Ninguno | Sin dataset de evaluacion (AI-06); la aprobacion humana es la unica barrera hoy |
| 7 | SQL generado malicioso via SQL Gateway (A03) | Base de datos completa | Validador AST (`sql-gateway.ts`): allowlist de tipos top-level, `FORBIDDEN_FUNCTIONS`, bloqueo de `pg_*`, filtro de tenant a nivel de RPC (`agent_sql_gateway`) | `sql-gateway.test.ts` (32 casos, incluye el nuevo test de `generate_series`/`regexp_split_to_table`/`jsonb_path_query`) + `be-07-sql-gateway-tenant-isolation.test.ts` (aislamiento end-to-end) | **Resuelto 2026-07-29**: la parte de `FORBIDDEN_FUNCTIONS` del gap ya esta cerrada. La otra mitad del gap citado el 2026-07-22 (`TOP_LEVEL_ALLOWED_TYPES` incluyendo `"with recursive"`) resulto ser **una lectura obsoleta al revisar el codigo actual** — `TOP_LEVEL_ALLOWED_TYPES` solo tiene `select`/`union`/`union all`/`with`/`values`; `"with recursive"` esta en `FORBIDDEN_NODE_TYPES` (rechazado siempre), no en la allowlist. No hay accion pendiente ahi. |
| 8 | Exposicion de transcripciones/resumenes a quien no debe | `call_transcripts`, `call_ai_summaries`, `call_internal_notes` | RLS: cliente ve solo `published`, notas internas solo consultor/admin (DB-08) | Cubierto en `rls-tenant-isolation.test.ts` (draft vs. published) | Verificado el acceso; **sin politica de retencion/redaccion de PII en transcripciones** (SQO-03) |
| 9 | IDOR en rutas organizacionales (organizationId manipulado en URL/body/query) | Cualquier endpoint de negocio | `AuthContext` + verificacion en bootstrap/listado consultor | **Sin test de integracion contra el servidor Fastify real con `organizationId` manipulado** (gap ya reconocido en BE-01) | Sin test — es el riesgo P0 mas citado y menos probado de todo el sistema |
| 10 | Elevacion de privilegios (consultor actuando como `platform_admin`) | Operaciones de administracion (borrar/restaurar/editar organizacion) | `requirePlatformAdmin` en 5 puntos de `consultant.ts` (verificado en FE-07, 2026-07-22) | Verificado por lectura de codigo, **sin test automatizado que lo confirme** | Sin test — el control existe, la prueba no |
| 11 | Borrado destructivo irreversible | Organizaciones, tiendas | Soft-delete + `pending_deletion` + rutas de restore (R-008) | Existencia de las rutas confirmada (FE-07); **sin test de que el periodo de gracia se respete o de que el borrado fisico posterior sea correcto** | Parcial |
| 12 | Supply-chain (dependencia comprometida) | Todo el monorepo | `gitleaks` en CI (secret scanning de git, no de dependencias) | `ci.yml` job `secret-scan` | **Sin `npm audit`/Dependabot/Renovate, sin SBOM, sin escaneo de imagenes Docker** |
| 13 | Secretos en artefactos de build | Imagenes Docker, bundles de `apps/web` | Ninguno mas alla de gitleaks sobre el repo Git | Ninguno | Sin control — los Dockerfiles de BE-00 nunca se han construido de verdad (ver BE-00) |
| 14 | Rate-limit bypass / abuso de endpoints caros | API, coste de infraestructura | `@fastify/rate-limit`: 120 req/min global + 10 req/min por organizacion en 6 endpoints de IA (`apps/api/src/server.ts`, 2026-07-22) | Verificado en vivo (`curl` contra `/health`, headers `x-ratelimit-*`) | **No distribuido en produccion**: no existe Redis en produccion hoy (corregido 2026-07-27, una nota anterior asumia que si por error), el limite es por instancia serverless, no global. **Aceptado 2026-07-27**: sin clientes reales todavia, se difiere provisionar Redis hasta que haya trafico real de Piloto 1 (ver SQO-00) |
| 15 | Abuso de coste IA (loop de tool calls, prompt caro) | Presupuesto de API de modelo | `evaluateAgentBudget` corta el turno (`AgentBudgetExceededError`), `DEFAULT_AGENT_BUDGET` (maxCostUsd 1, maxToolCalls 10) aplicado en los 3 puntos de entrada de agentes | Tests de `evaluateAgentBudget` en `packages/ai/src/index.test.ts` | Bien cubierto; limite plano para todos los agentes (afinar por agente/organizacion es AI-09, no implementado) |
| 16 | Contaminacion de conocimiento privado entre organizaciones (RAG) | `knowledge_search`, respuestas de A08/A09 | Filtro por `target_organization_id` a nivel de funcion SQL | `db-11-knowledge-search-isolation.test.ts` | Verificado para el caso sintetico mas grave; sin dataset de `recall@k`/precision de citas (AI-04/AI-06) |
| 17 | Persistencia de datos tras borrado de organizacion (derecho al olvido) | Embeddings, backups, agent runs, payloads de webhook | Soft-delete de organizacion/tienda (R-008) | Ninguno mas alla de la existencia del soft-delete | **Sin purga real verificada**: sin tombstone de embeddings (AI-04), sin proceso de exportacion/borrado documentado (SQO-03) |

## Como se usa esta matriz

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
