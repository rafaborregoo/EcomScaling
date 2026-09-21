# Tareas pendientes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â conocimiento a software

Lo que queda abierto de `docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md`, separado
por **quien puede cerrarlo**. Se actualiza en el mismo turno en que aparece la
tarea, no despues: una deuda que solo vive en una conversacion esta perdida.

Los bloqueadores de proveedor (Meta, Klaviyo, Shopify App Store) siguen en
[`roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`](../roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md),
que es el checklist canonico del piloto. Aqui solo lo de esta linea de trabajo.

---

## Integracion transversal Copiloto-first — bloqueante antes de F7

El producto se esta construyendo para que el Copiloto consulte y explique los
resultados. La auditoria transversal F3-F6 queda cerrada el 2026-09-18 con un
adaptador de contexto comun, el feed de `InsightsMenu` y el prompt versionado
de A09. Esta deuda no se resuelve creando escrituras automaticas: el Copiloto
lee evidencia y propone con los controles existentes.

- [x] **Inventariar F3 bloque a bloque (D01–D14).** Declarar para cada uno la
      tool o adaptador de contexto, los campos que puede leer, el agente y la
      version/`allowed_tools`; dejar motivo explicito en D00 y en cualquier
      bloque que aun no deba exponerse.
- [x] **Auditar F4 y F5.** Confirmar que decisiones y playbooks llegan al
      Copiloto con `organization_id`, `as_of`, `source_refs`, `reason_codes`,
      `UNKNOWN`, `ABSTAIN`, `BLOCKED` y `VALIDATION_REQUIRED` sin perder
      semantica.
- [x] **Auditar F6.** Renombrar el contexto que hoy se presenta como F5 para
      incluir benchmarks y guardrails, enriquecer el resumen con facts/unknowns
      y decidir si hace falta una tool de lectura especifica para assessments F6.
- [x] **Alinear prompt y permisos.** Dejar escrito que `UNKNOWN` no es falso,
      confidence no autoriza ejecucion y toda mutacion pasa por propuesta,
      aprobacion, idempotencia y auditoria; actualizar `allowed_tools` solo con
      una version identificable del agente.
- [x] **Probar el camino del agente.** Añadir tests de contrato/contexto,
      aislamiento entre organizaciones y una pregunta representativa con datos
      reales usando `.env.local`; comprobar tambien el salto de `InsightsMenu`
      al ancla exacta de cada card. La campana de notificaciones permanece
      separada.
- [x] **Cerrar la pausa antes de abrir F7.** Documentar la auditoria en el
      plan maestro, el indice y la bitacora de la fase correspondiente. Puede
      resolverse con un adaptador comun; no hace falta una tool distinta por
      bloque si se conserva procedencia y semantica.

### Cierre de la auditoria Copiloto-first — 2026-09-18

Las casillas anteriores quedan resueltas por el adaptador común y no por una
tool nueva por bloque: el snapshot del caso cubre D00-D11, D12/D13 se leen de
sus revisiones actuales y D14 de la salida versionada. A09 v8 consume el
contexto con prompt v4 y mantiene sus permisos de lectura y aprobación.

La verificación unitaria cubre contrato, unknowns, aislamiento tenant y
navegación. El smoke test transaccional sobre `.env.local` creó dos casos reales
en dos organizaciones, leyó solo un tenant, obtuvo D12/D13/D14, comprobó que
existían filas del otro tenant y terminó con rollback; la comprobación posterior
dejó `diagnostic_cases`, `diagnostic_outputs`, `diagnostic_robustness` y
`temporal_diagnoses` a cero. F7 queda desbloqueable, pero no se abre en esta
auditoría.

---

## Para Rafa ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â nadie mas puede hacerlo

- [ ] **Reautorizar Shopify en `ecomscaling-dev.myshopify.com`.** La credencial
      caduco el 2026-09-14 y la conexion esta en `syncing` sin traer dato. El
      motor de `D01` ya lo detecta solo y lo marca como
      `credential_expired` / `blocked`, asi que mientras no se reconecte
      **ninguna senal de esa tienda sostiene un diagnostico** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â que es el
      comportamiento correcto, pero deja la tienda a ciegas.
- [ ] **Decidir que pasa con las cuatro conexiones de Meta Ads en `pending`.**
      Nunca han sincronizado. El motor no las marca como rotas a proposito
      (`pending` es "recien creada", no "averiada"), asi que se quedan
      invisibles: ni dan dato ni dan aviso. O se completan o se descartan.
- [ ] **Activar los `schedule` de los workflows de motores**, si procede.
      `Data Quality Engine`, `Signal Engine`, `Context Engine`, `Symptom
      Engine` y `Maturity Engine` estan sin
      disparador automatico por decision tuya del 2026-08-03: hoy solo corren a
      mano desde Actions. Mientras sigan asi, **las pantallas de fase 3 muestran
      la ultima pasada manual**, no el estado de hoy. Si se activan, el orden de
      la cadena importa: calidad (06:07), senales (06:17), contexto (06:27) y
      sintomas (06:37). El de madurez va aparte (05:47) porque no depende de
      ellos: mide de que es capaz el negocio, no que se ha movido.
- [ ] **Desplegar la API y el worker al VPS.** El arreglo de la atribucion
      vive en `shopify-order-journey.ts` y corre dentro de la reconciliacion,
      que ya esta programada en el worker. Hasta que se despliegue, la cola de
      419 pedidos sigue parada: el esquema esta puesto en produccion, el codigo
      no.
- [ ] **Commits.** Hay ficheros sin commitear y la instruccion es no hacer
      commits ni push. Cuando quieras, dime y los preparo.
- [ ] **Destilar el bloque que sigue sin capas** (`8.12`): `7.15`, `7.17` y
      `7.18` ya están implementados end-to-end y documentados; `8.12` queda
      fuera de F7.

---

## Deuda anotada ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â la cierro yo cuando toque

Cada una lleva **por que se dejo**, que es lo que permite decidir si sigue
siendo buena idea dejarla.

### De `D01` (calidad de datos)

- [ ] **Vista de platform_admin: que fuentes fallan en toda la cartera.**
      Un `permission_gap` en doce clientes es un problema de producto, no de
      doce clientes. *Por que se dejo:* es observabilidad entre organizaciones y
      vive en `/admin/observabilidad`; tiene mas sentido hacerla una vez para
      varios bloques de la fase que bloque a bloque.
- [ ] **Reconciliacion entre fuentes** (`data_source_reconciliations`, pasos 4,
      5, 6 y 17 del runtime). *Por que se dejo:* hace falta una **segunda fuente
      comparable** sobre el mismo fenomeno, y hoy solo Shopify tiene serie
      diaria. La tabla y el contrato existen desde el primer dia esperando a
      Meta y Klaviyo.
- [ ] **Pasos 7, 8, 12, 13, 14 y 18 del runtime** (schema drift, checks
      matematicos, lineage, atribucion, limpieza de no representativos,
      ponderacion). *Por que se dejaron:* necesitan el evento crudo o piezas que
      todavia no existen.

### De `D02` (contextualizacion)

- [x] ~~**Mover la apertura de casos diagnosticos a `D06`.**~~ **Descartada el
      2026-09-28, al construir `D06`: era una mala idea.** El paso 7 del runtime
      de `D06` obliga a leer la lectura contextual de `D02`, y esa lectura
      cuelga de un caso. Si `D06` abriera el caso, `D02` no podria escribir
      antes y `D06` no tendria contexto que leer: es un ciclo. El caso lo abre
      quien lo necesita primero, que es `D02`, y se queda ahi.
- [ ] **Dejar que el cliente escriba su contexto declarado**
      (`tenant_context_facts`, en onboarding y en su perfil). El motor ya lo lee
      si existe; sin eso, los pasos 9 y 13 del runtime --cambios internos y
      contradicciones declarado/observado-- no tienen materia prima.
