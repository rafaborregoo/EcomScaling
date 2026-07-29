# AI-06 - Evaluaciones y calidad IA

## Estado

- **Estado real:** `foundational_work_in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** AI-00
- **Prioridad:** P0 — no se recomienda anadir agentes nuevos antes de tener una primera version seria de
  este archivo. `checkOutputSanity` es una guarda de sanidad estructural (texto vacio, repeticion
  corrupta, titulos vacios); no es groundedness (que cada afirmacion importante este respaldada por una
  metrica/consulta/cita/documento concreto) — son cosas distintas y este archivo cubre solo la primera.
- **Evidencia:** `checkOutputSanity` (`packages/ai/src/index.ts`), 30 tests en
  `packages/ai/src/index.test.ts` (`npm run test -w @ecomscaling/ai`, en CI; conteo actualizado 2026-07-23
  tras anadir deteccion de apertura incoherente, ver mas abajo -- antes 15).
- **Lo que ya funciona**: la guarda corre justo despues de la validacion de schema en `runAgentTurn` y
  rechaza (`AgentOutputValidationError` -> `rejected_output`, nunca `pending_approval`) salidas con
  answer/summary vacio, texto con fragmento repetido 5+ veces, o `proposed_writes`/`proposed_tasks` con
  titulo vacio o descripcion corrupta. Funciona por duck-typing sobre los contratos existentes (A02/A04/
  A06, A01, A09), asi que cubre agentes nuevos sin cambios. Detecto y previno en tests los dos glitches
  reales que motivaron su creacion (A02: answer vacio/texto corrupto; A06: answer/title vacios tras agotar
  tool calls). Rollback de prompt/version ya existe de facto via `agent_versions.is_active`.
- **Dataset de A02 ampliado a 5 escenarios, 2026-07-22** (`apps/api/src/eval-a02-monitor.ts`, `npm run
  eval:a02 -w @ecomscaling/api`): los 3 originales (organizacion sin datos, tienda con ventas pero sin
  configuracion financiera, tienda sana) mas los 2 que pedia explicitamente este documento --
  **stock roto** (producto real con 40 unidades vendidas/30d y 2 disponibles, seedeado con el arbol
  Shopify completo: location/product/variant/inventory_item/inventory_current_state, no un mock) y
  **falso positivo deliberado** (producto con 500 disponibles y 3 vendidas -- el agente NO deberia generar
  una alerta urgente). Cada escenario con checks "hard" (deterministicos: `sources` no vacio si hay
  `findings`, `evidence` no vacia, sin cifras inventadas) y "soft" (heuristicas de texto). Dos corridas
  reales seguidas: primera 15/15 checks pasan; segunda 17/18 pasan (1 soft fail real por variabilidad del
  LLM -- `confidence` reportada `high` en vez de `medium`/`low` para el escenario sin datos, evidencia real
  de que los checks soft son ruidosos por diseño, confirma que no deben bloquear el eval por si solos).
  Coste total por corrida: ~$0.17. No corre en CI (cuesta dinero real) — ejecutar manualmente.
- **Quality gates con umbrales explicitos, 2026-07-22** (implementados en el propio script, no solo
  documentados): (1) **coste maximo por escenario** $0.15 (visto real: ~$0.03-0.04) y **latencia maxima**
  45s (visto real: ~16-20s) -- si una version de prompt dispara cualquiera de los dos, el eval falla igual
  que un check hard; (2) **tasa de fallos soft**: si mas de 1/3 de los checks soft de una corrida fallan,
  se imprime una advertencia explicita de revision (no bloquea todavia, sigue siendo heuristica) en vez de
  quedar en silencio dentro del ruido de checks individuales. Cierra el entregable "Presupuesto maximo de
  coste y latencia" de este mismo documento, que llevaba pendiente desde el diseño original.
- **Dataset de A01 anadido, 2026-07-23** (`apps/api/src/eval-a01-call-analyst.ts`, `npm run eval:a01 -w
  @ecomscaling/api`): 3 escenarios, los que este mismo documento pedia explicitamente para A01 --
  **tareas claras** (transcripcion con 2 pendientes explicitos con dueño y plazo -- el agente debe
  proponer tareas con `owner` correcto), **sin tareas accionables** (checkin informativo sin problemas --
  el agente no deberia inventar tareas de la nada) y **tarea sin responsable claro** (problema real
  discutido pero nadie se compromete a resolverlo en la transcripcion -- el agente no deberia inventar un
  nombre propio como responsable, ya que A01 no tiene tools y su unica fuente es la transcripcion). Corrida
  real: 0 fallos hard, 1/7 fallos soft (14%, bajo el umbral de aviso de 1/3) -- el unico soft fail fue el
  agente asignando `owner: "cliente"` a "decidir quien revisara el checkout" en vez de `"consultor"` como
  esperaba el check, una interpretacion razonable (decidir es responsabilidad del cliente aunque la
  ejecucion tecnica no), no una alucinacion real -- confirma el mismo patron que A02: los checks soft son
  ruidosos por diseño. Coste total: $0.084. No corre en CI (cuesta dinero real).
- **Dataset de A06 anadido, 2026-07-23** (`apps/api/src/eval-a06-stock-planner.ts`, `npm run eval:a06 -w
  @ecomscaling/api` -- correccion de nombre: A06 es el planificador de stock, no el gestor de conocimiento,
  ese es A08, que sigue sin dataset): 3 escenarios, mismo patron que A02 -- **sin datos** (tienda conectada
  sin ningun producto/stock sembrado, el agente no deberia inventar cifras ni proponer una cantidad de
  reposicion inventada), **stock roto** (producto real con 40 unidades vendidas/30d y 2 disponibles,
  `shopify_stock_risk_products` real) y **falso positivo deliberado** (500 disponibles, 3 vendidas -- no
  deberia proponer reposicion urgente). Primera corrida real encontro 2 fallos hard que resultaron ser
  **checks mal calibrados, no bugs del agente**: el check original rechazaba cualquier mencion de "0
  unidades" (una afirmacion verdadera, no una alucinacion) y cualquier recomendacion en absoluto sin
  productos (el agente proponia razonablemente "verificar que el tracking de inventario este activo", que
  es una recomendacion operativa util, no una reposicion inventada). Corregidos los checks para distinguir
  cifras positivas inventadas de afirmaciones verdaderas en cero, y recomendaciones operativas genericas de
  cantidades de reposicion fabricadas. Segunda corrida real: **3/3 escenarios pasan, 0 fallos hard, 0/5
  fallos soft**. Coste total: $0.06.
- **Dataset de A08 anadido, 2026-07-23** (`apps/api/src/eval-a08-knowledge-manager.ts`, `npm run eval:a08 -w
  @ecomscaling/api`): 2 escenarios -- **catalogo vacio** (organizacion sin ningun documento propio; el
  catalogo global tampoco tenia filas activas al momento de escribir el eval, confirmado por SQL directa
  contra el proyecto real) y **duplicados obvios** (2 documentos organization-scoped sobre el mismo tema con
  contenido casi identico, mas 1 documento claramente distinto). Correccion real durante el desarrollo: el
  comentario de cabecera asumia que A08 no usa `search_knowledge` (solo el catalogo ya resuelto en
  contexto) -- **falso**, `agent_versions` confirma `allowed_tools: ["search_knowledge"]` para A08
  (`model=claude-opus-4-8`), lo que explica el resto de hallazgos. Primera corrida real encontro 4 fallos
  hard, 3 de ellos **checks mal calibrados** (mismo patron que A06): comparacion de acentos rota (`dañado`
  vs `danado` normalizado, arreglado con `stripAccents`), y un check que confundia fuentes legitimas de
  `search_knowledge` (kind='tool', confirmando ausencia real) con fuentes fabricadas. Corregidos.
  **Hallazgo real que sobrevive la correccion de checks, no es un bug del eval**: en 2 de 3 corridas reales,
  el campo `answer` de A08 llego con un fragmento inicial corrupto/desordenado antes de recuperarse en texto
  coherente -- `", ecd"` seguido de nada en la primera corrida (`checkOutputSanity` no lo bloqueo por no
  estar vacio ni repetido), y `"El catlogo del catos c\ntene tres documentos..."` en la tercera (typos y
  salto de linea a mitad de palabra, luego coherente). Ambos casos coinciden con turnos donde A08 hizo
  varias llamadas seguidas a `search_knowledge` (una de ellas ademas golpeo un 429 real de Voyage por el
  limite de 3 RPM de la cuenta sin metodo de pago, mismo hallazgo ya documentado en AI-04). No es
  reproducible a voluntad ni bloqueante para el criterio de cierre de este eval (los `findings`/`sources`
  siguen siendo coherentes y sin fabricacion en todas las corridas), pero es una señal real de que
  `checkOutputSanity` **no cubre corrupcion parcial al inicio del texto tras una secuencia larga de tool
  calls** -- gap nuevo, no capturado antes porque A02/A06 no encadenan tantas llamadas a herramientas
  seguidas. Quality gate de latencia tambien violado en 2/3 corridas (48-98s vs el umbral de 45s), coherente
  con el mismo patron de multiples tool calls encadenadas. Corrida final usada como evidencia: escenario
  `catalogo_vacio` limpio (3/3 checks, incluido el gate de latencia); escenario `duplicados_obvios` con
  findings/sources correctos y sin fabricacion, pero con el gate de latencia violado y el hallazgo de
  corrupcion parcial de texto arriba. Coste total entre las 3 corridas (incluida la fallida por 429 durante
  la ingesta): ~$0.35.
- **Resuelto 2026-07-23 (audio deficiente y varios interlocutores, A01)**: los 2 escenarios que quedaban
  pendientes explicitamente del pedido original para A01 anadidos a `eval-a01-call-analyst.ts` (5 escenarios
  en total ahora). **Audio deficiente**: transcripcion con tramos `[inaudible]`/`[audio cortado]` justo en
  la cifra de precio y la fecha de un cambio de proveedor -- el agente no inventa ni la cifra ni la fecha
  (2 checks hard), avisa explicitamente de los cortes en `warnings`, y baja su `confidence` a `medium`.
  **Varios interlocutores**: 3 personas en la llamada (consultor + 2 personas del cliente con nombre y rol
  propios, cada una con una tarea distinta) -- el agente distingue correctamente a cada persona y le atribuye
  su tarea, sin colapsarlas en un "cliente" generico. Corrida real: **0 fallos hard, 2/13 fallos soft (15%,
  bajo el umbral de 1/3)** -- ambos soft fails son la misma ambiguedad razonable ya vista en A01/A02 (el
  agente asigna `owner: "cliente"` a una decision que legitimamente le corresponde al cliente, no una
  alucinacion). Coste total de la corrida (5 escenarios): $0.15.
- **Resuelto 2026-07-23 (deteccion de apertura incoherente en `checkOutputSanity`)**: implementada la mejora
  que quedo pendiente tras el hallazgo de A08 -- `hasIncoherentOpening` (`packages/ai/src/index.ts`) rechaza
  ahora un `answer`/`summary` que (1) empieza con puntuacion de continuacion imposible al inicio de un texto
  humano (coma, punto y coma, dos puntos, parentesis/corchete de cierre -- el patron real de `", ecd"`), o
  (2) tiene un salto de linea partiendo una palabra a mitad dentro de los primeros 60 caracteres sin
  puntuacion de cierre de frase antes (el patron real de `"El catlogo del catos c\ntene..."`). Reproduce
  ambos glitches reales observados en la eval de A08 como tests puros (sin I/O) en
  `packages/ai/src/index.test.ts`, mas 2 tests de no-regresion para confirmar que no bloquea texto legitimo
  corto (`"ok"`) ni saltos de linea legitimos tras puntuacion (parrafos). Descartado un primer diseño
  (longitud corta + pocas letras) por dar falso positivo real contra `"ok"` en la propia suite de tests --
  el chequeo final es mas preciso (apertura imposible, no solo "corto"). 30/30 tests de `packages/ai` pasan
  (26 previos + 4 nuevos), `@ecomscaling/ai` reconstruido (`npm run build -w @ecomscaling/ai`) para que
  `apps/api` recoja el cambio, 105/105 tests de `apps/api` pasan, typecheck limpio en los 10 workspaces.
  - Sin metricas automaticas mas alla de sanity + los checks nuevos (`citation_precision`,
    `unsupported_claim_rate`, `task_duplicate_rate`, `false_positive_rate`, `cross_tenant_violation_rate`,
    `p95_latency`, `average_cost` agregados historicamente -- hoy cada corrida es independiente, sin
    almacenar resultados para comparar entre versiones de prompt).
  - Sin proceso de regresion obligatorio (dataset offline -> shadow -> canary -> activacion) antes de
    promover una version de prompt -- los gates actuales corren manualmente, no bloquean un despliegue de
    `agent_versions.is_active` todavia.
  - Sin feedback estructurado del consultor (util/no util, prioridad correcta, edicion necesaria).
- **Resuelto 2026-07-28 (corrupcion parcial en mitad de texto)**: `hasIncoherentOpening` solo miraba el
  primer salto de linea dentro de los primeros 60 caracteres del texto -- el mismo glitch de palabra
  partida por un salto de linea, si aparecia mas adelante en un `answer`/`summary` largo, pasaba
  `checkOutputSanity` sin deteccion. Anadida `hasBrokenWordMidText` (`packages/ai/src/index.ts`) con la
  misma heuristica (palabra rota entre lineas, sin puntuacion de cierre de frase antes del salto) pero
  recorriendo todos los saltos de linea del texto, no solo el primero; exige minuscula justo despues del
  salto (mas estricto que la apertura, que acepta ambos casos) para no confundir un parrafo o un item de
  lista legitimo que arranca con mayuscula sin punto previo. Nueva razon de rechazo:
  `${field}_con_texto_partido`. 4 tests nuevos en `packages/ai/src/index.test.ts` (el caso real de palabra
  partida a mitad de texto, mas 3 de no-regresion: parrafos multiples con punto de cierre, lista con
  guiones, y el caso de apertura original que ya cubria `hasIncoherentOpening`). 29/29 tests de
  `packages/ai` pasan, `@ecomscaling/ai` reconstruido y typecheck de `apps/api` limpio (sin correr los
  tests de integracion de `apps/api` en esta sesion -- este entorno no tiene Supabase configurado, ver nota
  equivalente en FE-00).
- **Siguiente accion:** todos los agentes de diagnostico (A01, A02, A06, A08) tienen ya un dataset propio,
  incluidos los 2 escenarios de A01 (audio deficiente, varios interlocutores) que esta misma seccion
  listaba antes como pendientes -- ya resueltos arriba el 2026-07-23, texto desactualizado corregido
  2026-07-28. Unico candidato real pendiente: decidir si los quality gates deben pasar a bloquear la
  activacion de una nueva `agent_versions` (hoy son solo un script manual sin efecto en `is_active`) --
  decision de proceso, no de codigo.

## Objetivo

Medir seguridad, utilidad y regresiones antes de produccion.

## Entregables

- Datasets por agente.
- Tests de groundedness, permisos y falta de datos.
- Tests de prompt injection.
- Presupuesto maximo de coste y latencia.
- Feedback del consultor.

## Criterios de cierre

- Version nueva no degrada casos criticos.
- Errores de permiso objetivo cero.
- Existe rollback de prompt/version.
