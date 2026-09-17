# Tareas pendientes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â conocimiento a software

Lo que queda abierto de `docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md`, separado
por **quien puede cerrarlo**. Se actualiza en el mismo turno en que aparece la
tarea, no despues: una deuda que solo vive en una conversacion esta perdida.

Los bloqueadores de proveedor (Meta, Klaviyo, Shopify App Store) siguen en
[`roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`](../roadmap/roadmaps/99-decisiones-y-seguimiento/BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md),
que es el checklist canonico del piloto. Aqui solo lo de esta linea de trabajo.

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
- [ ] **Destilar los 5 bloques que siguen sin capas** (`6.04`, `7.15`, `7.17`,
      `7.18`, `8.12`): solo tienen corpus maestro, hay que pasarlos por el
      prompt maestro. Tres de ellos bloquean la ola 1.

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
- [ ] Implementar 5.03, conversión y CRO.

### Integración F4/F5 con el Copiloto — 2026-09-17

- [x] ~~Conectar las salidas decisionales y los playbooks al contexto del
      Copiloto.~~ Se añadió un adaptador tenant-scoped de solo lectura que
      entrega contexto F4/F5 resumido, conserva `UNKNOWN`, `ABSTAIN` y
      `VALIDATION_REQUIRED`, y añade preguntas específicas en Diagnóstico.