- [ ] **Dimensiones `device`, `market` y `product` en el mix.**
      *Por que se dejo:* `shopify_order_facts` no las sostiene. No se simulan:
      el motor las declara en `missing_context`.
- [ ] **Calibrar `DOMINANCIA_MINIMA`** (0.75). Es el umbral a partir del cual se
      dice que el cambio fue de rendimiento o de composicion, y **el numero es
      nuestro, no del artefacto**. Con casos reales delante se vera si es el
      correcto.

### De `D06` (motor de sintomas)

- [ ] **Ampliar la libreria de patrones** (`SYMPTOM_TEMPLATES`). Tiene cuatro
      entradas: las dos metricas que `D05` sabe emitir, en sus dos direcciones.
      *Por que se dejo:* una libreria con entradas para metricas que nadie
      calcula solo sirve para aparentar cobertura. Crece con `D05`.
- [ ] **Declarar mas relaciones entre metricas** en `metric_dependencies`. Hoy
      solo esta la aritmetica de ventas y pedidos, asi que la unica jerarquia
      posible es esa. Cada relacion nueva --embudo, economica, operacional--
      amplia lo que el motor puede relacionar **sin tocar codigo**, que es el
      punto del diseno.
- [ ] **Evidencia cualitativa** (paso 18): resenas, tickets, llamadas. El
      esquema y el guardrail de representatividad estan desde el primer dia;
      falta ingerir la materia prima.
- [ ] **Composicion de sintomas superiores** (paso 16). *Por que se dejo:*
      agrupar familias distintas bajo un mismo padre exige declarar que las
      relaciona, y hoy la unica relacion declarada es aritmetica.
- [ ] **`D07` no recorre el grafo de relaciones candidatas.** El motor las
      escribe (`often_cooccurs`) y nadie las lee todavia.

### De `D03` (madurez por capacidad)

- [ ] **Decidir `required_level` por capacidad.** Es el recorte mas grande del
      bloque y **no es codigo**: el apartado 19 del artefacto dice que el
      algoritmo, los umbrales y las ponderaciones no estan definidos, asi que
      el motor no los inventa y la pantalla escribe "nadie ha dicho que necesita
      este negocio". Sin esto no hay brecha, y sin brecha no hay pasos 5 a 14
      del runtime (asimetrias, cuellos de botella, regresion, riesgo latente,
      growth-system fit, sobreingenieria).
- [ ] **Escribir el resto del grafo de capacidades.** Van 7 aristas, que son
      literalmente las que el artefacto escribe. Las demas son conocimiento de
      ecommerce por escribir, y ponerlas a ojo seria lo mismo que inventar los
      umbrales.
- [ ] **Conectar el `business_stage` de la fase 2.** `D03` lo consume y no lo
      redefine; hoy se queda nulo porque la fase 2 no esta implementada.
- [ ] **Dejar que una persona suba una capacidad por encima de `defined`.** El
      motor tiene techo estructural ahi: `measured` exige que la medida cambie
      decisiones (guardrail 20) y eso no esta en ninguna tabla. Falta la pantalla
      donde el consultor marque `influences_decisions` y `has_ownership`.
- [x] ~~**El 96% de los pedidos no trae origen.**~~ **Arreglado el 2026-09-15.**
      No era un problema de permisos: el webhook de Shopify no trae el customer
      journey y la reconciliacion incremental filtra por `updated_at`, asi que
      un pedido que entraba por webhook y no se volvia a tocar no se pedia
      nunca. Ahora la reconciliacion lo rellena (`shopify-order-journey.ts`).
      **Cola en produccion: 419 pedidos** dentro de la ventana esperando la
      primera pasada; 334 se quedan fuera porque Shopify ya no guarda su
      journey y eso no tiene arreglo.
- [x] ~~**Nadie puede declarar un `health_reference`.**~~ **Hecho el
      2026-10-04**: panel en `/shopify/diagnostico`, justo encima de la salud.
      Verificado de punta a punta -- declarar `cac <= 32 EUR` hace que la
      adquisicion pase de `not_assessable` a `bad` con el motivo escrito.
      Queda: el alcance por tienda (hoy se declara por organizacion) y los
      umbrales de severidad de `D10`, que son otra pregunta.
- [ ] **Los umbrales de severidad de `D10` siguen sin sitio.** Con el guardrail
      economico declarado, `D04` ya dice si una capacidad esta mal. `D10` sigue
      sacando las cinco severidades en `unknown` porque nadie ha dicho **a partir
      de que cuota esto es grave** -- y eso es otra pregunta, con otra respuesta
      por tienda. Antes del formulario hace falta la decision.
- [ ] **Coste por referencia: 43 de 44 vacias.** Sin coste no hay margen, y sin
      margen `D03` declara la economia unitaria no observable. Se rellena en
      Shopify (coste por variante) o conectando la fuente que lo tenga.
- [ ] **No hay historico de existencias** (`shopify_inventory_level_snapshots`
      esta a cero). Se sabe el stock de hoy, no el de la semana pasada.

### De la fase 3 entera

**Estado canÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico 2026-09-16:** D13 y D14 estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n hechos; F3 estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ cerrada y F4
queda habilitada. Las casillas histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ricas de esta secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se conservan como
bitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cora, pero no representan trabajo abierto.

- [x] ~~**4 flujos escritos y sin implementar**: `d07`, `d09`, `d10` y
      `d11`.~~ **Hechos los cuatro** (2026-10-06, `d07` y `d09` los ultimos).
- [x] ~~**D12: verificar el motor y flujo runtime en staging.**~~ **Hecho el
      2026-09-16** usando `env.local`: dos pasadas, revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n vigente e
      histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rica, conteo de confusores/checks y limpieza verificada a cero.
- [ ] **2 bloques que necesitan motor y no tienen flujo escrito**: `D13`,
      `D14`. Ahi si hay diseno que hacer. (`D04` y `D08` ya tienen motor
      propio, escrito sin flujo formal.)
- [ ] **Pantalla en 2 de los 15 bloques** (`D13`, `D14`; `D00` no necesita).
      La matriz de audiencia de
      [`fase-03/IMPLEMENTACION.md`](fase-03/IMPLEMENTACION.md) ya dice que lleva
      cada una.
- [ ] **`D09` cierra la cadena causal, y `D11` no se ha vuelto a mirar desde
      entonces.** Las capas `why`, `root_cause` y `constraint` de
      `packages/contracts/src/confidence.ts` siguen escribiendo "no puede
      determinarse... D07, D08 y D09 no tienen motor" **codigo por codigo**, y
      eso ya no es cierto: los tres tienen motor desde el 2026-10-06. Es la
      razon de ser de D11 -- reflejar lo que los demas bloques han
      determinado -- y hoy no lo hace. Hace falta leer `causal_paths`,
      `diagnostic_hypotheses` y `root_causes` del caso y traducir su estado
      real a esas tres capas, en vez del texto fijo actual. No es un bug (el
      texto sigue siendo honesto: **sigue** sin haber una causa cerrada), pero
      la pantalla ya no explica **por que** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â el motivo real hoy es "la
      evidencia es correlacion", no "no existe el motor".
- [ ] **Ningun agente lee todavia una tabla de fase 3.** Conectarlos es anadir
      una tool y subir una version de `agent_versions`, no tocar el runtime
      (apartado 10 del plan).
- [ ] **Retirar o corregir `.env.tests` obsoleto.** `env.local` ya apunta al
      staging documentado `kopcblejsxpkxoykldyh`; `.env.tests` sigue
      referenciando un proyecto sin DNS y puede provocar una verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en el
      entorno equivocado. No reutilizar una clave entre proyectos ni apuntar a
      producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- [ ] **D12: decidir el presupuesto de recursiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y su efecto en D11.** El motor
      deja la reapertura explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cita (`revision_triggered`, `reopened_blocks`),
      pero no reabre ni consume presupuesto automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente hasta que esa
      polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© decidida.

