# Inicio de implementación controlada — 1 de noviembre de 2026

**Continuación:** [segundo avance: conciliación y recuperación de conexiones](SEGUNDO_AVANCE_CONCILIACION_Y_CONEXIONES_2026-11-01.md). Este registro conserva los resultados del primer incremento; el enlace contiene la comparación posterior y el estado más reciente.

**Estado:** IMP-00 parcialmente contrastado con metadatos reales; primer incremento P0 de IMP-01 implementado localmente.  
**Plan de referencia:** [Plan maestro](../PLAN_MAESTRO_IMPLEMENTACION_CONTROLADA_E_NORA.md).  
**Evidencia de inventario:** [Snapshot JSON](IMP00_BASELINE_2026-11-01.json).  
**Entorno leído:** proyecto Supabase E-NORA, coincidente con el enlace local de `supabase/.temp/project-ref`. La revisión de la base no acredita la revisión de API/worker/frontend desplegados.

## Qué se ha implementado

Se ha corregido el cálculo compartido de medición A24 para que una fuente marcada explícitamente como incompleta (`complete: false`) produzca un estado `unknown`, con razón `source_incomplete`. Antes podía producir `usable_with_attribution_limits` con las filas parciales recibidas.

El resumen de entrega ya no considera completa una fotografía de incidencias vacía, no disponible o incompleta. Exige además que la lectura paginada de incidencias haya confirmado que terminó. Una fuente sin fotografía no provoca una excepción al construir el veredicto.

Las dos entradas A24 —ejecución del agente y consulta de diagnóstico— transmiten ahora la completitud de páginas al cálculo, al manifiesto de fuentes y a la huella de evidencia. Se ha incrementado la versión local del veredicto a `a24-measurement-v5`; el lector de caché existente usa esa constante, por lo que los veredictos v4 no se reutilizarán como v5 después de desplegar.

No se ha aplicado una migración para esta corrección: reutiliza contratos y almacenamiento existentes. La versión nueva no necesita poblarse manualmente: A24 la calculará cuando se ejecute o consulte su diagnóstico. Hasta tener evidencia compatible, sus consumidores deben conservar el comportamiento de estado desconocido.

### Archivos del incremento

- [Motor del veredicto](../../apps/api/src/meta-measurement-verdict.ts).
- [Detalle de evidencia y cobertura](../../apps/api/src/meta-measurement-evidence.ts).
- [Entradas y caché del runtime](../../apps/api/src/ai-runtime.ts).
- [Regresiones del veredicto](../../apps/api/src/meta-measurement-verdict.test.ts).
- [Regresiones de cobertura](../../apps/api/src/meta-measurement-evidence.test.ts).

## Línea base local y conectada

| Comprobación | Resultado observado | Límite |
|---|---|---|
| Versiones activas de agentes | 27; todas las definiciones correspondientes activas y todos los prompts referenciados presentes | Actividad en catálogo, no ejecución efectiva ni modelo final tras routing |
| Herramientas configuradas en esas versiones | 45 nombres distintos; todos aparecen en el registro local y ninguno está marcado `planned` | Su estado local es parcial; no acredita cada ejecutor ni su conexión/permiso |
| Registro local | 86 entradas; `propose_capability` se añade como herramienta concedida por runtime | No todas se ofrecen a todos los agentes |
| Migraciones registradas en base | 703; mayor identificador `20270115110000` | Identificador de migración, no fecha real inferida de ejecución |
| Archivos SQL locales | 626 | La comparación requiere contenido, no solo cantidades |
| Metadatos de conexión | 2 Meta Ads y 1 Shopify en estado registrado `error`; ninguna fila de Klaviyo en esta consulta | No se leyeron tokens ni mensajes de error ni se provocaron llamadas de sincronización; causa y vigencia del error por diagnosticar |
| Configuración por organización | 0 filas en `organization_ai_settings` | No equivale a organizaciones deshabilitadas; los valores por defecto dependen del código y demás controles |
| Caché A24 | 0 filas | No permite validar consumidores con un veredicto real ni medir su precisión |
| RPCs muestreadas | 11 firmas/permisos consultados; existen las de paginación, cobertura y persistencia A24 | Metadatos y ACL, sin ejecutar funciones de escritura ni consultas sobre datos de clientes |

Se leyeron catálogo de agentes/prompts, historial de migraciones, metadatos de funciones y agregados de estado. No se leyeron pedidos, perfiles de compradores, reseñas, transcripciones ni credenciales. No hubo escrituras en servicios conectados.

El snapshot conserva el checksum declarado de cada prompt; no se presenta como una verificación de que ese checksum sea el hash del contenido. Los modelos de la tabla siguiente son los valores guardados en `agent_versions`; la selección final puede depender de la configuración/routing de ejecución.

