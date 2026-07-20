# Riesgos activos

> P = probabilidad (1-5), I = impacto (1-5), Severidad = P x I. Mitigacion reduce la probabilidad;
> Contingencia es que hacer si el riesgo ya ocurrio. Owner "sin asignar" es en si mismo el problema mas
> urgente de este documento: ningun P0 tiene responsable real hoy.

| ID | Riesgo | P | I | Sev. | Owner | Mitigacion | Contingencia | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Crear todo el esquema de una vez. | 2 | 3 | 6 | sin asignar | Seguir DB-00 a DB-11. | Revertir migracion y trocear. | Activo |
| R-002 | Dashboard antes de reconciliar APIs. | 2 | 4 | 8 | sin asignar | Mostrar freshness y comparar contra fuentes oficiales. | Banner de discrepancia + aviso al cliente. | Activo |
| R-003 | Agentes antes de motores deterministas. | 2 | 4 | 8 | sin asignar | Motores primero, IA interpreta despues. | Desactivar el hallazgo del agente afectado. | Activo |
| R-004 | Fallo multi-tenant/RLS. | 2 | 5 | 10 | sin asignar | Tests A/B desde DB-02 y SQO-00. | Revocar acceso, auditar `audit_logs` (cuando exista, ver R-014), notificar. | Activo |
| R-005 | Automatizacion autonoma prematura de agentes IA. | 2 | 4 | 8 | sin asignar | Borradores y aprobacion humana hasta quality gates (AI-06). | Revertir la escritura materializada, revisar `agent_runs`. | Activo |
| R-006 | Fases marcadas "completado" sin evidencia verificable. | 2 | 4 | 8 | sin asignar | Taxonomia de estados con evidencia (`ESTADOS_Y_EVIDENCIA.md`); auditorias 2026-07-20 reclasificaron fases sobreestimadas. | Reabrir la fase y exigir evidencia antes de reclasificar. | Activo, mitigacion en curso |
| R-007 | `schema_conceptual_snapshot.sql` usado como si fuera el esquema real. | 1 | 3 | 3 | sin asignar | Renombrado y marcado no-ejecutable; migraciones son la unica fuente de verdad. | — | Mitigado 2026-07-20 |
| R-008 | Borrado irreversible de tienda/organizacion desde el CRUD de Consultoria (hard-delete, cascada de FK verificada). | 2 | 5 | 10 | Rafa (decision de producto pendiente) | Ninguna todavia — requiere decidir soft-delete con estados (`active -> suspended -> pending_deletion -> retention_period -> permanently_deleted`), ver FE-08 y Q-009. | Restaurar desde backup si existe (sin prueba de restauracion real, ver R-016). | Activo, sin mitigar |
| R-009 | Contexto de cliente/tienda activos depende de `localStorage` como fuente casi unica. | 3 | 4 | 12 | sin asignar | Deep-links `?organizationId=&connectionId=` como fallback; pendiente decidir si la URL pasa a ser fuente primaria (ADR-0010, Q-010). | Pedir al usuario que refresque/reseleccione cliente ante duda. | Activo |
| R-010 | Faltan los 3 webhooks de privacidad obligatorios de Shopify y `app/uninstalled`. | 3 | 4 | 12 | sin asignar | Anadir los 4 topics en `shopify-webhooks.ts`/`shopify-webhook-handler.ts` — bloquea aprobacion de distribucion publica (ver ADR-0011, INT-01). | — | Activo, sin mitigar |
| R-011 | A02 (monitor) sigue con `sql_select` libre; presupuesto de coste/latencia se registra pero no se aplica en ningun agente. | 4 | 4 | 16 | sin asignar | Migrar A02 al evidence pack ya aplicado a A06; aplicar `maxCostUsd`/`maxTokens` real en `ai-runtime.ts` (AI-00, AI-02, Q-012). | Desactivar generacion automatica, servir el ultimo diagnostico valido, alertar coste anomalo. | Activo, sin mitigar |
| R-012 | Diseño propuesto de AI-07 re-ingiere informes generados por IA como RAG encadenado a otros informes generados por IA. | 2 | 4 | 8 | sin asignar | Fase marcada `planned_architecture_revision_required`, no implementada tal cual. Antes de construirla: no descartar originales, marcar lo generado como `derived`. | No activar la fase hasta rediseñar. | Activo, sin mitigar |
| R-013 | `public.audit_logs` existe en el esquema pero ningun endpoint escribe en ella. | 3 | 4 | 12 | sin asignar | Conectar `audit_logs` a las escrituras sensibles ya existentes (SQO-03). | Reconstruir historial manualmente desde logs de aplicacion si los hay (hoy no los hay, ver R-014). | Activo, sin mitigar |
| R-014 | Sin observabilidad basica (logging estructurado, error tracking, metricas) en ningun `package.json`. | 4 | 4 | 16 | sin asignar | Elegir stack minimo de logging estructurado + correlation IDs antes de escalar clientes (SQO-02, Q-014). | Diagnostico manual leyendo codigo y consultando la DB directamente (lento, ya es la practica actual). | Activo, sin mitigar |
| R-015 | No existe staging — cambios van de local/preview directo a produccion. | 3 | 4 | 12 | sin asignar | Crear staging real antes del piloto (OPS-00, Q-001, Q-015). | Rollback manual del despliegue si algo rompe en produccion. | Activo, sin mitigar |
| R-016 | Backups/PITR de Supabase no tienen una restauracion probada documentada en este repo. | 2 | 5 | 10 | sin asignar | Ejecutar y documentar una restauracion real, con RPO/RTO objetivo (SQO-03, Q-015). | Sin contingencia real hasta que se pruebe — es precisamente el riesgo. | Activo, sin mitigar |
| R-017 | Soporte y runbooks: `OPS-02` enumera runbooks pero no contiene ninguno. | 3 | 3 | 9 | sin asignar | Escribir al menos los runbooks de mayor probabilidad (sync fallido, token expirado, coste IA disparado) antes del piloto (OPS-02). | Resolver incidentes ad-hoc sin protocolo (practica actual). | Activo, sin mitigar |
| R-018 | Dependencia de un unico responsable (Rafa) para producto, ingenieria y operacion — sin sustituto documentado. | 3 | 4 | 12 | Rafa | Documentar credenciales/accesos criticos y al menos un runbook por area antes de escalar clientes reales. | — | Activo |
| R-019 | Perdida de webhooks (Shopify/futuros Meta/Fathom) durante una caida de la API o del worker. | 2 | 3 | 6 | sin asignar | `private.webhook_events` ya persiste el evento antes de procesar (INT-00); falta confirmar reintento/replay tras caida. | Reconciliacion periodica ya existente (`shopify-reconcile.ts`) cubre parcialmente Shopify. | Activo |
| R-020 | Proveedor LLM (Anthropic) no disponible o degradado, sin fallback definido. | 2 | 3 | 6 | sin asignar | Definir model routing/fallback (Q-012, AI-00). | Degradar a "sin diagnostico IA disponible" mostrando el ultimo valido con freshness. | Activo |
| R-021 | Tests de CI dependen del Supabase remoto real (no un entorno aislado por PR). | 3 | 2 | 6 | sin asignar | Evaluar Postgres/Supabase aislado por CI run (SQO-01). | Revisar residuos manualmente si un run falla a mitad. | Activo |

## Riesgos mitigados o descartados

Ver R-007 arriba (unico mitigado hasta la fecha). Ningun riesgo se ha descartado todavia — la lista solo
crece porque las auditorias siguen encontrando gaps reales mas rapido de lo que se resuelven.