### Anteriores, aun abiertas

- [ ] **No existe drenaje de reintentos de webhooks.** Un webhook fallido se
      queda ahi; `D01` ahora lo detecta y lo reporta, pero nadie lo reprocesa.
- [ ] **`fase-06/02-contratos-IA` tiene 17 ficheros legacy** a granel, sin el
      renombrado que tienen las demas capas.
- [ ] **El bypass del guardrail de `pending_deletion` sigue sin explicacion.**

### Apertura F4/P00 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 2026-09-16

- [x] ~~**Aplicar y verificar `4.00/P00` en `.env.local`.**~~ El contrato,
      runtime, worker, workflow y panel se probaron con una ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real
      `INPUT_INCOMPLETE` por ausencia de contexto P1 y limpieza confirmada.
- [x] ~~**Implementar `4.01` despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de cerrar P00.**~~ Contrato, tests,
      snapshots, runtime, worker, API, panel y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real con
      `.env.local`; se probÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `COMPLETE` con declaraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n temporal e
      `INCOMPLETE` sin objetivo, y se confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ cleanup.

### Cierre de integracion D11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 2026-09-16

- [x] ~~Integrar D11 con D07, D08 y D09.~~ El motor ahora consume rutas,
      hipotesis, causas raiz y constraints del caso, con aislamiento por
      organizacion y degradacion explicita cuando faltan.
- [x] ~~Verificar D11 con datos reales.~~ `.env.local` sobre
      `kopcblejsxpkxoykldyh`: D07 -> D08 -> D09 -> D11, dos pasadas identicas,
      tres claims causales no genericos y limpieza a cero.
- [x] ~~D11 completo.~~ La deuda de integracion queda cerrada; F4 puede comenzar.
### Cierre F3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 2026-09-16

- [x] ~~D13: flujo runtime, motor temporal, worker, workflow, panel y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real.~~ Hecho con `env.local`; la prueba sembrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ y eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una serie temporal y confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la limpieza.
- [x] ~~D14: flujo runtime, motor de salida, 11 validadores, snapshot/ledger, worker, workflow, panel y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real.~~ Hecho con `env.local`; la salida insuficiente quedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ correctamente `invalid_output`, con 11 validadores y cleanup a cero.
- [x] ~~F3 cerrada.~~ D13 y D14 estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n en `hecho`; F4 deja de estar bloqueada.

### Avance F4/P01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 2026-09-16

- [x] ~~**Implementar `4.01` contexto de decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y objetivos.**~~ Contrato,
      tests, migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, snapshots, runtime, worker, API, panel y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
      real con `.env.local`; se probÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `COMPLETE` con declaraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n temporal y
      `INCOMPLETE` sin objetivo, y se confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ cleanup.
- [x] ~~**Implementar `4.03` urgencia y sensibilidad temporal.**~~ Contrato,
      tests, migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, runtime, worker, workflow, API y panel verificados con
      `.env.local`; la prueba real confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `TIME_CRITICAL`, ejecutÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ las cinco
      organizaciones sin fallos y limpiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la fila temporal.
- [x] ~~**Implementar `4.04` impacto decisional y valor en juego.**~~ Contrato,
      tests, migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, runtime, worker, workflow, API y panel verificados con
      `.env.local`; perfil `HIGH`, cinco organizaciones sin fallos y cleanup.
- [x] ~~**Implementar `4.05` constraints y dependencias.**~~ Contrato, tests,
      migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, runtime, worker, workflow, API y panel verificados con
      `.env.local`; cinco organizaciones sin fallos y cleanup confirmado.
- [x] ~~**Implementar `4.06` esfuerzo, recursos y factibilidad.**~~ Contrato, tests, migraciÃƒÆ’Ã‚Â³n, runtime, worker, API, panel y verificaciÃƒÆ’Ã‚Â³n real en `.env.local`; cinco organizaciones sin fallos y cleanup confirmado.
      y repetir contrato, motor, pixel, verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real y documentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

### Avance F4/P03 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 2026-09-16

- [x] ~~**P03 urgencia y sensibilidad temporal.**~~ No mezcla urgencia con
      severidad o prioridad; mantiene `UNKNOWN` cuando no existen ventanas,
      deadlines o lead times observables. El artefacto de tenant-context
      referenciado por el manifiesto falta en el corpus y queda como recorte
      explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito.
- [x] ~~**Abrir e implementar `4.04`.**~~ P04 conserva el valor en juego sin
      mezclarlo con urgencia, severidad o ranking; la falta de economics y
      counterfactual queda como unknown explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito.
- [x] ~~**Abrir e implementar `4.05`.**~~ P05 separa mapa de constraints y
      grafo de dependencias, y mantiene objetivo/evidencia/falsifier explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­citos.
- [x] ~~**Abrir `4.06`.**~~ P06 queda hecho tras revisar el artefacto y sus guardrails; F4 continÃƒÆ’Ã‚Âºa con P07.
      F4 sigue abierta.


### Cierre F4 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-09-16

- [x] ~~**Implementar 4.06 factibilidad.**~~ Cinco organizaciones procesadas
      sin fallos y cleanup confirmado en .env.local.
- [x] ~~**Implementar 4.07 riesgo y reversibilidad.**~~ Contrato, motor, worker,
      API, panel y migraciÃƒÆ’Ã‚Â³n verificados; cleanup confirmado.
- [x] ~~**Implementar 4.08 asignaciÃƒÆ’Ã‚Â³n y expected value.**~~ El motor solo calcula
      EV con inputs declarados; verificaciÃƒÆ’Ã‚Â³n y cleanup confirmados.
- [x] ~~**Implementar 4.09 strategic fit.**~~ La falta de declaraciÃƒÆ’Ã‚Â³n del tenant
      permanece explÃƒÆ’Ã‚Â­citamente como UNKNOWN; verificaciÃƒÆ’Ã‚Â³n y cleanup confirmados.
- [x] ~~**Implementar 4.10 ranking.**~~ Sin polÃƒÆ’Ã‚Â­tica de pesos del tenant el
      resultado es ABSTAIN; no se inventa ranking.
- [x] ~~**Implementar 4.11 portfolio.**~~ Capacidad desconocida permanece
      UNKNOWN; verificaciÃƒÆ’Ã‚Â³n y cleanup confirmados.
- [x] ~~**Implementar 4.12 salida decisional.**~~ La evidencia insuficiente exige
      ABSTAIN/VALIDATION_REQUIRED; verificaciÃƒÆ’Ã‚Â³n y cleanup confirmados.
- [x] ~~**Cerrar F4.**~~ P00, P01, P03, P04, P05 y P06ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“P12 estÃƒÆ’Ã‚Â¡n en hecho.
      F4 queda cerrada; F5 es la siguiente fase del ÃƒÆ’Ã‚Â­ndice.
### Apertura F5/P00 â€” 2026-09-17

- [x] ~~Implementar 5.00, framework universal de playbooks.~~ Contrato, tests,
      migraciÃ³n, runtime, worker, API, panel y workflow verificados con
      .env.local. El catÃ¡logo vacÃ­o devuelve NO_APPLICABLE_PLAYBOOK y cleanup
      queda confirmado.
- [x] ~~Abrir F5.~~ F4 estÃ¡ cerrada y 5.00 es el contrato raÃ­z de la fase.
### Cierre F5/P01 — 2026-09-17

- [x] ~~Implementar 5.01, adquisiciÃ³n y generaciÃ³n de demanda.~~ ExtensiÃ³n
      del contrato universal con `domain_extension.acquisition`, validator
      determinista, runtime filtrado por dominio, columna de persistencia
      compartida, worker, workflow, endpoint y panel. Verificado con
      `.env.local`: cinco organizaciones sin fallos y cleanup confirmado.
