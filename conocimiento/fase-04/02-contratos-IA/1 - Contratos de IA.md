# **P0 — CONTRATO FUNDAMENTAL DE PRIORIZACIÓN Y DECISIÓN**

## **0\. Propósito**

P0 define el contrato raíz del sistema de Priorización y Decisión.

No determina todavía:

* cuánto impacto tiene un candidato;  
* cuánta urgencia existe;  
* cuánto esfuerzo requiere;  
* qué riesgo presenta;  
* cuál es su expected value;  
* cuál ocupa el puesto nº1;  
* qué puede ejecutarse en paralelo.

Esas responsabilidades pertenecen a P1–P12.

P0 determina **cómo debe comportarse cualquier decisión de priorización independientemente del criterio concreto utilizado posteriormente**.

Su función es establecer:

> qué constituye una ejecución válida del motor de priorización, qué información puede consumir, qué tipos de conclusiones puede producir, qué reglas nunca puede violar y cómo puede reconstruirse posteriormente por qué tomó una determinada decisión.

P0 es por tanto el **contrato constitucional de Fase 4**.

---

# **1\. Responsabilidad arquitectónica de P0**

P0 debe garantizar cinco propiedades fundamentales:

| Propiedad | Significado |
| ----- | ----- |
| Validez | ninguna decisión puede producirse fuera de las reglas del sistema |
| Determinismo estructural | las reglas objetivas deben producir siempre el mismo resultado ante el mismo estado |
| Incertidumbre explícita | desconocer algo nunca equivale a asumir un valor |
| Trazabilidad | toda conclusión debe poder reconstruirse |
| Separación de responsabilidades | diagnóstico, prioridad, estrategia y ejecución no pueden mezclarse |

El sistema debe impedir especialmente que un modelo generativo pueda saltarse estas propiedades mediante razonamiento libre.

---

# **2\. Principio central**

El motor NO utilizará un único sistema universal del tipo:

`priority_score = weighted_sum(...)`

como autoridad de decisión.

La arquitectura deberá operar mediante diferentes clases de mecanismo:

| Mecanismo | Función |
| ----- | ----- |
| Gate | determina si algo puede continuar |
| Constraint | limita el espacio de decisión |
| Dependency | determina precedencias |
| Override | sustituye temporalmente el orden normal |
| Dimension | aporta información para comparar |
| Modifier | altera valor, riesgo, confianza u otra dimensión |
| Ranking rule | ordena candidatos comparables |
| Portfolio rule | decide concurrencia y asignación |
| Abstention rule | impide decidir cuando no existen fundamentos suficientes |

Un score podrá existir posteriormente como **instrumento de comparación**, pero nunca podrá neutralizar un gate, romper una dependencia o ocultar incertidumbre.

---

# **3\. Unidad fundamental: PRIORITIZATION\_RUN**

Cada proceso completo de priorización deberá existir como una ejecución identificable.

Nombre conceptual:

**PRIORITIZATION\_RUN**

Representa:

> una evaluación de un conjunto determinado de candidatos, bajo un determinado contexto empresarial, objetivos, información disponible y versiones concretas del sistema, realizada para decidir qué merece atención primero.

Una nueva ejecución deberá crearse cuando cambie materialmente alguna de esas condiciones.

---

# **4\. Identidad del PRIORITIZATION\_RUN**

| Campo | Tipo conceptual | Obligatorio | Productor | Propósito |
| ----- | ----- | ----- | ----- | ----- |
| `prioritization_run_id` | immutable ID | Sí | runtime | identidad única de la decisión |
| `business_id` | reference ID | Sí | plataforma | identifica el ecommerce |
| `analysis_snapshot_id` | reference ID | Sí | upstream | fija el estado del negocio utilizado |
| `created_at` | timestamp | Sí | runtime | momento de creación |
| `decision_as_of` | timestamp | Sí | runtime/context | momento para el que la decisión es válida |
| `completed_at` | timestamp/null | Condicional | runtime | finalización |
| `schema_version` | version | Sí | runtime | versión del contrato |
| `decision_policy_version` | version | Sí | runtime | reglas utilizadas |
| `input_fingerprint` | immutable fingerprint | Sí | runtime | identifica semánticamente el input |
| `recompute_reason` | enum/null | Condicional | runtime | explica por qué existe una nueva ejecución |