## Agentes activos observados

| Código | Versión agente | Versión prompt | Modelo declarado en BD | Tools configuradas | Aprobación declarada |
|---|---|---|---|---|---|
| `a01_analista_llamadas` | v8 | v7 | `claude-sonnet-5` | 1 | `required_before_publish` |
| `a02_monitor_negocio` | v13 | v12 | `gpt-6.1-terra` | 1 | `required_before_publish` |
| `a04_generador_tareas` | v13 | v13 | `gpt-6-luna` | 2 | `required_before_publish` |
| `a05_estrategia_campanas` | v5 | v5 | `claude-sonnet-5` | 10 | `required_before_publish` |
| `a06_planificador_stock` | v10 | v9 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a08_gestor_conocimiento` | v8 | v7 | `claude-sonnet-5` | 1 | `required_before_publish` |
| `a09_copiloto_consultor` | v23 | v9 | `claude-sonnet-5` | 43 | `required_before_publish` |
| `a11_generador_marketing` | v11 | v11 | `claude-sonnet-5` | 12 | `required_before_publish` |
| `a12_analista_email` | v4 | v4 | `claude-sonnet-5` | 4 | `required_before_publish` |
| `a13_operativa_shopify` | v2 | v2 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a14_operativa_meta` | v3 | v3 | `claude-sonnet-5` | 5 | `required_before_publish` |
| `a15_analista_imagenes` | v3 | v3 | `claude-sonnet-5` | 0 | `none` |
| `a16_texto_sobre_imagen` | v4 | v4 | `claude-sonnet-5` | 0 | `none` |
| `a17_plan_semanal` | v9 | v9 | `gpt-6-luna` | 2 | `required_before_publish` |
| `a18_plan_mensual` | v8 | v8 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a19_arquitecto_camino` | v17 | v17 | `gpt-6-sol` | 9 | `required_before_publish` |
| `a19_revision_camino` | v5 | v5 | `claude-opus-4-8` | 0 | `none` |
| `a20_retencion_clientes` | v4 | v4 | `claude-sonnet-5` | 4 | `required_before_publish` |
| `a21_adquisicion_shopify` | v7 | v7 | `claude-sonnet-5` | 4 | `required_before_publish` |
| `a22_postventa_shopify` | v8 | v8 | `claude-sonnet-5` | 5 | `required_before_publish` |
| `a23_creatividad_meta` | v10 | v10 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a24_medicion_meta` | v10 | v10 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a25_cambios_meta` | v5 | v5 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a26_contenido_email` | v8 | v8 | `claude-sonnet-5` | 2 | `required_before_publish` |
| `a27_planificador_mailing` | v5 | v5 | `claude-sonnet-5` | 12 | `required_before_publish` |
| `a28_arquitecto_flujos` | v3 | v3 | `claude-sonnet-5` | 1 | `required_before_publish` |
| `a29_analista_metrica` | v5 | v5 | `claude-sonnet-5` | 1 | `none` |

Los nombres concretos de las allowlists y los metadatos del registro están en el JSON. Deben contrastarse también con la autorización del actor, el conector, los controles por organización y las comprobaciones del ejecutor antes de considerar una acción disponible.

## Diferencias de historial que requieren conciliación

Se han localizado 10 versiones de archivos locales sin el mismo identificador en el historial remoto y 87 versiones remotas sin archivo local con ese identificador. Dos de las 10 locales tienen un registro remoto con exactamente el mismo nombre y otro identificador.

Eso demuestra una diferencia de historial. No prueba por sí solo que falte el cambio de esquema ni justifica ejecutar las migraciones pendientes automáticamente. Hay que comparar definiciones y efectos, establecer su origen y dejar un historial reconciliado antes de preparar un despliegue.

| Versión local sin coincidencia | Nombre | Coincidencia remota por nombre |
|---|---|---|
| 20261026080914 | `integration_event_delivery` | Sin coincidencia exacta por nombre |
| 20261029074726 | `a06_stock_event_pilot` | Sin coincidencia exacta por nombre |
| 20261029080642 | `a06_stock_event_scoped_claim` | Sin coincidencia exacta por nombre |
| 20261029085000 | `a06_haiku_model_and_sol_fallback` | Sin coincidencia exacta por nombre |
| 20261029093918 | `copilot_cost_weighted_credits` | Sin coincidencia exacta por nombre |
| 20261031071751 | `a05_email_pipeline_tools` | 20261031071955 (mismo nombre; contenido por contrastar) |
| 20261031081043 | `a08_authorized_methodology_audit` | 20261031081228 (mismo nombre; contenido por contrastar) |
| 20270113100001 | `consultant_launch_readiness` | Sin coincidencia exacta por nombre |
| 20270113100002 | `consultant_report_branding` | Sin coincidencia exacta por nombre |
| 20270114100000 | `camino_consolidation` | Sin coincidencia exacta por nombre |