- [x] ~~Implementar 5.02, paid media y eficiencia de trÃ¡fico.~~ Reutiliza el
      contrato y evaluador universal de P00, con contexto Paid Media explícito,
      persistencia por dominio, worker, workflow, endpoint y panel. Verificado
      contra cinco organizaciones reales usando `.env.local`: la evidencia
      incompleta produce `VALIDATION_REQUIRED`, y el cleanup queda en cero.
- [x] ~~Implementar 5.03, conversión y CRO.~~ Extensión CRO sobre P00,
      cobertura real del funnel Shopify con `UNKNOWN` cuando falta dato,
      validator, motor, persistencia compartida, worker, workflow, endpoint y
      panel. Verificado con `.env.local` sobre cinco organizaciones; las cinco
      evaluaciones exigieron validación y el cleanup quedó en cero.

### Cierre F5/P03 — 2026-09-17

P03 queda hecho. F5 sigue abierta; el siguiente bloque habilitado es 5.04,
oferta, pricing, merchandising y AOV.

### Cierre F5/P04 — 2026-09-17

- [x] ~~Implementar 5.04, oferta, pricing, merchandising y AOV.~~ Contrato
      especializado, validator, migración, runtime con ventas/margen/stock/
      catálogo Shopify, worker, workflow, endpoint y panel. Elasticidad,
      incrementalidad y calidad de cliente quedan `UNKNOWN` cuando no hay
      observación suficiente. Verificado con `.env.local`: 5/5 organizaciones,
      0 fallos, `VALIDATION_REQUIRED` por evidencia insuficiente y cleanup a 0.

F5 sigue abierta; el siguiente bloque habilitado es 5.05, retención, CRM,
lifecycle y LTV.

### Cierre F5/P05 — 2026-09-17

- [x] ~~Implementar 5.05, retención, CRM, lifecycle y LTV.~~ Contrato,
      validator, migración, motor con clientes/pedidos Shopify y configuración
      de Klaviyo, worker, workflow manual, endpoint y panel. El runtime conserva
      `UNKNOWN` para churn, LTV, suscripciones, incrementalidad y customer
      quality cuando no están observados. Verificado con `.env.local`: 5/5
      organizaciones, 0 fallos, 5 filas contadas directamente, `BLOCKED`
      conservador y cleanup a 0.

F5 sigue abierta; el siguiente bloque habilitado es 5.06, unit economics y
rentabilidad.

### Cierre F5/P06 — 2026-09-17

- [x] ~~Implementar 5.06, unit economics y rentabilidad.~~ Contrato,
  validator, motor puro con tests, migración, runtime con ventas/margen/resumen
  financiero Shopify, worker, workflow manual, endpoint y panel. Separamos
  waterfall, COGS, margen bruto, costes fijos y resumen financiero; CAC,
  contribution, payback, cash, segmentación, escenarios y comparabilidad no se
  inventan y permanecen `UNKNOWN` sin fuente suficiente.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.

F5 sigue abierta; el siguiente bloque habilitado es 5.07, producto, catálogo e
inventario.

### Cierre F5/P07 — 2026-09-17

- [x] ~~Implementar 5.07, producto, catálogo e inventario.~~ Contrato,
  validator, motor puro con tests, migración, runtime con catálogo/variantes,
  stock Shopify, ventas y margen, worker, workflow manual, endpoint y panel.
  El runtime separa catálogo, inventario, demanda y economics; no inventa
  overstock, forecast, reposición, supplier, calidad ni racionalización.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `BLOCKED` conservador y cleanup directo
  a cero.

F5 sigue abierta; el siguiente bloque habilitado es 5.08, operaciones,
fulfillment y customer experience.

### Cierre F5/P08 — 2026-09-17

- [x] ~~Implementar 5.08, operaciones, fulfillment y customer experience.~~
  Contrato, validator, migración, motor puro con tests, runtime con entrega,
  ventas y devoluciones Shopify, worker, workflow manual, endpoint y panel.
  El runtime separa preparación, fulfillment, tránsito, promesa, capacidad,
  devoluciones, soporte y recuperación; no inventa SLA, backlog, capacidad,
  causa del carrier ni experiencia de cliente.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.

F5 sigue abierta; el siguiente bloque habilitado es 5.09, datos, tracking y
experimentación.

### Cierre F5/P09 — 2026-09-18

- [x] ~~Implementar 5.09, datos, tracking y experimentación.~~ Contrato,
  validator, migración, motor puro con tests, runtime con ventas, funnel y
  series diarias Shopify, worker, workflow manual, endpoint y panel. El runtime
  separa cobertura, calidad, semántica, reconciliación, atribución, causalidad
  y experimentación; no confunde datos observados con datos fiables ni
  atribución con incrementalidad.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.

F5 sigue abierta; el siguiente bloque habilitado es 5.10, escalabilidad y
eliminación de constraints.

### Cierre F5/P10 — 2026-09-18

- [x] ~~Implementar 5.10, escalabilidad y eliminación de constraints.~~
  Contrato con `domain_extension.scalability`, validator, migración, motor puro
  con tests, runtime con ventas/margen/stock/delivery/serie diaria Shopify,
  worker, workflow manual, endpoint y panel ordenado de cobertura. El runtime
  no inventa capacidad, headroom, bottleneck, fragilidad ni siguiente
  constraint sin evidencia específica.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.

F5 sigue abierta; el siguiente bloque habilitado es 5.11, recovery, crisis y
playbooks transversales.

### Integración F4/F5 con el Copiloto — 2026-09-17

- [x] ~~Conectar las salidas decisionales y los playbooks al contexto del
      Copiloto.~~ Se añadió un adaptador tenant-scoped de solo lectura que
      entrega contexto F4/F5 resumido, conserva `UNKNOWN`, `ABSTAIN` y
      `VALIDATION_REQUIRED`, y añade preguntas específicas en Diagnóstico.

### Cierre F5/P11 — 2026-09-18

- [x] ~~Implementar 5.11, recovery, crisis y playbooks transversales.~~
  Contrato `domain_extension.recovery_crisis`, validator, migración, motor puro
  con tests, worker, workflow manual, endpoint y panel. El runtime hace triage
  conservador y mantiene `UNKNOWN` para crisis, severidad, blast radius,
  continuidad, containment, estabilización, causa raíz y comunicación no
  observadas.
- [x] ~~Conectar el feed transversal de IA con `InsightsMenu`.~~ La zona de IA
  sigue separada de la campana normal, filtra por organización y enlaza cada
  assessment con el ancla de la card concreta. Se añadieron anclas a F5.01–F5.11
  y al resumen diagnóstico; el patrón queda disponible para fases anteriores.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, `5 succeeded`,
  `0 failed`, cinco ejecuciones `VALIDATION_REQUIRED`, cleanup a cero; el feed
  devolvió un assessment temporal sembrado y lo borró al terminar.

F5 queda cerrada completa (`P00`–`P11`). La siguiente fase habilitada es F6,
benchmarks y guardrails.

### Cierre F6/P00 — 2026-09-18

- [x] ~~Implementar 6.00, framework universal de benchmarks y guardrails.~~
  Contrato, validator, motor puro con tests, migración, worker, workflow,
  endpoint y panel. El runtime observa historia propia y fuentes Shopify, pero
  no inventa comparabilidad, benchmark externo, objetivo, materialidad,
  guardrails ni confianza.
- [x] ~~Verificar con `.env.local`.~~ Template temporal, cinco organizaciones,
  `5 succeeded`, `0 failed`, cinco filas `VALIDATION_REQUIRED` y cleanup a cero.
- [x] ~~Conservar la integración de `InsightsMenu`.~~ P00 publica la card con
  ancla estable y usa el feed de IA separado de las notificaciones normales.

F6/P00 queda hecho. El siguiente bloque habilitado es F6/P01,
contextualización y cohortes comparables.

### Cierre F6/P01 — 2026-09-18