### **Invariantes**

`prioritization_run_id` nunca puede reutilizarse.

Una decisión histórica nunca se modifica retroactivamente para representar nueva información.

Si cambia información material se genera una nueva ejecución relacionada con la anterior.

`decision_as_of` y `created_at` no son equivalentes.

Una decisión puede ejecutarse hoy utilizando un snapshot correspondiente a un instante anterior.

---

# **5\. INPUT ENVELOPE DE FASE 4**

P0 define el contenedor de entradas, pero no redefine los contratos internos de P1–P9.

El input conceptual será:

**PRIORITIZATION\_INPUT**

y deberá referenciar como mínimo:

| Campo | Procedencia | Función |
| ----- | ----- | ----- |
| `analysis_snapshot_id` | Fases anteriores | estado empresarial conocido |
| `diagnostic_refs[]` | Fase 3 | problemas, causas, restricciones o hipótesis relevantes |
| `decision_context_ref` | P1 | objetivo y contexto decisional |
| `candidate_set_ref` | P2 | alternativas reales sometidas a decisión |
| `evaluation_time` | runtime | referencia temporal |
| `policy_version` | configuración | reglas vigentes |

P0 no duplicará dentro del input los datos completos de diagnóstico, contexto o candidatos.

La **source of truth seguirá perteneciendo al sistema que los produjo**.

---

# **6\. REGLA DE INMUTABILIDAD DEL SNAPSHOT**

Una ejecución de priorización deberá trabajar sobre un estado lógico congelado.

Durante una ejecución:

> los inputs utilizados para decidir no pueden cambiar silenciosamente.

Si aparecen nuevos datos materialmente relevantes mientras el motor está evaluando:

1. la ejecución actual puede finalizar utilizando su snapshot original;  
2. el nuevo dato queda registrado;  
3. se genera posteriormente una nueva ejecución.

Esto evita decisiones imposibles de reproducir.

---

# **7\. ESTADOS DEL RUN**

El ciclo de vida mínimo será:

| Estado | Significado |
| ----- | ----- |
| `CREATED` | ejecución creada |
| `INPUT_INCOMPLETE` | existen inputs obligatorios todavía no resolubles |
| `READY` | existen condiciones para evaluar |
| `EVALUATING` | motor procesando reglas |
| `COMPLETED` | decisión estructural válida producida |
| `ABSTAINED` | el sistema deliberadamente no puede decidir |
| `INVALIDATED` | información posterior hace que el resultado deje de ser vigente |
| `FAILED` | fallo técnico impide completar el proceso |

Deben mantenerse separadas:

`ABSTAINED`

y

`FAILED`.

ABSTAINED significa:

> el sistema funciona correctamente y concluye que no existe fundamento suficiente para decidir.

FAILED significa:

> el sistema no pudo ejecutar correctamente el proceso.

---

# **8\. RESULTADO RAÍZ**

P0 define el contenedor:

**PRIORITIZATION\_RESULT**

No define todavía internamente el ranking P10, portfolio P11 o explicabilidad P12.

Debe contener:

| Campo | Obligatorio | Responsable final |
| ----- | ----- | ----- |
| `prioritization_run_id` | Sí | P0 |
| `run_status` | Sí | P0 |
| `decision_validity` | Sí | P0 |
| `candidate_evaluation_refs[]` | Condicional | P3–P9 |
| `ranking_result_ref` | Si procede | P10 |
| `portfolio_result_ref` | Si procede | P11 |
| `decision_explanation_ref` | Si existe decisión | P12 |
| `unresolved_unknowns[]` | Si existen | P0/P12 |
| `abstention_reason_codes[]` | Si abstiene | P0 |
| `rule_trace_refs[]` | Sí | P0–P12 |
| `source_lineage_refs[]` | Sí | sistema |
| `warnings[]` | Opcional | runtime |

