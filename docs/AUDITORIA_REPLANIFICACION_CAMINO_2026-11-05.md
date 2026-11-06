# Auditoría de la replanificación de Mi Camino (Fase 0)

**Fecha:** 2026-11-05
**Compara:** la implementación actual con el *Plan maestro de replanificación inteligente*.
**Alcance:** lectura de código y lectura de datos en TEST. No se ha cambiado código, tablas ni prompts.
**Sin comprobar:** PROD, una generación nueva con IA y el móvil.

## 1. Veredicto

Hoy la replanificación es «generar un camino nuevo y archivar el anterior». No modifica una estrategia de forma controlada. No se borra nada, pero el sistema no garantiza la integridad que pide el plan.

De las 24 pruebas obligatorias: **5 pasan, 11 pasan a medias, 7 fallan y 1 no se ha verificado.**

La arquitectura de base sirve y no hace falta sustituirla: propuesta separada en `agent_outputs`, versiones en `strategic_plans`, creación transaccional en `create_strategic_plan_tree` y decisiones con control de concurrencia en `camino_proposal_decision`. Falta la capa de identidad, validación y aplicación.

En TEST no se ha aplicado ninguna replanificación real: hay un solo plan, sin versiones archivadas. El flujo de confirmar no se ha ejecutado nunca con datos.

## 2. Hallazgos críticos

### C1. Las metas cambian de mes en silencio (el fallo de la captura)