- [x] ~~Implementar 6.01, contextualización y cohortes comparables.~~
  Contrato con métrica, dimensiones materiales, referencias, definiciones,
  muestra, mix, temporalidad y comparabilidad; validator, migración, motor
  puro con tests, runtime Shopify, worker, workflow manual, endpoint y panel.
  El motor observa solo lo que las fuentes demuestran y mantiene `UNKNOWN`
  para cohortes, peer groups, definiciones, mix y confianza no medidos.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.
- [x] ~~Conectar P01 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-cohort-context`; el feed transversal conserva la separación de la
  campana normal y puede llevar al consultor directamente a la card.

F6/P01 queda hecho. El siguiente bloque habilitado es F6/P02.

### Cierre F6/P02 — 2026-09-18

- [x] ~~Implementar 6.02, calidad, suficiencia y fiabilidad de los datos.~~
  Contrato con identidad de métrica, source of truth, tipo de evidencia,
  calidad, muestra, maduración, missingness, reconciliación, validaciones
  matemáticas, gaps y scope of claim; validator, migración, motor puro con
  tests, runtime sobre D01 + Shopify, worker, workflow manual, endpoint y
  panel separado de la pantalla D01.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.
- [x] ~~Conectar P02 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-data-quality-reliability`; el feed transversal conserva la
  separación de la campana normal y lleva al consultor al punto exacto.

F6/P02 queda hecho. El siguiente bloque habilitado es F6/P03.

### Cierre F6/P03 — 2026-09-18

- [x] ~~Implementar 6.03, benchmarks y guardrails de adquisición y demanda.~~
  Contrato con nuevos clientes, CAC, economics, calidad, roles de canal,
  dependencia, eficiencia marginal, cohortes, restricciones e incrementalidad;
  validator, migración, motor puro con tests, runtime Shopify, worker, workflow
  manual, endpoint y panel.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales, `5 succeeded`, `0 failed`, `VALIDATION_REQUIRED` conservador y
  cleanup directo a cero.
- [x] ~~Conectar P03 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-acquisition-demand`; el feed transversal conserva la separación de
  la campana normal y lleva al consultor a la evaluación.

F6/P03 queda hecho. El siguiente bloque habilitado es F6/P04.

### Cierre F6/P04 — 2026-09-18

- [x] ~~Implementar 6.04, benchmarks y guardrails de Paid Media y eficiencia
  de tráfico.~~ Contrato específico separado de F5.02 mediante
  `PAID_MEDIA_BENCHMARKS`, validator, migración, motor puro con tests, runtime
  Meta/Shopify, worker, workflow manual, endpoint y panel. La cadena separa
  media efficiency, post-click, acquisition, economics, atribución y
  guardrails; incrementalidad, escala marginal, objetivo y confianza quedan
  `UNKNOWN` sin evidencia compatible.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P04 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-paid-media-benchmarks`; el feed de IA sigue separado de la campana
  normal y lleva al consultor a la card exacta.

F6/P04 queda hecho. El siguiente bloque habilitado es F6/P05.

### Cierre F6/P05 — 2026-09-18

- [x] ~~Implementar 6.05, benchmarks y guardrails de conversión y CRO.~~
  Contrato específico `CONVERSION_CRO_BENCHMARKS`, validator, motor puro con
  tests, runtime Shopify, migración, worker, workflow, endpoint y panel. El
  flujo valida definición y denominador, controla mix, descompone funnel,
  separa economics de causalidad y conserva `UNKNOWN` para product views,
  técnica, experimentos, comparabilidad, oportunidad y guardrails no medidos.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P05 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-conversion-cro-benchmarks`; el feed de IA sigue separado de la
  campana normal y lleva al consultor a la evaluación CRO.

F6/P05 queda hecho. El siguiente bloque habilitado es F6/P06.

### Cierre F6/P06 — 2026-09-18

- [x] ~~Implementar 6.06, benchmarks y guardrails de oferta, pricing,
  merchandising y AOV.~~ Contrato `OFFER_PRICING_BENCHMARKS`, validator, motor
  puro con tests, runtime Shopify, migración, worker, workflow, endpoint y
  panel. Descompone AOV, separa economics de pricing/elasticidad, conserva
  `UNKNOWN` para incrementalidad y customer quality no observadas y no ejecuta
  cambios comerciales.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P06 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-offer-pricing-benchmarks` y permanece separada de la campana normal.

F6/P06 queda hecho. El siguiente bloque habilitado es F6/P07.

### Cierre F6/P07 — 2026-09-18

- [x] ~~Implementar 6.07, benchmarks y guardrails de retención, CRM y LTV.~~
  Contrato `RETENTION_CRM_BENCHMARKS`, validator, motor puro con tests,
  runtime Shopify/Klaviyo, migración, worker, workflow, endpoint y panel.
  Observa identidad, repeat, contribution y capacidades CRM sin inventar
  cohort maturity, churn, LTV o incrementalidad.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P07 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-retention-crm-benchmarks` y sigue separada de la campana normal.

F6/P07 queda hecho. El siguiente bloque habilitado es F6/P08.

### Cierre F6/P08 — 2026-09-18

- [x] ~~Implementar 6.08, benchmarks y guardrails de unit economics y
  rentabilidad.~~ Contrato `UNIT_ECONOMICS_BENCHMARKS`, validator, motor puro
  con tests, runtime Shopify, migración, worker, workflow, endpoint y panel.
  Separa revenue, costes y gross profit, y mantiene contribution, CAC,
  payback, cash y escenarios en `UNKNOWN` sin evidencia específica.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P08 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-unit-economics-benchmarks` y permanece separada de la campana normal.

F6/P08 queda hecho. El siguiente bloque habilitado es F6/P09.

### Cierre F6/P09 — 2026-09-18

- [x] ~~Implementar 6.09, benchmarks y guardrails de operaciones y experiencia
  de cliente.~~ Contrato `OPERATIONS_CX_BENCHMARKS`, validator, motor puro con
  tests, runtime Shopify, migración, worker, workflow, endpoint y panel.
  Promesa, timestamps, delivery y returns se separan de capacidad, soporte,
  CX y coste no observados.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas
  temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P09 con `InsightsMenu`.~~ La card tiene el ancla estable
  `#insight-operations-cx-benchmarks` y sigue separada de la campana normal.

F6/P09 queda hecho. El siguiente bloque habilitado es F6/P10.

### Cierre F6/P10 — 2026-09-18

- [x] ~~Implementar 6.10, benchmarks y guardrails de inventario y salud comercial.~~ Contrato `PRODUCT_INVENTORY_BENCHMARKS`, validator, motor puro con tests, runtime Shopify, migración, worker, workflow, endpoint y panel; stock y demanda observados no se convierten en coverage, forecast, aging o replenishment.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P10 con `InsightsMenu`.~~ Card `#insight-product-inventory-benchmarks` y entrada de overview registrados.

F6/P10 queda hecho. El siguiente bloque habilitado es F6/P11.

### Cierre F6/P11 — 2026-09-18

- [x] ~~Implementar 6.11, benchmarks y guardrails de escalabilidad y límites.~~ Contrato `SCALABILITY_BENCHMARKS`, validator, motor puro con tests, runtime Shopify, migración, worker, workflow, endpoint y panel; economics y throughput no se convierten en headroom o bottleneck.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P11 con `InsightsMenu`.~~ Card `#insight-scalability-benchmarks` y entrada de overview registrados.

F6/P11 queda hecho. El siguiente bloque habilitado es F6/P12.

### Cierre F6/P12 — 2026-09-18

- [x] ~~Implementar 6.12, anomalías, red flags y patterns.~~ Contrato `ANOMALIES_RED_FLAGS`, validator, motor puro con tests, runtime Shopify, migración, worker, workflow, endpoint y panel; una observación no se presenta como anomalía sin baseline y desviación.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P12 con `InsightsMenu`.~~ Card `#insight-anomalies-red-flags` y entrada de overview registrados.

F6/P12 queda hecho. El siguiente bloque habilitado es F6/P13.

