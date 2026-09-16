# Bitacora de implementacion — fase 3, sistema de diagnostico

Que se ha construido de esta fase, **como y por que**. El estado de cada bloque
vive en el indice global
([`conocimiento/IMPLEMENTACION.md`](../IMPLEMENTACION.md)); aqui esta el
razonamiento que ese indice no cabe: la decision que se tomo, la alternativa que
se descarto, lo que quedo fuera y donde se aplico el esquema.

Una entrada por bloque, en el orden en que se implementa. Se escribe en el mismo
commit que el bloque, no despues.

**Quien ve cada cosa** esta al final, en "Audiencia": una fila por bloque con lo
que veran cliente, consultor y platform_admin, y que agente lo consume. Se
decide al implementar el bloque, y **desde el 2026-09-25 se construye tambien**:
la fila dejo de ser un apunte para ser el boceto de una pantalla.

> **Esta fase no esta terminada.** Sus 15 bloques estan en `contrato` — esquema,
> invariantes y tests, en test y en produccion — y les falta el motor que
> escriba esas tablas y la pantalla que las muestre. Las tres patas se definen
> en el apartado 3 del plan maestro. El inventario de lo que queda esta al
> final, en "Lo que falta para cerrar la fase 3".

**Regla de despliegue de esta fase** (decision 2026-09-14): toda migracion se
aplica primero a **test** (`npm run db:push`) y se verifica ahi; si no da error y
el esquema queda como se espera, se aplica a **produccion**
(`npm run db:push:prod`). Nunca con `apply_migration` del MCP, que ejecuta el SQL
sin anotarlo en `schema_migrations`. El esquema va a produccion **antes o a la
vez** que el codigo que lo necesita, nunca despues: el codigo se despliega solo
al hacer push a `main`, las migraciones no.

---

## `D00` — Contrato de diagnostico · **contrato** 2026-09-14

**Fuente:** `02-contratos-IA/D00-contrato-de-diagnostico.md` (61 apartados).

D00 no diagnostica nada. Define **que es un diagnostico** y que estructura debe
respetar cualquier motor de la fase (D01..D14) al producirlo. Por eso su
implementacion es contrato puro: esquema e invariantes, sin motor.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema del caso diagnostico | `supabase/migrations/20260914110000_f3_d00_contrato_de_diagnostico.sql` |
| Tipos y esquemas Zod de la salida | `packages/contracts/src/diagnostics.ts` |
| Invariantes cruzados | `checkDiagnosticInvariants()` en el mismo fichero |
| Tests de los invariantes | `packages/contracts/src/diagnostics.test.ts` (14) |
| Ejecucion en CI | `.github/workflows/ci.yml`, paso *Diagnostic contract invariant tests* |

10 tablas: `diagnostic_cases`, `_observations`, `_signals`, `_symptoms`,
`_symptom_signals`, `_hypotheses`, `_evidence`, `_hypothesis_evidence`,
`_data_gaps`, `_case_links`. 26 check constraints, RLS en las 10.

### Decisiones

**Una tabla por capa, no un `jsonb` con todo dentro.** El apartado 2 separa
dato / senal / sintoma / hipotesis / evidencia / causa / constraint / severidad /
confianza justamente para impedir el razonamiento circular — tomar un sintoma
por una causa, una correlacion por una explicacion. Guardarlo todo en un
documento unico dejaria esa separacion en manos de quien escriba el JSON, es
decir, del modelo. Con una tabla por capa la sostiene el esquema: una hipotesis
no existe sin caso, una evidencia apoya o contradice de forma explicita, y una
hipotesis descartada sigue ahi con su motivo.

**Columna para lo que se filtra, `jsonb` para lo que se lee entero.** Estado,
severidad, confianza, scope y fechas son columnas: son lo que un guardrail
comprobara y lo que sostiene los indices. `business_context` (F1),
`maturity_context` (F2) y `data_quality` (D01) van en `jsonb` porque su forma
pertenece a **otros bloques**; fijarlos en columnas aqui seria decidir por ellos
antes de tiempo.

**Snapshot, no FK viva.** Esos tres contextos se copian dentro del caso. El
apartado 61 exige poder reconstruir que datos habia *cuando* se diagnostico; con
una referencia a la fila viva, releer un caso de hace tres meses lo mostraria con
el contexto de hoy y la traza seria mentira.

**La frontera es estructural, no un prompt.** El apartado 40 prohibe que el motor
diagnostico recomiende. No hay columna ni campo `action`, `recommendation`,
`priority`, `next_steps` ni `playbook` — y hay un test que falla si alguien los
anade. No darle donde escribirlo es mas barato que prohibirselo por prompt.

**Los invariantes se reparten segun lo que cada sitio sabe ver.** Lo que se
decide mirando una fila es `check` constraint (6). Lo que necesita ver varias
entidades a la vez es `checkDiagnosticInvariants()` (9): alternativas
consideradas (§11) y resueltas (§34), evidencia minima (§46), falsacion
intentada (§12/§36), calidad de datos evaluada (§58), hueco declarado
(§14/§58), causa distinta del constraint (§20), confianza coherente (§26), no
generalizar (§58). El apartado 60 exige que estas reglas **no dependan del RAG**:
si dependieran de que el vector search encuentre el documento, dejarian de
cumplirse en silencio.

### Lo que quedo fuera, a proposito

- **§58, "no convertir correlacion en causalidad"** — sin check ejecutable. No se
  puede decidir mirando la estructura del caso, y fingir que se comprueba seria
  peor que admitir que depende del juicio del motor y de la revision humana. Los
  otros 14 invariantes del apartado si estan.
- **§25, transiciones de estado** — `status` valida el catalogo de valores, no
  que la transicion sea legal (hoy un caso puede saltar de `open` a `confirmed`).
  La maquina de estados es runtime y ningun motor escribe todavia.
- **§61, reconstruccion desde el panel** — las tablas guardan la traza completa;
  no hay pantalla que la lea. Cuando exista un motor que escriba casos.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicada con `npm run db:push`. Bloque `DO`
  comprobando que 6 invariantes rechazan la violacion y sin filas residuales.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): aplicada con `npm run db:push:prod`.
  Verificado 10 tablas / 10 con RLS / 10 politicas / 26 checks, y la migracion
  anotada en `supabase_migrations.schema_migrations`. Identico a test.
- 14 tests en verde. Se comprobo que fallan de verdad: al romper el umbral de
  evidencia minima fallo su test y solo el suyo.
- Se anadio `@ecomscaling/contracts` a CI — **no corria sus tests**. Un test que
  no se ejecuta no es un guardrail.

### Riesgo abierto

Nada lee ni escribe estas tablas todavia. El contrato esta verificado contra el
documento, no contra un consumidor real; el primer motor que escriba casos
(D05/D06) es el que dira si la forma aguanta.

---

## `D01` — Calidad y fiabilidad de los datos · **contrato** 2026-09-14

**Fuentes:** `02-contratos-IA/d01-requisitos-contrato-calidad-datos.md` (18 apartados),
`04-policies-guardrails/d01-guardrails-calidad-diagnostico.md` (38 guardrails),
`06-tenant-context/d01-configuracion-calidad-y-semantica.md` (13 apartados).

D01 responde a una pregunta anterior a cualquier motor de la fase: **¿el dato
aguanta la interpretacion que se le quiere dar?** Es lo que impide que "las
ventas han caido" signifique en realidad "el pixel dejo de disparar".

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260914160000_f3_d01_calidad_y_fiabilidad_de_datos.sql` |
| Catalogos, esquemas Zod y la puerta | `packages/contracts/src/data-quality.ts` |
| Tests | `packages/contracts/src/data-quality.test.ts` (22) |

6 tablas: `data_source_expectations`, `tenant_metric_definitions`,
`data_quality_assessments`, `data_quality_issues`,
`data_source_reconciliations` y el puente `diagnostic_case_data_quality`.
43 check constraints, RLS en las 6.

### Decisiones

**El artefacto se niega a definir esquema, y con razon.** Su apartado 18 dice
literalmente que no se inventen tablas, columnas ni ids a partir de el, que eso
es trabajo de un contrato tecnico posterior. Esta migracion **es** ese contrato:
los vocabularios cerrados (freshness, missingness, variance, roles de fuente)
salen palabra por palabra del documento; los nombres de tabla y columna son
decision de aqui y no se atribuyen al artefacto.

**Configuracion y observacion, separadas.** El apartado 13 del tenant context lo
exige: `data_source_expectations` y `tenant_metric_definitions` son configuracion
estable del ecommerce; las otras tres son telemetria de una evaluacion concreta.
Mezclarlas haria que cambiar hoy la definicion de CAC reescribiera el pasado.

**La definicion de una metrica es una serie temporal, no un valor.** Con una fila
por metrica, `METRIC_DEFINITION_DRIFT` (apartado 3) no se puede declarar: se
sobreescribe y el historico queda comparado contra una formula que entonces no
existia, que es el guardrail 10. Por eso lleva `effective_from`/`effective_to`,
con indice parcial de una sola definicion vigente, y cerrar una exige
`change_reason`.

**Lo que no se compara, no se resta.** En `data_source_reconciliations`, si las
fuentes no son comparables las columnas de diferencia quedan nulas por check
constraint (guardrail 6). Restar dos metricas con definicion o periodo distintos
produce un numero sin significado que despues alguien cita como evidencia.

**Una discrepancia no es un error.** Guardrail 4: `classification` empieza en
`unknown` y pasar a `error` exige explicacion escrita. Dos fuentes que difieren
pueden estar midiendo cosas distintas, no una rota.

**El umbral de freshness vive en la base, no en el codigo.** El guardrail 1
prohibe un umbral global: pedidos live se miden en minutos y un P&L mensual en
dias. `expected_cadence_minutes` esta por fuente y uso, y la evaluacion copia el
valor que regia al evaluar — mismo motivo que los snapshots de D00.

**Una sola fuente primaria por fenomeno**, por indice unico parcial (apartado 2).
Dos primarias es justo la ambiguedad que el paso 4 del runtime tiene que
resolver antes de reconciliar nada.

**El reparto de los 38 guardrails.** Los que se deciden mirando una fila son
check constraints (43). Los 9 que necesitan ver el caso diagnostico **y** la
calidad del dato a la vez estan en `checkDataQualityGate`, que es el puente real
con D00: `bloqueo_respetado` (§36), `confianza_degradada` (§23, §35),
`causa_tecnica_antes_que_negocio` (§34), `gap_declarado` (§37),
`permiso_no_es_ausencia` (§14), `divergencia_sin_clasificar` (§4, §28),
`comparabilidad_temporal` (§18, §19), `evidencia_fragil` (§29-31),
`definicion_estable` (§10).

### Lo que quedo fuera, a proposito

- **Guardrails 5, 25 y 26 (no sumar atribucion entre plataformas)** — ya los
  sostiene [`ADR-0021`](../../docs/decisions/ADR-0021-ingresos-atribuidos-entre-integraciones.md)
  en la capa de integraciones, que es donde se construyen las cifras. Repetirlos
  aqui daria por comprobado algo que depende de como se agrego el dato tres
  capas mas abajo.
- **Guardrail 15 (descartar duplicacion, backfill o schema drift antes de leer
  un spike como cambio de negocio)** — necesita la serie temporal, no la
  estructura del caso. Es trabajo del motor de senales (`D05`).
- **Guardrail 7 (preferir source of truth y corroboracion independiente)** — es
  un criterio de diseno de la jerarquia de fuentes, no una comprobacion.
- **El flujo de 19 pasos de `03-runtime`** — es un motor, y no hay todavia nada
  que evaluar: ninguna integracion escribe evaluaciones y `D05`/`D06` no
  existen. El esquema y la puerta son la mitad que se puede construir sin
  inventar el consumidor.
- **Lineage de metricas derivadas (apartado 9)** — la cadena
  `source -> raw_table -> normalized_table -> business_metric` no tiene tabla.
  Los guardrails 22 y 24 quedan cubiertos solo en parte: una fuente `derived` no
  puede prometer cadencia propia, pero la propagacion de degradacion por la
  cadena no se comprueba. Se abre cuando exista un registro real de metricas.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicada con `npm run db:push`. Bloque `DO`
  con 14 intentos de violacion: **los 14 rechazados**, insert valido aceptado,
  rollback limpio y 0 filas residuales.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): aplicada con `npm run db:push:prod`.
  6 tablas / 6 con RLS / 6 politicas / 43 checks / migracion anotada. Identico a
  test.
- 22 tests nuevos (36 en el paquete). Mutacion comprobada: al romper el umbral
  de `bloqueo_respetado` fallo su test y solo el suyo.
- CI ya ejecutaba `@ecomscaling/contracts` desde `D00`, asi que no hizo falta
  tocar el workflow.

### Riesgo abierto

El mismo que `D00` y ahora mas grande: nada escribe en estas tablas. La puerta
esta verificada contra el documento, no contra un motor. El primer consumidor
real (`D05`) dira si `phenomenon` y `scope` estan bien elegidos como ejes — son
la decision mas facil de equivocar aqui, porque atraviesan las seis tablas.

---

## `D02` — Contextualizacion · **contrato** 2026-09-14

**Fuentes:** `02-contratos-IA/d02-requisitos-contrato-contextualizacion.md` (18 apartados),
`04-policies-guardrails/d02-guardrails-contextualizacion.md` (38 guardrails),
`06-tenant-context/d02-contexto-configurable-ecommerce.md` (24 apartados),
`05-experience-learning/d02-experiencia-historica-y-aprendizaje-contextual.md`.

Primer bloque de la fase con las cinco capas. D01 pregunta si el dato es fiable;
D02 pregunta **que significa aqui**. La misma caida de CVR es un fallo en una
tienda y un trade-off deliberado en otra que acaba de retirar un descuento para
recuperar margen.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260914190000_f3_d02_contextualizacion.sql` |
| Catalogos, esquemas Zod e invariantes | `packages/contracts/src/context.ts` |
| Deteccion de la paradoja de Simpson | `detectSimpsonReversal()` en el mismo fichero |
| Tests | `packages/contracts/src/context.test.ts` (21) |

7 tablas: `tenant_context_facts`, `context_change_events`,
`context_comparability_breaks`, `context_assessments`, `context_mix_segments`,
`context_assessment_change_events`, `context_confounders`. 24 check
constraints, 1 trigger de inmutabilidad, RLS en las 7.

### Decisiones

**La frontera vuelve a ser una ausencia.** El limite funcional del artefacto es
explicito: "D2 no debe cerrar causalidad". Asi que no existe columna ni campo
`root_cause`, `causes`, `explains` ni `confirmed` en ninguna de las 7 tablas. Un
cambio se relaciona con una senal por su posicion en el tiempo
(`temporal_relation`) y por si se descarto o no — nada mas. El guardrail 20 dice
que la proximidad temporal no es causalidad, y no darle sitio donde escribirla
es mas barato que prohibirselo por prompt. Hay un test que falla si alguien
anade uno de esos campos.

**`tenant_context_facts` es una tabla estrecha, no 200 columnas.** El tenant
context enumera 23 familias (modelo de negocio, mix de producto, canales,
mercados, objetivos, restricciones...) y avisa dos veces de que la taxonomia **no
es cerrada**. Una columna por concepto seria una migracion por cada matiz nuevo
de un cliente. Una fila por `(dimension, valor, origen)` aguanta el catalogo
abierto y, sobre todo, resuelve el apartado 22, que es el dificil: el contexto
**declarado** por el cliente y el **observado** por sus datos conviven como dos
filas vivas. Un cliente que dice "somos suscripcion" mientras sus pedidos dicen
"compra unica" produce dos filas, no una sobrescrita. El guardrail 28 exige que
una contradiccion no se resuelva en silencio; aqui ni siquiera puede.

**Simpson deja de ser una advertencia y pasa a ser un calculo.**
`context_mix_segments` guarda peso **antes** y peso **despues**, los dos
obligatorios. Con las dos cifras, `detectSimpsonReversal()` decide: si todos los
segmentos se mueven en una direccion y el agregado en la contraria, lo unico que
cambio fue la composicion. Es el unico punto de este bloque donde el sistema
puede afirmar algo definitivo sobre causalidad, y lo afirma en negativo: "esto
**no** es un cambio de rendimiento". Devuelve `null` cuando no hay datos para
decidirlo, y el test lo fija: no detectar la paradoja no es haberla descartado.

**Una tabla para dos rupturas.** `REGIME_CHANGE` (apartado 9) y
`MEASUREMENT_DISCONTINUITY` (apartado 11) llegan por caminos distintos — uno es
el negocio, otro la medicion — pero hacen exactamente lo mismo: a partir de una
fecha, el historico anterior deja de ser baseline limpio (guardrails 18 y 19).
Separarlas duplicaria la unica consulta que importa: "¿hay alguna ruptura entre
mi baseline y mi periodo?".

**El snapshot no se reescribe, y lo impide la base.** El guardrail 38 prohibe
sobrescribir retrospectivamente un snapshot historico con la configuracion
actual del tenant. Es la clase de regla que se rompe sin mala intencion, en un
`update` rutinario, asi que no depende de que nadie se acuerde: un trigger
(`private.prevent_context_snapshot_overwrite`) lo rechaza. Es la unica
aportacion real de la capa `05-experience-learning` en este bloque, y el propio
artefacto explica por que no hay mas: schema de experiencia, outcomes,
similitud y promocion de aprendizajes los remite a documentos posteriores.

**Un baseline sin motivo escrito es una comparacion elegida por cercania**, que
es justo lo que prohibe el guardrail 3. `baseline_type` exige
`baseline_rationale` por check constraint.

### Lo que quedo fuera, a proposito

- **Guardrails 1, 2, 5 y 10 a 14** (no leer una metrica aislada, no usar
  benchmarks genericos como verdad, no penalizar una decision estrategica
  deliberada) — dependen de conocer el objetivo del negocio y de juzgar si una
  desviacion es intencionada. Eso es criterio, y el RAG es donde vive. Fingir
  que una funcion lo comprueba seria peor que decir que no.
- **Guardrail 9** (no ocultar scopes locales tras promedios globales) — es real
  y mecanizable, pero exigiria un umbral de materialidad que el artefacto no da
  y que seria inventado. `paradoja_de_simpson` cubre su caso peor.
- **Guardrails 33 a 35** (disponibilidad antes que demanda) — necesitan stock
  real por periodo, que hoy no llega hasta aqui. Vuelven con `D05`.
- **El flujo de 16 pasos de `03-runtime`** — mismo recorte que en `D01`: es un
  motor y no hay senales que contextualizar todavia. Las 6 ramas operativas (CVR
  agregado cae, revenue WoW, CAC sube, AOV baja, retencion cae, metrica local
  peor con resultado economico mejor) quedan como el guion del motor cuando
  exista.
- **La economia del apartado 14** (gross margin, contribution, CAC, LTV,
  payback, cash position) — ya vive en las integraciones y en
  `shopify_margin_summary`. Duplicarla como contexto declarado seria crear una
  segunda verdad sobre los mismos numeros.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicada con `npm run db:push`. Bloque `DO`
  con 13 intentos de violacion: **los 13 rechazados**, incluido el trigger de
  inmutabilidad del snapshot. Y un caso positivo que importa tanto como los
  rechazos: contexto declarado y observado contradictorios quedaron **vivos a la
  vez, 2 filas**. Rollback limpio, 0 filas residuales.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): aplicada con `npm run db:push:prod`.
  7 tablas / 7 con RLS / 7 politicas / 24 checks / funcion del trigger presente /
  migracion anotada.
- 21 tests nuevos (57 en el paquete). Dos mutaciones comprobadas: al desactivar
  la deteccion de Simpson fallaron sus dos tests y solo esos; al romper la
  herencia de incertidumbre de D01, el suyo.

### Riesgo abierto

`tenant_context_facts` tiene catalogo abierto en `dimension`. Es lo correcto
segun el artefacto, pero significa que dos consultores pueden escribir
`business_model` y `modelo_negocio` sin que nada se queje. Cuando exista la
pantalla que las escriba hara falta una lista cerrada **en la UI**, no en la
base — cerrarla aqui es lo que el documento prohibe expresamente.

---

---

## `D03` — Deteccion de etapa de madurez · **contrato** 2026-09-15

**Fuentes:** `02-contratos-IA/d03-requisitos-contrato-madurez.md` (19 apartados),
`04-policies-guardrails/d03-guardrails-madurez.md` (30 guardrails),
`05-experience-learning/d03-aprendizaje-y-evolucion-madurez.md`,
`06-tenant-context/d03-contexto-madurez-ecommerce.md`.

D03 contesta **"¿que es capaz de hacer este negocio?"**, que no es "¿como le
va?". Un ecommerce puede facturar mucho con capacidades fragiles y otro poco con
un sistema solido y joven.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260915090000_f3_d03_madurez_por_capacidad.sql` |
| Catalogos, escalera e invariantes | `packages/contracts/src/maturity.ts` |
| Tests | `packages/contracts/src/maturity.test.ts` (23) |

4 tablas: `maturity_profiles`, `capability_maturity`, `maturity_evidence`,
`capability_dependencies`. 23 check constraints, RLS en las 4.

### Decisiones

**Los 30 guardrails son casi todos la misma frase: `X != MADUREZ`.** Facturacion,
rendimiento, usar una herramienta, automatizar, tamano de equipo, documentacion.
Todos se cumplen igual y en negativo: **no existe columna donde escribir X**. Si
no hay sitio para la facturacion ni para el numero de personas, no pueden
colarse en el calculo por descuido. Hay un test que falla si aparece cualquiera
de esos campos.

**No hay puntuacion.** El guardrail 11 prohibe una nota vanity sin
interpretacion diagnostica, asi que no existe `score`, `maturity_index` ni
`rating` en ninguna tabla. A cambio, un hallazgo **exige** su
`gap_interpretation` por check constraint: la nota se cambia por explicacion, no
se elimina sin mas.

**Estado no es etapa.** No hay columna de salud ni de incidencia: un problema de
hoy no mueve la etapa estructural (guardrail 7). La salud por capacidad es `D04`
y vive en otro sitio a proposito. Tampoco hay `priority`: un cuello de botella
de madurez no es la prioridad de esta semana (guardrail 19), eso es F4.

**La jerarquia de evidencia es el nucleo mecanizable.** El apartado 10 la ordena:
comportamiento observado > dato del sistema > proceso documentado > lo que dice
el cliente. De ahi sale la regla dura del bloque: **a partir de `defined` hace
falta evidencia por encima de la autopercepcion**. Y se anade `tool_presence`
como tipo propio, que **no esta en la lista del artefacto**, porque los
guardrails 3 y 14 avisan exactamente de eso y sin tipo propio se colaria
disfrazado de dato del sistema: tener Klaviyo no es saber hacer email marketing.

**Las dimensiones no son casillas informativas.** El apartado 5 lista diez y tres
sostienen un nivel por check constraint: sin medicion no se llega a `measured`
(guardrails 20 y 21), sin ownership no se llega a `optimized` (guardrail 29), y
sin aprendizaje ni resiliencia no se es `adaptive` (guardrail 30). Se anade
`influences_decisions` junto a `has_measurement` porque el guardrail 20 pide las
dos cosas: medir y que la medida cambie alguna decision. Un panel que nadie mira
no es madurez.

**"Observar mejor" no es "haber mejorado".** El artefacto da el ejemplo exacto:
Finance E3-E5 con confianza baja pasando a Finance E4 con confianza alta. Por eso
un perfil que sustituye a otro **tiene que declarar** `change_type`, y si dice
`confidence_increase` o `uncertainty_reduction`, ningun nivel puede haber subido
(guardrail 28). Sin esto el sistema celebra progresos que no existieron.

**E0..E12 no se redefinen aqui.** El apartado 2 es explicito: "D3 consume estos
stages; no los redefine". La columna guarda el codigo y el significado pertenece
a la fase 2.

**`capability_dependencies` se crea vacia, a proposito.** El grafo de que
capacidad necesita a cual es conocimiento de ecommerce y el artefacto solo da un
ejemplo (escalar paid necesita inventario, finanzas, creatividad, conversion,
operaciones y datos; la produccion de creatividades pone techo a paid).
Inventarme el resto seria justo lo que prohibe el apartado 1 del plan maestro:
convertir criterio en codigo. Los invariantes que dependen del grafo
(`escalado_sin_base`, `techo_declarado`, `asimetria_no_es_problema`) simplemente
no disparan mientras este vacio, y eso es honesto: no detectar no es descartar.

### Lo que quedo fuera, a proposito

- **Guardrail 25** (no exigir capacidades enterprise a quien no las necesita) en
  su forma fuerte — derivar `required_level` de la complejidad del negocio
  (volumen, SKUs, mercados, canales) exige el algoritmo de scoring, los
  thresholds y las ponderaciones, y el apartado 19 dice expresamente que **no
  estan definidos**. Inventarlos seria fabricar la respuesta y presentarla como
  derivada del documento. Lo que si se comprueba es la coherencia: si alguien
  declara un `required_level`, el hallazgo tiene que cuadrar con el
  (`simplicidad_no_se_penaliza`, `complejidad_no_se_premia`).
- **Guardrail 22** (no usar frameworks externos como verdad del tenant) — es una
  regla sobre de donde sale el contenido, no sobre la forma del perfil.
- **El flujo de `03-runtime`** — tercer bloque consecutivo con el mismo recorte:
  describe un motor y no hay nada que evaluar. Ya es un patron y esta anotado en
  el apartado 8 del plan maestro.
- **El mapping ladder <-> E0..E12** — el apartado 4 dice que "no se define
  todavia". Se guardan los dos y no se traduce uno al otro.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicada con `npm run db:push`. Bloque `DO`
  con 12 intentos de violacion y un caso valido: **13/13 correctas**. Rollback
  limpio, 0 filas residuales.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): aplicada con `npm run db:push:prod`.
  4 tablas / 4 con RLS / 4 politicas / 23 checks / migracion anotada.
- 23 tests nuevos (85 en el paquete). Mutacion comprobada: al desactivar la
  exigencia de evidencia objetiva fallaron sus dos tests y solo esos.

### Riesgo abierto

El mismo de la fase, y uno propio: **el grafo de dependencias esta vacio**, asi
que tres de los invariantes no pueden disparar todavia. Estan escritos y
probados, pero dormidos. Conviene no confundir "no salta" con "esta bien".


---

## `D04` — Diagnostico de salud por capacidad · **contrato** 2026-09-15

**Fuentes:** `02-contratos-IA/d04-requisitos-contrato-health.md` (23 apartados),
`04-policies-guardrails/d04-guardrails-health.md` (50 guardrails),
`05-experience-learning/d04-health-memory-y-aprendizaje.md`,
`06-tenant-context/d04-contexto-health-ecommerce.md`.

`D03` dijo de que es capaz el negocio. `D04` dice **como esta hoy**. Es la misma
distincion que el guardrail 7 de D03 (`STATE != STAGE`) vista desde el otro
lado, y por eso viven en tablas separadas: una capacidad puede ser madura y
estar rota esta semana, o ser joven y funcionar perfectamente.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260915140000_f3_d04_salud_por_capacidad.sql` |
| Catalogos, tarjeta de salud e invariantes | `packages/contracts/src/health.ts` |
| Tests | `packages/contracts/src/health.test.ts` (23) |

5 tablas: `tenant_capability_config`, `health_references`, `capability_health`,
`health_findings`, `health_evidence`. 35 check constraints, RLS en las 5.

### Decisiones