P0 actúa como contenedor estable aunque los contratos especializados evolucionen.

---

# **9\. VALIDEZ DE LA DECISIÓN**

Toda salida deberá declarar explícitamente uno de estos estados:

| `decision_validity` | Significado |
| ----- | ----- |
| `VALID` | puede utilizarse como decisión actual |
| `VALID_WITH_LIMITATIONS` | puede utilizarse pero existen limitaciones relevantes |
| `REQUIRES_VALIDATION` | debe validarse información antes de asumir la prioridad |
| `INSUFFICIENT_INFORMATION` | no existe base suficiente |
| `NO_VALID_CANDIDATES` | ningún candidato puede entrar en decisión |
| `STALE` | información material ha quedado desactualizada |
| `INVALID` | el resultado no debe utilizarse |

Esto evita reducir toda la ejecución a éxito/error.

---

# **10\. UNKNOWN NO ES UN VALOR**

P0 establece una regla obligatoria para todo P1–P12:

`UNKNOWN ≠ 0`

`UNKNOWN ≠ false`

`UNKNOWN ≠ LOW`

`UNKNOWN ≠ NOT_APPLICABLE`

`UNKNOWN ≠ neutral`

Si una variable no se conoce, debe representarse explícitamente como desconocida.

Queda prohibido convertir automáticamente un dato ausente en:

* cero;  
* promedio;  
* mediana;  
* neutral;  
* valor histórico;  
* supuesto conservador;

sin que exista una regla explícita y trazable que autorice esa estimación.

---

# **11\. ESTADO EPISTÉMICO DE LOS DATOS**

Todo dato decisional material deberá poder clasificarse como:

| Estado | Significado |
| ----- | ----- |
| `OBSERVED` | obtenido directamente de una fuente |
| `CALCULATED` | derivado determinísticamente |
| `ESTIMATED` | estimación basada en evidencia |
| `INFERRED` | conclusión probabilística |
| `UNKNOWN` | no conocido |
| `NOT_APPLICABLE` | conceptualmente no aplica |

`NOT_APPLICABLE` requiere una regla que demuestre por qué no aplica.

Nunca debe utilizarse simplemente porque no haya información.

---

# **12\. SEPARACIÓN ENTRE HECHO E INFERENCIA**

Una inferencia de IA nunca podrá sobrescribir silenciosamente un dato observado.

Ante conflicto:

**OBSERVED DATA**

y

**INFERRED DATA**

deben mantenerse como registros diferentes.

El sistema podrá posteriormente resolver el conflicto mediante reglas de confianza, vigencia o calidad de fuente, pero nunca eliminando la procedencia de ambos.

---

# **13\. CONTRATO DE CONFIANZA**

P0 prohíbe fabricar precisión.

No se permitirá producir valores como:

`confidence = 0.73`

salvo que exista un método formal que justifique matemáticamente dicho valor.

La confianza operacional deberá expresarse preferentemente mediante estados semánticos:

| Estado | Significado |
| ----- | ----- |
| `SUFFICIENT_TO_DECIDE` | evidencia suficiente para priorizar |
| `SUFFICIENT_WITH_LIMITATIONS` | decisión posible con limitaciones |
| `VALIDATION_REQUIRED` | falta información que puede alterar la decisión |
| `INSUFFICIENT` | no debe tomarse decisión |
| `UNKNOWN` | no puede evaluarse |

Además deberá registrarse:

`confidence_basis`

es decir:

> por qué se considera suficiente o insuficiente la evidencia.

---

# **14\. GATES**

Todo gate deberá producir un resultado explícito:

| Resultado | Significado |
| ----- | ----- |
| `PASS` | condición satisfecha |
| `FAIL` | condición incumplida |
| `UNKNOWN` | no puede determinarse |
| `NOT_APPLICABLE` | gate no relevante |

Una variable desconocida nunca puede convertirse automáticamente en PASS.

