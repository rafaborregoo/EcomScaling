# Roadmap operativo - Base de datos

## Objetivo

Construir Supabase/PostgreSQL por fases, sin desplegar las 90 tablas del modelo conceptual de golpe. La base de datos debe sostener multi-tenant, integraciones, metricas, operaciones humanas, agentes IA y auditoria con RLS verificable.

## Principios

- `organization_id` es obligatorio en toda tabla de negocio.
- Las credenciales externas viven en `private`, nunca en `public`.
- Las migraciones SQL son la fuente ejecutable de verdad.
- DBML y contexto se actualizan solo cuando una decision aprobada cambia el contrato.
- Cada bloque multi-tenant necesita tests de aislamiento cliente A/B y consultor asignado/no asignado.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| DB-00 | `fases/DB-00-infraestructura.md` | F1 | Schemas, extensiones, permisos base y trigger `updated_at`. |
| DB-01 | `fases/DB-01-enums-core.md` | F1-F2 | Enums minimos del nucleo, sin anticipar fases futuras. |
| DB-02 | `fases/DB-02-auth-multitenant-rls.md` | F2 | Profiles, organizations, memberships, assignments, subscriptions, notifications y audit logs. |
| DB-03 | `fases/DB-03-configuracion-financiera.md` | F5 | Costes, gastos, reglas de envio y objetivos. |
| DB-04 | `fases/DB-04-integraciones-comunes.md` | F4 | Conexiones, credenciales privadas, sync runs y webhook events. |
| DB-05 | `fases/DB-05-shopify-vertical-slice.md` | F4-F5 | Tienda, catalogo, inventario, pedidos, refunds, costes y metricas diarias. |
| DB-06 | `fases/DB-06-meta-ads.md` | F6 | Cuentas, campanas, ad sets, ads, creatividades, insights y metricas calculadas. |
| DB-07 | `fases/DB-07-alertas-tareas-plan.md` | F7-F9 | Reglas, alertas, tareas, historial, comentarios y Mi Camino. |
| DB-08 | `fases/DB-08-llamadas-runtime-agentes.md` | F8 | Llamadas, transcripciones, resumenes y runtime inicial de agentes. |
| DB-09 | `fases/DB-09-klaviyo-campanas.md` | F11-F12 | Klaviyo, reporting, metricas email y campanas planificadas. |
| DB-10 | `fases/DB-10-instagram.md` | F14 | Instagram, media, insights y ganadores manuales. |
| DB-11 | `fases/DB-11-rag-consultor-ia.md` | F13 | Knowledge, chunks, conversaciones, mensajes, pgvector y auditoria IA avanzada. |

## Checklist permanente

- [ ] Migracion aplicable desde cero.
- [ ] Constraints de integridad multi-tenant.
- [ ] RLS activada en tablas expuestas.
- [ ] Grants revisados para `anon`, `authenticated` y `service_role`.
- [ ] Tests SQL/RLS.
- [ ] Indices para filtros reales.
- [ ] Documento de contexto/DBML actualizado si cambia contrato.