**Diez de los cincuenta guardrails son `X != SALUD`** — madurez, un KPI suelto,
las ventas, la causa, la prioridad, la severidad, la disposicion a escalar, lo no
optimo, la ausencia de datos y un heatmap. Se cumplen como en `D03`: **no hay
donde escribir X**. Sin `priority` (eso es F4), sin `root_cause` (eso es
D07-D09), sin `scaling_readiness`, sin `score` ni `health_index`. Un test falla
si aparece cualquiera.

**La severidad no esta en la capacidad, esta en el hallazgo.** Apartado 13 y
guardrail 6: la salud es el estado de una capacidad y la severidad es el dano de
un hallazgo concreto. Son ejes distintos y mezclarlos hace que un problema grave
y localizado pinte de rojo una capacidad que funciona. `capability_health` no
tiene columna `severity`; `health_findings` la tiene y es obligatoria.

**La ausencia de datos no es salud.** Guardrail 9 y apartado 21, y es el error
mas facil de cometer: si no vemos anomalias, asumimos que todo va bien. Con
`confidence = insufficient_data` el estado tiene que ser `not_assessable` o
`unknown`, nunca `healthy`. Y `not_assessable` exige decir **que** falta.

**Salud y riesgo son independientes, y eso se protege NO poniendo una
constraint.** Los guardrails 22 y 23 dicen que HEALTHY puede convivir con riesgo
estructural alto. Forzar que cuadren destruiria justo la informacion que hace
util al bloque. Hay un test que lo fija como comportamiento esperado, para que
nadie "arregle" la aparente inconsistencia mas adelante. Lo unico que si se
exige es el guardrail 25: un riesgo alto a corto plazo necesita indicadores
adelantados, porque mirando solo los rezagados el aviso llega con el dano hecho.

**Jerarquia de scope sin formula de agregacion.** El apartado 4 exige que un
padre HEALTHY pueda convivir con una subcapacidad CRITICAL, y el apartado 23
dice que la politica de agregacion **no esta definida**. Ademas los guardrails 17
("no esconder un desastre local") y 18 ("no degradar el todo por un subsegmento
pequeno") tiran en direcciones opuestas: cualquier formula seria una invencion
presentada como derivada del documento. Lo que hace la base es guardar los dos
niveles con `parent_id`; lo que comprueban los invariantes es que la relacion
**se haya declarado**, en las dos direcciones.

**El rol del problema se llama `issue_role` y sus valores dicen "suspected" en
voz alta.** El guardrail 31 permite registrar si algo parece de origen o
arrastrado; el 30 prohibe afirmar la causa. `primary_suspected` y
`downstream_suspected` hacen la distincion sin abrir la puerta a la causalidad,
que es D07-D09.

**Contra que se juzga lo pone el tenant, no un umbral universal.** El guardrail
11 prohibe clasificar CAC, CVR o refund rate por umbral global y el 13 prohibe
depender de benchmarks externos. `health_references` guarda el baseline propio,
el objetivo y el guardrail economico. Un CAC alto puede ser sano si cabe en la
economia (guardrail 39) y uno bajo puede ser critico si destruye contribucion
(40) — ninguna de las dos cosas se puede saber sin esta tabla, y por eso
clasificar adquisicion sin ella es una violacion.

**`suspected_downstream_of` en vez de una tabla de propagacion.** El apartado 10
pide poder expresar que capacidades podrian verse afectadas. Una auto-referencia
lo resuelve en la direccion que necesitan los guardrails 33 y 34 — no contar dos
efectos arrastrados como dos problemas independientes — y evita una tabla que
hoy nadie llenaria.

### Lo que quedo fuera, a proposito

- **La politica de agregacion** (guardrails 17 a 21) — ver arriba. Se comprueba
  que la relacion padre/hijo este declarada, no se calcula el estado del padre.
- **Los umbrales de estado** (guardrails 11, 48, 49) — cuando un CAC pasa de
  sano a critico depende de la economia de cada tienda y la fuente no da
  formula. La base exige que los extremos se justifiquen y digan sobre que
  impactan; que la justificacion sea buena es juicio humano.
- **El historial de salud** (`experience` apartados 1, 6, 7, 8: pattern
  repetition, cronicidad calculada, recovery patterns) — `capability_health` es
  append-only con `assessed_at`, asi que el historico **se guarda**; lo que no
  hay es nada que lo lea ni derive `chronic_weakness` de el. Hoy `chronicity` es
  una etiqueta que alguien escribe, no un calculo. El propio artefacto remite el
  aprendizaje a F9 (apartado 11).
- **Primer bloque de la fase sin capa `03-runtime`** — no tiene artefacto de
  runtime (`C·PET`), asi que aqui no hubo recorte: el bloque esta completo
  respecto a lo que existe.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicada con `npm run db:push`. Bloque `DO`
  con 10 intentos de violacion y **dos casos positivos que importan tanto como
  los rechazos**: HEALTHY con riesgo estructural critico entro sin pelea, y un
  padre sano con un hijo en desastre tambien. **12/12**, rollback limpio.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): aplicada con `npm run db:push:prod`.
  5 tablas / 5 con RLS / 5 politicas / 35 checks / migracion anotada.
- 23 tests nuevos (108 en el paquete). Mutacion comprobada: al desactivar la
  regla del KPI unico fallo su test y solo el suyo.

### Riesgo abierto

`chronicity` (agudo, cronico, deuda de salud) se escribe a mano y el artefacto
no da umbrales temporales. Mientras nadie derive esa etiqueta del historico, es
una opinion con nombre tecnico. Conviene no tratarla como un dato calculado.


---

## `D05` — Motor de senales y anomalias · **contrato + motor** 2026-09-16

**Fuentes:** `02-contratos-IA/d05-requisitos-contrato-senales.md` (29 apartados),
`04-policies-guardrails/d05-guardrails-senales.md` (57 guardrails),
`03-runtime/d05-flujo-motor-senales.md` (30 pasos),
`06-tenant-context/d05-configuracion-motor-senales.md`,
`05-experience-learning/d05-pattern-memory-y-baseline-learning.md`.

**El primero que escribe filas leyendo datos reales.** D00 a D04 definieron que
es un diagnostico, cuando el dato aguanta, que significa aqui, de que es capaz
el negocio y como esta hoy. D05 mira las cifras y dice "esto ha cambiado".

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260916090000_f3_d05_motor_de_senales.sql` |
| Huella unica de senal | `supabase/migrations/20260916120000_f3_d05_huella_unica_de_senal.sql` |
| Contrato, invariantes **y detector puro** | `packages/contracts/src/signals.ts` |
| Tests | `packages/contracts/src/signals.test.ts` (26) |
| Runtime con I/O | `apps/api/src/signal-engine.ts` |
| Job | `apps/worker/src/signal-engine-once.ts` + `.github/workflows/signal-engine.yml` |

7 tablas: `metric_dependencies`, `tenant_signal_patterns`, `signals`,
`signal_evidence`, `signal_clusters`, `signal_cluster_members`,
`signal_conflicts`. 38 check constraints, RLS en las 7. Mas
`diagnostic_signals.source_signal_id` como puente con D00.

### Decisiones

**La frontera del bloque la fija el artefacto con un ejemplo que no admite
interpretacion**: *"D5 puede decir CTR deterioration. D5 no puede decir creative
fatigue confirmed"* (guardrails 49 y 50). Asi que no hay columna `symptom`,
`cause`, `action`, `recommendation` ni `priority`: interpretar es `D06`, la causa
`D07`-`D09` y la accion F5+. Hay un test que recorre el texto de las senales
generadas y falla si contiene palabras interpretativas.

**Los baselines y guardrails no se duplican: ya existen.** `health_references`
de `D04` guarda por metrica el baseline propio, el objetivo y el guardrail
economico, que es exactamente lo que piden los apartados 1 y 2 del
tenant-context de D05. Una segunda tabla de umbrales seria garantizar que dentro
de seis meses digan cosas distintas sobre el mismo CAC. Una senal referencia la
fila que uso.

**Magnitud no es impacto.** Guardrail 8 y su ejemplo del 57: un +200% en una
campana minuscula puede ser irrelevante. `magnitude_relative` y
`business_relevance` son columnas distintas y la relevancia alta **exige**
exposicion material por check constraint. Sin eso, el motor grita mas fuerte
cuanto menos importa lo que mira.

**El detector es puro, y por eso se puede probar.** `detectSignals` recibe una
serie de numeros y devuelve senales candidatas: sin base de datos, sin reloj.
Toda la decision vive ahi y `signal-engine.ts` solo hace de fontaneria. 14 de
los 26 tests le dan numeros a mano.

**Mediana y MAD, no media y desviacion tipica.** El guardrail 24 pide metodos
robustos cuando hay outliers, y en ecommerce los hay siempre: un Black Friday
dentro de la ventana dispara la desviacion tipica y esconde todo lo demas bajo
un rango enorme. Hay un test con un pico de 900 en una serie de dieces que lo
demuestra.

**Los umbrales son defaults tecnicos declarados como tales.** El guardrail 17
prohibe los umbrales de gurú y el 19 avisa de que incluso uno tecnico casi
universal necesita configuracion. `madMultiplier: 3` es el equivalente robusto de
"tres sigmas" y esta documentado **como default tecnico, no como verdad de
negocio**; el apartado 29 dice expresamente que la formula no esta definida.

**Agrupar no es perder** (guardrail 31). Los clusters existen para no mandar
cinco avisos del mismo fenomeno, pero las senales siguen enteras en su tabla: el
cluster es una relacion, no un resumen que las sustituya.

**Event-linked no es event-caused** (guardrail 35). Una senal puede apuntar al
cambio de negocio con el que coincide en el tiempo, y la columna se llama
`linked_event_id` con un `event_link_status` obligatorio. Nunca `caused_by`.

**Reejecutar no duplica.** `signals_huella_idx` sobre (organizacion, metrica,
scope, fin de ventana, tipo) convierte la segunda pasada del dia en un update.
Dos tipos distintos sobre la misma metrica y dia si son dos filas, porque un
cambio de nivel y una tendencia son cosas distintas.

**El workflow no tiene `schedule`**, igual que Alert Rules: decision de Rafa del
2026-08-03 de no tener disparadores automaticos. Se lanza a mano.

### Un fallo real que encontro un test

La guarda `mad > 0` -- puesta para evitar un rango degenerado -- **silenciaba la
senal mas obvia que existe**: una serie perfectamente plana (13 dias en 100) que
cae a 40 tiene MAD 0 y no generaba nada. Lo cazo el test del baseline. Arreglado
con una tolerancia relativa para series planas, que es otro default tecnico
declarado.

### Lo que quedo fuera, a proposito

De los 30 pasos del runtime, **se implementan 1, 2, 3, 5, 6 (level, trend), 9,
10 y 13**. Lo que falta y por que:

- **Paso 4, ajuste por estacionalidad y dia de la semana** — necesita el
  calendario comercial del tenant (`context_change_events` de D02 existe pero
  esta vacio). Es el recorte con mas consecuencias: hoy una caida de agosto
  generaria senal.
- **Pasos 7 y 8, onset y change points** — algoritmos que el apartado 29 declara
  no definidos.
- **Pasos 14 a 17, drilldown y scan por segmento** — necesitan series
  segmentadas por canal, mercado o dispositivo, que las funciones SQL actuales
  no devuelven.
- **Pasos 19 a 22, corroboracion, conflictos y clustering** — el esquema existe
  entero (`signal_evidence`, `signal_conflicts`, `signal_clusters`) y los
  invariantes tambien; lo que falta es una segunda fuente que corroborar. Llega
  con Meta y Klaviyo.
- **Pasos 25 a 27, patrones y supresion** — `tenant_signal_patterns` existe y
  esta vacia. Ningun patron declarado significa que nada se silencia, que es el
  comportamiento seguro.
- **Paso 29, actualizar D04** — el lazo `METRICS -> SIGNALS -> HEALTH` queda
  abierto: las senales no escriben todavia en `capability_health`.
- **Meta y Klaviyo** — solo se lee `shopify_sales_daily`. Ampliar es anadir una
  entrada a `METRICAS`, no reescribir.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): aplicadas con `npm run db:push`. Bloque `DO`
  con 11 intentos de violacion y 2 casos positivos: **13/13**. Rollback limpio.
- **Motor ejecutado de verdad** contra test: 3 organizaciones, 3 correctas, 0
  fallos, 0 senales escritas — **porque ninguna organizacion de test tiene
  tienda Shopify conectada**. Queda verificada la fontaneria (consultas validas,
  sin errores), no la deteccion sobre datos reales. La deteccion si esta
  ejercitada, por 14 tests con series a mano.
- **Idempotencia comprobada aparte**: dos pasadas el mismo dia dejan una fila
  actualizada, no dos; un tipo distinto si crea fila nueva.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 7 tablas / 7 con RLS / 7 politicas /
  38 checks / huella unica / puente con D00 / 2 migraciones anotadas.
- 26 tests nuevos (134 en el paquete), 300 de la API en verde, typecheck limpio.

### Riesgo abierto

**La deteccion no se ha visto correr sobre datos reales.** No es un descuido del
bloque: no hay ninguna tienda Shopify en test. En cuanto haya una, la primera
pasada del motor es la que dira si el multiplicador de MAD produce ruido o
silencio, y ese numero casi seguro habra que ajustarlo por tenant. Hasta
entonces, cualquier afirmacion sobre su calibracion seria inventada.

Y el recorte del paso 4 tiene nombre: **sin ajuste estacional, agosto generara
senales**. Conviene declarar los patrones conocidos del tenant antes de encender
el workflow.


---

## `D05` — Calibracion contra datos reales · 2026-09-16

Al ir a resolver los dos riesgos abiertos de `D05` (sin ajuste estacional y sin
calibrar) aparecio algo que no estaba previsto: **la unica tienda con historia
llevaba un mes reportando cero euros**.

> **Aviso sobre la muestra (anadido tras revisarlo con Rafa).** La cuenta de
> `padelespana` esta desactivada desde agosto: el ultimo sync bulk correcto es
> del **13-08-2026 16:13** y la conexion esta en `pending_deletion` desde el
> 11-09-2026, con purga programada para el 11-10-2026. **No es una muestra
> valida para calibrar el negocio.** Lo que si es valido es lo estructural: que
> con MAD del 45% de la mediana el limite inferior de la banda cae por debajo de
> cero. Eso es aritmetica de la dispersion, no una propiedad de esta tienda, y
> le pasa a cualquier serie pequena y volatil.
>
> El apagado explica **cuando** se vio el fallo, no el fallo. Los ceros ya se
> escribian antes; el sync bulk los machacaba cada dia y los tapaba. La prueba
> son los ceros sueltos de enero y abril de 2025 y el de junio: pedidos que el
> bulk nunca volvio a tocar. Al pararse el bulk, dejo de haber quien tapara.

### El fallo de datos que salio al buscar una serie

`padelespana`, 785 pedidos. Desde el **14-08-2026**, el 55% de los pedidos de
agosto y el **99% de los de septiembre** tenian `net_sales = 0` con
`current_total_price` correcto. 248 pedidos, **7.129,78 EUR** que no se contaban.

La causa no era Shopify. El ingreso neto se calculaba en **dos sitios**:

- `apps/api/src/shopify-sync.ts` (sync bulk) escribia
  `net_sales = current_total_price - refunds`. Correcto.
- `apps/api/src/shopify-webhook-handler.ts` (webhooks `orders/create` y
  `orders/updated`) **no escribia la columna**. Como es `not null default 0`,
  cada pedido que entraba por webhook se guardaba con ingreso cero, sin error.

El 14 de agosto el webhook paso a ser la via principal de ingesta y el fallo
paso de anecdota a norma. Nada salto: `orders_count` seguia bien y la unica
senal era que el dinero no aparecia.

El webhook de `refunds/create` tenia el mismo hueco: escribia en
`shopify_refunds` pero nunca bajaba el `net_sales` del pedido.

### El arreglo: la coherencia como check, no como convencion

`supabase/migrations/20260916150000_shopify_net_sales_coherente.sql` recalcula
las filas rotas y deja la igualdad como restriccion:

```sql
check (net_sales = current_total_price - refunds)
```

Es el mismo principio que el resto de la fase: **un guardrail no vive en la
cabeza de quien escribe el mapper**. La proxima via de ingesta que se olvide de
`net_sales` fallara en voz alta en lugar de guardar un cero. Verificado en test
con una tabla espejo: 2 inserts rechazados (uno omitiendo la columna, que es el
bug exacto; otro con un valor incoherente) y 1 aceptado.

Ademas, en el codigo: el webhook de pedidos ahora escribe `net_sales` y
`refunds`, y el de devoluciones recalcula ambos. El helper `sumRefunds` usa el
mismo criterio que el sync bulk para que las dos vias no discrepen.

Produccion despues del arreglo: septiembre paso de **0,00 EUR** a **3.314,14
EUR**; agosto a 6.430,95. El unico cero que queda es legitimo (un pedido
devuelto entero).

### Y ahora si: que hace el detector con datos reales

Serie de 61 dias de `net_sales`, ya corregida. Mediana **173,96 EUR**, MAD
**77,49 EUR**. Simulando una pasada diaria del motor sobre los 47 dias
evaluables:

| `madMultiplier` | Dias con senal | Ruido |
| --- | --- | --- |
| 2 | 9 de 47 | 19% — demasiado |
| **3 (default)** | **3 de 47** | **6% — una cada dos semanas** |
| 4 | 2 de 47 | 4% |

El default no hace ruido. Pero **calla por el motivo equivocado**, y eso es el
hallazgo:

**El rango "normal" con k=3 va de -59 a 406 EUR.** El limite inferior es
**negativo**. En una tienda con esta dispersion (MAD del 45% de la mediana), la
banda simetrica de MAD **no puede disparar nunca una senal de caida**: ni un dia
a cero euros queda por debajo del umbral. Las 3 senales detectadas son las tres
`level/up`.

Comprobado sobre el caso que mas importa — la serie tal y como estaba **con el
bug**, 32 dias a cero:

| `madMultiplier` | Detecta el desplome a cero |
| --- | --- |
| 2 | Si, el 14 y el 15 de agosto. Nada mas |
| **3 (default)** | **No. Ninguna senal** |
| 4 | No |

**El motor de senales no habria detectado el fallo que acabamos de encontrar a
mano.** Y a k=2 solo lo habria visto dos dias: a partir del tercero los ceros ya
son el baseline y el detector se calla. Un fallo sostenido se convierte en la
nueva normalidad.

### Lo que esto cambia

1. **El umbral simetrico esta mal para estas series.** No es cuestion de bajar
   k: a k=2 el ruido sube al 19% y sigue sin aguantar mas de dos dias. Hace falta
   umbral relativo (o asimetrico, mas estrecho a la baja) y un suelo en cero.
   Apartado 29 del contrato ya decia que la formula no estaba definida; ahora hay
   evidencia de por que.
2. **`D01` no es opcional, es la condicion previa.** El motor escribe hoy
   `data_confidence: 'low'` a mano porque nadie lo calcula. Un chequeo de
   `D01` sobre `net_sales = 0` con `orders_count > 0` habria cazado esto el
   15 de agosto. Es exactamente el tipo `contaminated_data` del catalogo de
   issues accionables.
3. **Lo del ajuste estacional pierde urgencia relativa.** Este verano no genero
   senales falsas; el problema real es el contrario, que no genera ninguna a la
   baja.

**No se ha cambiado el default de `madMultiplier`.** Un solo tenant no es base
para mover una constante que afecta a todos, y el arreglo correcto no es la
constante sino la forma del umbral.

---

---

## `D06` — Motor de sintomas · **contrato** 2026-09-17

**Fuentes:** `02-contratos-IA/d06-requisitos-contrato-sintomas.md` (23 apartados),
`04-policies-guardrails/d06-guardrails-sintomas.md` (48 guardrails),
`03-runtime/d06-flujo-motor-sintomas.md` (24 pasos),
`06-tenant-context/d06-contexto-motor-sintomas.md`,
`05-experience-learning/d06-memoria-diagnostica-sintomas.md`.

**El bloque que cruza la frontera de `D05`, y solo esa.** `D05` puede decir "el
CTR cae un 34%". `D06` puede decir "hay un patron de deterioro en prospecting de
Francia". Sigue sin poder decir por que (`D07`-`D09`) ni que hacer (F5+).

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260917090000_f3_d06_motor_de_sintomas.sql` |
| Contrato e invariantes | `packages/contracts/src/symptoms.ts` |
| Tests | `packages/contracts/src/symptoms.test.ts` (22) |

4 tablas: `symptoms`, `symptom_signals`, `symptom_evidence`,
`symptom_relations`. 29 check constraints, 3 triggers, RLS en las 4. Mas
`diagnostic_symptoms.source_symptom_id` como puente con `D00`.

### Decisiones

**La omision mas importante es `direction`, y es deliberada.** El guardrail 21
dice que la valencia es contextual y el 22 lo ejemplifica: "CAC arriba" no es
automaticamente un sintoma negativo — puede ser el precio de entrar en un
mercado nuevo. Si el sintoma guardase la direccion de la metrica, derivar la
valencia de ella seria lo mas natural del mundo y nadie se daria cuenta. La
direccion vive en las senales de `D05`, **a un join de distancia**: consultarla
exige un acto deliberado. La garantia no es una regla que prohiba el atajo; es
que el dato no esta aqui.

**Simultaneidad no es sintoma.** Guardrails 9 y 10. Que cinco senales caigan el
mismo martes no las relaciona. Por eso los factores de coherencia son columnas
separadas — `same_time_window` no es `known_relationship` — y afirmar relacion
obliga a decir de que clase es: temporal, matematica, de funnel, funcional,
economica u operacional. Un sintoma de confianza alta exige ademas calidad de
senal suficiente y scope compatible.

**El catalogo de relaciones no admite causalidad.** `may_precede`, `may_follow`,
`often_cooccurs`, `related`. No hay `causes` ni `caused_by`, y anadirlo exigiria
tocar el check de la tabla, el array del contrato y un test. Esa friccion es el
guardrail 18 hecho codigo. El grafo causal es `D07`.

**Lo local no se generaliza ni se esconde** (guardrails 23 a 26). Un sintoma con
scope distinto de `business` esta obligado por check a decir donde. Y hay una
regla de contrato para el otro lado: si todas las senales que lo sostienen vienen
de un unico scope concreto, declararlo global es una generalizacion indebida.

**La memoria orienta, no confirma** (guardrail 36). Un sintoma puede apuntar al
episodio anterior parecido y guardar el contexto de entonces, pero el snapshot es
inmutable por trigger — mismo guardrail que en `D02` y por el mismo motivo:
reescribirlo con el contexto de hoy hace que dos episodios parezcan comparables
cuando no lo son. Y apoyarse solo en que "ya paso antes", sin evidencia ni
senales propias, es violacion de contrato.

**Un positivo comercial no cancela un negativo economico** (guardrail 32). Si un
sintoma agrupa hijos y uno de ellos es un sintoma economico negativo, el padre no
puede presentarse como positivo ni neutro.

**Salud y sintoma coexisten, y eso se permite a proposito.** Guardrails 40, 41 y
42: una capacidad HEALTHY puede presentar un sintoma adelantado de riesgo, y un
gap de madurez de `D03` no es un sintoma. **No hay ninguna restriccion** que ate
`symptoms` a `capability_health` ni a `capability_maturity`, y hay un test que
comprueba que la combinacion se permite — para que nadie la "arregle" dentro de
seis meses.

### Lo que quedo fuera, a proposito

- ~~**No hay motor.**~~ **Cerrado el 2026-09-28** — ver la entrada de `D06` mas
  abajo. Entonces `signals` estaba vacia; al llegar `D05` dejo de estarlo.
- **No hay libreria de tipos canonicos** (paso 6 del runtime). `canonical_type`
  es texto libre. Crear una tabla catalogo vacia que nada puede referenciar es
  andamio para luego; la libreria se creara cuando haya sintomas reales que
  clasificar. **Riesgo anotado: deriva de vocabulario** — nada impide hoy que
  dos consultores escriban `cvr_drop` y `conversion_drop` para lo mismo.
- **No hay `granularity` como columna propia** (apartado 1). La fuente no define
  sus valores, y el repo no usa enums sin catalogo. `scope` + `scope_detail`
  cargan con ello.
- **Pasos 16 y 18** (composicion, evidencia cualitativa) tienen esquema e
  invariantes, pero nada los ejecuta. El 15 (descomposicion) lo cerro el motor:
  la jerarquia padre-hijo sale de `metric_dependencies`.
- **Sin `D07`, las relaciones candidatas no van a ninguna parte.** Se guardan
  para que `D07` las lea. Hoy es un grafo que nadie recorre.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con 10 intentos de violacion y 2
  casos positivos: **12/12**. Inmutabilidad del snapshot aparte: **2/2** (se
  rechaza reescribir el contexto, se permite actualizar lo demas). Rollback
  limpio, 0 filas residuales.
- **Mutacion deliberada**: anadir `direction` al sintoma hace fallar el test
  §21/§22 y solo ese. La garantia muerde.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 4 tablas / 4 con RLS / 4 politicas /
  29 checks / 3 triggers / puente con `D00` / migracion anotada.
- 22 tests nuevos (**156 en el paquete**), typecheck limpio, esquema generado al
  dia (188 migraciones).

### Un tropiezo del camino

`confidence` y `data_confidence` salieron con `varchar(16)`, y
`insufficient_data` tiene 17 caracteres: la migracion se aplico y reventaba al
primer insert de verificacion. Los bloques anteriores usan `varchar(20)`. Como
la tabla estaba recien creada, vacia y solo en test, se corrigio el fichero y se
rehizo limpio (drop + borrar la anotacion + `db:push`) en vez de anadir una
migracion de parche: el historial queda con una sola migracion correcta.

### Riesgo abierto

**Las reglas de contrato estan escritas, probadas y dormidas.** Como `signals`
esta vacia, ninguna de las ocho reglas de `checkSymptomInvariants` se ha
ejecutado nunca sobre datos reales — solo sobre los casos a mano de los tests.
Vale lo mismo que en `D03` y `D05`: **no confundir "no salta" con "esta bien"**.

---

---

## `D07` — Grafo causal del ecommerce · **contrato** 2026-09-18

**Fuentes:** `02-contratos-IA/d07-requisitos-contrato-grafo-causal.md` (34 apartados),
`04-policies-guardrails/d07-guardrails-causalidad.md` (50 guardrails),
`03-runtime/d07-flujo-razonamiento-causal.md` (20 pasos),
`05-experience-learning/d07-aprendizaje-causal-tenant.md`.