Cada gate deberá indicar:

* `gate_id`;  
* `gate_version`;  
* `result`;  
* `reason_code`;  
* `evidence_refs`;  
* `evaluated_at`.

---

# **15\. PRECEDENCIA GLOBAL**

Salvo override explícitamente definido por contratos posteriores, el sistema respetará la siguiente jerarquía:

**1\. Validez del input**

↓

**2\. Hard gates**

↓

**3\. Constraints no negociables**

↓

**4\. Hard dependencies**

↓

**5\. Overrides autorizados**

↓

**6\. Evaluación multidimensional**

↓

**7\. Comparación / ranking**

↓

**8\. Portfolio y concurrencia**

↓

**9\. Explicación final**

Una fase inferior de esta jerarquía no puede anular arbitrariamente una superior.

Ejemplo:

un candidato con enorme impacto potencial no puede superar un gate legal fallido.

---

# **16\. REGLA DE NO COMPENSACIÓN**

Determinadas dimensiones son **no compensatorias**.

Por tanto:

> un resultado excepcional en una dimensión no puede compensar automáticamente una condición prohibitiva en otra.

Ejemplos conceptuales:

Impacto muy alto  
NO compensa  
ilegalidad.

Urgencia extrema  
NO compensa  
imposibilidad técnica demostrada.

Expected value elevado  
NO compensa  
hard dependency todavía incumplida.

---

# **17\. BUSINESS PRIORITY ≠ EXECUTION ORDER**

P0 protege obligatoriamente esta separación.

Un candidato puede tener:

`business_priority = highest`

y simultáneamente:

`execution_position != first`

porque otro elemento debe ejecutarse primero como dependencia.

Por tanto deberán existir posteriormente representaciones diferenciadas para:

* importancia/prioridad empresarial;  
* orden de ejecución;  
* dependency sequence;  
* portfolio state.

Nunca debe utilizarse un único campo `priority` para representar los cuatro conceptos.

---

# **18\. RANK ≠ DISTANCIA DE PRIORIDAD**

Que dos candidatos sean:

\#1

y

\#2

no implica que exista una diferencia significativa entre ellos.

P10 deberá poder representar posteriormente:

* posición;  
* proximidad;  
* empate material;  
* dominancia clara;  
* incertidumbre de orden.

P0 prohíbe interpretar automáticamente la posición ordinal como distancia cuantitativa.

---

# **19\. PRIORIDAD ≠ RECOMENDACIÓN DE SOLUCIÓN**

La salida de Fase 4 puede establecer:

* merece atención inmediata;  
* necesita validación;  
* debe prepararse;  
* debe monitorizarse;  
* debe diferirse;  
* debe detenerse;  
* depende de otra intervención;  
* puede tratarse concurrentemente.

Pero no puede responder todavía:

> «haz exactamente estas cinco acciones para arreglarlo».

Eso pertenece a Fase 5\.

---

# **20\. REGLA DE ABSTENCIÓN**

La abstención es una salida legítima.

El sistema deberá abstenerse cuando exista al menos una condición material que impida tomar una decisión defendible.

Entre ellas:

* falta una variable necesaria para resolver un hard gate;  
* existen candidatos insuficientemente definidos;  
* las evidencias materiales son contradictorias y no pueden resolverse;  
* la incertidumbre puede cambiar sustancialmente el orden;  
* el contexto u objetivo de decisión es ambiguo;  
* la información crítica está desactualizada;  
* ninguna alternativa es actualmente válida.

ABSTAIN nunca debe sustituirse por una decisión inventada para «ser útil».

---

# **21\. REASON CODES**

Toda decisión estructural deberá poder explicarse mediante códigos de razón.

Los reason codes no contienen la explicación narrativa.

Representan causas estructuradas.

Convención conceptual:

`CATEGORY.REASON`

Ejemplos:

`INPUT.MISSING_REQUIRED`

`GATE.LEGAL_FAIL`

`DEPENDENCY.BLOCKED`

