# Roadmap operativo - Base de datos

> **Verificación vigente 2026-08-26:** `supabase migration list --linked` devuelve 75/75 migraciones
> locales/remotas coincidentes; `supabase db push --linked --dry-run` informa que la base remota está al
> día; y `node scripts/regenerate-generated-schema.mjs --check` pasa. La comprobación fue de lectura y
> no modificó datos ni metadatos de producción.

> Verificacion 2026-08-20: el endpoint de Management API y el generador MCP de typegen
> devuelven falta de privilegios para la cuenta enlazada. Como alternativa, el CLI oficial
> genera correctamente desde `SUPABASE_DB_URL` por conexión PostgreSQL directa. El artefacto
> tipado está en `packages/db/src/database.types.ts` y se exporta desde `packages/db/src/index.ts`;
> las migraciones y `schema_generado_desde_migraciones.sql` siguen siendo la fuente ejecutable
> de verdad.

## Objetivo

Construir Supabase/PostgreSQL por fases, sin desplegar las 90 tablas del modelo conceptual de golpe. La base de datos debe sostener multi-tenant, integraciones, metricas, operaciones humanas, agentes IA y auditoria con RLS verificable.

## Principios

- `organization_id` es obligatorio en toda tabla de negocio.
- Las credenciales externas viven en `private`, nunca en `public`.
- Las migraciones SQL son la fuente ejecutable de verdad.
- DBML y contexto se actualizan solo cuando una decision aprobada cambia el contrato.
- Cada bloque multi-tenant necesita tests de aislamiento cliente A/B y consultor asignado/no asignado.
- Los estados de fase siguen la taxonomia y el formato de evidencia de
  [`ESTADOS_Y_EVIDENCIA.md`](../99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md).
- Antes de tocar cualquier `fases/DB-XX-*.md` o su migracion, aplica las reglas de
  [`DB-README.md`](DB-README.md) (fuentes de verdad, que no tocar sin decision del usuario, disciplina de
  idempotencia/cifrado/RLS).

## Fuente de verdad vs. modelo conceptual

`schema_conceptual_snapshot.sql` (ex "BDD EcomScaling.sql") es un export de la herramienta de diseno
ER — **no ejecutable, no fuente de verdad**, con problemas conocidos documentados en su propia cabecera
(FKs invertidas, sin RLS/CHECK/grants, desalineado con el esquema real en varios puntos). Para ver el
esquema real: `supabase/migrations/*.sql`, o su version concatenada y regenerable en
`schema_generado_desde_migraciones.sql`. Ejecuta `node scripts/regenerate-generated-schema.mjs`
para regenerarlo y `node scripts/regenerate-generated-schema.mjs --check` para detectar drift.

## Fases

| Fase  | Archivo                                   | Relacion maestro | Resultado                                                                                     |
| ----- | ----------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| DB-00 | `fases/DB-00-infraestructura.md`          | F1               | Schemas, extensiones, permisos base y trigger `updated_at`.                                   |
| DB-01 | `fases/DB-01-enums-core.md`               | F1-F2            | Enums minimos del nucleo, sin anticipar fases futuras.                                        |
| DB-02 | `fases/DB-02-auth-multitenant-rls.md`     | F2               | Profiles, organizations, memberships, assignments, subscriptions, notifications y audit logs. |
| DB-03 | `fases/DB-03-configuracion-financiera.md` | F5               | Costes, gastos, reglas de envio y objetivos.                                                  |
| DB-04 | `fases/DB-04-integraciones-comunes.md`    | F4               | Conexiones, credenciales privadas, sync runs y webhook events.                                |
| DB-05 | `fases/DB-05-shopify-vertical-slice.md`   | F4-F5            | Tienda, catalogo, inventario, pedidos, refunds, costes y metricas diarias.                    |
| DB-06 | `fases/DB-06-meta-ads.md`                 | F6               | Cuentas, campanas, ad sets, ads, creatividades, insights y metricas calculadas.               |
| DB-07 | `fases/DB-07-alertas-tareas-plan.md`      | F7-F9            | Reglas, alertas, tareas, historial, comentarios y Mi Camino.                                  |
| DB-08 | `fases/DB-08-llamadas-runtime-agentes.md` | F8               | Llamadas, transcripciones, resumenes y runtime inicial de agentes.                            |
| DB-09 | `fases/DB-09-klaviyo-campanas.md`         | F11-F12          | Klaviyo, reporting, metricas email y campanas planificadas.                                   |
| DB-10 | `fases/DB-10-instagram.md`                | F14              | Instagram, media, insights y ganadores manuales.                                              |
| DB-11 | `fases/DB-11-rag-consultor-ia.md`         | F13              | Knowledge, chunks, conversaciones, mensajes, pgvector y auditoria IA avanzada.                |

## Checklist permanente — estado real (2026-08-26)

Un checklist con casillas vacias no dice nada por si mismo; esto es lo que hay evidencia real de hoy,
agregado sobre las fases con migracion aplicada (DB-00 a DB-11 y ampliaciones operativas/IA). Detalle completo por fase en
  la seccion "Estado" de cada `fases/DB-XX-*.md`.

| Item                                                        | Estado real                            | Evidencia / gap                                                                                                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migracion aplicable desde cero                              | Cumplido                               | 75/75 migraciones locales = remotas (`supabase migration list`, verificación vigente 2026-08-26).                                                                                                                          |
| Constraints de integridad multi-tenant                      | Parcial                                | Triggers reales existen (`enforce_task_alert_same_org` en DB-07), pero no estan cubiertos por tests automatizados en todos los dominios.                                                                                   |
| RLS activada en tablas expuestas                            | Cumplido                               | Confirmado por `rls-tenant-isolation.test.ts` (11/11) para las tablas cubiertas; sin verificar en RPC/vistas/Storage.                                                                                                      |
| Grants revisados para `anon`/`authenticated`/`service_role` | Sin evidencia                          | No hay un test que verifique privilegios de schema (ver DB-00).                                                                                                                                                            |
| Tests SQL/RLS                                               | Parcial                                | 11 tests de lectura cross-tenant; faltan insert/update cross-tenant y acceso REST directo.                                                                                                                                 |
| Indices para filtros reales                                 | Cumplido (no auditado exhaustivamente) | Indices presentes en las migraciones revisadas (p. ej. `agent_runs_lookback_days_idx`, `tasks_organization_category_idx`).                                                                                                 |
| Documento de contexto/DBML actualizado si cambia contrato   | Parcial                                | Esta auditoria (2026-07-20) corrigio varias desalineaciones; el `schema_conceptual_snapshot.sql` sigue teniendo problemas conocidos documentados en su cabecera, a proposito no reparados (ver "Fuente de verdad" arriba). |
