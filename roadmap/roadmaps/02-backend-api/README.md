# Roadmap operativo - Backend, API y worker

## Objetivo

Crear una API y worker que concentren permisos, integraciones, calculos deterministas, agentes y auditoria. El frontend no debe operar credenciales ni service role.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| BE-00 | `fases/BE-00-fundaciones-api-worker.md` | F1 | Fastify, env schema, logging, healthcheck, worker y cola. |
| BE-01 | `fases/BE-01-identidad-tenancy.md` | F2-F3 | AuthContext, bootstrap, organizaciones, permisos y asignaciones. |
| BE-02 | `fases/BE-02-integrations-core.md` | F4 | OAuth base, credenciales, webhooks, sync orchestration e idempotencia. |
| BE-03 | `fases/BE-03-shopify-metricas.md` | F4-F5 | Shopify connector, jobs y motor financiero MVP. |
| BE-04 | `fases/BE-04-meta-adquisicion.md` | F6 | Meta connector, insights async y metricas de adquisicion. |
| BE-05 | `fases/BE-05-operaciones.md` | F7-F9 | Alertas, tareas, llamadas, planes y notificaciones. |
| BE-06 | `fases/BE-06-klaviyo-stock-campanas.md` | F11-F12 | Klaviyo, stock, campanas y Fathom. |
| BE-07 | `fases/BE-07-ai-runtime-rag.md` | F8/F13 | Runtime IA, SQL Gateway, tools, RAG y aprobaciones. |

## Contrato global

Antes de tocar cualquier `fases/BE-XX-*.md` o codigo en `apps/api`/`apps/worker`, aplica
[`BE-README.md`](BE-README.md): auth/tenancy, validacion, formato de error unico, idempotencia,
observabilidad, envelope de jobs y Definition of Done por endpoint.

## Convenciones

- Controllers validan entrada y auth.
- Services coordinan casos de uso.
- Repositories encapsulan SQL.
- Connectors traducen APIs externas a DTOs internos.
- Jobs son reentrantes e idempotentes.