`goal.monthly_targets[].month` es un índice relativo, sin mes real ([packages/ai/src/index.ts:943](../packages/ai/src/index.ts#L943)). El mes se calcula después con la fecha de inicio. Hay tres anclas distintas:

| Momento | Qué fija |
|---|---|
| Generar | El modelo razona días desde esa fecha |
| Aceptar | Fechas de hitos y tareas (`caminoProposalToPlanInput`) |
| Activar | `starts_on`, y con él el mes de cada meta ([strategic-plans.ts:961](../apps/api/src/strategic-plans.ts#L961)) |

La vista previa usa siempre la fecha de hoy ([camino-create-panel.tsx:838](../apps/web/src/app/camino/camino-create-panel.tsx#L838)), aunque la propuesta sea de otro mes.

Reproducido con la propuesta real pendiente del 7 de octubre, aceptándola hoy:

| | Generada | Si se acepta hoy |
|---|---|---|
| Meta de 75.000 € | Noviembre 2026 | **Diciembre 2026** |
| Fecha de la meta | Octubre + 53 días | 28 de diciembre |
| Hito «Black Friday preparado el 13 nov» | 13 de noviembre | **12 de diciembre** |

Las propuestas no caducan. TEST tiene 11 en `pending_approval`, la más antigua de hace 40 días.

El plan activo ya tiene una incoherencia menor: su meta de 75.000 € es de noviembre, pero `goal.target_date` es 3 de diciembre.

Además, A19 recibe el plan actual con los mismos índices relativos ([ai-runtime.ts:9464](../apps/api/src/ai-runtime.ts#L9464)). Si copia el «mes 2» de un plan que empezó en octubre, en uno que empieza en noviembre esa cifra cae en diciembre. Esta segunda vía está deducida del código, no reproducida con una generación nueva.

### C2. Confirmar deja la tienda sin Camino activo

Confirmar archiva el plan activo y crea el nuevo como **borrador** ([strategic-plans.ts:3568](../apps/api/src/strategic-plans.ts#L3568)). Hasta que alguien pulse Activar no hay plan `active`, y las revisiones de objetivos y parte del contexto de agentes solo leen planes activos.

Tampoco es atómico. Archivar y crear son dos operaciones, con una restauración manual si falla la segunda. Si el proceso cae entre ambas, no se restaura. `activateStrategicPlan` hace un bucle de updates sin transacción y no comprueba sus errores.

### C3. La propuesta no tiene identidad frente al plan

A19 recibe nombres de fases e hitos, sin ids y sin tareas. Su contrato no tiene referencia a elementos existentes. Por eso:

- La comparación va por nombre de hito ([plan-compare.ts](../apps/web/src/app/camino/plan-compare.ts)). Un hito renombrado figura como retirado y añadido.
- No se puede saber qué tarea se mantiene, se reprograma o se mueve.
- No se pueden aprobar cambios sueltos, solo toda la propuesta.
- Las cifras no son comparables: el plan activo tiene 84 tareas, y su propuesta original 65, porque las rutinas se expanden al crear.

### C4. No hay reconciliación de tareas

Las 72 tareas abiertas del demo seguirían abiertas, enlazadas a hitos archivados, y el plan nuevo crearía otras. El aviso actual lo dice («siguen en Tareas»), pero el resultado son duplicados.

Tampoco se reasignan objetivos vinculados a hitos, campañas del calendario ni reuniones, que siguen apuntando a hitos archivados. Las propuestas de cambio pendientes se quedan en el plan archivado.

### C5. Las decisiones manuales no se distinguen ni se protegen

`created_by` no sirve: la creación con IA guarda también al usuario que aceptó. No existe ninguna marca de edición manual, y A19 no recibe qué cambió una persona.

Hay materia prima para derivarlo sin columnas nuevas: `audit_logs` (entidad y campos editados), `tasks.source` y `camino_objective_changes`.

### C6. Las restricciones económicas no llegan a la IA

El objetivo de margen del 20 % (`net_margin_pct`) existe en `organization_metric_targets`, pero el contexto de A19 no lo incluye. Nada comprueba después si la propuesta lo respeta. La «Protección de margen» del plan no tiene hoy ninguna pieza detrás.

### C7. Las versiones anteriores no se pueden consultar

Los datos se conservan, pero `getStrategicPlan` excluye los archivados ([strategic-plans.ts:235](../apps/api/src/strategic-plans.ts#L235)) y no hay ruta para abrir uno. Configuración solo lista nombre y versión.

`deleteStrategicPlan` no comprueba el estado ([strategic-plans.ts:1153](../apps/api/src/strategic-plans.ts#L1153)): por API se puede borrar en cascada un plan con historial.

### C8. Sin control de concurrencia

La propuesta no guarda de qué plan ni de qué estado salió. Si el Camino cambia durante la revisión, se aplica igual. `replace_plan_id` solo comprueba que el plan exista y sea de la misma tienda.

### C9. Moneda sin conversión al confirmar

Replanificar parte de la moneda de la organización, no de la del plan ([nuevo/page.tsx:174](../apps/web/src/app/camino/nuevo/page.tsx#L174)). Se puede cambiar en pantalla y solo cambia la etiqueta de los importes; el servidor no lo bloquea. `display_fx` no pasa a la nueva versión.

### Efectos secundarios menores

- Generar reescribe el contexto permanente de la tienda antes de confirmar nada ([camino-create-panel.tsx:709](../apps/web/src/app/camino/camino-create-panel.tsx#L709), `PUT camino-context`). Rechazar no lo deshace.
- Las tareas hechas viajan dentro del texto del brief y se cortan a 2.000 caracteres ([camino-create-panel.tsx:416](../apps/web/src/app/camino/camino-create-panel.tsx#L416)). Deben ir como bloque del servidor.
- Generar solo pide ser miembro de la organización. Confirmar sí exige poder gestionar el plan. Un miembro sin permisos puede gastar IA.
- El control de doble generación vive en memoria de un proceso.
- Al entrar en Replanificar se muestra la última propuesta no rechazada, incluida la ya aplicada, como si fuera nueva.

## 3. Reglas innegociables

| Regla | Estado | Detalle |
|---|---|---|
| R1 No destruir historial | Parcial | Replanificar no borra. Falla C7 y el borrado por API |
| R2 No tocar decisiones manuales | No cumple | C5 |
| R3 No alterar objetivos | No cumple | C1, C6. Solo se avisa si cambia la cifra final, no la serie mensual |
| R4 Separar hechos y propuestas | Parcial | El contexto de A19 los separa. La pantalla no distingue meta, previsión y real |
| R5 La propuesta no toca el activo | Parcial | Generar no toca el plan, pero sí el contexto. Confirmar no activa: C2 |
| R6 Validación independiente | Parcial | Hay esquema y normalización de fechas. Nada compara con el plan vigente |

## 4. Flujo y pantallas

| Bloque del plan | Hoy | Falta |
|---|---|---|
| Tres pasos reales | Indicador visual sobre una sola pantalla | Pasos separados que no se puedan saltar |
| Ámbitos de cambio | No existe | Los seis, enviados como datos estructurados |
| Duración | Slider 1–12 y fechas | Selector numérico, partir de la duración del plan, zona horaria de la tienda, final exclusivo |
| Instrucciones | 2.000 caracteres, opcional | Contador cerca del límite, separar de lo que añade el sistema |
| Cuestionario | Wizard de 3 pasos, prioridad obligatoria | En replanificación debe ser opcional y no sobrescribir nada |
| Elementos protegidos | No existe | Bloque visible y lista real de decisiones manuales |
| Restricciones económicas | No existe | Leer margen, metas y presupuesto reales, sin inventar |
| Resumen antes de generar | No existe | Texto derivado de la selección |
| Resumen comparativo | Fases, hitos y tareas por nombre | Valores calculados en servidor y comparables |
| Clasificación de cambios | Se mantiene, añadido, retirado | Modificado, reprogramado, movido y conflicto |
| Revisión económica | Solo la cifra final | Rutas alineadas por mes real |
| Justificación por cambio | Global, por fase y por tarea | Por cambio relevante |
| Rechazo individual | No existe | Decisión por cambio y revalidación |
| Paso 3 | Diálogo con cuatro líneas fijas | Resumen real y bloqueos |
| Resultado | Aviso y vuelta a Mi Camino | Resumen de cambios e historial |

## 5. Pruebas obligatorias

| ID | Escenario | Estado | Motivo |
|---|---|---|---|
| T01 | Cinco ámbitos | Falla | No existen |
| T02 | Duración de 6 meses | Parcial | Cálculo correcto, con fecha del navegador |
| T03 | Instrucciones vacías | Pasa | El brief es opcional |
| T04 | Duración fuera de rango | Pasa | `parseCaminoDurationMonths` |
| T05 | Duración con meta mensual | Falla | Índices relativos |
| T06 | Noviembre pasa a diciembre | Falla | Reproducido con datos reales |
| T07 | IA modifica tarea completada | Parcial | No puede tocar la fila, pero sí repetirla; solo se avisa por título exacto |
| T08 | IA modifica decisión manual | Falla | C5 |
| T09 | Tarea duplicada | Parcial | Solo título exacto contra tareas hechas |
| T10 | Meta de margen modificada | Falla | C6 |
| T11 | Faltan costes | Parcial | «Margen parcial» existe en el plan activo, no en la propuesta |
| T12 | Cancelar el paso 1 | Pasa | Nada se escribe antes de generar |
| T13 | Rechazar propuesta | Parcial | Plan intacto, contexto de tienda reescrito |
| T14 | Generar dos veces | Parcial | Protegido, con control en memoria |
| T15 | Conflicto de versión | Falla | C8 |
| T16 | Error al activar | Parcial | Compensación manual, sin transacción |
| T17 | Historial conservado | Parcial | Datos sí, consulta no |
| T18 | Evidencias conservadas | Pasa | Las filas no se tocan |
| T19 | Sin permisos | Pasa | `assertCanManagePlan` al confirmar y activar |
| T20 | Reabrir propuesta aplicada | Parcial | Servidor devuelve 409; la pantalla la pinta como actual y con meses mal |
| T21 | Cambio de moneda | Falla | C9 |
| T22 | Objetivo futuro sin datos | Parcial | Admite cifras nulas; falta prueba en la comparación, que aún no existe |
| T23 | Texto que anula restricciones | Parcial | El historial está a salvo; las restricciones económicas no |
| T24 | Móvil y teclado | Sin verificar | |

Las pruebas actuales cubren piezas (`camino-proposal`, `camino-proposal-adjustment`, `plan-compare`). Ninguna cubre el flujo de sustitución. `scripts/camino-consolidation-db.test.mjs` sirve de plantilla para probar el SQL con PGlite y datos sintéticos.

## 6. Qué se reutiliza

| Necesidad | Pieza existente |
|---|---|
| Borrador | `agent_outputs` con `agent_context_snapshots` |
| Transacción y bloqueo por tienda | `create_strategic_plan_tree` |
| Valor anterior y nuevo, control de obsolescencia | Patrón de `camino_proposal_decision` y `captureCaminoChange` |
| Rutinas expandidas | `recurrenceDates` |
| Ruta mensual | `MonthlyRoute` |
| Margen y cobertura de costes | `camino-economics.ts` |
| Moneda | `fx_rates` y `display_fx` |
| Evidencias | `EvidenceChips` |
| Auditoría | `audit_logs` |
| Comparación | Se sustituye `plan-compare.ts`: el diff debe calcularse en servidor |

No hacen falta tablas nuevas.

## 7. Plan de migración

**Fase 1. Integridad (sin pantallas)**
- Añadir el mes real a cada meta mensual (`period: "2026-11"`), calculado por el servidor al normalizar. Los planes y propuestas antiguos conservan el índice y se resuelven con su fecha de inicio.
- Guardar en la propuesta el plan de origen, su versión y una huella del estado.
- Nuevo módulo puro de validación con cada regla, bloqueante o conflicto.
- Nuevo módulo puro de diferencias por identificador.
- Pruebas T05 a T10, T15 y T21.

**Fase 2. Contrato y A19**
- Referencias opcionales a hito y tarea de origen en el contrato, para que las propuestas antiguas sigan leyéndose.
- Prompt v18 con instrucciones de replanificación y justificación por cambio.
- Contexto con ids, tareas, hechas, decisiones manuales y restricciones como bloques del servidor.
- Evaluarlo en TEST con una generación real antes de cerrar.

**Fase 3. Aplicación**
- Nueva función SQL transaccional que bloquee, compare la huella, archive, cree y active en una sola operación.
- Reconciliación: tareas conservadas, retiradas con motivo, objetivos, campañas y reuniones.
- Guardar `replaces_plan_id` y un resumen de la replanificación en el plan nuevo.
- Lectura de versiones archivadas y bloqueo del borrado de planes con historial.
- Prueba de SQL con PGlite para T16, T17 y T18.

**Fase 4. Pantallas**
- Paso 1, Paso 2 con decisiones por cambio, Paso 3 y resultado.
- Las pantallas no aplican reglas: muestran lo que devuelve el servidor.

**Fase 5. Cierre**
- Prueba de flujo completo en TEST, móvil, teclado y regresión.
- Migraciones en PROD antes que el código, comprobando `schema_migrations`.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Listados de tareas toman el primer enlace de la tarea ([operations.ts:852](../apps/api/src/operations.ts#L852), [consultant.ts:1800](../apps/api/src/consultant.ts#L1800)); dos enlaces darían un hito arbitrario | Mover el enlace en vez de duplicarlo y dejar la trazabilidad en el resumen |
| El prompt v18 empeora la calidad de A19 | Evaluar en TEST, conservar v17 activable |
| Propuestas antiguas sin referencias | Marcarlas como no aplicables en replanificación |
| Otra sesión edita estos ficheros a la vez | Revisar el diff antes de tocar `server.ts` y `strategic-plans.ts` |
| PROD no comprobado | Autorización de Rafa antes de migrar |
| Lentitud de TEST | Reintentos y validación por SQL |

## 9. Decisiones tomadas (Rafa, 2026-11-05)

1. **Confirmar activa directamente**, en la misma transacción. Replanificar un borrador lo sustituye y sigue en borrador.
2. **Fechas fijadas al generar**, sin reanclar al aceptar. Una propuesta caduca si cambia el mes natural o supera 7 días. Vale también para caminos nuevos: cierra la duda de Black Friday.
3. **Tareas abiertas:** la misma tarea continúa, con su historia y responsable. Las que salen pasan a descartadas con motivo y se pueden recuperar.
4. **Tareas hechas:** se quedan en su versión; la nueva muestra un contador de heredadas.

## 10. Estado tras implementar (2026-11-05)

Migraciones `20270117100000` y `20270118100000` aplicadas en TEST y PROD. En PROD siguen pendientes `20270115120000` y `20270115130000`, que no son de este trabajo.

### Comparación de modelos por CLI

Mismo contexto real de A19, prompt v17 con las reglas de replanificación y contrato nativo. Sonnet y Haiku corrieron antes de añadir al contrato una frase sobre unificar rutinas; Opus, Luna, Sol y Terra la recibieron. Codex corrió con esfuerzo medio. Resultados en `.e-nora-test-lab/a19-replan-2026-11-05/`; se repite con `scripts/a19-replan-model-comparison.mts`.

| Modelo | Tiempo | Coste API equivalente | Contrato | Cubre abiertas | Meta de noviembre | Lectura |
|---|---|---|---|---|---|---|
| Opus 5.5 | 15,2 min | 2,73–3,12 USD | Sí | 53 de 71 | 75.000 € | **Elegido.** Ve que el stock (457 unidades) no cubre noviembre y detecta datos incoherentes |
| Sonnet 5.5 | 5,0 min | 0,72–0,89 USD | Sí | 47 de 71 | 75.000 € | Mejor relación calidad/coste; cubre mejor las fechas comerciales |
| Haiku 5.5 | 9,8 min | 0,51–0,59 USD | Sí | 53 de 71 | 75.000 € | Correcto, más mecánico; deja mayo sin cifra |
| Sol 6.1 | 8,7 min | 0,42 USD | Sí | 40 de 71 | 75.000 € | **Segundo, y el recomendado para la app.** Instrucciones en todas las tareas y ninguna cifra inventada; solo deja 8 tareas intactas |
| Terra 6.1 | 4,1 min | 0,15 USD | Sí | 32 de 71 | 75.000 € | Plan reducido a 55 abiertas; mantiene abril en 12.000 € y lo avisa, deja mayo sin cifra |
| Luna 6 | 5,0 min | 0,02 USD | Sí | 15 de 71 | 75.000 € | Descartado: retira 55 de 71 tareas y deja 25 abiertas |

Ninguno movió la meta de mes ni repitió tareas hechas por título. Es un solo caso, en una tienda. Solo Opus calcula que las 457 unidades cubren unos 22.000 €, y solo Opus y Haiku señalan los 84.813 € de envío absorbidos. Rafa decidió dejar a Opus como modelo de A19 y a Sol de respaldo (`A19_MODEL_DECISION`, provisional).

### A19 por la API con Opus

Ejecución real en TEST con `scripts/a19-replan-api-run.mts`, mismo flujo que la app. Propuesta pendiente: `agent_outputs` `510d0a66-fbe9-4bc6-b9bc-c708f6d39697`, run `42285660-e854-4905-9cce-7dbd54f57706`. Caduca el 12 de noviembre y deja de valer si el Camino cambia antes. Sustituye en pantalla a la de la CLI (`b8b7f574-…`).

| Fase | Tiempo | Coste estimado |
|---|---|---|
| Estrategia | 13,6 min | 3,07 USD |
| Detalle de tareas | 6,5 min | 3,64 USD |
| **Total** | **20 min** | **6,71 USD** |

Para que funcionara hubo que cambiar `runAgentTurn` en `packages/ai`:

- Anthropic rechaza por tamaño la gramática del contrato del Camino. Ante ese error, reintenta con el esquema en la instrucción y valida con el mismo contrato.
- El tope de salida estaba fijo en 16.000 tokens. Ahora sube con `maxCompletionTokens` y va en streaming por encima de ese valor.
- El esfuerzo se aplica a Claude de la familia 5; antes se ignoraba y Opus 5.5 corría en `medium`.
- Se reanudan los turnos pausados (`pause_turn`) de la búsqueda web.

El respaldo a Sol no se ha ejecutado: OpenAI sigue sin crédito. Además solo entra ante fallos del proveedor antes de consumir tokens, no ante una respuesta inválida.

Diferencias con el plan de migración de la sección 7:

- No hay prompt v18. Las reglas de replanificación van en `CAMINO_REPLAN_CONTRACT`, y A19 solo las recibe al replanificar: los caminos nuevos siguen con v17.
- Las decisiones por cambio no se guardan: viajan en la confirmación y el servidor recalcula todo. Si se recarga la pantalla, se vuelven a tomar.

| ID | Estado | Cómo se ha comprobado |
|---|---|---|
| T01, T02, T04 | Pasa | Tests y pantalla |
| T03 | Pasa | El brief sigue siendo opcional |
| T05 a T10, T21, T22 | Pasa | `camino-replan.test.ts` |
| T11 | Pasa | Aviso de costes parciales en la revisión |
| T12, T13 | Pasa | Generar ya no reescribe el contexto de la tienda |
| T14 a T18, T20 | Pasa | `scripts/camino-replan-db.test.mjs`, y la transacción real en TEST con rollback |
| T19 | Pasa por código | `assertCanManagePlan`; generar también lo exige ahora. Sin prueba específica |
| T23 | Parcial | Las reglas deterministas no dependen del texto. Falta verlo con el modelo real |
| T24 | Parcial | Sin desbordes a 390 px en los tres pasos. Teclado sin probar a fondo |

Sin probar:

- **El respaldo a Sol.** OpenAI devuelve `insufficient_quota`: si Opus cae, A19 falla hasta recargar crédito.
- **Confirmar desde la pantalla contra la API real.** La revisión y el paso 3 sí se recorrieron con la propuesta real. La transacción se probó en TEST con rollback, para no sustituir el plan demo.

Límites conocidos:

- El mes de cada meta se fija en UTC, no en la zona de la tienda: el día de cambio de mes puede diferir unas horas.
- Los duplicados se detectan por palabras en común, no por significado.
- Las propuestas de cambio pendientes del plan anterior quedan en esa versión, sin aviso en la confirmación.
- Tras un cambio concurrente hay que generar otra propuesta, aunque el cambio fuera pequeño.