**El primero que puede hablar de causas — y sigue sin poder decidirlas.** `D06`
dejo las relaciones candidatas escritas y sin recorrer; aqui se recorren. Pero
`D07` no decide la causa raiz (guardrail 46), no prescribe (47) y no prioriza
(48): produce rutas plausibles con su soporte, sus contradicciones y lo que
falta por comprobar.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260918090000_f3_d07_grafo_causal.sql` |
| Contrato e invariantes | `packages/contracts/src/causal.ts` |
| Tests | `packages/contracts/src/causal.test.ts` (23) |

5 tablas: `causal_nodes`, `causal_edges`, `causal_paths`, `causal_path_steps`,
`causal_case_evidence`. 39 check constraints, RLS en las 5. Mas
`diagnostic_hypotheses.source_path_id` como puente con `D00`.

### Decisiones

**Sin mecanismo no hay arista causal.** Es el guardrail 7 y el check central del
bloque: `mechanism` es obligatorio — y con longitud minima, porque el guardrail 9
dice que un eslogan de experto no es un mecanismo. Una correlacion tambien cabe
en el grafo, pero como `unvalidated_relation` (apartado 22) y con el techo
puesto: no puede declarar evidencia por encima de `speculative` ni fuerza por
encima de `weak`. Guardar una correlacion como si fuera una causa cuesta una
migracion.

**El prior global y la confianza del caso son dos tablas distintas.** Guardrail 3
y apartado 11. `causal_edges.strength` dice lo fuerte que es la relacion **en
general**; `causal_path_steps.case_support` dice que pasa **en este caso**.
Mezclarlas es como se acaba afirmando que una tienda tiene un problema porque el
libro dice que suele pasar.

**Linaje no es causalidad** (guardrail 4). Que `revenue = sesiones x CVR x AOV`
es aritmetica: descompone, no explica. `relation_type` distingue `mathematical`
del resto, y hay una regla de contrato que impide que una ruta hecha solo de
aristas matematicas se presente como explicacion.

**La causa precede al efecto, y cuando no, se dice.** Guardrails 19 y 20: si el
efecto empezo antes que la causa candidata, el check obliga a marcar ese paso
como `contradicted`. No prohibe registrarlo — prohibe registrarlo como si
encajara. Y el guardrail 22 pide lo contrario del celo: `expected_lag_days` vive
en la arista para no exigir efecto inmediato cuando el mecanismo tiene retardo.

**No se guarda centralidad, a proposito.** El guardrail 5 dice que la centralidad
en el grafo no es prioridad de negocio. La forma mas segura de que nadie ordene
por `betweenness` es no tener `betweenness`, y hay un test que lo vigila.

**No se fuerza una causa unica** (guardrails 28 a 31). `cause_role` admite
`contributory`, varias rutas pueden estar soportadas a la vez, y las aristas que
solo actuan juntas comparten `interaction_group` en lugar de fingir que cada una
basta por su cuenta — con una regla que detecta usar media interaccion.

**Medir no es que pase** (guardrails 37 a 39). `causal_nodes.measurement_layer`
separa la variable real del sistema de medida y de la metrica observada. Un fallo
de tracking cambia las compras observadas sin cambiar las compras, y una ruta que
pasa por una metrica observada sin validar la medicion no puede darse por
soportada.

**Los confusores se reutilizan, no se duplican.** `causal_path_steps.confounder_id`
apunta a `context_confounders` de `D02`. Misma decision que en `D05` con
`health_references`: una segunda tabla de confusores seria garantizar que dentro
de seis meses digan cosas distintas sobre el mismo Black Friday.

### Lo que quedo fuera, a proposito

- **El grafo esta vacio.** `causal_nodes` y `causal_edges` no traen ni un nodo ni
  una arista. El contenido es conocimiento de ecommerce, no codigo: cada arista
  necesita mecanismo, condiciones, retardo esperado y utilidad diagnostica
  escritos por alguien que sepa. Sembrarlo con lo primero que se me ocurra seria
  justo lo que el guardrail 9 prohibe.
- **No hay recorrido.** Los 20 pasos del runtime describen una busqueda causal
  (recuperar padres, podar ramas, expandir upstream). Aqui hay esquema, contrato
  e invariantes; el motor que recorre el grafo necesita nodos, aristas y senales
  reales — y no hay ninguna de las tres.
- **Sin metricas de centralidad** (apartado 28), por la razon de arriba.
- **Sin `loop_metadata`** (apartado 32): bucles reforzadores y equilibradores son
  conceptualmente representables, pero nada los lee y el artefacto los deja en
  "conceptualmente".
- **El aprendizaje causal por tenant** (`05-experience-learning`) tiene su sitio
  — `knowledge_source = 'tenant_learned'` con `organization_id` obligatorio por
  check, que es el guardrail 44 — pero nada aprende todavia.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con 13 intentos de violacion y 2
  casos positivos: **15/15**. Rollback limpio.
- **Mutacion deliberada**: anadir `priority` a la ruta hace fallar el test de la
  frontera §46/§47/§48 y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 5 tablas / 5 con RLS / 5 politicas /
  39 checks / puente con `D00` / migracion anotada.
- 23 tests nuevos (**179 en el paquete**), typecheck limpio, esquema generado al
  dia (189 migraciones).

### Riesgo abierto

**Es el bloque mas grande de la fase y el que menos se ha ejercitado.** Las diez
reglas de `checkCausalInvariants` estan escritas y probadas contra casos a mano;
ninguna ha visto un grafo real, porque no hay grafo. Y a diferencia de `D05` o
`D06`, aqui el vacio no se llena solo cuando lleguen datos: **alguien tiene que
escribir las aristas**, una a una, con su mecanismo. Ese es el trabajo pendiente
de verdad de `D07`, y no es codigo.

---

---

## `D08` — Generador y contraste de hipotesis · **contrato** 2026-09-19

**Fuentes:** `02-contratos-IA/d08-requisitos-contrato-hipotesis.md` (26 apartados),
`04-policies-guardrails/d08-guardrails-hipotesis.md` (60 guardrails),
`05-experience-learning/d08-historial-y-calibracion-de-hipotesis.md`,
`06-tenant-context/d08-contexto-motor-hipotesis.md`.
**Sin capa de runtime**, como `D04`.

`D07` deja ramas que sobreviven. `D08` las convierte en hipotesis explicitas y
las somete a prueba. Sigue sin decidir la causa raiz (guardrail 45: eso es
`D09`) ni producir accion ni prioridad (25).

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260919090000_f3_d08_motor_de_hipotesis.sql` |
| Contrato e invariantes | `packages/contracts/src/hypotheses.ts` |
| Tests | `packages/contracts/src/hypotheses.test.ts` (26) |
| Alineacion de `D00` | `packages/contracts/src/diagnostics.ts` y su test |

**Solo 2 tablas nuevas**: `hypothesis_tests` y `hypothesis_status_history`. El
resto es ampliacion de lo que ya existia: `diagnostic_hypotheses` pasa de 9 a 44
columnas y de 3 a 21 checks; `diagnostic_evidence` suma 9 columnas y llega a 8
checks.

### Decisiones

**No se crea una segunda tabla de hipotesis.** `diagnostic_hypotheses` existe
desde `D00` y es la misma entidad, solo que alli estaba en su version minima.
Crear `hypotheses` al lado seria garantizar que dentro de seis meses digan cosas
distintas sobre la misma H1 — el mismo argumento por el que `D05` reutiliza
`health_references` y `D07` reutiliza `context_confounders`.

**Eso obligo a cambiar el vocabulario de estados de `D00`.** Los seis valores de
entonces (`possible`, `strongly_supported`, `rejected`...) se sustituyen por los
diez del apartado 3 de `D08`. **Se pudo hacer gratis porque las tablas estaban
vacias en los dos entornos**; dentro de seis meses habria costado una migracion
de datos y una discusion. `HYPOTHESIS_STATUSES` en `diagnostics.ts` se actualizo
en el mismo movimiento, para que contrato y base no puedan discrepar, y los tests
de `D00` se migraron con el. Queda anotado aqui porque la entrada de `D00` de
esta misma bitacora describe el vocabulario viejo.

**"No observado" no es "observado ausente", y aqui es una columna.** El guardrail
5 es de los que se pierden en un prompt y no en un esquema:
`diagnostic_evidence.observation_kind` distingue `observed_present`,
`observed_absent` y `not_observed`, y un check impide que lo no observado
contradiga nada. No haber mirado deja de poder colarse como evidencia de que no
pasa.

**Sin ruta causal en `D07` no hay hipotesis causal** (guardrail 19). Una
hipotesis de tipo causa directa, contributoria o candidata a raiz esta obligada
por check a apuntar a una fila de `causal_paths`. Inventar una causa sin camino
por el que llegue es justo lo que el bloque existe para impedir.

**Confirmar cuesta.** El guardrail 32 pide que `CONFIRMED` sea raro, y el check
lo cobra: exige confianza alta, condicion de falsacion escrita y separacion alta
respecto de las alternativas. El guardrail 35 dice que `inconclusive` es mejor
que el teatro de la certeza, asi que `inconclusive` es un estado de primera clase
y no una forma de fracaso.

**Candidata a raiz no es raiz** (guardrail 4). Existe `root_cause_candidate`
booleano; **no existe `root_cause` en ninguna tabla de la fase**. Y una candidata
esta obligada a decir que la falsaria. Hay un test que vigila la ausencia.

**Un test diagnostico no es una accion de negocio** (principio 8, guardrail 50).
`hypothesis_tests` no tiene ninguna columna que se parezca a una accion, y el
check `no_preguntar_lo_que_ya_hay` implementa los guardrails 46 y 47: si el dato
esta disponible en el sistema, el test tiene que ser pasivo. No se le pregunta al
cliente algo que ya tenemos guardado.

**Que lo proponga un agente especializado no es evidencia** (guardrails 51 y 52).
`proposing_agent` y `validating_agent` son columnas distintas, y hay una regla de
contrato que salta cuando una hipotesis gana confianza sin una sola evidencia y
lo unico que la sostiene es quien la propuso.

### Lo que quedo fuera, a proposito

- **No hay motor.** Como en `D06` y `D07`: contrato, esquema e invariantes. Nada
  genera hipotesis, porque generar una exige rutas causales, y no hay grafo.
- **No hay formula de confianza** (apartado 26: la fuente no la define). La
  confianza es una categoria que alguien declara y los checks acotan.
