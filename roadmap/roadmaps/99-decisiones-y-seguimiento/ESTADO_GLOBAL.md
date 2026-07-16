# Estado global

> Actualizar este archivo al cerrar o reabrir fases.

| Dominio | Fase actual | Estado | Proximo hito |
| --- | --- | --- | --- |
| Base de datos | DB-06a | En progreso | Migraciones remotas al dia; ultima correccion aplicada: vistas publicas con `security_invoker` para respetar RLS. |
| Backend/API | BE-03 | En progreso | OAuth, Bulk sync, scopes, reintentos y metricas Shopify implementados; falta validar con tienda con pedidos reales. |
| Frontend/UX | FE-02 | En progreso | Vista tecnica Shopify y banda de acciones implementadas; falta dashboard ejecutivo MVP con formulas finales. |
| Integraciones | INT-01 | En progreso | Shopify local end-to-end operativo; falta validar webhooks/reconciliacion con URL publica o tunel HTTPS y datos reales. |
| Agentes IA | AI-00 | Pendiente | Contratos runtime y tools. |
| Seguridad/QA/Observabilidad | SQO-00 | En progreso | `typecheck` y `build` pasan; faltan tests RLS con admin/cliente/consultor. |
| Operacion/Despliegue | OPS-00 | En progreso | Puerto local fijado en 3001; Supabase remoto linkeado y `db push --dry-run` sin migraciones pendientes. |