### Cierre F6/P13 — 2026-09-18

- [x] ~~Implementar 6.13, confianza, incertidumbre y comunicación del benchmark.~~ Contrato `BENCHMARK_CONFIDENCE`, validator, motor puro con tests, runtime Shopify, migración, worker, workflow, endpoint y panel; las dimensiones no se promedian y confianza no autoriza ejecución.
- [x] ~~Verificar con `.env.local`.~~ Cinco organizaciones, cinco filas temporales `VALIDATION_REQUIRED`, `5 succeeded`, `0 failed` y cleanup a cero.
- [x] ~~Conectar P13 con `InsightsMenu`.~~ Card `#insight-benchmark-confidence` y entrada de overview registrados.

F6 queda cerrada completa (`P00`–`P13`). F7 puede abrirse en una sesión posterior.

### Apertura y cierre F7/P01 - 2026-09-18

- [x] ~~Implementar `7.01`, elegibilidad de una intervención.~~ Contrato,
  migración, motor puro con tests, runtime tenant-bound, worker, workflow,
  endpoint y panel. No prioriza ni selecciona candidatos.
- [x] ~~Adaptar `7.01` al Copiloto y `InsightsMenu`.~~ Contexto de solo lectura
  con procedencia, unknowns y aislamiento por organización; card anclada en
  `#insight-intervention-eligibility`, separada de las notificaciones normales.
- [x] ~~Verificar con `.env.local`.~~ Smoke real con un candidato temporal:
  `VALIDATION_REQUIRED`, `tenant_match: true`, `no_selection: true` y cleanup
  a cero; la migración no deja pendientes.

F7/P01 queda hecho. El siguiente bloque habilitado es F7/P02 (`7.02`).

### Cierre F7/P02 - 2026-09-18

- [x] ~~Implementar `7.02`, matching problema-intervención.~~ Contrato,
  migración, motor puro con tests, runtime tenant-bound, worker, workflow,
  endpoint y panel. La cadena causal es explícita y no hay ranking ni selección.
- [x] ~~Adaptar `7.02` al Copiloto y `InsightsMenu`.~~ Contexto de solo lectura
  con problema, mecanismo, palanca, señales, procedencia y unknowns; card
  anclada en `#insight-intervention-matching`.
- [x] ~~Verificar con `.env.local`.~~ Smoke real conservador:
  `VALIDATION_REQUIRED`, `tenant_match: true`, `matched_count: 0`,
  `no_selection: true` y cleanup a cero; no quedan migraciones pendientes.

F7/P02 queda hecho. El siguiente bloque habilitado es F7/P03 (`7.03`).

### Cierre F7/P03 - 2026-09-18

- [x] ~~Implementar `7.03`, priorizacion entre intervenciones.~~ Contrato,
  motor puro con tests, runtime que consume F7.01/F7.02, migracion, worker,
  workflow, endpoint y panel. No usa score ni autoriza ejecucion.
- [x] ~~Adaptar `7.03` al Copiloto y `InsightsMenu`.~~ El contexto expone la
  prioridad principal, alternativas, motivos, unknowns y
  `execution_authorized: false`; la entrada navega a
  `#insight-intervention-prioritization`.
- [x] ~~Verificar con `.env.local`.~~ Smoke real con template y runs upstream
  temporales: `PRIORITY_AVAILABLE`, `tenant_match: true`, principal unica y
  `execution_authorized: false`; cleanup de templates y runs a cero.

F7/P03 queda hecho. El siguiente bloque habilitado es F7/P04 (`7.04`).

### Cierre F7/P04 - 2026-09-19

- [x] ~~Implementar `7.04`, impacto esperado.~~ Contrato cualitativo, motor puro con tests, runtime tenant-bound, persistencia RLS, worker y workflow.
- [x] ~~Exponer F7.04 en el consultor.~~ API, panel `#insight-intervention-impact`, contexto Copiloto, feed `InsightsMenu` y view-model.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Seed temporal, `IMPACTS_AVAILABLE`, traza/magnitud/guardrail verificados y cleanup a cero.

F7/P04 queda hecho. El siguiente bloque habilitado es F7/P05 (`7.05`).

### Cierre F7/P05 - 2026-09-19

- [x] ~~Implementar `7.05`, factibilidad de recursos.~~ Contrato cualitativo, coste/esfuerzo/capacidad separados, motor puro con tests, runtime tenant-bound, persistencia RLS, worker y workflow.
- [x] ~~Exponer F7.05 en el consultor.~~ API, panel `#insight-intervention-feasibility`, contexto Copiloto, feed `InsightsMenu` y view-model.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Seed temporal, `FEASIBILITY_AVAILABLE`/`FEASIBLE_NOW`, primary y guardrails verificados; cleanup a cero.

F7/P05 queda hecho. El siguiente bloque habilitado es F7/P06 (`7.06`).

### Cierre F7/P06 - 2026-09-19

- [x] ~~Implementar `7.06`, riesgo, reversibilidad y coste del error.~~ Contrato cualitativo con ejes separados, motor puro con tests, runtime tenant-bound, persistencia RLS, worker y workflow.
- [x] ~~Exponer F7.06 en el consultor.~~ API, panel `#insight-intervention-risk`, contexto Copiloto, feed `InsightsMenu` y view-model.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Seed temporal de template y runs upstream, `RISK_ASSESSMENTS_AVAILABLE`/`RISK_ACCEPTABLE_WITH_GUARDRAILS`, sin score/probabilidades ni autorización, cleanup a cero.

F7/P06 queda hecho. El siguiente bloque habilitado es F7/P07 (`7.07`).

### Cierre F7/P07 - 2026-09-19

- [x] ~~Implementar `7.07`, secuenciación y dependencias.~~ Contrato de camino condicional, prerequisitos, bloqueadores, gates, ramas, paralelismo explícito, `NOT YET` y espera; motor puro con tests, runtime tenant-bound, migración, worker y workflow. No es scheduler ni plan de tareas.
- [x] ~~Exponer `7.07` en el consultor.~~ API, panel `#insight-intervention-sequencing`, contexto Copiloto, feed `InsightsMenu` y view-model; la salida conserva `execution_authorized: false`.
- [x] ~~Verificar con `.env.local`.~~ Smoke real con template y runs upstream temporales: `SEQUENCES_AVAILABLE`, camino `NOW/THEN`, gate y aislamiento tenant confirmados; cleanup a cero.

F7/P07 queda hecho. El siguiente bloque habilitado es F7/P08 (`7.08`).

### Cierre F7/P08 - 2026-09-19

- [x] ~~Implementar `7.08`, experimentar vs ejecutar directamente.~~ Contrato de modos `FIX`, `DIRECT_EXECUTION`, `TEST`, `PILOT`, `GATHER_EVIDENCE`, `WAIT_OBSERVE` y `DO_NOT_PROCEED`; motor puro con tests, runtime tenant-bound, migración, worker y workflow. No lanza experimentos ni autoriza cambios.
- [x] ~~Exponer `7.08` en el consultor.~~ API, panel `#insight-intervention-test-execute`, contexto Copiloto, feed `InsightsMenu` y view-model; hipótesis, outcomes, guardrails y handoff quedan visibles.
- [x] ~~Verificar con `.env.local`.~~ Smoke real con secuencia upstream y template temporales: `DECISIONS_AVAILABLE`, modo `TEST`, hipótesis y decisión posterior confirmados; ausencia de campos de ejecución y cleanup a cero.

F7/P08 queda hecho. El siguiente bloque habilitado es F7/P09 (`7.09`).

## Cierre F7/P09 — intensidad de la intervencion — 2026-09-20

- [x] Contrato, motor puro con tests, runtime tenant-bound, migracion, worker, workflow, API y panel de consultor implementados.
- [x] Copiloto y `InsightsMenu` conectados mediante contexto y feed de solo lectura, con ancla `#insight-intervention-intensity`.
- [x] Verificado en `.env.local`: `INTENSITY_PROFILES_AVAILABLE`, `INCREASE` multidimensional y cleanup real a cero; `db:push:dry` sin pendientes.