- **Sin cap de candidatas** (guardrail 11: "no generar decenas de candidates
  irrelevantes"). El artefacto no define el numero y no me lo invento; lo que si
  esta es la regla de doble conteo, que es el caso concreto que hace crecer la
  lista sin aportar.
- **Versionado de hipotesis** (apartado 23: narrow, split, merge) queda abierto,
  como en la fuente. `hypothesis_status_history` guarda transiciones, no
  bifurcaciones.
- **La calibracion por agente** (guardrail 53) tiene donde apoyarse — `actor` en
  el historial y `proposing_agent` en la hipotesis — pero nadie calcula nada
  todavia.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **14 intentos de violacion y
  3 casos positivos: 17/17**. Rollback limpio.
- **Mutacion deliberada**: anadir `root_cause` a la hipotesis hace fallar el test
  de la frontera §4/§25/§45 y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 2 tablas nuevas con RLS y politica, 21
  checks en `diagnostic_hypotheses`, 8 en `diagnostic_evidence`, 10 en
  `hypothesis_tests`, vocabulario de estados nuevo confirmado, migracion anotada.
- 26 tests nuevos (**205 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (190 migraciones).

### Riesgo abierto

**El vocabulario de `D00` cambio debajo de una entrada de bitacora ya escrita.**
La de `D00` sigue describiendo `possible`/`rejected`/`strongly_supported`. No la
he reescrito porque documenta lo que se decidio entonces y por que; esta entrada
es la que dice que se amplio. Si alguien lee solo la de `D00`, se llevara el
vocabulario viejo — **conviene leerlas en orden, que es justo para lo que sirve
una bitacora**.

---

---

## `D09` — Root cause & constraint engine · **contrato** 2026-09-20

**Fuentes:** `02-contratos-IA/d09-requisitos-contrato-root-cause-constraint.md` (26 apartados),
`04-policies-guardrails/d09-guardrails-root-cause-constraint.md` (48 guardrails),
`03-runtime/d09-flujo-root-cause-constraint.md`,
`06-tenant-context/d09-contexto-root-cause-constraint.md`,
`05-experience-learning/d09-memoria-root-causes-y-constraints.md`.

**El unico bloque de la fase autorizado a cerrar una causa.** `D08` dejo
candidatas con su condicion de falsacion; aqui se deciden. Y aun asi `D09` no
prioriza: severidad, prioridad, playbook y ranking de impacto son F4 (guardrails
25 y 37).

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260920090000_f3_d09_root_cause_y_constraints.sql` |
| Contrato e invariantes | `packages/contracts/src/root-cause.ts` |
| Tests | `packages/contracts/src/root-cause.test.ts` (25) |

4 tablas: `root_causes`, `root_cause_chain`, `business_constraints`,
`constraint_tests`. 35 check constraints, RLS en las 4. Mas
`diagnostic_cases.no_business_constraint` con su razonamiento obligatorio.

### Decisiones

**Causa raiz y constraint son dos tablas sin ninguna clave ajena que las ate.**
El guardrail 4 las separa y el apartado 23 exige que las cuatro combinaciones
existan: causa conocida con constraint desconocido, constraint conocido con causa
desconocida, causa resuelta con constraint activo y constraint resuelto con
driver estructural activo. Hay un test que comprueba que las cuatro caben, para
que nadie las una mas adelante "para simplificar". Atarlas convertiria "por que
paso" y "que nos limita" en la misma pregunta, que es el error que el bloque
existe para evitar.

**Un constraint siempre lo es respecto de algo.** `target` es `not null`
(guardrail 30), y declararlo vinculante cuesta tres checks: tiene que limitar el
target (guardrails 5 y 28), haber pasado el contrafactual — `falsifier` y
`counterfactual_result` obligatorios (31) — y declarar capacidad **y** demanda
(29). Una tienda puede tener el email mal montado y que eso no limite nada si el
cuello esta en el stock.

**"No hay constraint relevante" es una conclusion, no un hueco.** Apartado 22 y
guardrail 32: se declara en el caso y exige razonarlo por check. Y una regla de
contrato salta si se declara sin haber evaluado ni un candidato — porque eso no
es una conclusion, es no haber mirado.

**Confirmar cuesta y `unresolved` es una salida valida.** Guardrail 12 y 13.
Confirmar exige confianza alta, contraste en `D08` y limitaciones escritas. No
forzar el cierre (14) es lo que separa un diagnostico de un informe que habia que
entregar.

**Medir mal no es ir mal.** Guardrails 41 y 42: una regresion de tracking puede
ser la causa raiz de un problema de observabilidad sin serlo de un deterioro del
negocio. `affects_observability_only` lo marca y el check impide que algo asi
reclame cobertura explicativa del negocio.

**No se culpa a personas, y la garantia es que no hay sitio.** Guardrails 38 a
40. Misma jugada que en `D06` con `direction`: **no existe ninguna columna donde
quepa una persona** — ni `responsible`, ni `owner`, ni `assignee`. Se describen
procesos, capacidades y configuraciones porque no hay otro sitio donde
escribirlo. Verificado en produccion: 0 columnas de ese tipo. Ademas hay una
regla de contrato que detecta el lenguaje de culpa en el enunciado.

**El lenguaje se calibra a la confianza** (guardrails 46 y 47). Una regla detecta
formas como "sin duda" o "causado por" en una causa que no tiene confianza alta.
Es la primera vez en la fase que un invariante mira **como esta escrito** algo, y
no solo que campos tiene.

**La cadena obliga a decir en que eslabon se esta.** Los cuatro primeros
guardrails (sintoma != causa inmediata != causa raiz != driver estructural) viven
en `root_cause_chain.chain_role`. Con dos reglas que muerden por los dos lados:
pararse en la causa inmediata es pararse pronto (guardrail 9), y subir a un
driver estructural que nada sostiene es inventar (10).

### Lo que quedo fuera, a proposito

- **No hay motor**, como en `D06`, `D07` y `D08`. Cerrar una causa exige
  hipotesis contrastadas, y no hay ninguna.
- **No se duplica la evidencia.** Una causa raiz apunta a la hipotesis de `D08`
  que la sostiene, y esa ya tiene su ledger. `root_causes` no tiene tabla de
  evidencia propia.
- **Sin formula de confianza ni de scoring de constraints** (apartado 26: la
  fuente no las define).
- **Constraints en serie y en paralelo** (apartado 18) se pueden declarar con
  `arrangement`, pero nada razona sobre la secuencia.
- **La memoria de causas y constraints** (`05-experience-learning`) tiene
  `recurrence` y fechas, pero nadie compara episodios todavia.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **11 intentos de violacion y
  5 casos positivos: 16/16**. Entre los positivos, los dos que importan: un
  vinculante bien probado y una causa resuelta conviviendo con un constraint
  activo (apartado 23).
- **Mutacion deliberada**: anadir `priority` al constraint hace fallar el test de
  la frontera §7/§25/§35/§37 y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 4 tablas / 4 con RLS / 4 politicas /
  35 checks / `no_business_constraint` presente / **0 columnas de persona o
  prioridad** / migracion anotada.
- 25 tests nuevos (**230 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (191 migraciones).

### Riesgo abierto

**Las reglas de lenguaje son las mas fragiles del bloque.** `DEFINITIVE_LANGUAGE`
y `BLAME_LANGUAGE` son expresiones regulares en castellano, y una regex no
entiende una frase: se le escapa "fue el equipo de compras quien no lo vio" y
saltaria con "no hay duda de que NO es la causa". Estan porque el guardrail 39 y
el 47 piden algo, y algo imperfecto que salta es mejor que nada — pero **no son
una garantia estructural como las demas de esta fase**, y conviene tratarlas como
un aviso, no como un filtro.

---

---

## `D10` — Severidad e impacto · **contrato** 2026-09-21

**Fuentes:** `02-contratos-IA/d10-requisitos-contrato-severidad-impacto.md` (29 apartados),
`04-policies-guardrails/d10-guardrails-severidad-impacto.md` (56 guardrails),
`03-runtime/d10-flujo-evaluacion-severidad-impacto.md`,
`06-tenant-context/d10-contexto-severidad-impacto.md`,
`05-experience-learning/d10-memoria-severidad-impacto.md`.

**El primer bloque de la fase que puede ordenar algo, y justo por eso el que
hereda todas las fronteras que `D05` a `D09` han ido guardando.** Mide cuanto
dano hay: cuanto, donde, durante cuanto, como se propaga, cuanto se recupera y
con que confianza. **No decide que se ataca primero** (guardrails 3, 46, 47 y
48): un HIGH puede ir antes que un CRITICAL segun esfuerzo, valor estrategico y
momento, y eso es F4.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260921090000_f3_d10_severidad_e_impacto.sql` |
| Contrato e invariantes | `packages/contracts/src/severity.ts` |
| Tests | `packages/contracts/src/severity.test.ts` (33) |

5 tablas: `severity_assessments`, `impact_measurements`, `impact_exposures`,
`impact_propagation`, `absorption_buffers`. 69 check constraints, RLS en las 5.

### Decisiones

**Tres ausencias garantizadas, cada una con su test.** Donde `D09` no tenia
sitio para una persona, `D10` no tiene sitio para una decision:

1. **No hay `priority`, `recommended_action`, `playbook`, `effort` ni
   `intervention_order`** en ninguna de las cinco tablas (guardrails 3, 46, 47
   y 48).
2. **No hay ninguna columna de probabilidad numerica.** El guardrail 29 prohibe
   inventar un "13,7 %" sin modelo calibrado, y la garantia es que el numero no
   cabe: `likelihood` solo admite `low`/`medium`/`high`/`unknown`.
3. **No hay donde escribir el porcentaje de cambio de una metrica.** Los
   guardrails 9 y 10 dicen que la magnitud no define la gravedad. Si cupiera
   aqui, alguien acabaria derivando la severidad de ella; la magnitud vive en
   `D05` y en `D10` hay que declarar exposicion, impacto y colchon.

**Cinco severidades, no una, y sin formula entre ellas.** Aguda, acumulada,
prospectiva, estructural y global son columnas distintas (apartado 3): un
problema cronico moderado puede acumular mas dano que un incidente breve
critico (guardrail 42). **La global no se deriva de las otras cuatro** -- la
fuente dice explicitamente que no define ninguna formula (apartado 29) y el
apartado 95 permite que una sola dimension domine: revenue LOW con cash
BUSINESS_THREAT da BUSINESS_THREAT. Inventar la formula seria decidir por quien
evalua. Lo unico que hay es un aviso de contrato si la global queda dos
escalones por debajo de la peor parte declarada.

**Tres confianzas separadas** (apartado 27, guardrail 4): en la causa, en el
impacto y en la severidad. No existe una columna `confidence` a secas, porque
colapsaria los tres juicios. Y el guardrail 13 exige que se pueda estar muy
seguro de que el dano es grave y nada seguro de por que pasa: **hay un test que
comprueba que esa combinacion se permite**, con la unica condicion (guardrail
54) de escribir las limitaciones.

**Lo observado, lo estimado, lo inferido y lo pronosticado no se mezclan**
(guardrails 19 a 22). `evidence_type` y `timing` estan atados por check: lo
`observed` solo puede ser `realized` u `ongoing`, y lo `potential` o
`projected` nunca puede presentarse como observado. Un pronostico no se
disfraza de medicion. Ademas, "exacto" solo se dice sobre algo observado, con
metodo escrito y el periodo cerrado (guardrails 23, 27 y 53) -- que es la
respuesta estructural al "no digas *exact loss* cuando es una estimacion", sin
tener que mirar como esta redactado.

**Una cuota sin denominador no dice nada** (apartado 13, guardrails 15 a 18).
`impact_exposures` obliga a decir sobre que base, admite varios denominadores a
la vez y obliga a marcar y razonar cual se uso para juzgar. El mismo incidente
es un 3 % del revenue y un 30 % de la contribution, y elegir mal el denominador
es la forma mas comun de exagerar o de quitar importancia. **No hay ningun
umbral**: el guardrail 17 dice que un scope pequeno puede ser material.

**Reversibilidad != recuperabilidad** (guardrail 7). Dos columnas con dos
vocabularios que **no comparten ni un valor**, a proposito: no se pueden
confundir copiando uno en el otro, y hay un test que comprueba la interseccion
vacia. Que el fallo se arregle en diez minutos no devuelve los pedidos que no
se hicieron.

**Contar la cascada aparte es contar el mismo euro dos veces** (guardrails 33 y
34). En `impact_propagation` solo lo `direct` puede marcarse como perdida
independiente. Y lo sistemico exige una ruta causal de `D07` (36), no la
sensacion de que "esto lo toca todo".

**El colchon es un hecho del tenant, no del caso.** `absorption_buffers` cuelga
de la organizacion. Es lo que hace que la misma causa no tenga la misma
gravedad en dos tiendas (guardrail 38): el mismo retraso de proveedor es un
susto con seis semanas de stock y un paro con tres dias.

**Lo local no se globaliza, con una excepcion.** Un CRITICAL de un canal no es
un CRITICAL del negocio sin exposicion material declarada (guardrail 14 y
apartado 219) -- salvo que amenace la continuidad (apartado 220) o sea un fallo
del camino critico (guardrail 12). Las tres salidas estan en el mismo check.

**Medir mal no es perder dinero** (guardrails 49 a 51). Un fallo de tracking
puede tener impacto CRITICAL en la dimension `data` con el impacto sobre
revenue en UNKNOWN, y **eso es una salida valida, no un hueco**: hay un test que
comprueba que esa fila no dispara ninguna regla. Lo que si salta es dar una
perdida economica por observada cuando la medicion esta comprometida.

### Lo que quedo fuera, a proposito

- **No hay motor**, como en `D06` a `D09`. Evaluar severidad exige un
  diagnostico causal cerrado, y no hay ninguno.
  > **Corregido el 2026-10-03.** Era demasiado estricto. El guardrail 13 exige
  > que se pueda estar seguro del dano y no de la causa, asi que **medir el
  > impacto no necesita causa**; lo que no se puede sin ella --ni con ella-- es
  > puntuar la gravedad, porque la fuente no da formula. El motor existe desde
  > entonces y hace solo la rama de cuantificacion.
- **Sin formula de severidad, sin ponderacion de impacto, sin modelo monetario
  universal y sin modelo de probabilidad de riesgo** (apartado 29: la fuente no
  los define).
- **Sin politica de alertas** (guardrail 56). `escalation_signal` es una lectura
  del estado -- insumo de escalado (55) -- no una orden de avisar a nadie.
- **El feedback a `D4`** (seccion 6 del runtime) no existe: severidad e impacto
  pueden actualizar la representacion de salud, pero nadie lo hace todavia.
- **La memoria** (`05-experience-learning`) tiene el historico por construccion
  -- una evaluacion vigente por caso y las anteriores como `superseded` -- pero
  nadie compara episodios, ni calibra estimado contra realizado.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **23 intentos de violacion
  y 2 casos positivos, 25/25**. Entre los positivos, los dos que importan: lo
  local elevado a global por amenaza de liquidez (apartado 220) y el relevo de
  la evaluacion vigente por una nueva.
- **Mutacion deliberada**: anadir `priority` a `severityAssessmentFields` hace
  fallar el test de la frontera §3/§46/§47/§48 y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 5 tablas / 5 con RLS / 5 politicas /
  69 checks / **0 columnas de prioridad, accion, probabilidad o porcentaje de
  cambio** / migracion anotada.
- 33 tests nuevos (**263 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (192 migraciones).

### Riesgo abierto

**La regla de lenguaje vuelve a apoyarse en la regex de `D09`.** `D10` reusa
`DEFINITIVE_LANGUAGE` para detectar un resumen categorico sobre un impacto que
nadie ha observado (guardrails 52 y 53). Reusarla evita que dos definiciones de
"lenguaje categorico" acaben diciendo cosas distintas, pero **arrastra la misma
limitacion**: es un aviso, no una garantia estructural. La parte de esos dos
guardrails que si esta garantizada es la otra -- "exacto" no se puede escribir
sobre algo no observado porque el check no lo deja.

---

---

## `D11` — Confianza e incertidumbre · **contrato** 2026-09-22

**Fuentes:** `02-contratos-IA/d11-requisitos-contrato-confianza-incertidumbre.md` (29 apartados),
`04-policies-guardrails/d11-guardrails-confianza-incertidumbre.md` (60 guardrails),
`03-runtime/d11-flujo-evaluacion-confianza-incertidumbre.md`,
`06-tenant-context/d11-contexto-confianza-incertidumbre.md`,
`05-experience-learning/d11-calibracion-historica-confianza.md`.

**El bloque que audita a los diez anteriores.** `D01` a `D10` llevan diez
migraciones declarando `confidence` campo a campo; `D11` es el primero que
pregunta si esa confianza esta bien puesta, de donde sale y que la limita.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260922090000_f3_d11_confianza_e_incertidumbre.sql` |
| Contrato e invariantes | `packages/contracts/src/confidence.ts` |
| Tests | `packages/contracts/src/confidence.test.ts` (37) |

6 tablas: `claim_confidence`, `confidence_dimensions`, `confidence_caps`,
`diagnostic_uncertainties`, `confidence_history`, `knowledge_applicability`.
52 check constraints, un trigger, RLS en las 6.

### Decisiones

**No hay ningun numero, y esta vez la garantia se puede consultar.** El
guardrail 36 prohibe convertir la incertidumbre en un porcentaje opaco y el
apartado 149 del corpus prohibe literalmente "Confianza: 75%". En las seis
tablas existe **una sola columna numerica**: `retrieval_similarity`, y vive en
`knowledge_applicability`, la unica entidad que no decide nada sobre el negocio.
Verificado en produccion con una consulta que lista todas las columnas numericas
de las seis tablas: devuelve esa y nada mas. Y hay un test que recorre los
esquemas de Zod desenvolviendo `optional`/`default` y falla si aparece cualquier
otro `ZodNumber`.

**No hay confianza sin claim** (apartados 17 y 94). `claim` y `target_question`
son obligatorios y con longitud minima. Una etiqueta de confianza que no dice de
que afirmacion habla no se puede auditar, y es exactamente la "confianza global"
que el bloque existe para impedir. La misma evidencia sostiene una pregunta con
confianza alta y otra con confianza baja (apartado 91).

**Un cap que no baja el nivel no es un cap** (apartado 5, guardrails 16 a 20).
`confidence_caps` guarda de donde viene cada techo y por que; un trigger
mantiene `capped_at` en el claim como el mas restrictivo de sus caps **y baja el
nivel si lo supera**; y un check impide que el nivel quede por encima. Es la
unica pieza del bloque que escribe por su cuenta, y lo hace porque sin eso un
cap seria un comentario al margen. La verificacion lo prueba: se inserta un
claim en `high`, se le pone un cap en `medium`, y el claim queda en `medium`.

**Confianza != completitud** (guardrail 4, apartados 85, 255 y 256). Dos
columnas con dos vocabularios que no comparten ningun valor, y ninguna se
deriva de la otra: se puede estar muy seguro de una explicacion parcial, y se
puede explicar del todo algo medido con datos malos.

**No haber visto un problema no es haber visto que no lo hay** (guardrail 8,
apartado 233). `negative_claim_state` tiene tres valores y no dos. Afirmar que
no hay problema exige declarar con que cobertura se miro (29); afirmar
estabilidad exige ademas medicion completa y observada (31); y si faltan datos,
lo unico que cabe es `no_evidence` (30).

**Similarity no es verdad de negocio** (guardrails 5, 6, 39 a 42). La confianza
de recuperacion vive en **otra tabla** que la confianza del diagnostico, para
que no se puedan leer como el mismo numero. Y la aplicabilidad alta exige
haberlo validado contra el caso: ni el 0.97 del vector ni que la fuente sea
canonica valen. Hay un test que guarda que un 0.97 con aplicabilidad `low` es
una fila perfectamente valida.

**La separacion frente a las alternativas y el nivel de contradiccion son
puerta, no descriptor.** Viven en la fila del claim y no en
`confidence_dimensions`, con dos checks: con separacion debil no se llega a alta
(guardrail 25) y una contradiccion material no convive con alta (12). Lo que
importa no es cuantas alternativas quedan sino la fuerza de las que sobreviven
(apartado 78), asi que `not_applicable` tambien deja subir.

**Los `unknown unknowns` no se modelan, y es deliberado** (apartado 8, guardrail
38). Solo existe `is_known_unknown`. Fingir un catalogo de lo que no se sabe que
no se sabe seria justo la sobreconfianza que el bloque combate; lo que queda en
su lugar son los caps y la obligacion de declarar limitaciones.

**Decir "todavia no lo se" es una salida del sistema** (guardrails 22 y 60). El
estado `unknown` solo admite `insufficient_data`, por check: no saber con
confianza media no es no saber. Hay un test que comprueba que la salida existe
y que se permite.

### Lo que quedo fuera, a proposito

- **Sin formula de agregacion de confianza, sin modelo bayesiano, sin umbrales
  numericos y sin funcion de decay** (apartado 29). El guardrail 49 dice que el
  decay es especifico del dominio, no universal: hay `recency_domain`,
  `is_stale` y `decay_reason`, pero nada los calcula.
- **Sin prioridad y sin accion** (guardrails 57 y 58).
- **Sin motor**, como todos los bloques desde `D06`.
- **La calibracion historica** (`05-experience-learning`) tiene su tabla
  (`confidence_history`, con motivo obligatorio) pero nadie compara todavia la
  confianza predicha con lo que acabo pasando. Eso es F9, y esta tabla es lo que
  va a leer.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **26 intentos de violacion
  y 7 casos positivos: 33/33**. El positivo que mas importa comprueba que el
  trigger del cap baja de verdad el nivel, no solo que anota el techo.
- **Mutacion deliberada**: anadir `confidence_score: z.number()` hace fallar los
  dos tests que guardan esa ausencia -- el que recorre los esquemas buscando
  numeros y el que comprueba la lista de nombres prohibidos -- y solo esos.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 6 tablas / 6 con RLS / 6 politicas /
  52 checks / trigger del cap presente / **una sola columna numerica en las seis
  tablas** / 0 columnas de score, prioridad o accion / migracion anotada.
- 37 tests nuevos (**300 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (193 migraciones).

### Riesgo abierto

**La regla de lenguaje es, otra vez, la pieza mas debil.** `CERTAINTY_LANGUAGE`
anade "esta claro que", "es evidente" y "obviamente" a la `DEFINITIVE_LANGUAGE`
de `D09`, y se aplica al texto del claim cuando la confianza no es alta
(guardrails 43 a 47). Sigue siendo una expresion regular en castellano, con la
misma limitacion que en `D09` y `D10`: un aviso, no una garantia. Lo que si esta
garantizado de esos guardrails es lo otro -- el nivel no puede superar su techo,
una hipotesis no puede ir en alta y `unknown` no puede ir en media -- porque eso
son checks.

---

---

## `D12` — Confusores y falsos diagnosticos · **contrato** 2026-09-23

**Fuente:** `02-contratos-IA/D12-contrato-de-confusores-y-falsos-diagnosticos.md`
(22 apartados, 25 tipos de confusor, 18 tests nombrados con sus fixtures).

**Aviso sobre la fuente.** A diferencia de `D00` a `D11`, **`D12` tiene una sola
capa**: no hay corpus maestro, ni guardrails, ni runtime, ni tenant-context, ni
experience-learning. Solo el contrato. Donde `D11` tenia 60 guardrails que
citar, aqui se cita el apartado. Es menos material, y conviene saberlo al leer
lo que sigue: hay menos sitios desde los que contrastar una decision.

**La capa adversarial.** `D12` no busca la mejor explicacion -- eso es `D08` --
sino **la mejor razon por la que la interpretacion completa podria ser
enganosa**. El principio de cierre del apartado 22 lo dice sin rodeos: intentar
refutar la primera explicacion, no protegerla.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260923090000_f3_d12_confusores_y_falsos_diagnosticos.sql` |
| Contrato e invariantes | `packages/contracts/src/adversarial.ts` |
| Tests | `packages/contracts/src/adversarial.test.ts` (31) |

6 tablas: `diagnostic_robustness`, `diagnostic_confounders`, `confounder_tests`,
`metric_comparability_gates`, `mandatory_confounder_checks`,
`sensitivity_analyses`. 51 check constraints, RLS en las 6.

### Decisiones

**La garantia central: no se puede declarar que un diagnostico sobrevive sin
haber escrito antes por que podria estar mal.** `survival_status` en `survives`
o `survives_with_limitations` exige `red_team_counter_explanation`, por check.
Un diagnostico que nadie ha intentado tumbar no ha sobrevivido a nada, y sin
este check "sobrevive" seria el valor por defecto de la inercia.

**Y no hay donde forzar la supervivencia.** Ni `override`, ni `force_survive`,
ni `accepted_anyway`, ni `approved`. El apartado 21 prohibe "forzar que el
diagnostico sobreviva la revision adversarial" y la garantia es la de siempre:
que no cabe. Verificado en produccion a cero.

**Un confusor sin evidencia no sirve en ninguna direccion** (apartado 14). No
puede sostenerse -- pasar de `plausible` a `supported` o `material` exige
evidencia escrita, y **descartarlo tambien**, porque el apartado 5 define
`REJECTED` como "la evidencia muestra que no puede explicarlo" y sin esa
exigencia descartar seria gratis. Y no puede destruir: un confusor especulativo
no llega a `strong` ni a `decisive`, para que una hipotesis sin soporte no tumbe
un diagnostico fuerte.

**No se puede saltar un check obligatorio en silencio** (apartados 7 y 19). El
apartado 19 pide poder reconstruir que checks eran obligatorios, cuales se
ejecutaron y **cuales no pudieron ejecutarse y por que**; `skipped` y
`not_possible` exigen motivo, porque sin el esa reconstruccion no existe. Ademas
la tabla de checks minimos por familia del apartado 7 vive **como dato**
(`MANDATORY_CHECKS_BY_FAMILY`) y no como prosa, que es lo que permite a una
regla comprobar que no falta ninguno.

**Comparable significa las cinco cosas** (apartado 4): misma definicion, mismo
alcance, misma logica temporal, misma moneda y mismo filtro de estado. El check
no deja declarar `comparable` si alguna no es `yes`, y basta un `no` para que
deje de ser siquiera parcialmente comparable. Es la puerta determinista que el
apartado 17 pide que no dependa del LLM.

**Un riesgo CRITICAL bloquea el cierre** (apartado 2). Con la evidencia
sistematicamente distorsionada el diagnostico solo puede ir a revision o
invalidarse. Y revisar significa reabrir algo: `requires_revision` e
`invalidated` exigen `revision_triggered` y al menos un bloque reabierto
(apartado 11), no una nota.

**La revision que debilita baja la confianza, por check.** El apartado 21
prohibe "mantener intacta la confianza despues de un confusor decisivo", y en
`weakened` y `requires_revision` eso se comprueba comparando el antes con el
despues.

**Por que no se reuso `context_confounders` de `D02`.** Es la primera vez en la
fase que decido **no** reusar, y el motivo es el guardrail 24 de `D02`: alli los
confusores son candidatos de contexto y **no existe columna que los promueva**.
`D12` es justamente el mecanismo de promocion. Meterlo en la tabla de `D02`
habria roto su garantia. Viven aparte, y `source_confounder_id` conserva el
linaje para que una candidata que llega hasta aqui no se teclee dos veces. Hay
un test en `D12` que comprueba que `D02` **sigue** sin poder promover: si
alguien le anadiera `status` o `strength`, este bloque dejaria de tener sentido
como capa separada.

**Los fixtures del apartado 20 son reglas, no prosa.** Paradoja de Simpson (un
confusor de composicion soportado exige una comparacion within-segment
resuelta), periodo parcial, muestra insuficiente, intervenciones simultaneas,
confusor decisivo sin efecto, y el lado del falso negativo: **deterioro
enmascarado** -- un revenue plano con trafico +40 % y CVR -28 % no es un negocio
sano. El apartado 1 dice que `D12` protege contra los dos errores, y esa es la
mitad que suele olvidarse.

### Lo que quedo fuera, a proposito

- **No hay motor**, como todos los bloques desde `D06`. Los checks deterministas
  del apartado 17 (alineacion de periodos, descomposicion de mix, suficiencia
  muestral, madurez de cohortes) **no existen todavia**: la tabla guarda su
  resultado, pero nadie los calcula. Es el trabajo pendiente de verdad de `D12`.
- **El presupuesto de recursion** (apartado 11) tiene columna
  (`revision_budget_used`) pero no hay runtime que lo gaste ni que corte el
  bucle.
- **La realimentacion a `D11`** existe como dato (`confidence_before`,
  `confidence_after`, `confidence_adjustment`) pero nadie la propaga a
  `claim_confidence`.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **22 intentos de violacion
  y 6 casos positivos: 28/28**. Entre los positivos, los fixtures de mix de
  producto, tracking decisivo con reapertura, periodo parcial y enmascaramiento.
- **Mutacion deliberada**: anadir `force_survive` hace fallar el test de la
  frontera del apartado 21 y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 6 tablas / 6 con RLS / 6 politicas /
  51 checks / guardia del red team presente / linaje con `D02` presente /
  **0 columnas de forzado o prioridad** / migracion anotada.
- 31 tests nuevos (**331 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (194 migraciones).

### Correccion durante el bloque

Escribi "24 tipos de confusor" en la cabecera y monte el test sobre ese numero.
La fuente lista **25**. El catalogo del codigo coincidia exacto con la fuente
--comprobado por script, sin faltar ni sobrar-- asi que lo equivocado era mi
cuenta, no el catalogo. Corregido en el test, en la migracion y en el contrato.

### La regla de lenguaje: decidido que hacer

Las expresiones regulares de `D09`, `D10` y `D11` (`DEFINITIVE_LANGUAGE`,
`BLAME_LANGUAGE`, `CERTAINTY_LANGUAGE`) **estaban mal planteadas, no mal
escritas**. Una regex no entiende negacion ni cita: se le escapa "fue el equipo
quien no lo vio" y salta con "no hay duda de que NO es la causa". Y hay algo
peor de fondo: **una regex sobre prosa es un guardrail con forma de prompt** --
escribir texto libre y despues vigilarlo es justo lo que esta fase decidio no
hacer.

La inversion que lo arregla: **la frase no es texto libre, se deriva de los
campos**. Los guardrails 43 a 46 de `D11` no dicen "prohibido exagerar": dan la
formula de cada nivel -- INSUFFICIENT_DATA "no puede determinarse", LOW "es
compatible con", MEDIUM "la explicacion mas probable es", HIGH fuerte pero nunca
absoluta. La fuente ya trae el generador. Componiendo la salida desde el nivel y
el estado epistemico, el lenguaje descalibrado **no se detecta: no se puede
escribir**, igual que no se puede escribir una prioridad en `D10`.

Eso se construye en **`D14`** (salida diagnostica, trazabilidad y validacion),
que es el bloque que compone lo que sale. Mientras tanto las tres regex quedan
**degradadas explicitamente a lint sobre texto interno**, documentado en cada
una: dejan de figurar como la cobertura de esos guardrails. Lo que si esta
cubierto de forma estructural sigue estando y es lo que importa -- en `D09` no
hay columna donde quepa una persona; en `D10` "exacto" no se puede declarar
sobre algo no observado; en `D11` una hipotesis no puede ir en alta.

---

---

## `D13` — Diagnostico temporal y regresion · **contrato** 2026-09-24

**Fuente:** `02-contratos-IA/D13-contrato-de-diagnostico-temporal-y-regresion.md`
(35 apartados, 22 tests nombrados con sus fixtures). Igual que `D12`, **una sola
capa**: solo el contrato.

**La pelicula, no la foto.** `D05` a `D12` describen un momento; `D13` describe
la evolucion: cuando empezo, como se movio, si vuelve, si se recupera y si la
secuencia encaja con la cadena causal. Sin priorizar ni recomendar (apartado
34, ultima linea).

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260924090000_f3_d13_diagnostico_temporal_y_regresion.sql` |
| Contrato e invariantes | `packages/contracts/src/temporal.ts` |
| Tests | `packages/contracts/src/temporal.test.ts` (34) |

6 tablas: `capability_time_profiles`, `temporal_diagnoses`,
`temporal_lag_checks`, `diagnostic_episodes`, `temporal_events`,
`temporal_revisions`. 81 check constraints, RLS en las 6.

### Decisiones

**El invariante central es `STATE != TRAJECTORY`, y la garantia es la ausencia
de un check.** `current_state` y `trajectory` son dos columnas que nada obliga a
coincidir, porque **BAD + IMPROVING** y **HEALTHY + DETERIORATING** son las dos
combinaciones que mas importa poder escribir: la primera es una tienda que se
esta arreglando y la segunda es la que nadie ve venir. Hay dos tests, uno por
combinacion, que existen para que nadie "arregle" la aparente incoherencia mas
adelante. Es el mismo patron que `D09` con la causa y el constraint, pero aqui
el bloque entero gira alrededor de el.

Tres separaciones mas sin nada que las ate, y las tres con test:

- **Los tres horizontes** (apartado 19): corto, medio y largo pueden contar
  historias distintas, y el conflicto se conserva. Lo unico que salta es
  esconderlo: si corto y largo van en direcciones opuestas, el agregado tiene
  que decir `mixed`.
- **Las tres recuperaciones** (apartados 9 y 28): causa, sistema e impacto de
  negocio. **RESOLUTION != RECOVERY** -- la causa puede estar resuelta con el
  dano acumulado todavia vivo.
- **La trayectoria cruda y la ajustada por `D12`** (apartado 23): se guardan las
  dos, la ajustada dirige y la cruda hace auditable el ajuste.

**No se inventa una hora exacta con datos diarios** (apartado 4). El check no
deja que `onset_precision` sea mas fina que `source_granularity`. Es el tipo de
mentira que nadie detecta leyendo un informe -- un "empezo a las 14:20" cuando
la fuente solo sabe de dias suena a precision y es ruido.

**Una regresion exige un estado mejor anterior Y estable** (apartado 8). Si
nunca hubo algo mejor, lo que hay es una debilidad cronica, y el vocabulario
tiene **las dos palabras** (`regressed` y `chronic_weakness`) precisamente para
que nadie use la incorrecta por no tener la correcta. Declarar `regressed`
obliga a escribir el estado previo, el periodo estable en que existio y el tipo.

**Una caida de KPI no es una regresion de madurez** (apartados 8 y 18). Exige
perdida estructural persistente de capacidad, declarada y razonada por check. Un
mal mes no desmonta una capacidad.

**El baseline no se adapta a un sistema roto** (apartado 7 e invariante 34). Es
la trampa mas silenciosa del bloque: si un problema dura lo suficiente, la
estadistica lo aprende como normal y el problema desaparece del radar sin
haberse resuelto. Aqui promover un regimen exige **las cinco condiciones del
apartado 7 a la vez** -- duracion suficiente, comportamiento estable, cambio de
negocio entendido, calidad de datos alta y ningun incidente abierto -- y jubilar
un baseline exige ademas que la validacion este escrita. Y mientras haya un
incidente abierto, el baseline no puede quedarse en `active`.

**La causa precede al efecto, y el tiempo es el del evento** (apartado 10). El
check no deja una tercera opcion: o la causa va antes, o el encaje es
`incompatible` y se dice. Y cuando el tiempo de ingesta difiere del tiempo del
evento, manda el del evento -- porque los datos que llegan tarde no pueden
reordenar la causalidad en silencio.

**El mismo sintoma recurrente no implica la misma causa raiz** (apartado 12).
`same_root_cause_as_previous` es una afirmacion que exige evidencia escrita, no
algo que se deduzca de que el episodio se parezca.

**Los eventos temporales no se repiten, y la deduplicacion es un indice**
(apartado 25). "Sigue deteriorandose" en cada evaluacion no es informacion: la
restriccion unica sobre la transicion impide emitir dos veces la misma.

**No hay ventana universal** (apartado 5 e invariante 34).
`capability_time_profiles` existe para que cada capacidad traiga la suya, y para
que no haya una por defecto escondida en el codigo: un fallo de pagos se juzga
en minutos y la retencion en meses.

**Reuso, no duplicado.** `PERSISTENCE_STATES` ya existia en `D05` con los mismos
cuatro valores, asi que `D13` lo reexporta en vez de redefinirlo. Dos catalogos
de lo que significa "cronico" acabarian diciendo cosas distintas del mismo
problema.

### Lo que quedo fuera, a proposito

- **No hay motor**, como todos los bloques desde `D06`. Y aqui duele mas: el
  apartado 31 pide series temporales, change points, pendientes, alineacion de
  eventos y calculo de lags. **Nada de eso se calcula todavia** -- las tablas
  guardan el resultado de un analisis que nadie ejecuta. Es el trabajo pendiente
  de verdad de `D13`, y es codigo, no esquema.
- **La hysteresis y el `critical_override`** (apartado 15) no existen: no hay
  maquina de estados que evite el flapping, porque no hay maquina de estados.
- **Los KPIs operativos** (apartado 14: TTD, TTDiag, TTR, TTRec) tienen sus
  cuatro marcas de tiempo y su orden comprobado, pero nadie los calcula ni los
  agrega.
- **La realimentacion a `D10`** (apartado 24: impacto acumulado y peak) tiene
  columnas de peak pero no propaga nada.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **24 intentos de violacion
  y 7 casos positivos: 31/31**. Los dos positivos que definen el bloque son
  BAD + IMPROVING y HEALTHY + DETERIORATING; los otros cubren el conflicto de
  horizontes, RESOLUTION != RECOVERY, la regresion bien declarada frente a la
  debilidad cronica, el regimen nuevo con sus cinco condiciones y dos perfiles
  temporales opuestos (pagos en minutos, retencion en meses).
- **Mutacion deliberada**: anadir un `overall_status` que funda estado y
  trayectoria hace fallar el test del invariante central y solo ese.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 6 tablas / 6 con RLS / 6 politicas /
  81 checks / guardia de precision presente / deduplicacion de eventos presente
  / estado y trayectoria como dos columnas / las tres recuperaciones presentes /
  **0 columnas de prioridad, accion o estado fundido** / migracion anotada.
- 34 tests nuevos (**365 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (195 migraciones).

---

---

## `D14` — Salida diagnostica, trazabilidad y validacion · **contrato** 2026-09-25

**Fuente:** `02-contratos-IA/D14-contrato-de-salida-diagnostica-trazabilidad-y-validacion.md`
(41 apartados). Igual que `D12` y `D13`, **una sola capa**.

**El ultimo bloque de la fase.** No diagnostica: valida, empaqueta, versiona y
entrega lo que hicieron `D00` a `D13`. Y sigue sin decidir nada -- apartado 13:
severidad es diagnostico, prioridad es F4.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema | `supabase/migrations/20260925090000_f3_d14_salida_diagnostica_y_validacion.sql` |
| Contrato, generador e invariantes | `packages/contracts/src/output.ts` |
| Tests | `packages/contracts/src/output.test.ts` (37) |

6 tablas: `diagnostic_outputs`, `diagnostic_snapshots`,
`diagnostic_output_evidence`, `diagnostic_validations`, `diagnostic_transitions`,
`diagnostic_closures`. 51 check constraints, RLS en las 6, y la tabla
`knowledge_applicability` de `D11` ampliada en vez de duplicada.

### Aqui se paga la deuda del lenguaje

Durante `D09`, `D10` y `D11` el lenguaje calibrado se vigilaba con expresiones
regulares en castellano, y quedo escrito en esta misma bitacora que eso era un
lint y no una garantia. El diagnostico era que **estaban mal planteadas, no mal
escritas**: una regex no entiende negacion ni cita, y vigilar prosa despues de
escribirla es un guardrail con forma de prompt.

La inversion que lo arregla: **la frase no se escribe, se compone**. Los
guardrails 43 a 46 de `D11` no dicen "prohibido exagerar" -- dan la formula
exacta de cada nivel. Asi que la fuente ya traia el generador:

| Confianza | Entradilla obligatoria |
| --- | --- |
| `insufficient_data` | "No puede determinarse ..." |
| `low` | "Es compatible con ..." |
| `medium` | "La explicación más probable es ..." |
| `high` | "La evidencia sostiene que ..." |

`userSummary(nivel, cuerpo)` compone la frase, y el check
`diagnostic_outputs_lenguaje_calibrado` comprueba en base de datos que el
resumen empieza por la que le toca. **"Está claro que" con confianza baja ya no
es algo que se detecte: no se puede guardar.** Verificado en produccion, no solo
en test: los dos intentos descalibrados fueron rechazados y las cuatro formulas
correctas entraron.

Y el nivel de lenguaje no es una eleccion editorial aparte: otro check lo ata al
nivel de confianza, porque el apartado 25 dice que la interfaz puede simplificar
pero no alterar el significado.

**Las cuatro cadenas estan duplicadas a proposito** -- una en TypeScript y otra
en el check SQL -- porque esa duplicacion es lo que convierte la calibracion en
garantia. Para que no se separen sin que nadie se entere, hay un test que **lee
la migracion** y comprueba que las cuatro siguen coincidiendo. La mutacion
deliberada lo confirma: cambiar una sola formula en el contrato hace fallar ese
test y tres mas.

Las tres regex se quedan como lint sobre texto interno, ya degradadas
explicitamente en `D12`.

### Otras decisiones

**El gate son doce condiciones y se exigen las doce** (apartado 38).
`finalized_valid` no es alcanzable con once. El test recorre las doce y
comprueba que quitar cualquiera bloquea la finalizacion, una por una. Es el
primer invariante del apartado 41: no emitir como final algo no validado.

**La historia no se muta** (apartados 4, 6 y 20). Cada revision material crea
una version nueva con su motivo; un indice parcial garantiza una sola vigente
por caso y el numero de version es unico dentro del caso. Una version sustituida
no puede seguir siendo la vigente.

**Resolver no es cerrar** (apartado 18). Cerrar exige verificar el resultado
empresarial **o** declarar por escrito que es un cierre administrativo. Sin esas
dos salidas todo el mundo cierra en cuanto toca la causa.

**Reabrir exige evidencia nueva** (apartado 19), no un cambio de opinion.

**La evidencia contradictoria tiene sitio** (`stance = 'contradicting'`) porque
si no lo tuviera desapareceria sola, y el apartado 41 prohibe ocultarla. Ademas
una regla avisa cuando una conclusion en alta no tiene ni una contraria
registrada: o no se busco, o no se guardo.

**Un fallo tecnico no es un diagnostico** (apartados 33 y 35). La taxonomia de
error existe para que un timeout no se presente como conclusion parcial, y el
check impide que algo con fallo se marque como finalizado.

**Reproducible son cinco condiciones, no una etiqueta optimista** (apartado 22).
Y sin snapshot no hay salida final.

**Conocimiento no es evidencia, y no se duplica el registro** (apartado 26). En
vez de crear un `DIAGNOSTIC_REFERENCE_RECORD` paralelo, se amplia
`knowledge_applicability` de `D11`, que ya separaba la confianza de recuperacion
de la del diagnostico. Dos registros del mismo documento acabarian discrepando.

**El actor de una transicion es un rol, no una persona** (`engine`, `validator`,
`consultant`, `scheduler`, `external_event`), en la misma linea que `D09`.

**La RLS distingue por primera vez al cliente del staff.** `diagnostic_outputs`
tiene dos politicas: el staff ve lo de sus organizaciones asignadas y el cliente
solo las filas marcadas `user_visible` de la suya (apartado 23).

### Lo que quedo fuera, a proposito

- **La suite de evals y el release gate** (apartados 31 y 32) no existen. Es
  trabajo de F9 y de CI, no de esquema.
- **Las metricas de observabilidad** (apartado 29) se pueden calcular desde
  estas tablas, pero nadie las calcula.
- **El arbitraje multiagente** (apartado 28) no tiene tabla: no hay todavia dos
  agentes que puedan contradecirse.
- **La telemetria y los spans** (apartado 37): hay `trace_id`, no hay tracing.
- **Y sigue sin haber motor.** `D14` puede validar, pero no hay nada que
  produzca una salida que validar.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **24 intentos de violacion
  y 6 positivos: 30/30**. Cuatro de los rechazos son del lenguaje.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): 6 tablas / 6 con RLS / 7 politicas /
  51 checks / guardia de lenguaje y guardia del gate presentes / `D11` ampliada
  con sus cuatro columnas / **0 columnas de prioridad, accion o estrategia** /
  migracion anotada. Y ademas una prueba funcional con rollback: **3 rechazos de
  3 y 1 positivo de 1**, con las cuatro formulas entrando y el lenguaje
  descalibrado rebotando.
- **Mutacion deliberada**: cambiar una sola formula en el contrato hace fallar
  cuatro tests, incluido el que lee la migracion.
- 37 tests nuevos (**402 en el paquete**), 300 de la API, typecheck limpio,
  esquema generado al dia (196 migraciones).

### Un descuido durante el despliegue

Encadene el typecheck y el `db:push:prod` con `;` en vez de condicionar el
segundo al primero, y el typecheck fallo en esa pasada -- por un `dist` a medio
reconstruir, en un fichero de la API que no he tocado -- mientras la migracion
salia igualmente. No hubo dano: la migracion venia de 30/30 en test y el
typecheck vuelve limpio al reejecutarlo. Pero **el orden correcto es condicionar
el despliegue**, y encadenar con `;` lo rompe.

---


---

## `D01` — Motor y pantalla · **hecho** 2026-09-26

**Fuente:** `03-runtime/d01-flujo-evaluacion-calidad-datos.md` (19 pasos y 5 ramas
operativas). El contrato de `D01` se cerro el 2026-09-14; esto son las otras dos
patas del apartado 3 del plan maestro.

**El primer bloque de la fase 3 que esta entero.** Y se elige este y no otro
porque `D01` es la puerta que va antes de todo: sin el, "las ventas han caido" y
"la credencial de Shopify caduco el martes" producen el mismo diagnostico.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Logica pura del motor | `packages/contracts/src/data-quality.ts` (`assessSource` y sus cuatro piezas) |
| Parte sucia | `apps/api/src/data-quality-engine.ts` |
| Entrada de cron | `apps/worker/src/data-quality-once.ts` + `.github/workflows/data-quality-engine.yml` |
| Idempotencia | migracion `20260926090000_f3_d01_motor_idempotencia.sql` |
| Lectura de consultor | `listConsultantDataQuality` + `GET /v1/consultant/data-quality` |
| Lectura de cliente | `apps/api/src/data-quality.ts` + `GET /v1/organizations/:id/data-quality` |
| Pantalla | `apps/web/src/app/integraciones/data-quality-panel.tsx` y su view-model |
| Tests | 24 nuevos en `data-quality.test.ts` (428 en el paquete) + 6 en `data-quality-view-model.test.ts` |

Mismo reparto que `D05`: la decision entera vive en la funcion pura, que se
prueba sin montar nada, y el fichero de `apps/api` es solo leer y escribir.

### Que pasos del runtime cubre, y cuales no

De los 19 pasos, **cubre 5**: freshness contra la cadencia esperada (2),
completeness y tipo de ausencia (3), salud de ingestion (11), cierre temporal
(16) y emitir el resultado con sus motivos (19). Mas la rama D entera.

**No cubre 14, y no es pereza: son pasos que hoy no tienen datos.** Los pasos 4,
5, 6 y 17 --source of truth, reconciliacion, consistencia semantica y
cross-validation-- necesitan **dos fuentes comparables sobre el mismo
fenomeno**, y solo Shopify tiene serie diaria. Por eso
`data_source_reconciliations` tiene tabla y contrato desde el primer dia y sigue
vacia: no es una tabla olvidada, es una tabla esperando a Meta y Klaviyo. Los
pasos 7 y 8 (schema drift, checks matematicos) exigen el evento crudo. Los 12,
13, 14 y 18 dependen de piezas que aun no existen.

### La decision que mas condiciona el resultado

**La cobertura sale del rango realmente ingerido, no de la serie de ventas.** La
via obvia habria sido contar las filas de `shopify_sales_daily`, y esta mal:
esa funcion devuelve una fila por cada dia del rango, rellenando con ceros los
dias sin pedidos. Contarlas daria **100% de cobertura siempre**, incluso en una
tienda conectada ayer -- un numero tranquilizador y falso, que es la peor clase.

Lo que si se puede afirmar: entre el primer y el ultimo pedido ingeridos, el
dato esta. Un dia a cero ahi dentro es un dia sin ventas, un valor y no un
hueco; tratarlo como hueco seria el guardrail 14 al reves. Fuera de ese rango no
es que no hubiera ventas: es que no las hemos traido.

### Otras decisiones

**Sin cadencia esperada no existe la obsolescencia.** Un dato de hace tres dias
esta perfecto si la fuente es semanal. `classifyFreshness` devuelve `unknown` y
no un estado inventado. Las cadencias por defecto del motor son el ultimo
recurso y las pisa cualquier fila de `data_source_expectations`, que es la capa
de tenant de este bloque.

**La ventana son dias enteros UTC.** Al principio acababa en `now`, y entonces
el periodo salia `open` en todas las pasadas: un aviso que se repite siempre
deja de avisar. Con dias cerrados, `partially_settled` y `open` vuelven a
significar algo.

**La fiabilidad nunca sube, solo baja**, y cada bajada deja su motivo escrito --
que es ademas lo que exige la check constraint `..._degradacion_motivada`.

**Un fallo cerrado no se reabre en silencio.** El indice unico de la migracion
es **parcial a proposito**: solo puede haber un issue ABIERTO del mismo tipo
sobre la misma fuente, y los cerrados se acumulan porque son el historial. Saber
que este permiso ya se cayo tres veces en dos meses es informacion; colapsarlos
en una fila la borraria. Si la averia vuelve, entra una fila nueva con su fecha.

**Un fallo que ya no se observa se cierra con su motivo.** El guardrail 4
prohibe cerrar sin decir por que, y el motor puede decirlo: la condicion ya no
esta. Dejarlos abiertos para siempre convierte el panel en ruido, que es la otra
forma de no avisar de nada.

**Ahora `D05` sabe de que dato habla.** El motor de senales escribia
`data_confidence: "low"` fijo, con una nota pidiendo perdon porque nadie
evaluaba el dato. Ya no: lee la fiabilidad real de la fuente. `unusable` no baja
a `insufficient_data` porque la tabla solo lo permite con relevancia baja -- la
senal existe, lo que no aguanta es concluir sobre ella, y de eso se ocupa
`checkDataQualityGate` cuando llegue el diagnostico.

### La pantalla

**La etiqueta dice lo que el fallo le hace al diagnostico, no lo buena que es la
fuente.** "Fiabilidad baja" obliga al consultor a traducir; "bloquea el
diagnostico" ya esta traducido. Es literalmente la columna `downstream_effect`
del contrato, que existe para eso (apartado 17).

Dos vistas y dos reglas, en dos componentes separados para que se vea de lejos:

- **Consultor** (`/integraciones`, vista de cartera): las evaluaciones enteras
  con sus motivos de degradacion y todos los issues abiertos, incluidos los que
  son culpa nuestra.
- **Cliente** (`/integraciones`, su panel): solo lo que ocurre en sus sistemas y
  **ya esta verificado**, que es `client_actionable` y `status <> 'open'`. Un
  issue recien detectado es una sospecha del motor: avisar de una averia que no
  lo era erosiona la confianza mas rapido que el fallo original. **Si no hay
  nada que pueda arreglar, no se pinta nada** -- un modulo que dice "todo
  correcto" le obliga a leer para enterarse de que no pasa nada.

La condicion del cliente esta escrita dos veces (la consulta y la politica RLS
`data_quality_issues_select_cliente`, comprobada en produccion). Si discrepan,
manda la RLS, que es la unica que no se puede saltar por descuido.

**Sin cobertura medible no se pinta un porcentaje.** Hay un test para eso: en
pantalla un "100%" inventado miente mas que en la tabla, porque nadie audita un
numero que parece bueno.

### Lo que quedo fuera, a proposito

- **La vista de platform_admin** (que fuentes fallan en toda la cartera) no
  esta. Es observabilidad entre organizaciones y vive en
  `/admin/observabilidad`, donde tiene mas sentido hacerla una vez para varios
  bloques que bloque a bloque.
- **Los `data_source_reconciliations`**, por lo dicho arriba: falta la segunda
  fuente.
- **El workflow no tiene `schedule`**, igual que el de senales: decision de Rafa
  del 2026-08-03. Si algun dia se activan los dos, este va antes (06:07 frente a
  06:17).

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **2 rechazos y 5 positivos,
  7/7**, sobre los dos indices unicos. Un detalle util del primer intento: la
  check constraint `..._degradacion_motivada` rechazo mi propia fila de prueba
  antes de que llegara al indice.
- **Motor ejecutado de verdad** contra test: 3 organizaciones, 0 fallos. Y
  encontro por su cuenta lo que ya sabiamos y nadie habia automatizado: la
  credencial de Shopify caducada y cero dias de pedidos en la ventana. Segunda
  pasada: **4 evaluaciones, 4 huellas distintas** -- no duplica -- y **un issue
  auto-resuelto** al desaparecer su condicion.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): las 2 columnas de huella, los 2
  indices con el predicado parcial correcto, migracion anotada, y la politica
  RLS de cliente comprobada: `client_actionable AND status <> 'open' AND
  can_access_org`.
- **Mutacion deliberada**: relajar "cero observaciones inutiliza la fuente" de
  `unusable` a `medium` **no rompio ningun test a la primera**. El agujero era
  real y mio: en `assessSource` esa regla queda tapada porque la cobertura cero
  genera ademas un issue que bloquea. Se anadio el test que la prueba suelta,
  se remuto y entonces si fallo. Revertido.
- 30 tests nuevos, **428 en el paquete de contratos** y 171 en la web, suite
  completa y typecheck en verde, esquema al dia (**197 migraciones**).
- Esta vez el despliegue a produccion fue **condicionado** al typecheck, no
  encadenado con `;` -- que es la correccion del descuido anotado en `D14`.

---


---

## `D02` — Motor y pantalla · **hecho** 2026-09-27

**Fuente:** `03-runtime/d02-flujo-contextualizacion.md` (16 pasos y 6 ramas). El
contrato se cerro el 2026-09-14; esto son el motor y el pixel.

**Lo que aporta, en una frase:** la misma caida del AOV es un problema si cada
canal vende peor, y **no lo es** si todos venden igual y solo cambio el peso de
cada uno. Sin descomponer, los dos casos se leen igual y llevan a diagnosticos
opuestos.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Logica pura | `packages/contracts/src/context.ts` (`assessContext` y sus cinco piezas) |
| Parte sucia | `apps/api/src/context-engine.ts` |
| Agregacion del mix | funcion SQL `public.context_order_mix` (migracion `20260927093000`) |
| Cron | `apps/worker/src/context-once.ts` + `.github/workflows/context-engine.yml` |
| Idempotencia | migracion `20260927090000` |
| Lectura de consultor | `listConsultantContextReadings` + `GET /v1/consultant/context-readings` |
| Pantalla | `apps/web/src/app/shopify/diagnostico/context-readings.tsx` y su view-model |
| Tests | 22 nuevos en `context.test.ts` (448 en el paquete) + 7 en el view-model |

### Que pasos del runtime cubre

**7 de 16**: scope (2), baseline (3), comparabilidad temporal (4), analisis de
mix (6), discontinuidades de medicion heredadas de D01 (12), completitud
contextual (15) y emitir la salida (16). Y las ramas A y D enteras, que son las
dos que se resuelven separando rendimiento de composicion.

**Los pasos 5, 7, 8, 10, 11 y 14** (contexto de negocio, trade-offs,
promociones, contexto externo, capacidad, experiencia historica) **no son
calculo, son criterio**, y el RAG es su sitio. Los pasos 9 y 13 necesitan que
alguien escriba en `context_change_events` y `tenant_context_facts`, hoy vacias:
el motor las lee si hay algo y no inventa lo que no hay.

### La cadena, funcionando

Lo mejor de este bloque no es una pieza suya: es que **D01 y D02 se hablan**. El
paso 1 del runtime dice que "si D1 degrada una fuente, D2 debe conservar esa
incertidumbre", y en la prueba real se vio cumplirse solo: como la credencial de
Shopify en test esta caducada, la lectura contextual salio
`not_comparable` con el motivo escrito **"D01 marco shopify como fiabilidad
unusable"**. Nadie programo ese caso; salio de que un motor lea lo que escribio
el otro.

### Decisiones

**La descomposicion es aritmetica, no heuristica.** Shift-share clasico:
`dentro = Σ peso_antes × Δrendimiento` y `mix = Σ Δpeso × rendimiento_despues`.
La suma de las dos es exactamente el movimiento del agregado, y hay un test que
lo comprueba con tolerancia 1e-9. Lo unico elegido es `DOMINANCIA_MINIMA = 0.75`,
el umbral a partir del cual se dice que una domina; **ese numero es nuestro, no
del artefacto**, y esta exportado para poder calibrarlo.

**Los pesos se normalizan por dimension, no sobre la lista.** Se detecto al
conectar las dos dimensiones: con canal y tipo de cliente juntos, cada pedido
contaba dos veces y los pesos sumaban dos. La descomposicion seguia cuadrando y
ya no queria decir nada. Hay un test que suma los pesos de cada dimension y
exige 1.

**Dos dimensiones que discrepan no se resuelven eligiendo una.** El canal puede
decir "composicion" y el tipo de cliente "rendimiento", y las dos pueden ser
ciertas -- en la prueba real paso exactamente eso. `combineInterpretations`
devuelve `mixed`, que es lo que el guardrail 6 obliga a decir.

**El baseline por defecto es el periodo anterior de la misma duracion**, y sale
con su motivo escrito porque el guardrail 3 lo exige. No es el mejor baseline
posible y no pretende serlo: sin saber que periodos historicos son comparables,
es el unico que se puede defender. Por eso el paso 4 lo somete a examen justo
despues en vez de darlo por bueno.

**La agregacion va en SQL, no en Node** (ADR-0006 punto 6): `context_order_mix`
es `stable`, sin `security definer`, con su indice creado en la misma migracion.

**El contrato corrigio al motor.** El motor declaraba la comparacion `comparable`
teniendo una incognita critica abierta, y la check del contrato lo rechazo. Es
correcto: no se puede llamar limpia a una comparacion que no sabe si mira
rendimiento o composicion. Se arreglo el motor.

### Quien abre el caso, y por que es provisional

`context_assessments.case_id` es obligatorio y **no hay nadie que abra casos
diagnosticos**: `D00` define que es un caso pero no quien lo crea, y `D06`
(sintomas), que seria su sitio natural, no existe. Mientras tanto lo abre este
motor a partir de la senal, con la huella de `20260927090000` para no abrir dos
veces el mismo. **Cuando exista `D06` la apertura se mueve alli**, y esta
anotado en `conocimiento/TAREAS_PENDIENTES.md` para que no se quede aqui por
inercia.

### La pantalla

En `/shopify/diagnostico`, encima del detalle tecnico, y solo consultor -- esa
pagina ya filtra por rol. La lectura contextual es razonamiento a medio hacer:
dice contra que se compara, no que pasa; ensenarsela al cliente seria darle una
conclusion que no existe.

**Dice el significado, no el nombre interno.** `mix_shift` no le dice nada a
nadie; "cambio el peso de los segmentos, no su rendimiento" es la frase que el
consultor se lleva a la llamada. Y **"sin determinar" se redacta para que no se
confunda con "no pasa nada"**, que es la confusion mas cara de esta pantalla.

**El peso se dice en puntos, no en porcentaje de variacion.** Del 5% al 10% de
peso es "+5 puntos"; decir "+100%" sobre un peso impresiona y no informa.

**Un rendimiento que no se movio se pinta como "igual"**, explicitamente. Esa
palabra es la mitad del valor de la tabla: es lo que descarta el deterioro.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **2 rechazos y 3 positivos,
  5/5** sobre las dos huellas.
- **Motor ejecutado de verdad**, con 80 pedidos sinteticos que reproducen una
  composicion pura (cada canal con AOV constante, el peso de meta pasando del
  50% al 90%). Escribio 1 caso, 1 lectura y **4 segmentos con los pesos exactos
  0,5 -> 0,9 y 0,5 -> 0,1**. Los datos sinteticos se borraron despues; test
  vuelve a estar en cero.
- **Un fallo del fixture, no del motor**: el AOV salia 0 porque
  `shopify_order_facts` tiene un trigger que calcula `net_sales` desde
  `current_total_price`, y el fixture no lo rellenaba. Se comprobo el dato crudo
  antes de tocar la funcion -- que estaba bien.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): huella en `diagnostic_cases`, los 3
  indices, `context_order_mix` presente como `stable` y **sin `security
  definer`**, las 2 migraciones anotadas y **0 columnas de causa** en
  `context_assessments`.
- **Mutacion deliberada**: cambiar `peso_antes` por `peso_despues` en la
  descomposicion rompe el test de la identidad. Revertido.
- 29 tests nuevos (**448 en contratos**, 178 en la web), suite completa y
  typecheck en verde, esquema al dia (**199 migraciones**). Despliegue
  condicionado al typecheck.

### Lo que quedo fuera, a proposito

- **La edicion del contexto declarado por el cliente** (`tenant_context_facts`
  en onboarding y su perfil, que es lo que dice su fila de audiencia). El motor
  ya lo lee si existe; falta que alguien pueda escribirlo.
- **Las contradicciones declarado/observado** (paso 13): sin contexto declarado
  no hay con que contradecir.
- **Las dimensiones `device`, `market` y `product`**: `shopify_order_facts` no
  las sostiene. No se simulan -- el motor las declara en `missing_context`, que
  es lo que pide el paso 15.

---


---

## `D06` — Motor y pantalla · **hecho** 2026-09-28

**Fuente:** `03-runtime/d06-flujo-motor-sintomas.md` (24 pasos). El contrato se
cerro el 2026-09-17; esto son el motor y el pixel.

**Lo que aporta, en una frase:** `D05` puede decir "las ventas netas caen un
18%" y nada mas. `D06` es el bloque que cruza esa linea y solo esa: dice si caen
**porque caen los pedidos** --y entonces el sitio donde mirar es otro-- o si los
pedidos aguantan y lo que se hundio es el ticket medio. Sigue sin poder decir
por que (`D07`-`D09`) ni que hacer (F5+).

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Logica pura | `packages/contracts/src/symptoms.ts` (`buildSymptoms` y sus cinco piezas) |
| Parte sucia | `apps/api/src/symptom-engine.ts` |
| Idempotencia y aritmetica declarada | migracion `20260928090000` |
| Cron | `apps/worker/src/symptoms-once.ts` + `.github/workflows/symptom-engine.yml` |
| Lectura de consultor | `listConsultantSymptomMap` + `GET /v1/consultant/symptoms` |
| Pantalla | `apps/web/src/app/shopify/diagnostico/symptom-map.tsx` y su view-model |
| Tests | 20 nuevos en `symptoms.test.ts` (468 en el paquete) + 10 en el view-model |

### La decision que ordena todo el bloque

**La relacion entre dos senales no se adivina: se consulta.** El guardrail 9
prohibe crear un sintoma porque varias senales ocurran a la vez, y el 10 exige
una relacion declarada. La tentacion es inferirla de la forma de las series --que
es exactamente el error que el guardrail describe--. En vez de eso se lee de
`metric_dependencies`, la tabla que `D05` creo hace once dias y que **estaba
vacia**: la migracion declara ahi que `net_sales` se compone de `orders_count` y
por que. Sin fila declarada no hay sintoma compuesto: hay dos sintomas
independientes y, como mucho, una relacion candidata `often_cooccurs`.

Eso convierte el guardrail en una propiedad del sistema en vez de una regla que
alguien recuerda: para que el motor relacione dos metricas, alguien tiene que
escribir por que estan relacionadas.

### Que pasos del runtime cubre

**16 de 24**: recibir senales (1), calidad (2), buscar relaciones (3),
coherencia (4), formar el patron (5), plantillas (6), revisar `D02` (7),
localizar (8), familia (9), valencia (10), profundidad (11), posicion en el
proceso (12), rol temporal (13), jerarquia padre-hijo (14), descomposicion (15),
multiples sintomas (17), recurrencia (19), relaciones candidatas (20), memoria
(21) y objeto final (22).

**Fuera:** composicion de sintomas superiores (16) y evidencia cualitativa (18),
que necesita resenas o tickets ingeridos. El paso 23 es la pantalla y el 24 no
tiene destino: `D07` y `D08` no existen.

### Decisiones

**Un sintoma es un episodio, no una foto diaria.** Si la caida sigue ahi manana
no es un segundo sintoma: es el mismo, un dia mas viejo. Por eso la huella no
lleva fecha y el indice unico es **parcial, solo sobre los activos**; los
resueltos se acumulan como historia. Sin esa historia el paso 19 no se puede
contestar: **recurrente y cronico son cosas distintas** --uno vuelve, el otro
nunca se fue-- y distinguirlos exige episodios cerrados. Mismo criterio que las
incidencias de `D01`.

**La valencia no sale de la direccion, sale de una plantilla.** El guardrail 22
es explicito: "CAC arriba" no es automaticamente un sintoma negativo, puede ser
el precio de entrar en un mercado nuevo. La libreria de patrones del paso 6 es
donde vive ese juicio, y una plantilla puede **negarse a decidir**
(`valence: "contextual"`) y salir `neutral`. La libreria tiene cuatro entradas,
las de las dos metricas que `D05` sabe emitir: una libreria con entradas para
metricas que nadie calcula solo sirve para aparentar cobertura.

**Lo que contradice se conserva, y se conserva en los dos.** Si las ventas caen
mientras los pedidos suben, lo que se hundio es el ticket medio. Esa senal no se
descarta: entra con rol `contradicting` y como evidencia, y el invariante
`contradiccion_preservada` impide afirmar con confianza alta. **Y entra en los
dos sintomas**, no solo en el de ventas -- anotarlo solo en el padre dejaria
"crecimiento de pedidos" pintado como una buena noticia mientras la facturacion
cae. Los dos salen `mixed`.

**La lectura de `D02` va por metrica, no por pasada.** Que la caida de ventas se
explique por composicion no dice nada sobre el volumen de pedidos. Degradar el
segundo por lo que se sabe del primero seria inventar una correccion que `D02`
no hizo. Hay test.

**La coherencia son cinco campos, no un resumen.** Y en pantalla solo se enumera
**lo que falta**: cinco casillas verdes no cambian ninguna decision y tapan la
que importa.

### Un fallo de `D05` que solo aparecio al encadenarlo

`shopify_sales_daily` genera un bucket por dia hasta el final del periodo, y el
motor de senales le pedia hasta `now()`. El ultimo punto de la serie era
entonces **el dia en curso**, que a las nueve de la manana lleva un pedido y a
las once de la noche lleva veinte. El detector mira el ultimo punto: se estaba
produciendo **una caida de nivel falsa todos los dias**, mayor cuanto mas
temprano corriera el cron.

No se veia porque nadie miraba las senales de cerca. Aparecio al montar un
escenario donde los pedidos suben y las ventas caen: la senal de pedidos salia
`down`, al reves de lo que decia el dato. Arreglado descartando el ultimo
bucket **por posicion y no por fecha**, porque la funcion agrupa en la zona
horaria de la tienda y comparar contra la medianoche UTC volveria a equivocarse
en cuanto la tienda no estuviera en Londres.

### Quien abre el caso: lo que se aprendio

En la bitacora de `D02` quedo anotado que la apertura de casos diagnosticos
deberia mudarse a `D06` cuando existiera. **Al llegar aqui resulta que no.** El
paso 7 del runtime de `D06` obliga a leer la lectura contextual de `D02`, y
`context_assessments` cuelga de un caso: si `D06` abriera el caso, `D02` no
podria escribir antes, y `D06` no tendria contexto que leer. Es un ciclo. El
caso lo abre quien lo necesita primero, y ese es `D02`. La tarea se corrige en
`TAREAS_PENDIENTES.md` en vez de arrastrarse.

### La pantalla

En `/shopify/diagnostico`, encima de la lectura contextual, y solo consultor --
un sintoma es un patron **sin causa**, y ensenarle al cliente "caida de ventas
netas, confianza media" sin poder decirle por que le da el susto y ninguna
salida.

**La confianza se dice como para que sirve, no como nota.** "Media" cada uno la
interpreta como quiere; "sirve para investigar, no para concluir" es una
instruccion. Es el freno principal de esta pantalla: un sintoma con aspecto
seguro de si mismo se lee como una causa aunque nadie escriba la palabra.

**Lo que no encaja tiene su propio bloque**, con el mismo peso visual que lo
demas. Ver solo lo que encaja es como se cierra un diagnostico falso.

**Ninguna relacion candidata se traduce por algo causal**, y hay un test que
recorre el catalogo entero buscando la palabra. Si alguien cambia "coincide en
el tiempo con" por "provoca", el bloque deja de servir para lo que existe.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **9/9** -- relacion sin
  clase, confianza alta sin contexto, relacion causal, huella activa duplicada y
  evidencia repetida rechazadas; episodio cerrado y abierto conviviendo;
  cualitativa obligada a declarar representatividad; dependencia declarada; y
  **0 columnas de causa, accion, prioridad o direccion**.
- **La cadena entera, con datos reales**: 740 pedidos sinteticos ->
  `signal-engine` escribio 2 senales -> `data-quality` las evaluo ->
  `context-engine` abrio 2 casos y escribio 2 lecturas -> `symptom-engine`
  formo los sintomas. En el primer escenario (todo cae) salio la jerarquia
  correcta: **`net_sales_decline` como padre y `order_volume_decline` como
  hijo**, con `coherence_relationship: mathematical` venida de la tabla y
  `context_reviewed: true` venido de `D02`. En el segundo (pedidos arriba,
  ventas abajo) salieron **dos sintomas `mixed`, cada uno con la senal del otro
  marcada como `contradicting`** y su evidencia escrita.
- **Confianza `low` en los dos escenarios**, y es correcto: la credencial de
  Shopify en test esta caducada, `D01` marca el dato como poco fiable y el
  guardrail 33 impide que el sintoma afirme mas que su dato.
- **Idempotente**: segunda pasada, 0 sintomas nuevos, 2 filas y 3 enlaces
  intactos.
- **Datos sinteticos borrados** despues: test vuelve a estar en cero.
- **Mutacion deliberada**: hacer que `findMetricRelationship` devuelva una
  relacion `temporal` para cualquier par --es decir, tratar la coincidencia como
  relacion-- rompe el test que protege el guardrail 9. Revertido.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): huella, hash de evidencia, los 4
  indices, la dependencia declarada y 0 columnas prohibidas. Despliegue
  condicionado al typecheck.
- 30 tests nuevos (**468 en contratos**, 188 en la web), suite completa y
  typecheck en verde.

### Lo que quedo fuera, a proposito

- **La libreria de patrones tiene cuatro entradas.** Crece cuando crezcan las
  metricas de `D05`, no antes.
- **Evidencia cualitativa** (paso 18): no hay resenas ni tickets ingeridos. El
  esquema y los invariantes estan desde el primer dia esperandolos.
- **Composicion de sintomas superiores** (paso 16): agrupar sintomas de familias
  distintas bajo uno mayor exige declarar que los relaciona, y hoy la unica
  relacion declarada es aritmetica.
- **`D07` y `D08` no existen**, asi que el paso 24 no tiene destino. Las
  relaciones candidatas se guardan para que `D07` las lea; hoy es un grafo que
  nadie recorre.

---


---

## `D03` — Motor y pantalla · **hecho** 2026-09-30

**Fuente:** `03-runtime/d03-flujo-deteccion-madurez.md` (17 pasos y 8 ramas). El
contrato se cerro el 2026-09-15; esto son el motor y el pixel.

**Lo que aporta, en una frase:** convierte "no conozco a este cliente" en **"el
dato demuestra estas siete capacidades, no puede ver estas ocho, y este es el
numero de por que"**. Eso es lo que decide donde preguntar en la primera
llamada.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Logica pura | `packages/contracts/src/maturity.ts` (`observeMaturity`, `measureComplexity`, `classifyProfileChange`) |
| Parte sucia | `apps/api/src/maturity-engine.ts` |
| Hechos medidos | funcion SQL `public.maturity_business_facts` (migracion `20260930090000`) |
| Grafo de capacidades | 7 aristas declaradas en la misma migracion |
| Cron | `apps/worker/src/maturity-once.ts` + `.github/workflows/maturity-engine.yml` |
| Lectura de consultor | `listConsultantMaturity` + `GET /v1/consultant/maturity` |
| Pantalla | `apps/web/src/app/shopify/diagnostico/maturity-panel.tsx` y su view-model |
| Tests | 18 nuevos en `maturity.test.ts` (486 en el paquete) + 7 en el view-model |

### La decision principal es sobre lo que **no** se hace

**El apartado 19 del artefacto dice, con todas las letras, que el algoritmo de
scoring, los umbrales y las ponderaciones no estan definidos.** Asi que este
motor **no calcula `required_level` ni emite hallazgos de brecha**. Inventar
esos umbrales seria fabricar la respuesta y presentarla como derivada del
documento -- que es exactamente lo que el plan maestro prohibe.

Lo que si puede hacer, y hace, es mirar el dato del negocio y decir que
capacidades demuestra, con el numero delante. La brecha la pone una persona, y
la pantalla se la pide en vez de fingirla: donde iria un cero pone **"nadie ha
dicho que necesita este negocio"**.

### La segunda decision vale igual: lo que no se ve, no se escribe

Una capacidad que el dato no puede observar **no genera fila**. La tentacion es
ponerla en `absent`, y `absent` es una afirmacion --"esto no existe"-- que
ningun dato ausente sostiene. **"No lo se" y "no lo hay" son cosas distintas**, y
confundirlas en un diagnostico es como se le dice a un cliente que no tiene algo
que si tiene.

Las no observables salen en su propia lista, cada una con su motivo y su cifra:
"solo el 4% de los pedidos dice de donde viene". Esa lista es la mitad util del
bloque.

### El techo es `defined`, y es estructural

El guardrail 20 dice que `measured` exige medir **y** que la medida cambie
decisiones. Lo segundo no esta en ninguna tabla: **el dato puede demostrar que
algo se mide; no puede demostrar que alguien lo mire.** Por eso el motor no
puede pasar de `defined` por bueno que sea el dato, y ese salto lo da una
persona. Hay test.

### Que pasos del runtime cubre

**5 de 17**: medir complejidad (2), construir el perfil de capacidades (3),
evaluar sus dimensiones (4), contrastar evidencia por fuerza (15) y emitir el
perfil (17). Y el paso 16 --por que cambia-- entero.

**Los pasos 5 a 14** (required maturity, comparacion, asimetrias, cuellos de
botella, regresion, riesgo latente, growth-system fit, sobreingenieria) **cuelgan
todos del umbral que el artefacto no define**. No es que falten de hacer: es que
hacerlos hoy seria inventarlos. El paso 1 (business stage) lo define la fase 2.

### Un fallo que solo aparecio al ejecutar

La primera pasada real dio `conversion` en `defined`. Mirando el dato: **365
dias con fila de sesiones y 9 sesiones en todo el ano**. Una serie diaria tiene
una fila por dia aunque ese dia no entrara nadie, asi que contar filas mide que
la serie existe, no que haya trafico. Corregido a dias **con visitas**; la misma
tienda salio entonces en `repeatable`, que es lo que su dato sostiene.

### El grafo de capacidades: solo lo que el artefacto escribe

`capability_dependencies` se creo vacia el 2026-09-15 a proposito. Ahora lleva
**siete aristas, que son literalmente las del artefacto**: el apartado 13 dice
que escalar adquisicion requiere inventario, finanzas, creatividad, conversion,
operaciones y datos; el 14 pone el ejemplo de techo, "creative production
capacity -> paid acquisition scalability". El resto del grafo sigue sin
escribirse, y ponerlo a ojo seria lo mismo que inventar los umbrales.

### Mejorar y vernos mejor no se dicen igual

Guardrail 28, con el ejemplo del propio artefacto: pasar de "Finance E3-E5 con
confianza baja" a "Finance E4 con confianza alta" **no es una mejora del
negocio**, es una mejora de la observacion. `classifyProfileChange` los separa
mirando dos cosas distintas -- si se movio algun nivel (eso es el negocio) o si
cambio lo que vemos de el (eso somos nosotros) -- y **devuelve `null` cuando no
cambio nada**, que es lo que impide escribir un perfil nuevo cada dia para
repetir lo de ayer.

En la prueba real se vio funcionando: al empezar a llegar preparaciones de
pedido, el motor escribio `uncertainty_reduction` con el resumen "ahora se
pueden ver: operations". No `real_change`, que es lo que habria hecho felicitar
al cliente por algo que no hizo.

### La pantalla

En `/shopify/diagnostico`, encima de `D06`, y solo consultor -- "tu retencion es
a ratos" dicho sin acompanamiento es un juicio, no una ayuda, y asi lo dejo
escrito la RLS del contrato.

**Los niveles se dicen por lo que significan.** "repeatable" no es una nota:
es "lo hacen siempre igual, pero no lo miden". Esa frase se lleva a una llamada;
la etiqueta inglesa no.

**Lo no observable va en su propio bloque, no en un pie en gris**, y ordenado
por si tiene arreglo: los huecos que se cierran conectando o rellenando algo
van antes que los que hay que preguntar. Un panel con siete capacidades y ocho
vacias se lee como "a este negocio le faltan ocho cosas"; le faltan ocho **a
nuestra vista**, y toda la pantalla existe para no confundirlo.

**La complejidad se mide en vivo y no se guarda.** Son medidas, no
conclusiones: guardar una medida es quedarse con la de ayer. Lo que si se guarda
es el perfil, porque su valor esta en la historia.

### Verificacion y despliegue

- **Test** (`kopcblejsxpkxoykldyh`): bloque `DO` con **9/9** -- dos perfiles
  vigentes, sustituir sin decir por que, hallazgo sin interpretacion, `measured`
  sin que la medida sirva y regresion sin persistencia, todos rechazados; el
  perfil que produce el motor entra tal cual; las 7 aristas declaradas; la
  funcion `stable` sin `security definer`; y **0 columnas de revenue,
  performance, score, tamano de equipo o prioridad**.
- **Motor ejecutado de verdad** sobre 723 pedidos sinteticos: escribio el perfil
  inicial, la segunda pasada escribio **0** (nada cambio) y al aparecer
  preparaciones escribio uno nuevo con `uncertainty_reduction`. Datos borrados
  despues; test vuelve a estar en cero.
- **Produccion, solo lectura**: se llamo a la funcion sobre las dos tiendas
  reales sin escribir nada. `Grippadel` --786 pedidos, 11.241 clientes-- sale
  con **retencion `defined`: 585 de 786 pedidos (74%) son de clientes que ya
  habian comprado**, y con adquisicion y economia unitaria **no observables**,
  porque solo el 4% de los pedidos trae origen y solo 1 de 44 referencias tiene
  coste. Eso ultimo es un hallazgo real sobre un negocio real.
- **Mutacion deliberada**: hacer que las capacidades no observables se escriban
  como `absent` rompe 3 tests. Revertido.
- **Produccion** (`cthjwpeygpzwdmjkxeqa`): funcion, 7 aristas, indice, 0
  columnas prohibidas, migracion anotada, **0 perfiles escritos**. Despliegue
  condicionado al typecheck.
- 25 tests nuevos (**486 en contratos**, 195 en la web), suite completa y
  typecheck en verde.

### Lo que quedo fuera, a proposito

- **`required_level` y los hallazgos de brecha**, por lo dicho arriba. Es la
  pieza mas grande que falta y no es codigo: es una decision.
- **El resto del grafo de capacidades.** Siete aristas son las que el artefacto
  escribe; las demas son conocimiento de ecommerce por escribir.
- **`market`, `creative`, `finance`, `technology`, `team` y `strategy`** no se
  observan desde el dato de una tienda, y el motor lo dice en vez de rellenarlas.
- **El business stage de la fase 2** (`business_stage` se queda nulo): D03 lo
  consume, no lo redefine, y la fase 2 no esta implementada.

---

## `D05` — Pantalla · **hecho** 2026-10-01

D05 tenia contrato y motor desde el 2026-09-16 y le faltaba la tercera pata. Es
el unico bloque de la fase que llego a `hecho` solo con una pantalla.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Lectura del consultor | `listConsultantSignals()` en `apps/api/src/consultant.ts` |
| Ruta | `GET /v1/consultant/signals` en `apps/api/src/server.ts` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/signal-list-view-model.ts` |
| Tests | `signal-list-view-model.test.ts` (10) |
| Panel | `apps/web/src/app/shopify/diagnostico/signal-list.tsx` |

### Decisiones

**No se ordena por magnitud.** Es la decision de la pantalla y la unica que
cambia como se lee. Una lista de desviaciones puesta de mayor a menor **se lee
como una lista de prioridades**, y D05 no calcula ninguna: el guardrail 8 separa
magnitud de impacto justamente porque un +200% sobre una base minuscula no es la
primera cosa que mirar. Se ordena por fin de ventana, lo mas reciente arriba, y
el desempate es el id para que dos senales del mismo dia no bailen entre
recargas. Hay un test con una senal del -2% reciente y otra del -91% vieja que
falla si alguien invierte el criterio.

**Cuando la magnitud y la exposicion no dicen lo mismo, se dice en voz alta.**
`magnitudeCaveat()` devuelve una frase solo cuando la desviacion es grande y la
exposicion no es material — y `null` el resto de las veces, para no llenar la
lista de avisos que nadie lee. Sin esa frase, la pantalla grita mas fuerte
cuanto menos importa lo que mira, que es el fallo que el guardrail 8 viene a
impedir.

**Una senal sin sintoma es "aun no forma patron", nunca "sin importancia".** El
mapa de D06 solo ensena las senales que llegaron a formar un patron; esta lista
las ensena todas, y la diferencia es lo unico que anade. Pero una senal sola
puede ser la primera de un patron que todavia no existe, o la unica que hay
porque falta la metrica que la acompanaria. Decir que no importa seria afirmar
una ausencia que nadie ha comprobado — el mismo criterio que `D03` aplica a las
capacidades que no puede ver.

**Lo que debilita la senal va en la fila, no en un tooltip.** Muestra corta,
baselines en conflicto, metodo sin fuerza, dato que `D01` no da por utilizable.
Y solo cuando lo hay: lo que se cumple no cambia ninguna decision. Mismo
criterio que `coherenceReasons` en el mapa de sintomas.

**Las senales apartadas se separan, no se esconden.**
`tenant_signal_patterns` esta vacia hoy y por tanto no se silencia nada, pero
cuando alguien declare un patron de supresion el consultor tiene que poder ver
que se aparto y comprobar si estuvo bien. Una supresion invisible es una
supresion que nadie audita.

**Solo consultor**, y aqui el motivo es el mas fuerte de la fase: el guardrail 2
dice que no toda senal es un problema. Esta lista delante del cliente es una
alarma permanente el primer martes que el trafico baje.

**El titular no interpreta.** `headline()` compone "Ventas netas baja" a partir
de metrica y direccion, y hay un test que falla si aparece una palabra de causa.
Es la frontera de los guardrails 49 y 50 puesta en la capa que mas facil se la
salta: la que escribe el texto.

### Verificacion

- 10 tests nuevos del view model; suite de la web en verde (**207**).
- **Mutacion deliberada**: ordenar por `magnitude_relative` en vez de por fin
  de ventana rompe el primer test. Revertido.
- Las 33 columnas del `select` resuelven contra el esquema de **produccion**.
- Typecheck de `api` y `web` sin errores.

### Lo que quedo fuera

**No se ha podido ver con senales reales: `signals` esta a cero en test y en
produccion.** El motor existe y corre, pero no esta programado (el workflow no
tiene `schedule`, decision de Rafa del 2026-08-03) y nadie lo ha lanzado contra
la tienda real. La pantalla se ve vacia hasta que alguien lo ejecute — y el
vacio dice lo que debe decir: "que no haya ninguna significa que nada se ha
salido en la ventana medida, no que todo vaya bien".

---

## `D04` — Motor y pantalla · **hecho** 2026-10-02

Cierra el lazo que `D05` dejo abierto en su paso 29: `METRICS -> SIGNALS ->
HEALTH`. Hasta ahora las senales se escribian y nadie las convertia en un estado.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Motor puro | `assessHealth()` y compania en `packages/contracts/src/health.ts` |
| Tests | `packages/contracts/src/health.test.ts` (13 nuevos, 36 en total) |
| Runtime con I/O | `apps/api/src/health-engine.ts` |
| Job | `apps/worker/src/health-once.ts` + `.github/workflows/health-engine.yml` |
| Lectura del consultor | `listConsultantCapabilityHealth()` + `GET /v1/consultant/capability-health` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/capability-health-view-model.ts` (8 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/capability-health.tsx` |

**Sin migracion**: el esquema de `D04` esta puesto desde el 2026-09-15 y no
hizo falta tocarlo. Es el primer bloque de la fase que llega a `hecho` sin
escribir una linea de SQL nueva.

### Decisiones

**El motor no tiene un solo umbral propio, y esa es la decision entera.** El
guardrail 11 prohibe clasificar CAC, CVR o refund rate por umbral global; el 13
prohibe depender de benchmarks externos; el 39 dice que un CAC alto puede ser
sano si cabe en la economia y el 40 que uno bajo puede ser critico si destruye
contribucion. Contra que se juzga cada metrica lo declara el tenant en
`health_references`, y `D05` ya evaluo la senal contra **esa misma referencia**
en `guardrail_status`. El motor solo traduce: `within -> healthy`,
`approaching -> fragile`, `breached -> bad`, `crossed -> critical`. Sin
referencia declarada no clasifica: escribe `not_assessable` y **dice que falta**,
con la frase entera y nombrando la capacidad.

**`disaster` no aparece nunca.** No hay ninguna regla en la fuente que diga
cuando se llega ahi, y los guardrails 48 a 50 dicen que los estados extremos no
son un recurso retorico. Un estado que nadie sabe derivar es un estado que no se
escribe.

**No ver anomalias no es estar sano** (guardrail 9, el error mas facil de
cometer). Para decir `healthy` hace falta que la metrica se haya **medido** en
la ventana, asi que el motor recibe `measuredMetrics` en vez de deducirlo de la
ausencia de senales. Sin serie medida la respuesta es "no lo se", no "va bien".

**Trayectorias opuestas dan `volatile`, no la media.** Si unas senales mejoran y
otras empeoran, promediarlas inventa una calma que no existe. En la corrida real
la adquisicion salio `bad` + `volatile`, que es exactamente la foto: el CAC se
deteriora y las sesiones mejoran a la vez.

**Un riesgo alto a corto plazo exige indicadores adelantados** (guardrail 25).
Sin ellos el riesgo se queda en `low` por fea que sea la foto, y **la pantalla lo
avisa**: "sin indicadores adelantados, lo que se ve aqui confirma, no avisa". Un
"bajo" que en realidad significa "no miramos hacia delante" es peor que no decir
nada.

**Lo que contradice el estado se guarda como tal.** `evidenceRelation()` marca
`contradicting` la senal que mejora dentro de una capacidad en mal estado, o la
que empeora dentro de una sana. Los guardrails 27 y 28 piden resolver la
inconsistencia por escrito, y para resolverla primero hay que guardarla. En la
corrida real, la senal de sesiones --que mejoraba-- entro como contradictoria de
una adquisicion `bad`. Eso es el guardrail funcionando sobre datos de verdad.

**El riesgo estructural se queda en `none` y se enlaza el perfil de madurez.**
Derivarlo del nivel de `D03` seria una formula que nadie ha escrito. Se enlaza
`maturity_profile_id` (apartado 16 de D03: **referencia, no copia**) y lo lee
una persona.

**En pantalla, estado y trayectoria no se funden nunca** (apartado 3): "mal
mejorando" y "sana cayendo en picado" son situaciones distintas y una sola
etiqueta las iguala. Y **la severidad vive en el hallazgo, no en la capacidad**
(guardrail 6): el color de la tarjeta sale del `health_state` y jamas del peor
de sus hallazgos, porque un problema grave y localizado no pinta de rojo algo que
funciona.

**`not_assessable` no se pinta como una mala noticia.** No saber no es que la
tienda vaya mal: es una declaracion que nos falta. Tiene tono neutro y su
contenido principal es el blocker, que se lee como una instruccion. Hoy esa lista
es casi toda la pantalla, y **eso es el guardrail 11 funcionando**, no un estado
transitorio.

**Las capacidades no se ordenan de peor a mejor.** Ordenarlas es pintar una
prioridad, y "prioridad != salud" es uno de los diez guardrails del bloque.
Alfabetico dentro de cada grupo: un orden que no dice nada y por eso no miente.

### Un fallo que encontro el esquema

Escribi la evidencia con `source_kind` y `reference_id`, copiando la forma de
`D06`. **`health_evidence` no tiene esas columnas**: tiene `relation`
(supporting / contradicting / positive), `metric`, `indicator_type` (leading /
lagging) y la ventana. La tabla estaba diseñada para los guardrails 25, 26 y 27 y
mi version los perdia los tres. Corregido antes de escribir nada real, y con dos
tests que lo fijan.

### Verificacion

- **Bloque `DO` en test**: 6/6, rollback limpio. Incluye los tres rechazos que
  importan -- `not_assessable` sin blocker, oportunidad con severidad alta
  (guardrail 46) y una `relation` inventada.
- **Corrida real del motor** sobre datos sembrados en test: 2 capacidades, 2
  hallazgos, 1 `not_assessable`. `acquisition` salio `bad` **porque el
  guardrail economico declarado se incumplio**, no por un umbral nuestro;
  `retention` salio `not_assessable` diciendo que declarar -- pero **conservando
  la trayectoria**: no sabemos su estado y si sabemos que baja.
- **Mutacion deliberada**: quitar la regla de "sin referencia no se clasifica"
  rompe su test y solo el suyo. Revertida.
- Datos sembrados **borrados**: las seis tablas vuelven a cero.
- 21 tests nuevos (36 en `health.test.ts`, 215 en la web), suite completa y
  typecheck de los cuatro workspaces en verde.

### Lo que quedo fuera, a proposito

- **La politica de agregacion padre/hijo** (guardrails 17 a 21) — sigue sin
  definirse en la fuente, asi que el motor no escribe `parent_id`. Solo evalua
  scope `global`.
- **`chronicity`** — el artefacto no da umbrales temporales y `capability_health`
  ya guarda el historico. Derivarla es leer ese historico, y eso es F9 segun el
  propio artefacto. Hoy sigue siendo una etiqueta que nadie escribe.
- **`issue_role` y `suspected_downstream_of`** — decir que una capacidad
  arrastra a otra necesita el grafo causal de `D07`, que no existe.
- **`contradiction_resolution`** — el motor **guarda** la contradiccion y la
  pantalla la ensena aparte; resolverla por escrito es juicio humano y la columna
  espera a quien lo escriba.

### El resultado que hay que leer bien

`health_references` esta vacia en test y en produccion, asi que **hoy todo
saldria `not_assessable`**. No es que el motor no funcione: es que nadie ha
declarado todavia contra que se juzga ninguna metrica de ninguna tienda. La
pantalla convierte eso en una lista de lo que hay que declarar, que es la unica
cosa util que se puede decir antes de tenerlo.

---

## `D10` — Motor y pantalla · **hecho** 2026-10-03

La entrada del contrato decia "**no hay motor**: evaluar severidad exige un
diagnostico causal cerrado, y no hay ninguno". Era demasiado estricta, y quien lo
desmiente es el propio artefacto: el **guardrail 13 exige** que se pueda estar
muy seguro de que el dano es grave y nada seguro de por que pasa. Asi que se
puede medir el impacto sin saber la causa -- lo que no se puede es puntuar la
gravedad.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Motor puro | `assessSeverity()` y compania en `packages/contracts/src/severity.ts` |
| Tests | `packages/contracts/src/severity.test.ts` (13 nuevos, 46 en total) |
| Runtime con I/O | `apps/api/src/severity-engine.ts` |
| Job | `apps/worker/src/severity-once.ts` + `.github/workflows/severity-engine.yml` |
| Lectura del consultor | `listConsultantSeverity()` + `GET /v1/consultant/severity` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/severity-view-model.ts` (8 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/severity-panel.tsx` |

**Sin migracion**, como `D04`: el esquema esta puesto desde el 2026-09-21.

### Decisiones

**El motor no pone ni una severidad. Las cinco salen `unknown`.** El apartado 29
dice que la fuente **no define formula de severidad, ni ponderacion de impacto,
ni modelo monetario, ni modelo de probabilidad**, y el guardrail 17 anade que un
scope pequeno puede ser material -- o sea que tampoco hay umbral por cuota.
Escribir "un 3% del revenue es moderate" seria inventarse el umbral que el
documento se niega a dar y presentarlo como derivado de el. Hay un test que falla
si alguna de las cinco deja de ser `unknown`.

**Lo que si hace es la rama de cuantificacion, que es donde estaba el valor
escondido.** Convierte "las ventas netas bajan un 21,7%" en "-2.280 USD en la
semana, el 27,7% de la facturacion del periodo". Segun los guardrails 15 a 18,
elegir mal esa base es la forma mas comun de exagerar un problema o de quitarle
importancia, asi que la base se elige **una**, se marca, y el esquema no deja
marcarla sin escribir por que.

**La cuenta es estimada, no observada.** El valor de hoy se observa; la perdida
es la diferencia contra un baseline, y un baseline es un modelo. Poner
`evidence_type = observed` presentaria un calculo como una medicion, y ademas el
esquema obliga a escribir los supuestos de todo lo que no sea observado
(guardrail 22). Los supuestos dicen lo que hay que decir: que se supone que el
baseline habria seguido vigente, y que no se ajusta por estacionalidad porque
`D05` todavia no lo hace.

**Nunca se dice `exact`.** El esquema solo lo permite sobre algo observado con
el periodo cerrado y metodo escrito. Como la cifra es estimada, `exact` queda
fuera por construccion, que es justo la respuesta estructural al "no digas
*exact loss* cuando es una estimacion".

**La lista no se ordena por importe.** Ordenar por cuanto dinero es pintar la
prioridad que los guardrails 3, 46, 47 y 48 dejan fuera del bloque: un HIGH puede
ir antes que un CRITICAL segun esfuerzo y momento, y eso es F4. Va por fecha de
evaluacion, y hay un test con una evaluacion de 40 EUR reciente y otra de 99.000
vieja que falla si alguien invierte el criterio.

**Una evaluacion vigente por caso, y solo se reescribe si la medida cambia.**
`assessment_status` distingue `current` de `superseded`. Volver a escribir la
misma cifra cada dia convertiria el historico en ruido y haria imposible ver
cuando se movio de verdad. La segunda pasada de la corrida real escribio cero.

**Los denominadores salen de `shopify_sales_daily`,** la misma funcion SQL que
alimenta a `D05` (ADR-0006 punto 6). Escribir otra habria garantizado que dentro
de seis meses dieran cifras distintas sobre el mismo periodo.

**En pantalla, el `unknown` se explica.** "Nadie ha definido a partir de que
cuota esto es grave en esta tienda, y un umbral inventado se leeria como si lo
estuviera". Sin esa frase, un `unknown` se lee como que el sistema no sabe hacer
su trabajo.

**Las tres confianzas se ensenan juntas y separadas** (apartado 27). Verlas a la
vez es el punto: "en la cifra: media / en la causa: insuficiente / en la
gravedad: insuficiente" dice exactamente lo que sabemos y lo que no. Una sola
cifra de confianza borraria esa diferencia.

### Un fallo que encontro la corrida real

La primera pasada escribio una cuota de **4.560 %**: estaba dividiendo 2.280 USD
entre 50 pedidos. No era un error de magnitud sino **de categoria** -- una
perdida en dinero no tiene cuota sobre un recuento. La guarda que tenia (cuota
fuera de 0..1 se descarta) evito escribir el disparate, pero lo explicaba mal:
decia "la base esta mal medida" cuando lo que pasaba es que las unidades no
encajaban.

Arreglado con `metricUnitKind()` y una tabla de unidad por base. Ahora la base en
pedidos **se sigue guardando** --el guardrail 15 quiere varias-- pero sin cuota y
diciendo por que: "no estan en la misma unidad; la base queda registrada como
contexto". Con su test.

### Verificacion

- **Corrida real del motor** en test sobre un caso abierto con senal y 50 pedidos
  sinteticos: 1 evaluacion, 1 medida, 2 exposiciones. La segunda pasada escribio
  **cero** (idempotencia). Datos borrados: las seis tablas vuelven a cero.
- **Mutacion deliberada**: derivar `overall_severity` de la cuota rompe su test y
  solo el suyo. Revertida.
- 21 tests nuevos (46 en `severity.test.ts`, 233 en la web), suite completa y
  typecheck de los cuatro workspaces en verde.

### Lo que quedo fuera, a proposito

- **Las cinco severidades**, por lo dicho arriba. Es el recorte del bloque y no
  es codigo: es una decision que alguien tiene que tomar por tienda.
- **La contribucion como denominador** -- seria la mejor base para casi todo
  esto (el mismo incidente es un 3% del revenue y un 30% de la contribucion) y no
  se puede calcular: 43 de 44 referencias no tienen coste. El motor lo dice en
  `limitations` en vez de usar revenue y callarse.
- **Reversibilidad, recuperabilidad y severidad estructural** -- dependen de
  `D09`, que no tiene motor.
- **`impact_propagation` y `absorption_buffers`** -- la cascada exige una ruta
  causal de `D07` (guardrail 36) y el colchon lo declara el tenant. Ninguna de
  las dos se escribe.
- **El coste de oportunidad y el revenue en riesgo** -- son `potential` y exigen
  verosimilitud declarada; no hay de donde sacarla sin modelo.

---

## `D04` — El declarador de referencias · 2026-10-04

No es un bloque nuevo: es la pieza que faltaba para que `D04` y `D10` sirvieran
de algo. Los dos estaban implementados y los dos contestaban `unknown` en todo
por el **mismo** motivo -- nadie podia decir "el CAC maximo de esta tienda son 32
EUR". La tabla `health_references` existia desde el 2026-09-15 y solo la leia un
motor.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Esquema de la declaracion | `healthReferenceInputSchema` en `packages/contracts/src/health.ts` |
| Lectura y escritura | `listConsultantHealthReferences()`, `createConsultantHealthReference()`, `retireConsultantHealthReference()` |
| Rutas | `GET`, `POST` y `DELETE /v1/consultant/health-references` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/health-references-view-model.ts` (7 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/health-references.tsx` |

### Decisiones

**La declaracion va donde se reporta la ausencia.** El panel esta justo encima
del de salud, no en `/configuracion` ni en una pantalla de ajustes: quien lee "no
hay guardrail economico declarado para adquisicion" lo declara ahi mismo. Un
hueco que te dice que falta algo y no te deja arreglarlo es una queja, no una
herramienta.

**Solo el guardrail economico juzga, y la pantalla lo dice.** Los cinco tipos del
esquema no son equivalentes: `economic_guardrail` es el unico que dice "a partir
de aqui, duele", y por tanto el unico que hace que una capacidad pueda salir
`bad` o `critical`. El objetivo y el historico sirven para comparar. Si la
pantalla los tratara igual, alguien declararia su baseline, veria que sigue
saliendo `not_assessable` y concluiria que el sistema esta roto. Hay un test que
lo fija.

**No se borra, se retira.** Cambiar la vara explica por que una capacidad paso de
`bad` a `healthy` sin que el negocio se moviera: cambiamos el criterio. Borrar la
referencia dejaria ese salto sin explicacion en el historico, asi que retirar es
poner `effective_to` y la fila se queda. Declarar una nueva sobre la misma
metrica retira la anterior en el mismo movimiento: dos varas vigentes a la vez
darian dos diagnosticos.

**La direccion se declara junto al numero.** Un CAC sostenible es un techo y una
cobertura de stock es un suelo; el mismo 32 significa lo contrario en cada caso.
Sin `direction`, el motor no puede saber si 38 es incumplir o cumplir de sobra.

**El boton apagado dice por que.** `validateDraft()` devuelve el motivo en vez de
un booleano, para que el formulario pueda explicarse. Un control desactivado sin
explicacion es una pared.

**Se escribe con la service role y el permiso se comprueba a mano** (ADR-0006
punto 7): la lista de organizaciones del consultor **es** ese permiso. Si la
tienda no esta en su cartera, la escritura sale 403 antes de tocar nada.

**Un benchmark externo tiene que decir de donde sale.** El guardrail 13 no lo
prohibe, exige poder discutirlo. La regla vive en el esquema Zod y en el
servicio, para dar un mensaje util en vez de un error de Postgres.

### Verificacion: el lazo entero, de punta a punta

Es la primera vez en la fase que se comprueba la cadena completa sobre datos:

1. Se declara `cac <= 32 EUR` como guardrail economico de adquisicion.
2. Entra una senal de `D05` con `guardrail_status = breached`.
3. Se corre el motor de `D04`.
4. La adquisicion pasa de `not_assessable` a **`bad`, con el motivo escrito**:
   "El CAC sube a 38 EUR, por encima del guardrail declarado de 32", confianza
   `medium`, sin bloqueo.

Datos borrados despues: las tres tablas vuelven a cero. 7 tests nuevos (251 en la
web), suite completa y typecheck en verde.

### Lo que quedo fuera

- **El alcance por tienda**: `health_references` tiene `store_id` y la pantalla
  declara a nivel de organizacion. Con una tienda por organizacion da igual; con
  varias habra que elegir.
- **Los umbrales de severidad de `D10`** siguen sin sitio donde declararse. Son
  otra pregunta ("a partir de que cuota esto es grave") y necesitan su propia
  decision antes que su propio formulario.
- **Que el cliente vea o corrija su propia vara.** Hoy es consultor.

---

## `D11` — Motor y pantalla · **hecho** 2026-10-05

El bloque que le pone freno a los otros seis. Con senal, patron e impacto
medido, un caso **parece** un diagnostico cerrado; esto escribe al lado la fila
"¿Por que pasa? — no puede determinarse" y lo que haria falta para contestarla.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Motor puro | `assessConfidence()` y compania en `packages/contracts/src/confidence.ts` |
| Tests | `packages/contracts/src/confidence.test.ts` (13 nuevos, 50 en total) |
| Runtime con I/O | `apps/api/src/confidence-engine.ts` |
| Job | `apps/worker/src/confidence-once.ts` + `.github/workflows/confidence-engine.yml` |
| Lectura del consultor | `listConsultantConfidence()` + `GET /v1/consultant/confidence` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/confidence-view-model.ts` (11 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/confidence-panel.tsx` |

**Sin migracion**, como `D04` y `D10`: el esquema esta puesto desde el
2026-09-22.

### Decisiones

**La confianza no es del caso, es de cada afirmacion.** Es la idea entera del
bloque. Se puede saber con certeza que las ventas cayeron (capa `what`,
observado) y no tener ni idea de por que (capa `why`, desconocido), y las dos
cosas a la vez son lo normal, no una contradiccion. Colapsarlas en "confianza
media" borra justo la informacion que sirve: te dice cuanto fiarte, pero no de
que. Por eso el motor escribe **una fila por capa** y la pantalla las ensena
todas juntas.

**Sin formula, como todo en esta fase.** No hay media ponderada de dimensiones
ni de capas. La unica derivacion es el techo (`capped_at`), y sale de una regla
declarada y no de un umbral: **una afirmacion no puede ser mas firme que aquello
en lo que se apoya**. Si `D01` no se fia del dato, ninguna lectura construida
sobre ese dato se fia mas. En la corrida real se vio funcionando: sin evaluacion
de `D01`, las capas `what` y `where` --que eran `observed`-- bajaron a `low`
solas.

**La global no se promedia: hereda el techo de la causa.** No es un umbral
inventado, es la definicion de D00 -- un diagnostico es una explicacion, y una
explicacion sin causa no es un diagnostico. Mientras `why` sea
`insufficient_data`, `overall` tambien lo es, y el motivo va escrito en
`cap_reason`.

**"No lo se" y "no lo hay" son tres estados, no dos** (guardrail 8). Sin senal,
la capa `what` sale con `negative_claim_state = no_evidence`, no
`evidence_of_no_problem`: decir que no hay problema sin haber mirado es afirmar
una ausencia que nadie ha comprobado. Y `evidence_of_stability` exige ademas
medicion completa y observada. La mutacion deliberada fue justo esta, y rompio
su test.

**Cada nivel tiene su formula de lenguaje**, no un sinonimo elegante (guardrails
43 a 46). `calibratedPhrase()` devuelve "no puede determinarse si" / "es
compatible con que" / "la explicacion mas probable es que" / "la evidencia
sostiene con solidez que". Cambiar esas frases es descalibrar el lenguaje, y hay
un test que comprueba que **ninguna de las cuatro** dispara el lint de certeza
del guardrail 47 -- incluida la mas alta.

**Un mecanismo ausente no es un mecanismo debil.** Cuando dos metricas coinciden
en el tiempo sin relacion declarada, la dimension `mechanism_strength` sale
`absent`, no `weak`. Es la diferencia entre "el mecanismo es flojo" y "no hay
ningun mecanismo", y en pantalla se pintan distinto.

**Se reescribe entero, no se hace upsert.** La constraint unica del esquema es
(caso, capa, sujeto, **texto del claim**) y `subject_id` va nulo: en Postgres
dos nulos no colisionan, asi que un upsert insertaria una fila nueva en cada
pasada. La lectura de un caso se borra y se vuelve a escribir, y el
`on delete cascade` se lleva sus dimensiones, techos e incertidumbres. Es la
foto de hoy; media foto vieja mezclada con media nueva no la sostiene nadie.

**La falta de grafo causal se registra como `critical_unknown`**, enlazada a la
capa `why` y con lo que la resolveria escrito. El guardrail 33 no deja dejarla
caer sin decir a que afecta, y esa exigencia del esquema convierte la deuda mas
grande de la fase en una fila consultable en vez de una nota en un markdown.

### Dos fallos que encontro la corrida real

1. **`explanatory_coverage` no admite `not_applicable` ni `none`.** Solo
   `full` / `partial` / `minimal` / `unknown`. Lo corregi con criterio, no por
   compilar: en las capas descriptivas el eje no aplica y `unknown` no afirma
   nada; en las causales si se sabe cuanto explican --nada-- y eso es `minimal`,
   que es el suelo del vocabulario.
2. **`confidence_dimensions` y `confidence_caps` exigen `organization_id`** y yo
   solo pasaba `claim_id`. Siete capas escribieron bien y sus dimensiones no.

Las dos las caza el esquema, no un test: es el argumento entero a favor de
escribir el contrato antes que el motor.

### Verificacion

- **Corrida real** en test sobre un caso abierto con senal: **7 capas, 1
  incertidumbre critica, 3 causas sin resolver**. Segunda pasada identica (se
  reescribe, no duplica). Datos borrados: las seis tablas a cero.
- La herencia del techo se vio sobre datos: sin `D01`, `what` y `where` bajaron
  de `high` a `low` solas, con el motivo escrito.
- **Mutacion deliberada**: que la ausencia de senal se lea como
  `evidence_of_no_problem` rompe su test y solo el suyo. Revertida.
- 24 tests nuevos (50 en `confidence.test.ts`, 275 en la web), suite completa y
  typecheck de los cuatro workspaces en verde.

### Lo que quedo fuera, a proposito

- **`confidence_history`** — la tabla existe y nadie la escribe. Responderia
  "¿por que ayer estabamos mas seguros?", y para eso hace falta comparar dos
  pasadas, que es trabajo de otro dia.
- **`knowledge_applicability`** — califica si un conocimiento externo aplica a
  esta tienda. No hay conocimiento externo que calificar todavia.
- **Las capas `signal`, `future_impact`, `severity` y `forecast`** — o las
  cubre otra capa que ya se escribe, o dependen de bloques sin motor.
- **La composicion de la frase final** (guardrails 43 a 47 al completo) — hoy
  `calibratedPhrase()` da la formula y nadie la usa para redactar: eso es `D14`.
  Hasta entonces el lint de lenguaje cubre la mitad del guardrail, y conviene
  saberlo.

---

## `D07` — Motor y pantalla · **hecho** 2026-10-06

El bloque que llevaba tres semanas atascado, y no por el codigo: **el grafo
estaba vacio**. La migracion `20260918090000` dejo cinco tablas y cero filas, y
un grafo sin aristas no se recorre. Desatascarlo fue declarar el conocimiento,
igual que D06 hizo con `metric_dependencies` y D04 con `health_references`.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Semilla del grafo global | `supabase/migrations/20261017090000_f3_d07_grafo_causal_semilla.sql` |
| Motor puro | `exploreCausalPaths()` y compania en `packages/contracts/src/causal.ts` |
| Tests | `packages/contracts/src/causal.test.ts` (13 nuevos) |
| Runtime con I/O | `apps/api/src/causal-engine.ts` |
| Job | `apps/worker/src/causal-once.ts` + `.github/workflows/causal-engine.yml` |
| Lectura del consultor | `listConsultantCausalPaths()` + `GET /v1/consultant/causal-paths` |
| Declarador | `createConsultantCausalEdge()` + `POST /v1/consultant/causal-edges` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/causal-view-model.ts` (8 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/causal-paths.tsx` |

### Decisiones

**Una rama sin senal solo esta contradicha si esa metrica se mira.** Es la
contribucion real del bloque y la regla que ordena el motor entero.

Si las ventas caen y los pedidos aguantan, la rama de pedidos esta contradicha:
se miro, no se movio, y lo que se hundio es el ticket. Eso es un hallazgo, y
descarta media busqueda de un golpe. Pero si las ventas caen y no hay senal de
`sessions`, esa rama **no** esta contradicha: es que nadie mide las sesiones.
Tratar las dos ausencias igual convierte "no lo se" en "no lo hay" y poda la
rama correcta por el motivo equivocado. Por eso `measuredMetrics` es un
parametro del motor y no una constante, y por eso D05 exporta
`METRICAS_VIGILADAS`.

**Seis nodos y cinco aristas, y cuatro de las cinco son aritmetica.** Es poco
para un grafo causal del ecommerce, y es exactamente lo que se puede sostener
con las metricas que la plataforma lee hoy. Declarar mas seria inventar. Las
aritmeticas no son un relleno: `relation_type = 'mathematical'` existe para
esto, sirven para **acotar la busqueda** --si las ventas cayeron, o cayeron los
pedidos o cayo el ticket, no hay tercera opcion-- y el guardrail 4 mas
`checkCausalInvariants` impiden que una ruta hecha solo de ellas se presente
como explicacion. El motor lo escribe el mismo en `missing_evidence`.

**El unico calculo de magnitud sale de una identidad, no de un umbral.** Para una
arista aritmetica se puede preguntar de que parte del movimiento da cuenta el
factor: es el cociente de los dos movimientos relativos. El 1 no es un corte
elegido --es "explica el movimiento entero"-- y el 0 tampoco --es "se movio al
reves". Donde no hay identidad (`ad_spend -> sessions`) no hay cuota que
calcular y el encaje se queda `untested`. Poner ahi un corte seria el umbral
inventado que el guardrail 11 de D04 prohibe.

**Del encaje temporal solo se comprueba la flecha del tiempo.** Si el efecto
empezo antes que la causa candidata, esa causa no explica el arranque
(guardrails 19 y 20) y el paso queda `contradicted`. Lo que **no** se comprueba
es si el retardo observado se parece al esperado: para eso haria falta una
tolerancia, la fuente no la da, e inventarla seria decidir por ella. El retardo
se guarda en `observed_lag_days` para que se vea.

**`sessions` y `conversion_rate` se declaran `observed_metric` a proposito.**
Salen del tracking de la tienda, y un fallo de tracking las mueve sin que se
mueva el negocio. Esa etiqueta es lo que hace saltar los guardrails 37-39 en
cuanto una ruta pase por ellas sin validar la medicion. `net_sales`,
`orders_count` y `ad_spend` no: salen del registro de pedidos y de la
facturacion del anunciante, que son el sistema de registro y no una medida
indirecta.

**Ninguna ruta llega a `supported` hoy, y no es un fallo del motor.** El
guardrail 50 dice que una ruta con huecos declarados no esta soportada, y siempre
queda uno: nadie ha revisado los confusores de D02 contra ninguna ruta. Que eso
sea asi es el estado real de la cadena, y escribirlo es lo que impide leer un
caso descrito como un caso explicado.

**El declarador es la mitad del bloque.** Sin el, la pantalla es una lista de
"nadie mide eso" que no se puede arreglar desde ningun sitio -- exactamente lo
que le pasaba a D04 antes de tener el suyo. Lo declarado entra como
`expert_heuristic` con `plausible`, no como conocimiento establecido: el
guardrail 45 le pone entonces techo y el 44 impide que ascienda a arista global.
Lo que sabe un consultor vale; vale como lo que es. Y el formulario **no deja
elegir el nivel de evidencia**, que seria dejarle firmar su propio certificado.

**En pantalla, las rutas contradichas van primero.** Es contrario a la
intuicion. Lo normal seria enterrarlas y subir la que mejor encaja; hoy eso seria
al reves de lo util, porque ninguna esta sostenida y lo unico que el bloque sabe
de verdad es donde **no** esta el problema. Y no se ordena por confianza: quien
lee el primero de una lista entiende que es el bueno, y el guardrail 48 dice que
D07 no prioriza.

### Dos fallos que encontro la corrida real, no un test

Los dos son el mismo error a dos alturas: **decir algo distinto de lo que paso**.

1. La rama salia descartada **por tiempo** (la caida de ventas empezo el 1 y la
   de pedidos el 3) y el `next_evidence` hablaba de magnitud: "que explica el
   resto del movimiento". Mandaba a mirar donde no era. Ahora lo primero que se
   nombra es lo que rompio la ruta, y la pregunta es la util: que se movio en los
   dos dias en que el efecto ya caia y la causa aun no.
2. La evidencia iba marcada `contradicting` con un texto de apoyo -- la etiqueta
   cambiada y la frase igual. Ahora la observacion dice **por que** contradice.

### Verificacion

- **Corrida real** en test sobre un caso abierto con dos senales. Primer
  escenario (arranques desalineados): **2 rutas, 1 contradicha por tiempo, 1 sin
  probar**. Segundo escenario (arranques alineados): **3 rutas, 5 pasos**, y el
  recorrido sube solo a `sessions` y `conversion_rate` porque la rama de
  pedidos deja de estar podada.

> **Corregido el 2026-10-06, al implementar `D08`.** Aqui ponia que la segunda
> pasada era identica. **No lo era.** Comprobe lo que devolvia el motor --"3
> rutas" las dos veces-- y no lo que quedaba en la tabla, que eran seis. El
> borrado previo fallaba en silencio por una contradiccion del esquema
> (`source_path_id` era `on delete set null` contra un check que prohibe el
> nulo), y el motor no mira el error del `delete`. Arreglado en la migracion
> `20261021090000`, y **reverificado contando filas**: 3 rutas, 5 pasos, 4
> hipotesis, 4 tests, estable entre pasadas.
>
> La leccion no es la del bug: es que **"el motor devuelve lo mismo" no es
> idempotencia**. Devolver lo esperado es justo lo que hace un motor que
> duplica.
- La poda se vio funcionando sobre datos: con la rama de pedidos contradicha,
  **nadie sube a sesiones**. Con ella en pie, sube. Es el paso 5 del runtime.
- **Mutacion deliberada**: que una metrica sin vigilar se lea como contradicha
  rompe tres tests, incluido el que lleva el nombre de la regla. Revertida.
- Datos sembrados borrados: rutas, pasos, evidencia, senales y casos a cero. El
  grafo global (6 nodos, 5 aristas) queda, que es su sitio.
- Migracion en **test y produccion**.
- 21 tests nuevos. Suites: **538 contratos / 377 api / 283 web / 24 worker**,
  typecheck limpio en los mios.

### Lo que quedo fuera, a proposito

- **`limits`, `requires` e `interaction`** — el esquema los admite y el motor no
  los recorre (paso 9 del runtime). Ofrecerlos en el formulario seria prometer
  algo que no pasa, asi que no estan.
- **Los confusores de D02** — la tabla existe y el motor no la consulta; se
  declara como hueco en cada ruta en vez de fingir que se reviso.
- **El recorrido hacia delante** (seccion 3 del runtime) — validar una causa
  candidata mirando si aparecen sus efectos aguas abajo. Necesita mas series de
  las que hay.
- **`causal_paths.symptom_id` se escribe, pero casi siempre nulo** — depende de
  que D06 haya enlazado la senal a un sintoma.

---

## `D08` — Motor y pantalla · **hecho** 2026-10-06

Convierte cada ruta candidata de D07 en una hipotesis **explicita**: con su
estado, lo que la falsaria y el siguiente dato que la despejaria.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Motor puro | `generateHypotheses()` y compania en `packages/contracts/src/hypotheses.ts` |
| Tests | `packages/contracts/src/hypotheses.test.ts` (12 nuevos) |
| Runtime con I/O | `apps/api/src/hypothesis-engine.ts` |
| Job | `apps/worker/src/hypothesis-once.ts` + `.github/workflows/hypothesis-engine.yml` |
| Lectura del consultor | `listConsultantHypotheses()` + `GET /v1/consultant/hypotheses` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/hypotheses-view-model.ts` (10 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/hypotheses.tsx` |
| Migracion correctora | `supabase/migrations/20261021090000_f3_d08_hipotesis_siguen_a_su_ruta.sql` |

### Decisiones

**D08 no elige: enumera y descarta.** El guardrail 1 dice que la primera causa
plausible no es un diagnostico y el 12 que el challenger vive mientras haya
incertidumbre material; un motor que devolviera "la explicacion es X" rompe los
dos a la vez. Ninguna hipotesis sale afirmada --el techo es `under_test`-- y
ninguna lleva `relative_role = 'primary'`, porque el esquema exige entonces
decir por que gana y por que pierden las otras, y no hay con que.

**Las descartadas se guardan con su motivo, y eso es medio bloque.** "Los pedidos
no lo explican, porque las ventas empezaron a caer antes" es un resultado. Sin
escribirlo, dentro de un mes alguien vuelve a mirar los pedidos porque se le
olvido que ya se habian mirado. La pantalla las ensena abajo con el motivo
delante, no las filtra. Y no se les propone test: gastar en comprobar lo ya
descartado es el gasto mas facil de evitar.

**La hipotesis de que no haya pasado nada se escribe sola.** Siempre que alguna
ruta pase por una metrica que sale del tracking, el motor anade
`data_quality_explanation` con `relative_role = 'challenger'`: puede que las
sesiones no hayan caido y solo se haya roto la medida. Esa explicacion **no sale
de ninguna ruta causal** --no la hay, y por eso `source_path_id` va nulo-- y es
la unica que puede tumbar a todas las demas de golpe. Si dependiera de que
alguien se acuerde, no estaria nunca; por eso la escribe el motor. En pantalla va
arriba del todo: leerla despues de estudiar cinco explicaciones es leerla tarde.

**El prior y la confianza son dos columnas y se dicen por separado** (guardrail
2). El prior sale del `evidence_level` **declarado en la arista** --lo que suele
pasar-- y la confianza, de lo que se ha comprobado en este caso. Una identidad
aritmetica tiene prior alto y confianza baja a la vez, y las dos cosas son
ciertas. Fundirlas en un indicador es como se acaba afirmando que una tienda
tiene un problema porque el libro dice que suele pasar.

**Ninguna explicacion llega a completa.** Aunque el factor de cuenta del
movimiento entero, **por que se movio el factor** sigue sin explicarse, asi que
el residual siempre es material y se escribe en `residual_note`. El check
`cobertura_vs_residual` no dejaria decir otra cosa.

**Lo que nadie ha mirado entra como `not_observed` + `inconclusive`**
(guardrail 5). No es evidencia en contra, y en pantalla va en su propia lista:
en la misma que lo observado, un hueco cuenta como si fuera un hallazgo. La
mutacion deliberada fue justo esta.

**El test dice de donde sale el dato, y eso manda sobre que dato es** (guardrail
47). `available` y `needs_integration` piden acciones de personas distintas, y
verse iguales manda al consultor a molestar al cliente por algo que la plataforma
ya tiene. Cuando falta la serie, el motor dice `needs_integration` y no
`needs_user`: no hay que preguntarle a nadie, hay que conectar una fuente.

### Tres fallos que encontro la corrida real

Los dos primeros los canto el esquema; el tercero, la pantalla.

1. **`target_node_id` es la causa propuesta, no el sintoma.** Yo le puse el
   target del caso, y entonces las tres ramas parecian la misma hipotesis
   contada tres veces -- que es exactamente lo que canta el invariante
   `doble_conteo` (guardrails 41 y 42). Lo confirma el guardrail 43: la regla
   comprueba que una candidata a raiz no apunte a una metrica de resultado, y eso
   solo tiene sentido si la columna guarda la causa.
2. **Tres bloques le dan tres nombres al negocio entero**: `business_global` en
   D00, `business` en D07, `global` en las senales de D05. Cada esquema es
   coherente consigo mismo, pero hay que traducir al cruzarlos. Ahora se hace en
   una funcion con nombre (`alcanceDelCaso`) en vez de descubrirlo en un check.
3. **La frase aplanaba las cadenas de dos saltos.** Decia que las sesiones entran
   en la formula de las ventas. Entran en la de los **pedidos**, y los pedidos en
   la de las ventas. Aplanarlo inventa una relacion directa que nadie declaro, y
   lo vi leyendo la salida real, no en un test.

### Y uno que llevaba tres semanas escondido en el esquema

`diagnostic_hypotheses.source_path_id` se creo en D07 con `on delete set
null`. D08 anadio despues el check `causal_exige_ruta`, que prohibe ese nulo en
una hipotesis causal. Juntos hacen **imposible borrar una ruta** en cuanto algo
se apoye en ella: Postgres pone el nulo, el check lo rechaza, y la transaccion
entera se cae en silencio.

El sintoma fue que las rutas de D07 se acumulaban --tres por pasada-- sin que
nadie lo notara, porque el motor seguia devolviendo "3 rutas" y eso es justo lo
que uno espera leer.

**La correccion es `cascade`, no relajar el check.** El check tiene razon: una
hipotesis causal sin ruta no es una hipotesis a la que le falta un campo, es una
afirmacion causal sin nada detras. Lo que estaba mal era suponer que la hipotesis
sobrevive al razonamiento que la produjo. La misma trampa estaba puesta en
`root_causes.causal_path_id` y se arreglo en la misma migracion, antes de que
D09 la descubra desde el otro lado.

### Verificacion

- **Corrida real** en test, encadenando D07 y D08 sobre un caso abierto.
  Escenario con la cadena en pie: **3 rutas -> 4 hipotesis, 4 tests, 1
  challenger**. Escenario con una rama contradicha: **2 rutas -> 2 hipotesis, 1
  descartada con su motivo escrito y sin test propuesto**.
- **Idempotencia comprobada contando filas**, no por lo que devuelve el motor:
  3 rutas, 5 pasos, 4 hipotesis, 4 tests, 6 evidencias, estable entre pasadas.
- La rama sin serie escribio `not_observed` + `inconclusive`, que es el
  guardrail 5 funcionando sobre datos reales.
- **Mutacion deliberada**: que el hueco de una rama sin medir cuente como
  `contradicts` rompe su test y solo el suyo. Revertida.
- Datos sembrados borrados: rutas, hipotesis, tests, evidencia, senales y casos a
  cero. El grafo global queda.
- Migracion en **test y produccion**.
- 22 tests nuevos. Suites: **551 contratos / 382 api / 293 web / 25 worker**,
  typecheck limpio en los cuatro workspaces.

### Lo que quedo fuera, a proposito

- **`hypothesis_status_history`** — la tabla existe y nadie la escribe.
  Responderia "¿por que ayer esta hipotesis estaba viva?", y para eso hay que
  comparar dos pasadas.
- **Ejecutar los tests** — se proponen y se quedan en `proposed`. Ejecutarlos
  es leer datos que en su mayoria no existen todavia.
- **`interaction_hypothesis`** — necesita aristas con `interaction_group`, y
  el grafo global no declara ninguna.
- **La deteccion de doble conteo entre familias** (guardrails 41 y 42) — el
  invariante la comprueba, el motor no la provoca porque cada ruta apunta a un
  nodo distinto.

---

## `D09` — Motor y pantalla · **hecho** 2026-10-06

Cierra la cadena causal que abrio D07: convierte las hipotesis vivas de D08 en
una conclusion calibrada, y evalua por separado que capacidad podria estar
limitando el objetivo. Es el unico bloque de la fase autorizado a cerrar una
causa -- y aun asi casi nunca cierra nada, porque la evidencia de hoy no da
para mas.

### Que se ha construido

| Pieza | Donde |
| --- | --- |
| Motor puro (causa raiz) | `generateRootCauses()` y compania en `packages/contracts/src/root-cause.ts` |
| Motor puro (constraint) | `generateConstraintCandidates()`, mismo fichero |
| Tests | `packages/contracts/src/root-cause.test.ts` (13 nuevos) |
| Runtime con I/O | `apps/api/src/root-cause-engine.ts` |
| Job | `apps/worker/src/root-cause-once.ts` + `.github/workflows/root-cause-engine.yml` |
| Lectura del consultor | `listConsultantRootCauses()` + `GET /v1/consultant/root-causes` |
| Decisiones de pantalla | `apps/web/src/app/shopify/diagnostico/root-cause-view-model.ts` (10 tests) |
| Panel | `apps/web/src/app/shopify/diagnostico/root-cause.tsx` (dos tarjetas) |

**Sin migracion**: el esquema de `root_causes`, `root_cause_chain`,
`business_constraints` y `constraint_tests` esta puesto desde el 2026-09-20.

### Decisiones

**Casi todo llega `unresolved` o `latent`, y no es un techo del motor.** Es el
estado real de los datos que hoy existen. La evidencia de D07-D08 es siempre
co-movimiento (`correlation_only`), y el guardrail 15 prohibe cerrar una causa
con eso -- `probable` y `confirmed` quedan fuera de alcance mientras esa
evidencia no cambie. La plataforma no mide capacidad ni demanda de ninguna
capacidad, y los guardrails 29 y 31 prohiben declarar un cuello vinculante sin
las dos. Cerrar mas hoy seria mentir; cuando esos datos existan, el motor
cerrara mas sin que haga falta tocarlo.

**La regla del eslabon mas debil, hecha literal.** Si algun tramo de la cadena
tiene `case_support = 'untested'` -- nadie mide esa metrica -- la cadena entera
se queda en `unresolved` con confianza `insufficient`, por fuerte que sea el
resto. `partial_root_cause` es la conclusion mas fuerte que hoy se puede
sostener, y solo cuando la cadena se ha medido entera.

**El origen es siempre causa inmediata, nunca raiz.** El guardrail 9 exige
profundidad y evidencia para llegar a `root_cause`, y hoy nunca hay mas alla de
una serie que se movio a la vez. Etiquetarlo `root_cause` seria afirmar una
busqueda que no se hizo. `structural_driver` tampoco se usa nunca hoy, por el
mismo motivo.

**D09 no elige, igual que D07 y D08: una fila por candidata viva, no una
"ganadora".** El rol `primary` solo se usa con una sola candidata sobre la
mesa; con varias, todas quedan `contributing`, porque D08 ya establecio que la
separacion es baja y nombrar una "primaria" seria fingir un criterio que no
existe.

**Causa raiz y constraint son dos pipelines sin clave ajena entre si**
(apartado 23). El primero lee las hipotesis de D08; el segundo, la salud por
capacidad de D04. Ninguno referencia al otro, porque las cuatro combinaciones
tienen que poder existir: causa resuelta con constraint activo, constraint
resuelto con un driver estructural que sigue ahi. En pantalla son dos tarjetas
separadas por el mismo motivo.

**El desafiante de la medicion (H`n` de D08, `data_quality_explanation`)
tambien se convierte en causa raiz candidata**, marcada
`affects_observability_only`. No se resuelve nunca sola -- sigue `unresolved`
como las demas -- pero aparece en la lista con la misma seriedad que el resto,
porque si es cierta, ninguna de las otras hace falta.

**Cada candidata a cuello trae el test que haria falta correr, aunque hoy nadie
lo pueda ejecutar.** `binding_status` sale siempre `latent`, pero
`counterfactual_question`, `expected_if_binding` y `expected_if_not_binding`
quedan escritos: declarar la capacidad y la demanda el dia de manana es
rellenar un hueco, no empezar de cero.

### El fallo que encontro la corrida real, no un test

**`exploreCausalPaths` de D07 nunca emitia la explicacion corta por si sola.**
El recorrido solo emitia una cadena cuando ya no quedaba nada mas arriba que
explorar, asi que "los pedidos explican la mitad, con encaje temporal y de
alcance perfectos" -- un paso, totalmente medido -- se diluia siempre en su
extension hacia "sesiones", que nadie mide. El resultado visible: D09 nunca
llegaba a `partial_root_cause`, porque la version bien sostenida de la
explicacion jamas existia como ruta propia.

Se vio corriendo D07 encadenado con D09 sobre datos reales, no en un test
aislado -- ninguno de los dos bloques por separado lo habria delatado. La
correccion esta en `packages/contracts/src/causal.ts`: el recorrido emite la
cadena tal como esta **antes** de intentar extenderla, no solo al llegar a un
callejon sin salida. Es el paso 15 del runtime de D07 ("mantener alternativas")
tomado en serio: la explicacion corta y sostenida es una alternativa a la
extension mas larga, no un paso intermedio que se descarta.

### Verificacion

- **Corrida real encadenando D07, D08 y D09** en test sobre un caso abierto con
  dos senales (ventas y pedidos, misma ventana). Antes de la correccion: **4
  causas raiz, 0 parciales, 4 sin resolver**. Despues: **5 causas raiz, 1
  parcial (`RC1`: "pedidos" con la cadena entera medida), 4 sin resolver** --
  y las dos extensiones hacia sesiones y tasa de conversion siguen sin
  resolver, correctamente, porque nadie las mide todavia.
- **Idempotencia comprobada contando filas**: 5 causas, 1 parcial, 1 cuello
  candidato, estable entre pasadas.
- El pipeline de constraint se probo con una capacidad (`inventory`) marcada
  `bad` en `capability_health`: escribio una candidata `latent` con su test
  `pending`, nunca `binding`.
- **Mutacion deliberada**: dejar que una cadena medida y de cobertura parcial
  llegara a `probable` en vez de `partial_root_cause` rompe su test **y**
  `checkRootCauseInvariants` (guardrail 15) a la vez. Revertida.
- Datos sembrados borrados: causas, cadena, constraints, tests, hipotesis,
  rutas, salud, senales y casos a cero. El grafo global (6 nodos, 5 aristas)
  queda.
- 23 tests nuevos entre motor y pantalla. Suites: **565 contratos / 414 api /
  303 web / 26 worker**, typecheck limpio en los cuatro workspaces. Sin
  migracion.

### Lo que quedo fuera, a proposito

- **`no_business_constraint`** -- la columna existe en `diagnostic_cases`
  desde D09 (`no hay constraint relevante, y aqui esta el motivo`), pero es una
  declaracion del consultor, no algo que el motor pueda decidir por si solo. No
  se construyo el formulario: el motor de constraint ya hace la mitad del
  trabajo (enumerar candidatas), y declarar "ninguna limita" exige haber
  revisado la lista, que es un juicio humano.
- **Recurrencia** -- `root_causes.recurrence` se escribe siempre `unknown`. El
  paso 5 del runtime pide comparar con casos anteriores similares, y eso
  necesita una busqueda historica que no existe todavia.
- **El recorrido hacia delante de D07** (validar una causa mirando si aparecen
  sus efectos aguas abajo) seguia sin motor, y D09 tampoco lo necesita para lo
  que hoy puede cerrar.
- **Capacidad y demanda medidas** -- es el hueco mas grande de los dos
  pipelines. Sin ellas, `binding_status` no puede salir nunca `binding`, por
  mucho que una capacidad este objetivamente mal.

---

## Audiencia: que vera cada vista de esta fase

Añadido 2026-09-14 despues de `D00`, `D01` y `D02`. Los tres se cerraron con RLS
de staff **por inercia** — cada uno copio la decision del anterior sin criterio
escrito. Esta tabla es la deuda saldada y el molde para los que vengan: se
rellena al implementar el bloque, no despues.

Criterio general en el apartado 9 del
[plan maestro](../../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md): el consultor
lo ve todo, el cliente ve lo accionable o lo ya resuelto, platform_admin ve el
agregado.

| Bloque | Cliente | Consultor | platform_admin | Donde aterriza |
| --- | --- | --- | --- | --- |
| `D00` casos diagnosticos | **nada mientras el caso este abierto.** Un caso `open` o `investigating` es razonamiento a medias: hipotesis sin contrastar y evidencia sin pesar. Cuando concluya, el resumen (`summary`), nunca las hipotesis descartadas | **todo**: hipotesis vivas y descartadas con su motivo, evidencia a favor y en contra, data gaps. Es el destinatario primario | cuantos casos concluyen, cuantos quedan `inconclusive`, que invariantes saltan. Salud del motor, no el caso | consultor: modulo nuevo o ampliacion de `/shopify/diagnostico`. Cliente: el resumen, en su propio panel |
| `D01` calidad de datos | **los issues que puede arreglar el, ya verificados** (`client_actionable` y `status <> 'open'`). Decidido 2026-09-14, migracion `20260914213000` | todo: evaluaciones, issues, reconciliaciones entre fuentes | que fuentes fallan **en toda la cartera**. Un `permission_gap` en 12 clientes es un problema de producto, no de 12 clientes | cliente: aviso en su panel y en `/integraciones`. Consultor: `/integraciones` (ya existe `store-scope-card`, que hoy hace esto a mano para Meta y Klaviyo). platform_admin: `/admin/observabilidad` |
| `D03` madurez por capacidad | **nada.** "Tu capacidad de retencion es AD_HOC" sin contexto ni acompanamiento es un juicio, no una ayuda. Cuando haya pantalla y redaccion para ensenarselo bien, se revisa | **todo**: nivel, nivel requerido, evidencia y su rango, dependencias. Es material de conversacion, no un informe que se envia | distribucion de madurez en la cartera: donde se atascan los clientes es una senal de producto | consultor: ficha del cliente y `/camino`, que es donde `a19_arquitecto_camino` ya razona sobre etapas |
| `D04` salud por capacidad | **los fallos de sus sistemas que le tocan a el**, cuando esten confirmados — misma regla que `D01`. El estado de una capacidad ("tu operativa esta BAD") no: es una etiqueta sin la conversacion que la acompana | **todo**: estado, trayectoria, riesgo estructural, evidencia positiva y en contra, hallazgos con su severidad | que capacidades fallan en la cartera y cuantas lecturas quedan `not_assessable` — esto ultimo mide la cobertura real de datos, no la salud de los clientes | consultor: panel del cliente, junto a la madurez de `D03`. platform_admin: `/admin/observabilidad` |
| `D05` senales | **nada.** El guardrail 2 lo dice entero: no toda senal es un problema. Ensenarle al cliente cada desviacion convierte el panel en una alarma permanente | **todo**, y es lo primero que mira: que ha cambiado, cuanto, desde cuando y con que solidez estadistica | cuantas senales se generan por organizacion y cuantas se suprimen — es la medida de si el motor esta calibrado o hace ruido | consultor: modulo de senales y entrada al diagnostico. platform_admin: `/admin/observabilidad` |
| `D14` salida diagnostica y validacion | **esto es literalmente lo que ve**: el resumen calibrado, lo que se sabe, lo que no se sabe y las limitaciones. Solo las filas marcadas `user_visible`, y con la entradilla que corresponde a la confianza -- ni una palabra mas fuerte | **todo**: el ledger de evidencia con la contradictoria incluida, los once validadores, el gate de finalizacion condicion por condicion, las versiones y por que cambio cada una | cuantas salidas llegan a `finalized_valid` (si son pocas, el gate esta haciendo su trabajo), tasa de reapertura, tasa de invalidacion, y cuantas se quedan en `insufficient_data` | cliente: su panel, solo `user_visible`. Consultor: la salida entera. platform_admin: `/admin/observabilidad`, el diff entre versiones del apartado 24 |
| `D13` diagnostico temporal y regresion | **mucho, y es de lo mas util que va a ver**: cuando empezo, si va a mejor o a peor, si ya habia pasado antes y si se esta recuperando. Con la precision real del onset, no una hora inventada | **todo**: los tres horizontes con sus conflictos, el encaje de lags, los episodios anteriores, el estado del baseline y el historico de revisiones | cuantos casos tienen `temporal_sufficiency` insuficiente (es deuda de historia), cuantos baselines quedan congelados por incidentes abiertos, y cuantos regimenes nuevos se promueven -- si son muchos, alguien esta normalizando lo roto | cliente: su panel, estado y trayectoria como dos cosas. Consultor: la evaluacion entera. platform_admin: `/admin/observabilidad` |
| `D12` confusores y falsos diagnosticos | **casi nada, y es correcto**: como mucho, que el diagnostico se expresa despues de ajustar un factor (apartado 14) y las limitaciones que quedan. La lista de confusores descartados no le aporta | **todo, y es su vista mas util**: que se comprobo, que se descarto y con que evidencia, el diagnostico antes y despues, y la contraexplicacion del red team | cuantos diagnosticos mueren en D12 (si son cero, D12 no esta funcionando), cuantos checks obligatorios quedan sin ejecutar y que confusores se repiten entre casos -- esos son deuda de datos, no mala suerte | cliente: solo la nota de ajuste. Consultor: la revision entera. platform_admin: `/admin/observabilidad`, el antes y el despues del apartado 19 |
| `D11` confianza e incertidumbre | **el matiz de todo lo anterior**: con que seguridad se afirma cada cosa y que la limita, en las palabras del guardrail 43 al 46 ("la explicacion mas probable", "compatible con", "no puede determinarse"). Nunca un porcentaje | **todo**: la matriz por claim, las dimensiones con su motivo, los techos y de donde vienen, los critical unknowns y el historico de por que cambio cada confianza | cuantos claims llegan a `high` (deberian ser pocos), cuantos se quedan en `insufficient_data`, que caps se repiten (son deuda de datos) y si el lenguaje va por encima de la confianza | cliente: su panel, el nivel y la limitacion concreta. Consultor: la matriz entera. platform_admin: `/admin/observabilidad`, y sobre todo los caps repetidos |
| `D10` severidad e impacto | **la cifra y el alcance, no el orden**: cuanto dano, sobre que parte del negocio y con que confianza. Con rangos cuando son rangos y con UNKNOWN cuando no se puede medir (guardrails 23 y 28). Nunca una prioridad, porque `D10` no la tiene | **todo**: el perfil de cinco severidades, el vector por dimension con su capa de evidencia, los denominadores descartados, la propagacion y el estado de los colchones | cuantos casos llegan a `business_threat` (deberian ser rarisimos), cuantos cierran con cuantificacion `unknown`, y si la global se despega del perfil | cliente: su panel, la severidad global y el impacto observado. Consultor: la evaluacion entera. platform_admin: `/admin/observabilidad` |
| `D09` causa raiz y constraints | **aqui si, y es el primer bloque de la fase donde el cliente ve algo de peso**: la causa cuando esta cerrada y el cuello que le limita. Nunca las candidatas ni las descartadas, y con el lenguaje calibrado a la confianza que tenga (guardrail 46) | **todo**: la cadena entera de sintoma a driver estructural, las causas descartadas, el test contrafactual del cuello y lo que queda sin explicar | cuantas causas llegan a `confirmed` (deberian ser pocas), cuantas quedan `unresolved`, y cuantos casos se cierran sin cuello identificado | cliente: su panel, cuando la causa este cerrada. Consultor: la ficha del caso completa. platform_admin: `/admin/observabilidad` |
| `D08` hipotesis | **nada mientras el caso este abierto**, que es la misma regla que fijo `D00`. Una hipotesis es una explicacion a prueba; ensenarla es convertir una duda en un anuncio | **todo, y es el centro de su trabajo**: que hipotesis vivas hay, que las sostiene, que las contradice, que test toca hacer y que las falsaria | cuantas llegan a `confirmed` (deberian ser pocas), cuantas quedan `inconclusive` y **que agente propone hipotesis que luego se caen** — es la calibracion del guardrail 53 | consultor: panel de hipotesis del caso, con su ledger. platform_admin: `/admin/observabilidad` |
| `D07` grafo causal | **nada.** Ensenarle a un cliente una ruta causal sin confirmar es darle una explicacion que aun no lo es. El guardrail 1 lo dice entero: plausible no es probado | **todo, y es donde razona**: rutas rivales, que sostiene cada una, que la contradice, que falta por comprobar y que dato lo discriminaria | cuantas rutas quedan `untested` y cuantas se sostienen solo en correlacion — mide si el grafo sirve para algo o solo acumula aristas | consultor: explorador del grafo desde un sintoma de `D06`. platform_admin: `/admin/observabilidad` |
| `D06` sintomas | **nada todavia.** Un sintoma es una interpretacion a medio camino: ya no es una cifra pero aun no es una explicacion ni algo que pueda accionar. Lo que el cliente vera es lo que salga al final de la cadena, no esto | **todo, y es su herramienta de trabajo**: el patron, las senales que lo sostienen, las que lo contradicen, la evidencia cualitativa y las relaciones candidatas entre sintomas | cuantos sintomas se forman por organizacion y cuantos se quedan en `surface` — mide si el motor esta descomponiendo o parandose en el resultado | consultor: mapa de sintomas por capacidad, junto a las senales de `D05`. platform_admin: `/admin/observabilidad` |
| `D02` contextualizacion | **el contexto declarado, si**: es suyo y deberia poder corregirlo. El observado y las contradicciones, no — que sus datos digan otra cosa que el es una conversacion del consultor, no un aviso automatico | todo, y sobre todo las contradicciones declarado/observado: son material de conversacion con el cliente | nada especifico | consultor: ficha del cliente en `/configuracion`. Cliente: onboarding y su perfil de negocio |

### Que agente consume cada bloque

Criterio en el apartado 10 del
[plan maestro](../../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md). Resumen: los
agentes son datos (`agent_definitions` + `agent_versions`), y `allowed_tools` es
lista blanca por version. **Un agente no puede leer una tabla que no tenga tool,
por mucho que exista y la RLS se lo permita.**

Estado 2026-09-14: **ninguno de los 24 agentes activos accede a ninguna de las
23 tablas de F3.** No hay tool que las lea, porque no hay filas que leer. El
punto de conexion es `D05`.

| Bloque | Agente que lo consumira | Tool que hara falta |
| --- | --- | --- |
| `D00` casos diagnosticos | `a09_copiloto_consultor` (el consultor pregunta "¿que le pasa a esta tienda?"); mas adelante `a04_generador_tareas`, que deberia partir de un diagnostico y no de las cifras crudas | `get_diagnostic_case` — el caso con su traza: hipotesis vivas y descartadas, evidencia, data gaps |
| `D01` calidad de datos | `a09_copiloto_consultor`, y **todo agente que cite una cifra**: es la diferencia entre "ha caido el CVR" y "ha caido el CVR medido, y la medicion esta degradada" | `get_data_quality` por fuente y periodo. Candidata a entrar en la lista de varios agentes a la vez, no solo del copiloto |
| `D03` madurez por capacidad | `a19_arquitecto_camino` antes que nadie: es el agente que disena el camino de un cliente y hoy razona sobre etapas sin un perfil estructurado detras. Tambien `a09_copiloto_consultor` | `get_maturity_profile` — niveles, nivel requerido y hallazgos con su interpretacion. **Nunca una nota**: el guardrail 11 lo prohibe y una tool que devuelva un 72/100 lo reintroduce por la puerta de atras |
| `D04` salud por capacidad | `a09_copiloto_consultor` (es la respuesta directa a "¿que le pasa a esta tienda?") y los cinco agentes de diagnostico por area (`a20`..`a26`), que hoy evaluan su parcela sin un estado compartido | `get_capability_health` — estado, trayectoria, riesgo y hallazgos. **Nunca un heatmap plano**: el guardrail 10 dice que un mapa de colores no es razonamiento, asi que la tool devuelve la evidencia, no solo el color |
| `D05` senales | `a09_copiloto_consultor`, y sobre todo `a04_generador_tareas`: hoy propone tareas leyendo cifras crudas y deberia partir de senales ya contextualizadas | `list_signals` — abiertas, no suprimidas, con su magnitud, exposicion y confianza. **Con la descripcion tal cual**: si la tool interpretara, se saltaria la frontera que el esquema protege |
| `D06` sintomas | `a09_copiloto_consultor` y los agentes de diagnostico por area (`a20`..`a26`): un sintoma ya contextualizado es mejor punto de partida que una lista de senales sueltas | `list_symptoms` — patron, scope, valencia, profundidad y las senales que lo sostienen **con las que lo contradicen**. Si la tool devolviera solo lo que encaja, reintroduciria por la puerta de atras el sesgo que el guardrail 13 impide en el esquema |
| `D07` grafo causal | `a09_copiloto_consultor` y, mas adelante, quien genere hipotesis (`D08`). Es la tool que convierte la pregunta «¿por que pasa esto?» en una busqueda acotada en vez de en una invencion plausible | `explore_causal_paths` — rutas hacia un target con su estado, su evidencia **y sus rivales**. Devolver solo la mejor ruta seria el guardrail 49 roto por la tool: el modelo dejaria de ver que habia alternativas |
| `D08` hipotesis | `a09_copiloto_consultor` y los agentes de area (`a20`..`a26`), que hoy proponen explicaciones sin que nada las contraste. Aqui empiezan a someterse al mismo estandar (guardrail 52) | `list_hypotheses` y `next_best_test` — la segunda es la importante: devuelve **que comprobar ahora** en vez de dejar que el modelo elija la evidencia que le conviene. Ninguna de las dos puede devolver una accion de negocio (guardrail 50) |
| `D09` causa raiz y constraints | `a09_copiloto_consultor` y `a04_generador_tareas`. El segundo es el salto que lleva toda la fase esperando: hoy propone tareas leyendo cifras, y deberia partir del cuello identificado | `get_root_cause` y `get_binding_constraint`. **Ninguna puede devolver una prioridad** (guardrail 35): que un cuello sea vinculante no lo hace lo mas urgente, y si la tool ordenara, el modelo leeria ese orden como una decision ya tomada |
| `D10` severidad e impacto | `a09_copiloto_consultor` y `a04_generador_tareas`. Este es el bloque que le da al segundo lo que le falta para dejar de proponer a ojo: cuanto cuesta el problema y sobre cuanto negocio cae | `get_severity_assessment` y `get_impact_vector`. **Ninguna ordena, y ninguna devuelve una probabilidad** (guardrails 29 y 46). La tool devuelve el vector entero con su capa de evidencia, no un numero: si devolviera un score, el modelo lo trataria como la respuesta y se saltaria de que esta hecho |
| `D11` confianza e incertidumbre | **todos los agentes de diagnostico, y este es el punto**: `a09_copiloto_consultor` deberia leer la matriz antes de redactar nada, porque el guardrail 23 del runtime dice que la generacion consume confianza y estado epistemico | `get_claim_confidence` y `get_uncertainties`. **Ninguna devuelve un numero** (guardrail 36): devuelven el nivel, el estado epistemico, el techo con su motivo y las limitaciones. Un score haria que el modelo lo tratara como la respuesta y se saltara de que esta hecho |
| `D12` confusores y falsos diagnosticos | `a09_copiloto_consultor`, y con un papel distinto al de los demas bloques: aqui el modelo **no confirma, ataca**. El apartado 18 le deja proponer confusores plausibles y desafiar la narrativa causal, y le prohibe presentar como hecho un confusor externo especulativo o sobreescribir un check determinista | `get_diagnostic_robustness` y `run_red_team`. La segunda devuelve la biblioteca de confusores relevantes para la familia, **no una generacion libre** (apartado 12): el red team se apoya en el catalogo de 25 tipos y en los checks minimos, porque un adversario que se inventa los ataques tambien se inventa las defensas |
| `D13` diagnostico temporal y regresion | `a09_copiloto_consultor` y `a04_generador_tareas`. El apartado 32 marca la frontera con claridad: el modelo interpreta patrones temporales y explica la linea de tiempo, pero **no sustituye el calculo determinista** de timestamps, periodos, lags, change points ni alineacion de eventos | `get_temporal_diagnosis` y `get_episode_history`. La primera devuelve **estado y trayectoria por separado** (apartado 1): si devolviera una etiqueta fundida, el modelo leeria "mal" donde pone "mal pero mejorando", que es exactamente el error que el bloque existe para impedir |
| `D14` salida diagnostica y validacion | **todos, y es el unico contrato de integracion valido entre ellos** (apartado 28): los agentes intercambian objetos tipados y versionados, no narrativas. Ninguno puede sobreescribir en silencio la conclusion de otro | `get_diagnostic_output` y `get_evidence_ledger`. La primera devuelve el objeto estructurado **y el resumen ya calibrado**: el modelo no redacta la certeza, la recibe hecha. Es lo que impide que un agente suba el tono de una conclusion floja al escribirla |
| `D02` contextualizacion | `a09_copiloto_consultor` y `a19_arquitecto_camino`, que es quien mas necesita saber si el baseline historico de un cliente sigue siendo valido | `get_context_assessment`, incluidas rupturas de comparabilidad y contradicciones declarado/observado |

Ninguna existe todavia, y no deberian existir antes de `D05`: una tool que
siempre devuelve vacio ensena al modelo a dejar de llamarla.
### Lo que esto NO es

No es un encargo de pantallas. Hoy **ninguna de las 23 tablas de F3 la escribe
nadie**: una pantalla sobre tablas vacias se disena contra datos imaginados y se
tira. La UI llega con `D05`, que es el primer bloque que produce algo que mirar.
Lo que se adelanta aqui es la decision, mientras el contrato esta fresco.

### La decision de `D01`: el cliente ve lo que puede arreglar

**Tomada 2026-09-14. Migracion `20260914213000`, en test y produccion.**

La migracion original dejo `data_quality_issues` en staff-only. Lo que hizo
cambiar la decision: hay fallos que **solo el cliente puede resolver** — dar un
permiso en su cuenta de anuncios, reconectar una credencial caducada, confirmar
que esos pedidos eran pruebas suyas. Ocultarselos garantiza que no se resuelvan
y convierte al consultor en recadero de algo que podria ser automatico.

**Dos condiciones, no una.** El cliente no ve un issue por ser de su
incumbencia: lo ve cuando ademas `status <> 'open'`, es decir, cuando alguien
confirmo que el fallo existe. Avisar de una averia que no lo era erosiona la
confianza mas rapido que el fallo original.

**Una columna, no una lista de tipos en la politica.** "Accionable por el
cliente" no es propiedad del tipo sino del caso: una regresion de tracking en el
tema de su tienda la arregla el, y la misma regresion en nuestro pixel la
arreglamos nosotros. Quien escribe el issue lo declara en `client_actionable`.
La check constraint solo impide lo absurdo — marcar como suyo un rate limit de
nuestra ingesta. El catalogo permitido: `permission_gap`, `credential_expired`,
`consent_loss`, `tracking_regression`, `missing_events`, `schema_drift`,
`contaminated_data`. Todo ocurre en algo del cliente.

**Comprobado contra la RLS real**, no supuesto. Se insertaron cuatro issues y se
consulto la tabla como el usuario cliente de test
(`set local role authenticated` + claims): ve **exactamente uno**, y quedan
ocultos el que aun no esta verificado, el que es un fallo nuestro y el que
pertenece a otra organizacion. Y la constraint rechaza marcar un
`webhook_failure` como accionable por el cliente. Rollback limpio.

---

## Lo que falta para cerrar la fase 3

Escrito el **2026-09-25**, al terminar `D14` y comprobar que "fase completa"
significaba unicamente "esquema completo". Los 15 bloques tienen contrato; la
fase necesita ademas motor y pixel (plan maestro, apartado 3).

### El motor

La capa `03-runtime` de esta fase **ya tiene 9 flujos escritos**. Nueve estan
implementados (`d05`, `d01`, `d02`, `d06`, `d03`, `d07`, `d09`, `d10` y `d11`),
y `D08` tiene motor sin flujo escrito propio. No hay que inventar los tres que
quedan: hay que leerlos y escribirlos, como se hizo con estos nueve.

| Flujo | Bloque | Estado |
| --- | --- | --- |
| `d05-flujo-motor-senales` | `D05` | **hecho** — `apps/api/src/signal-engine.ts` |
| `d01-flujo-evaluacion-calidad-datos` | `D01` | **hecho** — `apps/api/src/data-quality-engine.ts` |
| `d02-flujo-contextualizacion` | `D02` | **hecho** — `apps/api/src/context-engine.ts` |
| `d03-flujo-deteccion-madurez` | `D03` | **hecho** — `apps/api/src/maturity-engine.ts` |
| `d06-flujo-motor-sintomas` | `D06` | **hecho** — `apps/api/src/symptom-engine.ts` |
| `d07-flujo-razonamiento-causal` | `D07` | **hecho** (recorrido hacia atras; el de ida y los confusores, no) — `apps/api/src/causal-engine.ts` |
| `d09-flujo-root-cause-constraint` | `D09` | **hecho** — `apps/api/src/root-cause-engine.ts` |
| `d10-flujo-evaluacion-severidad-impacto` | `D10` | **hecho** (solo la rama de cuantificacion) — `apps/api/src/severity-engine.ts` |
| `d11-flujo-evaluacion-confianza-incertidumbre` | `D11` | **hecho** (las capas que la cadena puede sostener hoy) — `apps/api/src/confidence-engine.ts` |

Y **cuatro bloques necesitan motor sin tener flujo escrito**, asi que ahi si hay
diseno que hacer (`D04` ya lo tiene, escrito sin flujo el 2026-10-02): `D08`
(el indice le pone `CRPET` pero **no existe `d08` en `03-runtime`** — la fila
esta mal), `D12` (los checks deterministas del apartado 17: alineacion de
periodos, descomposicion de mix, suficiencia de muestra, madurez de cohorte),
`D13` (series, change points, pendientes, calculo de lag, histeresis) y `D14`
(suite de evals y release gate, apartados 31 y 32).

`D00` no necesita motor: es contrato puro por diseno.

**El lazo minimo** — los bloques marcados ola 1 forman una cadena cerrada que va
de datos crudos a salida calibrada:

```text
d01 calidad -> d02 contexto -> d03 madurez -> d05 senales -> d06 sintomas
   -> d07 causal -> d09 causa raiz -> d10 severidad -> d11 confianza -> D14 salida
```

Cerrarlo para **una sola capacidad** produce el primer diagnostico real de la
plataforma, y con el la primera pantalla se disena contra datos que existen.

### El pixel

`D01` ya se ve en `/integraciones`, y `D02`, `D03`, `D04`, `D05`, `D06`, `D07`,
`D08`, `D09`, `D10` y `D11` en `/shopify/diagnostico`. De los 15 bloques,
**queda pantalla por hacer en 3** (`D12`, `D13`, `D14`; `D00` es contrato puro
por diseno y no necesita una). La matriz de
audiencia de mas arriba ya dice que lleva cada una.

Esa matriz es la especificacion de las primeras pantallas, y no vino del corpus
— **ninguna de las 9 fases tiene capa de UX**. Las 644 especificaciones dicen
que se guarda, que se calcula y que se prohibe; **no dicen que se ve**. El pixel
es nuestro en todas las fases, no solo en esta.

La primera pantalla es la **vista de caso del consultor**: es el destinatario
primario (plan maestro, apartado 9) y es quien necesita el razonamiento entero,
que es justo lo que estas 23 tablas guardan.

### Hasta que esto cierre, F4 no se abre.