Las 87 entradas remotas restantes están detalladas por versión y nombre en el snapshot. Las fechas posteriores a hoy en sus nombres no acreditan que sean futuras: estas entradas sí aparecen en el historial consultado.

### Orden para reconciliar

1. Comparar los dos pares con mismo nombre y distinto identificador; comprobar contenido/efecto antes de declararlos equivalentes.
2. Revisar las ocho locales sin nombre coincidente y el esquema/funciones que realmente afectan. Clasificar cada una como necesaria, ya cubierta, reemplazada o retirada, con evidencia.
3. Localizar el origen de las 87 remotas sin versión local y recuperar o documentar sus definiciones sin sobrescribir cambios válidos.
4. Preparar únicamente las modificaciones necesarias, verificar sobre entorno de validación y ejecutar las comprobaciones pertinentes antes de activarlas.
5. Contrastar revisión efectiva de API/worker/frontend y su compatibilidad con ese esquema.

## Validación del incremento

La batería `npm run test:a24-contracts --workspace apps/api` pasó inicialmente con 31 pruebas. Se añadieron regresiones que reprodujeron los fallos antes de corregir el cálculo.

Las nuevas regresiones cubren 13 subcasos: cinco fuentes explícitamente incompletas y ocho condiciones de fotografía/paginación de incidencias. Conservan un caso positivo de evidencia completa.

Después de la corrección, la batería pasó con **46 pruebas, cero fallos y cero omitidas**. El chequeo de tipos detectó una declaración inválida en el nuevo fixture de prueba bajo `exactOptionalPropertyTypes`; se corrigió omitiendo realmente la propiedad opcional. La comprobación final `npm run typecheck --workspace apps/api` terminó correctamente, con código de salida 0.

La última ejecución de la batería A24 tras ese ajuste volvió a pasar las 46 pruebas. También se verificaron 27 enlaces locales entre plan/registro y la consistencia de los recuentos del snapshot. Estos resultados validan el incremento local; no sustituyen la prueba del flujo desplegado con conectores utilizables.

No se ejecutó una batería remota que cree o modifique datos. La validación funcional con conectores reales queda pendiente de resolver su estado y preparar un ámbito de prueba autorizado.

## Cambios concurrentes del repositorio

El inicio de la sesión tenía 936 entradas en Git y HEAD `04c26ec1dd1a2dd40e428ed2d5f43d628cc30a9d`. Durante el trabajo, HEAD pasó a `00ed3dfad43fafc7bf6419483244acd75e7cf582` y el número de cambios descendió por actividad externa concurrente. Este trabajo no creó commits ni hizo reset, limpieza o cambio de rama.

Después de ese cambio se revisó el diff del incremento: los cambios de código de esta ejecución siguen en los cinco archivos enumerados. El snapshot describe la línea base observada; no representa un árbol inmutable mientras hay otras actividades.

## Estado de fases y siguientes acciones

| Trabajo | Estado al terminar este incremento | Siguiente evidencia necesaria |
|---|---|---|
| IMP-00: base de datos y catálogo | Metadatos contrastados; snapshot guardado | Conciliar historiales, acreditar versión de aplicación y disponibilidad por capacidad |
| IMP-01: datos incompletos y cobertura | Corrección local, 46 pruebas y chequeo de tipos superados | Revisión y futura validación en entorno conectado |
| IMP-01: medición completa del plan | Parcial | Casos restantes de calidad, consumidores/panel y datos reales utilizables |
| IMP-02/03 | Pendientes de su revisión e implementación | Economía comparable, ámbitos y aprobaciones más allá de las pruebas ya existentes |
| IMP-10: evaluación progresiva | Batería local A24 ampliada | Límites de coste, piloto y procedimiento de promoción/reversión contrastados |
| RAG, nuevas fuentes y agentes | Pendientes | Cumplir las dependencias del plan antes de activarlos |

La corrección está preparada en el código local. Su activación requiere un despliegue compatible y no se ha realizado en esta ejecución.

## Reversión de este incremento

Revertir únicamente los cambios de esta ejecución en los cinco archivos de código, conservando cambios ajenos. Si se activa la versión nueva en el futuro, restaurar coordinadamente lector/escritor y versión del cálculo; una caché v5 no debe interpretarse como v4. No hay una migración ni datos nuevos que borrar por este incremento.