F7/P09 queda hecho. La siguiente tarea habilitada es F7/P10 (`7.10`).

## Cierre F7/P10 — recomendaciones por madurez — 2026-09-20

- [x] Contrato y motor puro con tests: madurez funcional, readiness, capabilities existentes/faltantes, now/later, not-yet, reset local, complejidad absorbible, evidence standard y maturity unlock; sin score ni proxy de revenue/tooling.
- [x] Runtime tenant-bound desde F7.09 y D03, persistencia idempotente, migración `20261031000000_f7_p10_maturity_recommendations.sql`, worker y workflow.
- [x] API, panel `#insight-maturity-recommendations`, Copiloto y `InsightsMenu` conectados en solo lectura.
- [x] Verificado con `.env.local`: `MATURITY_RECOMMENDATIONS_AVAILABLE`, `BUILD_CAPABILITY_FIRST`, `LATER`, capability previa, aislamiento y cleanup real a cero; `db:push:dry` sin pendientes.

F7/P10 queda hecho. La siguiente tarea habilitada es F7/P11 (`7.11`).

### Cierre F7/P11 — 2026-09-20

- [x] ~~Implementar 7.11, recomendaciones bajo restricciones.~~ Contrato, motor puro con tests, runtime tenant-bound desde F7.10, migración, worker, workflow, endpoint y panel; la recomendación se adapta al binding constraint y protege la capacidad de éxito sin inventar scores ni asignar recursos.
- [x] ~~Adaptar 7.11 al Copiloto e `InsightsMenu`.~~ El contexto conserva intervención ideal, acción factible, respuesta a la restricción, acción diferida, activation trigger y next constraint; la card mantiene el ancla `#insight-constraint-recommendations` y está separada de notificaciones normales.
- [x] ~~Verificar con `.env.local`.~~ Smoke real temporal con plantilla y run upstream: `CONSTRAINT_RECOMMENDATIONS_AVAILABLE`, `REDUCE_SCOPE`, outcome ajustado y cleanup a cero; `db:push:dry` sin pendientes.

F7/P11 queda hecho. El siguiente bloque habilitado es F7/P12 (`7.12`).

### Cierre F7/P12 - 2026-09-20

- [x] ~~Implementar `7.12`, portafolio de recomendaciones.~~ Contrato, motor puro con tests, runtime desde F7.11, migración, worker, workflow, endpoint y panel. Construye la cartera mínima suficiente y explicita Primary, Enabling, Supporting, Parallel, Deferred y exclusiones.
- [x] ~~Adaptar `7.12` al Copiloto e `InsightsMenu`.~~ Contexto de solo lectura con roles, Primary, diferidos, secuencia, carga agregada, riesgo y narrativa; card anclada en `#insight-recommendation-portfolio`, separada de notificaciones normales y sin autorización de ejecución.
- [x] ~~Verificar con `.env.local`.~~ Smoke real temporal: `PORTFOLIO_AVAILABLE`, Primary persistida, aislamiento tenant, `execution_authorized: false` y cleanup a cero; `db:push:dry` sin pendientes.

F7/P12 queda hecho. La siguiente tarea habilitada es F7/P13 (`7.13`).
### Cierre F7/P13 - 2026-09-20

- [x] Contrato `dynamic-decision`, motor puro TDD y reglas de evidencia para `STOP`, `CONTINUE`, `SCALE` y `ROLLBACK`.
- [x] Runtime desde `recommendation_portfolio_runs`, persistencia idempotente, migración `20261031120000_f7_p13_dynamic_decisions.sql`, worker, workflow y API.
- [x] Panel de diagnóstico, ancla `#insight-dynamic-decision`, feed de `InsightsMenu` y bloque Copiloto; lectura consultiva con `execution_authorized: false`.
- [x] Smoke real con `.env.local`: `DECISIONS_AVAILABLE` / `SCALE`, persistencia, aislamiento y cleanup a cero; `db:push:dry` sin pendientes.

F7/P13 queda hecho. F7/P14 es el siguiente bloque abierto.
### Cierre F7/P14 - 2026-09-20

- [x] Contrato `restraint-decision` y motor TDD para `NO_ACTION`, `WAIT`, `GATHER_EVIDENCE`, `ACT_SMALL` y `ACT`.
- [x] Runtime desde `dynamic_decision_runs`, persistencia idempotente, migración `20261031130000_f7_p14_restraint_decisions.sql`, worker, workflow y API.
- [x] Panel `#insight-restraint-decision`, feed de `InsightsMenu` y bloque Copiloto; no se convierte en monitor, research agent, scheduler ni ejecución automática.
- [x] Smoke real con `.env.local`: `DECISION_AVAILABLE / WAIT`, persistencia, aislamiento, cleanup a cero y `db:push:dry` sin pendientes.

F7/P14 queda hecho. F7/P15 es el siguiente bloque abierto.
### Cierre F7/P15 - 2026-09-20

- [x] ~~Implementar `7.15`, expected outcome y success criteria.~~ Contrato, motor puro TDD, runtime desde F7.14, persistencia idempotente, migración, worker, workflow, API, panel y seam Copiloto-first.
- [x] ~~Adaptar `7.15` al Copiloto e `InsightsMenu`.~~ La tesis causal, outcomes por capas, criterio primario, guardrails y consecuencias de decisión navegan a `#insight-expected-outcome`; no es promesa, monitor ni ejecución.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Smoke temporal con `OUTCOME_CRITERIA_AVAILABLE`, fila persistida y cleanup a cero; 802 contratos, tests API/web y builds pasan.
- [x] ~~Aplicar migraciones.~~ Desarrollo sin pendientes; producción tiene aplicadas `20261031120000_f7_p13_dynamic_decisions.sql`, `20261031130000_f7_p14_restraint_decisions.sql` y `20261031140000_f7_p15_expected_outcomes.sql`; dry-run de producción sin pendientes.

F7/P15 queda hecho. F7.17 y F7.18 son los siguientes bloques abiertos; F7 permanece abierta hasta cerrar ambos.
### Cierre F7/P17 - 2026-09-20

- [x] ~~Implementar `7.17`, confianza de la recomendación.~~ Contrato, motor puro TDD, runtime desde F7.15, persistencia idempotente, migración, worker, workflow, API, panel y seam Copiloto-first.
- [x] ~~Adaptar `7.17` al Copiloto e `InsightsMenu`.~~ Se muestran dimensiones separadas, driver, incertidumbre principal, compromiso y forma de recomendación; no se crea un score ni se autoriza ejecución.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Smoke temporal con `CONFIDENCE_AVAILABLE`, fila persistida y cleanup a cero; 807 contratos, API/web, typechecks y builds pasan.
- [x] ~~Aplicar migración.~~ Desarrollo y producción sin pendientes; producción tiene aplicada `20261031150000_f7_p17_recommendation_confidence.sql`.

F7/P17 queda hecho. F7.18 es el siguiente bloque abierto; F7 permanece abierta hasta cerrarlo.

### Cierre F7/P18 - 2026-09-20

- [x] ~~Implementar `7.18`, comunicación de recomendaciones.~~ Contrato, motor puro TDD, runtime desde F7.17/F7.15, persistencia idempotente, migración, worker, workflow, API, panel y seam Copiloto-first.
- [x] ~~Adaptar `7.18` al Copiloto e `InsightsMenu`.~~ La recomendación principal aparece primero y conserva por qué, por qué ahora, exclusiones, outcome condicional, riesgo, hechos, inferencias, incertidumbre, señal de éxito y siguiente decisión; no es ejecución ni autorización.
- [x] ~~Verificar con datos reales usando `.env.local`.~~ Smoke temporal con `COMMUNICATION_AVAILABLE`, fila persistida, recomendación principal correcta y cleanup a cero; tests de contrato/API/Copiloto/UI, typechecks y builds pasan.
- [x] ~~Aplicar migración.~~ Desarrollo y producción tienen aplicada `20261031160000_f7_p18_recommendation_communication.sql`; ambos dry-runs quedan sin pendientes.

