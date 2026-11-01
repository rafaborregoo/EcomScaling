# Segundo avance — conciliación y recuperación de conexiones

**Fecha:** 1 de noviembre de 2026, Europe/Madrid.
**Alcance:** continuación de IMP-00 y controles de fiabilidad del plan. Corrección local implementada; sin despliegue ni escrituras remotas de esta ejecución.

Referencias: [plan maestro](../PLAN_MAESTRO_IMPLEMENTACION_CONTROLADA_E_NORA.md), [primer avance](ESTADO_IMPLEMENTACION_2026-11-01.md) y [snapshot inicial](IMP00_BASELINE_2026-11-01.json). El snapshot se conserva como evidencia histórica y no se sobrescribe con el estado nuevo.

## 1. Corrección implementada

La comprobación `hasRecoveredSync` verificaba recuperación si encontraba un éxito posterior a un fallo dentro del historial de sincronizaciones. No contrastaba ese éxito con el último error de la conexión. Eso permitía dar por verificada la recuperación usando una sincronización antigua aunque existiera un error posterior.

La consulta de metadatos identificó una conexión Shopify con ese patrón. La prueba de regresión reprodujo el comportamiento antes de modificarlo.

Ahora se exige una sincronización finalizada correctamente, de la misma conexión y posterior al último error conocido. Una finalización ausente, inválida o igual a la fecha del error no acredita recuperación. La comprobación usa la finalización, de modo que un proceso iniciado antes del error sí puede acreditar recuperación si termina correctamente después.

Se ha actualizado el consumidor de `listIntegrations` para transmitir `last_error_at`. Este cambio corrige la evidencia `recoverableErrorVerified` que recibe la evaluación de preparación del conector. No sustituye a la salud, frescura, permisos y demás requisitos de esa evaluación.

Archivos:
- [integrations.ts](../../apps/api/src/integrations.ts): cálculo compartido y llamada desde el listado.
- [integrations-configuration.test.ts](../../apps/api/src/integrations-configuration.test.ts): fixtures y regresión.

La corrección no modifica credenciales ni cambia una conexión a estado conectado. La causa original del error requiere su diagnóstico y una sincronización posterior verificable.

## 2. Validación

La prueba nueva falló antes del cambio, devolviendo recuperación verdadera para un éxito anterior al último error. Después, las **6 pruebas del archivo pasaron**, con cero fallos y cero omitidas.

La regresión comprueba ocho condiciones: error posterior al éxito, éxito finalizado después del error aunque empezara antes, igualdad temporal, fecha de error inválida, finalización ausente, finalización inválida, éxito de otra conexión y último resultado parcial. Se conservan los casos existentes que exigen un fallo previo antes de acreditar recuperación.

La comprobación de tipos de los dos archivos modificados y sus dependencias pasó con las opciones estrictas relevantes de la configuración del repositorio:

```text
tsc --ignoreConfig --noEmit --target ES2022 --lib ES2022,DOM,DOM.Iterable
    --module NodeNext --moduleResolution NodeNext --strict
    --exactOptionalPropertyTypes --noUncheckedIndexedAccess --skipLibCheck
    --esModuleInterop --resolveJsonModule --types node
    apps/api/src/integrations.ts apps/api/src/integrations-configuration.test.ts
```

La comprobación global `npm run typecheck --workspace apps/api` encontró **TS2352 en studio-ai-chat.ts, línea 473**, en un cambio concurrente del contexto de marketing. Ese archivo ya figuraba modificado por otra actividad y no se ha alterado en este incremento. La API completa no se declara validada hasta resolverlo y repetir el chequeo global.

La comprobación de diferencias de espacios del código modificado también pasó. No se ejecutaron llamadas a proveedores ni pruebas remotas que modifiquen datos.

## 3. Conciliación del historial de migraciones

| Medida | Snapshot inicial | Última consulta de este avance |
|---|---|---|
| Entradas remotas | 703 | 713 |
| Archivos SQL locales | 626 | 626 |
| Versiones locales sin registro remoto | 10 | 0 |
| Versiones remotas sin archivo local por identificador | 87 | 87 |

La base cambió durante la revisión sin escrituras remotas de esta ejecución. No se atribuye a este trabajo la incorporación de las diez entradas. La nueva comparación por identificador elimina las diez discrepancias locales iniciales; las 87 entradas remotas adicionales siguen requiriendo trazabilidad local.

Tener las versiones registradas no acredita por sí solo que sus efectos sean correctos. Se contrastaron también cuerpos de funciones y metadatos de los objetos esperados.

### Pares inicialmente registrados con otro identificador

| Archivo local | Registro alternativo consultado | Resultado |
|---|---|---|
| `20261031071751_a05_email_pipeline_tools.sql` | `20261031071955` | Contenido idéntico tras normalizar saltos de línea y espacios exteriores |
| `20261031081043_a08_authorized_methodology_audit.sql` | `20261031081228` | El archivo local añade tres `DROP FUNCTION IF EXISTS`; el resto coincide. Los tres cuerpos actuales y los permisos de ejecución de esas funciones coinciden con el destino previsto |

A05 y A08 tienen ahora sus identificadores locales registrados además de los alternativos. Conviene conservar el origen y propósito de esa duplicidad al documentar el historial. No se ha ejecutado una reparación del historial ni repetido las sentencias DROP.

### Ocho migraciones restantes del inventario inicial

