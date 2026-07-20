# Preguntas abiertas

> Solo preguntas sin decidir. Una pregunta resuelta se archiva en "Resueltas" abajo (con ADR si la
> resolucion es una decision estructural) — no compite visualmente con las que siguen abiertas.

## Abiertas

| ID | Pregunta | Dominio | Owner | Fecha limite | Opciones | Recomendacion | Bloquea |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | Confirmar proveedor final de hosting API/worker. | Operacion | sin asignar | antes de crear staging | Railway, Render, otro | sin recomendacion tomada | Despliegue staging/prod (OPS-00). |
| Q-003 | Definir formato exacto de nomenclatura de anuncios Meta. | Integraciones/IA | sin asignar | cuando se desbloquee Meta App Review | — | — | Analisis creativo avanzado (INT-02). |
| Q-005 | Auditar GoHighLevel antes de modelar CRM comercial. | Producto/DB | sin asignar | sin fecha | — | — | Integracion GHL futura. |
| Q-007 | Instalar o activar Docker Desktop para verificar Supabase local. | Operacion/DB | sin asignar | sin fecha | Docker Desktop, WSL2, alternativa remota-only documentada | sin recomendacion tomada | `supabase start`, `db reset`, tests RLS locales, `supabase db dump` (confirmado de nuevo 2026-07-20: `db dump --linked` sigue fallando). |
| Q-008 | BE-01: sustituir las "memberships virtuales" por un `AuthContext.accessSource` explicito (`membership` / `consultant_assignment` / `platform_admin`). | Backend | sin asignar | antes del piloto si se decide cambiar | mantener memberships virtuales (ADR-0012), o migrar a `accessSource` explicito | sin recomendacion tomada — ver riesgo en BE-01 | Cualquier endpoint nuevo que dependa de `AuthContext`. |
| Q-009 | Borrado de organizacion/tienda: mantener hard-delete actual o implementar soft-delete (`active -> suspended -> pending_deletion -> retention_period -> permanently_deleted`). | Producto/FE | Rafa | antes del piloto | hard-delete actual, soft-delete con estados | soft-delete — ver riesgo en `RIESGOS.md` y FE-08 | CRUD de Consultoria; entrada de clientes reales al piloto. |
| Q-010 | Contexto activo de cliente/tienda: mantener `localStorage` como fuente principal o mover a la URL (`/clientes/:organizationId/tiendas/:connectionId/...`). | Frontend | sin asignar | antes de escalar clientes | localStorage actual, URL como fuente primaria | sin recomendacion tomada — ver ADR-0010 | Enlaces compartibles/reproducibles entre soporte y cliente. |
| Q-011 | Fathom: modo de autenticacion (API key interna vs OAuth publico). | Integraciones | sin asignar | antes de empezar codigo de INT-04 | API key (pruebas internas), OAuth (multi-cliente) | sin recomendacion tomada | INT-04 (Fathom automatizado). |
| Q-012 | Presupuesto y model routing de agentes IA: como se aplica `maxCostUsd`/`maxTokens` real, y si todos los agentes usan el mismo modelo o hay routing por coste. | IA | sin asignar | antes de escalar clientes (coste crece con volumen) | limite duro por run, limite por organizacion/dia, ambos | sin recomendacion tomada | AI-00, AI-06. |
| Q-013 | Retencion de transcripciones de llamadas y documentos de conocimiento: cuanto tiempo se conservan tras baja de cliente. | Privacidad | sin asignar | antes del piloto (implica compromiso con clientes reales) | sin recomendacion tomada, requiere revision legal/juridica | — | SQO-03 (retencion), proceso de baja de organizacion. |
| Q-014 | Proveedor de observabilidad (logging/error tracking): elegir stack minimo. | Operacion | sin asignar | antes de escalar clientes | pino+servicio gestionado, Sentry, otro | sin recomendacion tomada | SQO-02. |
| Q-015 | RPO/RTO objetivo y estrategia de staging: definir numeros concretos, no solo "staging operativo". | Operacion | sin asignar | antes del piloto | — | — | OPS-00, OPS-01 (criterios de entrada al piloto). |

## Resueltas

| ID | Pregunta | Resolucion | Referencia |
| --- | --- | --- | --- |
| Q-002 | Confirmar cola gestionada: BullMQ + Redis u alternativa. | BullMQ+Redis en produccion desde varias semanas, cron diario funcionando. | `apps/worker/src/worker.ts` |
| Q-004 | Decidir estrategia inicial de embeddings: pgvector vs proveedor externo. | pgvector `vector(1024)` + Voyage `voyage-3.5` swappable. | **ADR-0007** (correccion: la version anterior de este documento referenciaba erroneamente ADR-0006, que es el patron de modulo de integracion, no la decision de embeddings) y DB-11. |
| Q-006 | Resolver acceso Supabase para vincular `cthjwpeygpzwdmjkxeqa`. | Proyecto linkeado, 34 migraciones aplicadas en remoto sin pendientes. | — |
