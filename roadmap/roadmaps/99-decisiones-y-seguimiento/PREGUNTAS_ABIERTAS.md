# Preguntas abiertas

> Solo preguntas sin decidir. Una pregunta resuelta se archiva en "Resueltas" abajo (con ADR si la
> resolucion es una decision estructural) — no compite visualmente con las que siguen abiertas.

## Abiertas

| ID | Pregunta | Dominio | Owner | Fecha limite | Opciones | Recomendacion | Bloquea |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | Confirmar proveedor final de hosting dedicado (VPS/contenedor) si algun dia hace falta. | Operacion | Rafa | sin fecha, no bloqueante | Railway, Render, IONOS, AWS, otro | **sin recomendacion tomada, pausada 2026-07-22**: verificado que `apps/api`/`apps/web` ya estan en produccion en Vercel (serverless) y que `apps/worker` no tiene ningun uso real hoy -- su unica cola ya la cubren los cron de GitHub Actions. No hay presupuesto ni necesidad tecnica actual que la justifique; revisar solo si aparece procesamiento asincrono real que no quepa en una funcion serverless. | Nada bloqueado por esto ahora mismo (antes bloqueaba OPS-00/OPS-01, ya no). |
| Q-003 | Definir formato exacto de nomenclatura de anuncios Meta. | Integraciones/IA | sin asignar | cuando se desbloquee Meta App Review | — | — | Analisis creativo avanzado (INT-02). |
| Q-005 | Auditar GoHighLevel antes de modelar CRM comercial. | Producto/DB | sin asignar | sin fecha | — | — | Integracion GHL futura. |
| Q-007 | Instalar o activar Docker Desktop para verificar Supabase local. | Operacion/DB | sin asignar | sin fecha | Docker Desktop, WSL2, alternativa remota-only documentada | sin recomendacion tomada | `supabase start`, `db reset`, tests RLS locales, `supabase db dump` (confirmado de nuevo 2026-07-20: `db dump --linked` sigue fallando). |
| Q-011 | Fathom: modo de autenticacion (API key interna vs OAuth publico). | Integraciones | sin asignar | antes de empezar codigo de INT-04 | API key (pruebas internas), OAuth (multi-cliente) | sin recomendacion tomada | INT-04 (Fathom automatizado). |
| Q-012 | Presupuesto y model routing de agentes IA: como se aplica `maxCostUsd`/`maxTokens` real, y si todos los agentes usan el mismo modelo o hay routing por coste. | IA | sin asignar | antes de escalar clientes (coste crece con volumen) | limite duro por run, limite por organizacion/dia, ambos | sin recomendacion tomada | AI-00, AI-06. |
| Q-014 | Proveedor de observabilidad (logging/error tracking): elegir stack minimo. | Operacion | sin asignar | antes de escalar clientes | pino+servicio gestionado, Sentry, otro | sin recomendacion tomada | SQO-02. |
| Q-015 | RPO/RTO objetivo y estrategia de staging: definir numeros concretos, no solo "staging operativo". | Operacion | sin asignar | antes del piloto | — | — | OPS-00, OPS-01 (criterios de entrada al piloto). |

## Resueltas

| ID | Pregunta | Resolucion | Referencia |
| --- | --- | --- | --- |
| Q-002 | Confirmar cola gestionada: BullMQ + Redis u alternativa. | BullMQ+Redis en produccion desde varias semanas, cron diario funcionando. | `apps/worker/src/worker.ts` |
| Q-004 | Decidir estrategia inicial de embeddings: pgvector vs proveedor externo. | pgvector `vector(1024)` + Voyage `voyage-3.5` swappable. | **ADR-0007** (correccion: la version anterior de este documento referenciaba erroneamente ADR-0006, que es el patron de modulo de integracion, no la decision de embeddings) y DB-11. |
| Q-006 | Resolver acceso Supabase para vincular `cthjwpeygpzwdmjkxeqa`. | Proyecto linkeado, 34 migraciones aplicadas en remoto sin pendientes. | — |
| Q-009 | Borrado de organizacion/tienda: hard-delete o soft-delete. | Rafa decidio soft-delete con estados (2026-07-21). Implementado: `status='pending_deletion'` + 30 dias de gracia + restauracion + purga por cron. | `RIESGOS.md` R-008, `apps/api/src/consultant.ts` |
| Q-010 | Contexto activo de cliente/tienda: `localStorage` o URL como fuente primaria. | Rafa decidio URL como fuente primaria (2026-07-21). Implementado en `PortalShell`; de paso se corrigio un bug de desincronizacion en `integraciones/page.tsx`. | `RIESGOS.md` R-009, ADR-0010, `apps/web/src/components/portal-shell.tsx` |
| Q-008 | BE-01: sustituir las "memberships virtuales" por un `AuthContext.accessSource` explicito. | Resuelto 2026-07-28 con la opcion aditiva (no la migracion completa a `OrganizationAccess`): `Membership.accessSource` anadido sin romper consumidores existentes. | ADR-0012, `apps/api/src/auth-context.ts`, `auth-context-access-source.test.ts` |
| Q-013 | Retencion de transcripciones de llamadas y documentos de conocimiento: cuanto tiempo se conservan tras baja de cliente. | Rafa decidio (2026-07-27) sin retencion por tiempo ni redaccion de PII mientras no haya cliente real en el Piloto 1 (ADR-0016). Tras baja de organizacion, ambas tablas ya heredan el mismo ciclo de vida de Q-009: se conservan durante los 30 dias de gracia de `pending_deletion` y se eliminan en cascada (`organization_id ... on delete cascade`) cuando `purgeExpiredDeletions` purga la organizacion — sin mecanismo adicional que crear. | ADR-0016, `RIESGOS.md`/Q-009, `supabase/migrations/20260719100000_db_08d_llamadas_consultoria.sql`, `supabase/migrations/20260718110000_db_11_rag_conocimiento.sql` |