F7/P18 queda hecho. F7 queda cerrada completa; F8 puede abrirse cuando corresponda.


### Cierre F8/P02 — 2026-09-20

- [x] Contrato HITL con autonomía graduada, niveles de aprobación, gate, granularidad, autoridad, frescura, revocación, escalado y separación approval/execution.
- [x] Motor puro con tests, runtime desde `agent_outputs`/`agent_approvals`, persistencia idempotente, RLS, worker, workflow y API.
- [x] Card de diagnóstico, ancla `#insight-hitl-approval`, `InsightsMenu` y contexto Copiloto-first.
- [x] Smoke real con `.env.local`, aprobación pendiente y aprobada, ejecución bloqueada, `execution_authorized=false` y cleanup a cero. Migración aplicada en desarrollo y producción; dry-runs sin pendientes.

F8/P02 queda hecho. F8/P16 es el siguiente bloque de la ola 1.


### Cierre F8/P16 — 2026-09-20

- [x] Contrato y motor TDD para completion/closure, closure gate, estado final, outcome operacional, calidad, madurez, residual risk, handoff y learning package.
- [x] Runtime tenant-bound desde `agent_outputs` y tareas materializadas, persistencia idempotente en `execution_closure_runs`, RLS, worker, API y lectura Copiloto-first.
- [x] Card `#insight-closure-handoff`, feed de `InsightsMenu` y navegación exacta desde el diagnóstico.
- [x] Smoke real con `.env.local`: cierre bloqueado con acción activa, cierre `CLOSED/SUCCESS` tras completar la tarea, cleanup a cero. Migración aplicada en desarrollo y producción; dry-runs sin pendientes.

F8/P16 queda hecho. La ola 1 (`8.02` + `8.16`) queda completa; `8.03` es el siguiente bloque de la ola técnica.

### Cierre F8/P03 — 2026-09-20

- [x] Contrato y motor puro TDD para descomponer recomendación en plan: acciones, dependencias, secuencia segura, camino crítico, checkpoints, rollout, budgets, rollback y aprobación.
- [x] Runtime tenant-bound desde comunicación de recomendación, expected outcome y HITL; persistencia idempotente en `execution_plan_runs`, RLS, worker, workflow y endpoint.
- [x] Panel `#insight-execution-plan`, feed de `InsightsMenu` y bloque Copiloto-first; el plan nunca autoriza ni ejecuta (`execution_authorized=false`).
- [x] Smoke real con `.env.local`: `READY_WITH_APPROVAL`, dos acciones y camino crítico correcto; cleanup a cero. Migración aplicada en desarrollo y producción; dry-run de desarrollo sin pendientes.

F8/P03 queda hecho. El siguiente bloque técnico es F8/P04 (`8.04`); F8 permanece abierta.

### Cierre F8/P04 — 2026-09-20

- [x] Contrato y motor TDD de precondiciones/readiness: dimensiones, evidencia, hard/soft/critical, unknown, degraded, freshness, ventana, freeze, concurrencia y remediation.
- [x] Runtime desde `execution_plan_runs` y HITL, persistencia idempotente en `readiness_assessment_runs`, RLS, worker, workflow y endpoint; no ejecuta ni autoriza.
- [x] Panel `#insight-readiness`, feed de `InsightsMenu` y contexto Copiloto-first con bloqueos, safe state y revalidación.
- [x] Smoke real con `.env.local`: `BLOCKED` por approval pendiente, measurement degraded y environment unknown; cleanup a cero. Migración aplicada en desarrollo y producción.

F8/P04 queda hecho. El siguiente bloque técnico es F8/P05 (`8.05`); F8 permanece abierta.
### Cierre F8/P05 — 2026-09-20

- [x] Contrato y motor puro TDD de action envelope: scope, tools, tipos, objetos, tenant/entorno, magnitud, presupuestos, frescura, violaciones y alternativas.
- [x] Runtime tenant-bound desde `execution_plan_runs`/readiness, persistencia idempotente en `action_envelope_runs`, RLS, worker, workflow y endpoint.
- [x] Panel `#insight-action-envelope`, feed de `InsightsMenu` y bloque Copiloto-first; la herramienta disponible no concede autoridad y `execution_authorized=false`.
- [x] Smoke real con `.env.local`: envelope temporal dentro de scope → `INSIDE`, persistencia y cleanup a cero. Migración aplicada en desarrollo y producción.

F8/P05 queda hecho. El siguiente bloque técnico habilitado es F8/P06; F8 permanece abierta.
### Cierre F8/P06–P15 y P17 — 2026-09-20

- [x] Capabilities/tools/permissions, safe execution/change control, monitoring, guardrails, lifecycle, incidents, rollback/recovery, human override, concurrency, verification y reporting implementados como once etapas explícitas en `execution_supervision_runs`.
- [x] Contrato TDD, runtime tenant-bound desde plan/readiness/action envelope, worker, workflow, API, panel `#insight-execution-supervision`, Copiloto y `InsightsMenu`.
- [x] Smoke real con `.env.local`: 11 etapas evaluadas, bloqueos/condicionales conservadores donde faltan permisos/evidencia, `execution_authorized=false` en todas y cleanup a cero.
- [x] Migración `20260920204142_f8_p06_p17_execution_supervision.sql` aplicada en desarrollo y producción.

F8 queda cerrada completa. F9 queda habilitada.
### Cierre F8/P00–P17 — 2026-09-20

- [x] F8.00 framework universal: separación contractual entre recomendación, intención, decisión, acción, ejecución y resultados.
- [x] F8.01 ejecutabilidad/autorización: capability, readiness, envelope y autoridad se evalúan explícitamente y nunca se infieren.
- [x] Las raíces se incorporan como `UNIVERSAL` y `EXECUTABILITY_AUTHORIZATION` en el runtime común; migración aplicada en desarrollo y producción.

F8 queda cerrada completa, incluyendo 8.00, 8.01, 8.02–8.17. F9 queda habilitada.
### Revisión Copiloto-first posterior al cierre F9 — 2026-09-21

- [x] ~~Conectar el turno real de A09 con los snapshots F3–F9.~~ Se
  incorporó `buildConsultantChatContextBlocks` y el endpoint de chat carga el
  contexto F8/F9 junto con vista, historial y restricciones.
- [x] ~~Evitar falsos “sin datos” cuando falla una tabla de snapshots.~~ Los
  bloques F8.05, F8.06–F8.17 y F9 quedan marcados como no disponibles si la
  lectura falla.
- [x] ~~Persistir la política Copiloto-first de F8/F9.~~ Migración A09 v6/v10
  añadida; las tools verifican cifras y los snapshots no autorizan ejecución.
- [x] ~~Comprobar el pixel de IA.~~ Cards F8/F9, anclas `#insight-*` y
  `InsightsMenu` enlazan el mismo resultado sin mezclarse con notificaciones.

### F9 — cerrado técnicamente — 2026-09-21

- [x] Contrato compartido y TDD de Experience/LearningAssessment para los 40 bloques reales.
- [x] Runtime, persistencia RLS, worker, workflow, API, Copiloto, panel de diagnóstico e `InsightsMenu`.
- [x] Migración F9 aplicada en desarrollo y producción.
- [x] Verificación real con `.env.local`: 6 organizaciones, 240 evaluaciones, cero fallos y cero duplicados; smoke temporal sembrado/borrado con cleanup completo.
- [ ] Pendiente operativo, no de implementación: cada tenant necesita outcomes métricos y evidencia causal suficientes para que el gate pase de `WAITING_FOR_EVIDENCE` a `READY`. F9 no inventa esos datos.