`EVIDENCE.INSUFFICIENT`

`DATA.STALE`

`PORTFOLIO.RESOURCE_CONFLICT`

`DECISION.ABSTAINED`

La explicación humana de P12 utilizará estos códigos, pero nunca los sustituirá.

---

# **22\. RULE TRACE**

Cada regla capaz de alterar una decisión deberá producir un registro trazable.

Contrato conceptual:

**RULE\_TRACE**

| Campo | Función |
| ----- | ----- |
| `rule_trace_id` | identidad |
| `rule_id` | regla aplicada |
| `rule_version` | versión |
| `rule_type` | gate, dependency, override, comparison, etc. |
| `input_refs[]` | datos utilizados |
| `result` | resultado estructurado |
| `reason_codes[]` | motivos |
| `evidence_refs[]` | soporte |
| `deterministic` | indica naturaleza |
| `executed_at` | timestamp |

Una prioridad que no pueda indicar qué reglas intervinieron se considera incompleta.

---

# **23\. SEPARACIÓN DETERMINISTA / PROBABILÍSTICA**

Toda lógica de Fase 4 deberá clasificarse explícitamente.

## **Deterministic logic**

Incluye:

* validaciones;  
* enums;  
* hard gates objetivos;  
* precedencias;  
* dependencias explícitas;  
* aritmética;  
* límites;  
* reglas contractuales;  
* comparaciones objetivas;  
* estados del runtime.

La IA no puede modificarlas.

## **Probabilistic judgment**

Puede intervenir en:

* interpretación contextual;  
* estimación;  
* clasificación semántica;  
* inferencia cuando falta estructura explícita;  
* valoración cualitativa donde no exista una regla determinista.

Pero su resultado deberá:

1. identificarse como inferencia;  
2. conservar evidencia;  
3. registrar modelo/prompt o sistema que la produjo;  
4. poder ser cuestionado;  
5. no sobrescribir reglas deterministas.

---

# **24\. CONTRATO DE INFERENCIA IA**

Toda inferencia material deberá generar un objeto lógico independiente:

**MODEL\_INFERENCE**

con al menos:

| Campo | Función |
| ----- | ----- |
| `inference_id` | identidad |
| `inference_type` | tipo de juicio |
| `input_refs[]` | contexto utilizado |
| `output` | conclusión estructurada |
| `evidence_refs[]` | soporte |
| `uncertainties[]` | incertidumbres reconocidas |
| `model_id` | modelo utilizado |
| `model_version` | versión si está disponible |
| `prompt_or_policy_version` | configuración |
| `created_at` | momento |
| `review_status` | si necesita validación |

La explicación narrativa del modelo no constituye por sí misma evidencia.

---

# **25\. SOURCE LINEAGE**

Toda variable material deberá poder reconstruirse mediante una cadena de procedencia.

Modelo mínimo:

**SOURCE**

→ **DATA**

→ **FACT / INFERENCE**

→ **DIAGNOSIS**

→ **CANDIDATE**

→ **DECISION DIMENSION**

→ **RULE**

→ **PRIORITY RESULT**

P0 exige referencias, no duplicación masiva de datos.

---

# **26\. VERSIONADO**

Toda decisión deberá poder reproducirse conceptualmente conociendo:

* versión del schema;  
* versión de las reglas;  
* versión de las políticas;  
* versión de los contratos upstream relevantes;  
* modelo utilizado para inferencias;  
* versión de prompts/policies IA;  
* snapshot de inputs.

Una actualización del sistema no debe reescribir decisiones históricas.

---

# **27\. INVALIDACIÓN**

Un resultado COMPLETED no implica validez indefinida.

Una decisión puede pasar posteriormente a:

`STALE`

o

`INVALIDATED`.

La invalidación debe registrar:

* motivo;  
* información que cambió;  
* timestamp;  
* ejecución posterior que la reemplaza, si existe.

---

# **28\. CONDICIONES QUE OBLIGAN A RECALCULAR**

Una nueva ejecución deberá plantearse cuando cambie materialmente alguno de estos elementos:

| Cambio | Motivo |
| ----- | ----- |
| objetivo empresarial | cambia qué significa «mejor» |
| diagnostic snapshot | cambia el problema conocido |
| conjunto de candidatos | cambia el espacio de decisión |
| hard constraint | puede cambiar elegibilidad |
| dependency | puede cambiar secuencia |
| recurso crítico | puede cambiar factibilidad |
| información temporal relevante | puede cambiar urgencia |
| evidencia material | puede cambiar confianza |
| riesgo material | puede cambiar prioridad |
| policy/rulepack | cambia la lógica aplicada |
| override | puede cambiar directamente la decisión |

---

# **29\. CAMBIOS QUE NO DEBEN RECALCULAR**

No debe generarse una nueva priorización únicamente por:

* cambios de formato;  
* reordenación de propiedades;  
* cambio de descripción textual sin cambio semántico;  
* nuevo timestamp de sincronización sin datos nuevos;  
* nueva consulta que devuelve exactamente el mismo estado;  
* modificación de metadata irrelevante;  
* cambio en una explicación narrativa cuando la decisión estructurada permanece idéntica.

De ahí la necesidad del `input_fingerprint`.

---

# **30\. IDEMPOTENCIA SEMÁNTICA**

Con:

* los mismos inputs semánticos;  
* las mismas reglas;  
* las mismas versiones;  
* las mismas políticas;

la parte determinista del motor debe producir el mismo resultado estructural.

La redacción explicativa de una IA puede variar.

La decisión estructural no.

---

# **31\. CONSISTENCIA ENTRE MODELOS**

Cambiar de modelo de IA no debe provocar que:

* desaparezca un hard gate;  
* cambie una dependencia explícita;  
* se altere una fórmula determinista;  
* un UNKNOWN se convierta en valor conocido;  
* un candidato inválido se convierta en válido.

En componentes probabilísticos sí puede existir desacuerdo.

Cuando el desacuerdo pueda cambiar materialmente la decisión:

> deberá elevarse la incertidumbre o activarse validación, no seleccionar silenciosamente una de las respuestas.

---

# **32\. OBSERVABILIDAD MÍNIMA**

Toda ejecución debe permitir observar:

| Métrica/estado | Utilidad |
| ----- | ----- |
| run status | saber si completó |
| duración | detectar degradación |
| nº candidatos | entender complejidad |
| nº gates PASS/FAIL/UNKNOWN | explicar filtrado |
| nº unknowns materiales | medir calidad de datos |
| nº inferencias IA | medir dependencia probabilística |
| nº abstenciones | detectar insuficiencia |
| reason codes dominantes | detectar patrones |
| recompute reason | entender churn decisional |
| decision drift | detectar inconsistencias |

---

# **33\. DECISION DRIFT**

Debe ser posible detectar:

> dos ejecuciones con inputs semánticamente equivalentes y mismas reglas que producen decisiones estructurales diferentes.

Ese evento deberá considerarse anómalo salvo que la diferencia proceda explícitamente de una capa probabilística permitida.

El drift debe poder auditarse.

---

# **34\. INVARIANTES GLOBALES**

P0 establece como invariantes de toda Fase 4:

1. Ningún candidato puede aparecer en el resultado si no pertenece al candidate set de la ejecución.  
2. Ningún hard gate fallido puede ser neutralizado por un score.  
3. Ninguna hard dependency puede ignorarse por mayor impacto.  
4. UNKNOWN nunca se convierte silenciosamente en un valor.  
5. Ninguna inferencia puede presentarse como hecho observado.  
6. Ninguna prioridad puede existir sin contexto de decisión.  
7. Ninguna explicación narrativa puede sustituir la decisión estructurada.  
8. Ningún resultado puede modificar su pasado después de completarse.  
9. Todo cambio material genera una nueva versión de decisión.  
10. Toda decisión material debe contener reason codes y trazabilidad.  
11. Ranking y execution order deben permanecer separados.  
12. Diagnóstico y priorización deben permanecer separados.  
13. Priorización y playbook deben permanecer separados.  
14. Un fallo del modelo generativo no debe alterar lógica determinista.  
15. El sistema puede abstenerse.