| Migración | Evidencia observada en la base | Clasificación en este avance |
|---|---|---|
| `integration_event_delivery` | Tabla de cambios, funciones, triggers, índices y columnas de versión de origen presentes | Efectos inspeccionados presentes; cuerpos de las tres funciones coinciden |
| `a06_stock_event_pilot` | Tres tablas del piloto, funciones y triggers observados | Efectos inspeccionados presentes; no se inscribieron tiendas ni activaron llamadas |
| `a06_stock_event_scoped_claim` | Firma de claim con `target_store_id` y cuerpo coincidente | Implementación contrastada |
| `a06_haiku_model_and_sol_fallback` | Restricción de modelos esperada y override A06 `claude-haiku-5-5` | Configuración de BD presente; el routing efectivo completo sigue siendo otra comprobación |
| `copilot_cost_weighted_credits` | Función de créditos con cuerpo coincidente | Cálculo localizado; no se consultó consumo ni se certifica aquí facturación completa |
| `consultant_launch_readiness` | Siete columnas de entrega, índice por tienda, FK con borrado en cascada, política restrictiva de borradores y función auxiliar presentes | Objetos inspeccionados presentes; la corrección funcional de permisos/envío requiere sus pruebas |
| `consultant_report_branding` | Color de marca con restricción de formato y snapshot de objetivo | Columnas y restricción presentes |
| `camino_consolidation` | Tablas de verificaciones/cierre/aprendizaje, columnas, políticas y funciones esperadas | Cuerpos de las dos funciones coinciden; no se hicieron transiciones reales |

Se verificaron ocho triggers habilitados y ocho índices esperados. La comprobación de políticas acredita su presencia, modalidad y rol; no sustituye una prueba de aislamiento. Las consultas se limitaron a catálogos y metadatos.

### Funciones contrastadas con los archivos locales

Comparación de `pg_proc.prosrc` frente al cuerpo local, normalizando exclusivamente CRLF y espacios exteriores. No se equiparan implementaciones distintas por similitud.

| Función | Última versión local relevante | Cuerpo actual |
|---|---|---|
| `private.a06_capture_inventory_change` | 20261029074726 | Coincide |
| `private.a06_verify_event_store` | 20261029074726 | Coincide |
| `public.camino_proposal_decision` | 20270114100000 | Coincide |
| `public.camino_transition_milestone` | 20270114100000 | Coincide |
| `public.claim_a06_stock_events` | 20261029080642 | Coincide |
| `private.consultant_owned_client_org_ids` | 20270113100001 | Coincide |
| `public.copilot_credit_usage` | 20261029093918 | Coincide |
| `public.finish_a06_stock_event` | 20261029074726 | Coincide |
| `private.keep_newest_shopify_state` | 20261026080914 | Coincide |
| `private.record_integration_change` | 20261026080914 | Coincide |
| `public.set_integration_webhook_health` | 20261026080914 | Coincide |
| `public.ai_knowledge_audit_coverage` | 20261031081043 | Coincide; ejecución solo service_role entre los roles consultados |
| `public.ai_knowledge_audit_document_evidence` | 20261031081043 | Coincide; ejecución solo service_role entre los roles consultados |
| `public.ai_knowledge_audit_semantic_candidates` | 20261031081043 | Coincide; ejecución solo service_role entre los roles consultados |

Para completar IMP-00 falta documentar o recuperar las 87 versiones remotas sin equivalente local y acreditar qué revisión de API, worker y frontend está realmente ejecutándose. La consulta actual no justifica aplicar de nuevo las diez migraciones inicialmente señaladas.

## 4. Diagnóstico de conexiones

| Proveedor | Evidencia mínima obtenida | Decisión |
|---|---|---|
| Meta Ads, dos conexiones | Estado registrado `error`, últimos runs fallidos y código técnico `meta_sync_partial_failure` | Revisar los bloques que fallaron. El mensaje genérico no demuestra la causa ni justifica pedir reconexión por sí solo |
| Shopify, una conexión | Último éxito registrado en septiembre y error de conexión posterior del 1 de noviembre; existía un fallo anterior al éxito | Corregido el falso positivo de recuperación. La causa del error actual no quedó identificada con los metadatos minimizados consultados |

El código de Meta convierte muchos fallos distintos en `meta_sync_partial_failure`; su utilidad diagnóstica es limitada. Un siguiente diagnóstico debe revisar los errores de bloques con minimización de datos y ámbitos autorizados. Un `last_sync_at` reciente tampoco prueba que todas las fuentes terminaran correctamente.

Se consultaron logs agregados por servicio y los avisos de seguridad de la plataforma como contexto de diagnóstico. No se usaron para atribuir sin evidencia la causa de los fallos de conexión, ni se cambiaron políticas o permisos desde esos avisos.

No se leyeron credenciales, pedidos, perfiles de compradores o mensajes originales de clientes. No se forzó una reconexión o sincronización ni se borraron estados de error.

## 5. Estado y continuación

| Parte del plan | Resultado |
|---|---|
| IMP-00, diferencias locales iniciales | Cero versiones locales sin registro en la consulta final; efectos principales inspeccionados y documentados |
| IMP-00, historial completo y despliegue | Parcial: 87 versiones remotas sin archivo local y revisión de aplicación sin acreditar |
| Fiabilidad de conexiones | Corregido localmente el marcador de recuperación; seis pruebas y chequeo de tipos acotado superados |
| Compilación global | Pendiente por error concurrente en contexto de marketing |
| Activación | Pendiente; sin despliegue ni escrituras remotas de esta ejecución |
| Próximo bloque | Completar trazabilidad/despliegue y avanzar con IMP-02/03; diagnosticar por bloques las conexiones antes de validar métricas reales |

El incremento modifica dos archivos de código y este seguimiento documental. Se conservan los cambios del primer avance y los cambios concurrentes del repositorio. No se crearon commits ni se alteró la rama.

Para revertir este incremento local se debe retirar su cambio de firma, la llamada que pasa el último error y las regresiones asociadas de forma coordinada, preservando cambios ajenos. No hay migraciones ni datos remotos que revertir por esta ejecución.