---

# **35\. PRECONDICIONES DE EJECUCIÓN**

Para pasar a `READY` deberá existir como mínimo:

* negocio identificado;  
* snapshot identificable;  
* contexto decisional disponible;  
* conjunto de candidatos válido;  
* versión de políticas conocida;  
* timestamp de referencia;  
* contratos upstream compatibles.

No significa que todas las dimensiones P3–P9 deban estar conocidas.

Significa que existe una ejecución coherente sobre la que comenzar a evaluar.

---

# **36\. POSTCONDICIONES**

Una ejecución `COMPLETED` deberá garantizar:

* inputs congelados;  
* candidatos identificables;  
* reglas utilizadas registradas;  
* unknowns conservados;  
* inferencias diferenciadas;  
* resultado estructurado;  
* lineage disponible;  
* versiones registradas;  
* reason codes disponibles;  
* referencias a ranking/portfolio/explicación cuando correspondan.

Si alguna condición imprescindible no se cumple, no debe utilizarse `COMPLETED`.

---

# **37\. FAILURE MODES QUE P0 DEBE PREVENIR**

### **Score absolutista**

Todo se reduce a una puntuación.

**Prevención:** gates, dependencies y overrides separados.

### **False precision**

La IA inventa 78/100 de confianza.

**Prevención:** estados epistemológicos y confidence classes.

### **Missing-as-zero**

Un campo ausente reduce artificialmente impacto o riesgo.

**Prevención:** UNKNOWN explícito.

### **Priority/execution collapse**

El problema prioritario se interpreta como la primera tarea ejecutable.

**Prevención:** contratos diferentes.

### **Diagnosis contamination**

La priorización empieza a redefinir las causas.

**Prevención:** diagnostic refs inmutables.

### **Strategy leakage**

La Fase 4 empieza a generar el playbook.

**Prevención:** frontera contractual con Fase 5\.

### **LLM authority escalation**

El modelo ignora reglas porque «razona» una excepción.

**Prevención:** precedencia determinista.

### **Silent data mutation**

Cambian inputs durante la decisión.

**Prevención:** snapshots y fingerprints.

### **Historical overwrite**

La última decisión sustituye a la anterior.

**Prevención:** runs inmutables.

### **Untraceable recommendation**

Sabemos qué decidió pero no por qué.

**Prevención:** RULE\_TRACE \+ lineage \+ reason codes.

---

# **38\. TESTS CONTRACTUALES MÍNIMOS DE P0**

P0 deberá disponer posteriormente de tests que demuestren como mínimo:

| Test | Resultado esperado |
| ----- | ----- |
| mismo input \+ mismas reglas | misma decisión determinista |
| metadata irrelevante cambia | no cambia decisión |
| hard gate FAIL \+ alto impacto | candidato no supera gate |
| hard dependency pendiente | no puede saltarse secuencia |
| required gate input UNKNOWN | no puede asumir PASS |
| UNKNOWN recibido | permanece UNKNOWN |
| `0` recibido | permanece valor conocido 0 |
| N/A válido | requiere regla de aplicabilidad |
| falta context | run no llega a READY |
| candidate fuera del set | rechazo |
| inferencia contradice dato observado | observado no se sobrescribe |
| modelo IA cambia | lógica determinista permanece |
| nueva evidencia material | puede activar recompute |
| explicación narrativa cambia | prioridad estructural no cambia |
| evidencia insuficiente | ABSTAIN permitido |
| error técnico | FAILED, no ABSTAINED |
| resultado histórico | permanece inmutable |
| decisión completada | contiene trazabilidad mínima |

---

# **39\. EVALS DE IA**

Además de tests deterministas, posteriormente deberán existir evaluaciones sobre componentes probabilísticos.

Entre otras:

**Consistency eval**

Diferentes ejecuciones sobre el mismo contexto deberían producir clasificaciones semánticamente compatibles.

**Evidence adherence eval**

La IA no debe realizar afirmaciones decisionales que no estén soportadas por los inputs.

**Uncertainty eval**

Debe reconocer cuando la evidencia es insuficiente.

**Boundary eval**

No debe introducir acciones propias de Fase 5\.

**Override compliance eval**

No debe argumentar narrativamente contra reglas deterministas.

**Traceability eval**

Toda inferencia material debe poder relacionarse con su evidencia.

---

# **40\. RELACIÓN DE P0 CON P1–P12**

P0 no sustituye ninguno de los siguientes contratos.

Define el marco donde vivirán.

| Bloque | Responsabilidad dentro del contrato P0 |
| ----- | ----- |
| P1 | rellena el contexto de decisión |
| P2 | construye el universo normalizado de candidatos |
| P3 | aporta estructura temporal y urgencia |
| P4 | aporta valor/impacto decisional |
| P5 | aporta constraints y dependencias |
| P6 | aporta esfuerzo, recursos y factibilidad |
| P7 | aporta riesgo y reversibilidad |
| P8 | aporta EV, coste de oportunidad y asignación |
| P9 | aporta strategic fit y madurez |
| P10 | sintetiza comparación y ranking |
| P11 | transforma ranking en portfolio decisional |
| P12 | genera explicación, trazabilidad y validación |

P0 contiene las interfaces y garantías transversales.

Cada bloque posterior define únicamente lo que le corresponde.

---

# **41\. SOURCE OF TRUTH**

La propiedad de los conceptos deberá permanecer distribuida.

Fase 3 es source of truth de:

* diagnóstico;  
* causas;  
* root causes;  
* síntomas;  
* evidencia diagnóstica.

P1 será source of truth de:

* objetivo decisional;  
* contexto.

P2:

* candidatos.

P3–P9:

* dimensiones decisionales correspondientes.

P10:

* ranking.

P11:

* portfolio state y concurrencia.

P12:

* explicación de la decisión.

P0:

* identidad de la ejecución;  
* ciclo de vida;  
* validez;  
* versionado;  
* precedencia;  
* invariantes;  
* trazabilidad transversal.

Ningún bloque debe duplicar la autoridad de otro.

---

# **42\. RESULTADO CONCEPTUAL DE P0**

Después de P0, Fase 4 dispone de una máquina decisional capaz de afirmar:

> «Esta es la ejecución que estamos realizando, estos son sus inputs, estas son las reglas que puede utilizar, estos son los límites que nunca puede saltarse, estas son las incertidumbres que debe preservar y esta es la estructura mediante la cual podremos reconstruir cualquier decisión».

Todavía no sabe:

> qué candidato merece prioridad.

Eso se construirá mediante P1–P12.

Y esa separación es deliberada.

---

# **43\. DEFINITION OF DONE — P0**

P0 se considera terminado cuando la arquitectura garantiza simultáneamente:

**IDENTITY**

cada decisión es una ejecución identificable.

**IMMUTABILITY**

cada ejecución trabaja con un snapshot reproducible.

**VALIDITY**

el sistema diferencia decisión válida, limitada, stale, abstención y fallo.

**UNKNOWN SAFETY**

la ausencia de información nunca se convierte silenciosamente en precisión.

**RULE PRECEDENCE**

gates, dependencies y overrides no pueden ser neutralizados por scores.

**DETERMINISTIC CONTROL**

la IA no controla reglas objetivas.

**TRACEABILITY**

toda decisión puede reconstruirse.

**VERSIONING**

se conocen las reglas bajo las que se tomó.

**RECOMPUTATION**

el sistema sabe cuándo debe volver a decidir.

**IDEMPOTENCY**

cambios irrelevantes no producen cambios decisionales.

**BOUNDARIES**

diagnóstico, priorización, estrategia y ejecución permanecen separados.

**EXTENSIBILITY**

P1–P12 pueden especializar el sistema sin romper el contrato raíz.

