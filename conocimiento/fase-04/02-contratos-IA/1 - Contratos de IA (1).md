# **P1 — CONTEXTO DE DECISIÓN Y OBJETIVOS**

## **0\. Propósito**

P1 define el contexto bajo el cual una priorización tiene significado.

Su responsabilidad es responder estructuralmente:

> ¿Para qué estamos priorizando, sobre qué ámbito, durante qué horizonte y bajo qué objetivo empresarial?

Sin P1 no existe una prioridad válida.

Un mismo problema puede tener distinta prioridad si el negocio intenta:

* maximizar crecimiento;  
* proteger caja;  
* recuperar rentabilidad;  
* reducir riesgo;  
* estabilizar operaciones;  
* liquidar inventario;  
* preparar expansión;  
* proteger capacidad operativa.

Por tanto:

> PRIORITY IS CONTEXT-DEPENDENT.

P1 no determina qué candidato gana.

P1 determina **qué significa ganar**.

---

# **1\. Responsabilidad de P1**

P1 será source of truth de:

* problema decisional;  
* objetivo principal;  
* objetivos secundarios;  
* ámbito de la decisión;  
* horizonte temporal;  
* criterios de éxito;  
* procedencia de los objetivos;  
* vigencia del contexto;  
* conflictos entre objetivos.

P1 NO será source of truth de:

* diagnóstico → Fase 3;  
* candidatos → P2;  
* urgencia → P3;  
* impacto → P4;  
* constraints y dependencias operativas → P5;  
* esfuerzo → P6;  
* riesgo → P7;  
* expected value → P8;  
* strategic fit/maturity → P9;  
* ranking → P10;  
* portfolio → P11;  
* explicación final → P12.

---

# **2\. Entidad raíz**

La entidad principal será:

**DECISION\_CONTEXT**

Representa:

> el marco explícito dentro del cual una ejecución determinada de priorización debe interpretar y comparar candidatos.

Relación principal:

`PRIORITIZATION_RUN`

→ `DECISION_CONTEXT`

Cada ejecución deberá utilizar exactamente una versión válida de contexto.

Una versión histórica de contexto nunca se sobrescribe.

---

# **3\. Identidad de DECISION\_CONTEXT**

| Campo | Tipo | Obligatorio | Propósito |
| ----- | ----- | ----- | ----- |
| `decision_context_id` | immutable ID | Sí | identidad |
| `business_id` | reference | Sí | ecommerce evaluado |
| `context_version` | version | Sí | versionado |
| `created_at` | timestamp | Sí | creación |
| `valid_from` | timestamp | Sí | inicio de vigencia |
| `valid_until` | timestamp/null | No | fin conocido |
| `supersedes_context_id` | reference/null | No | versión anterior |
| `created_by_type` | enum | Sí | origen del contexto |
| `source_refs[]` | references | Sí | trazabilidad |

---

# **4\. DECISION PROBLEM**

P1 debe contener una representación explícita del problema de decisión.

Entidad:

**DECISION\_PROBLEM**

Campos mínimos:

| Campo | Función |
| ----- | ----- |
| `decision_problem_id` | identidad |
| `decision_context_id` | contexto propietario |
| `problem_statement` | pregunta empresarial |
| `decision_scope` | ámbito |
| `decision_horizon` | periodo relevante |
| `status` | vigencia |

Ejemplo conceptual:

> Determinar qué problemas deben recibir recursos durante el próximo ciclo operativo para recuperar rentabilidad sin deteriorar la capacidad de crecimiento.

El `problem_statement` ayuda a humanos y modelos.

Pero no sustituye los campos estructurados.

---

# **5\. PRINCIPIO DE OBJETIVO EXPLÍCITO**

Toda priorización debe tener al menos un objetivo activo.

Queda prohibido utilizar implícitamente:

`maximize_revenue`

como objetivo por defecto.

También queda prohibido asumir:

> más crecimiento \= mejor

sin contexto.

El sistema no puede decidir qué optimizar basándose únicamente en que una métrica parezca empresarialmente importante.

---

# **6\. OBJECTIVE**

La unidad fundamental será:

**DECISION\_OBJECTIVE**

Un contexto puede contener uno o varios objetivos.

Campos:

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `objective_id` | Sí | identidad |
| `decision_context_id` | Sí | propietario |
| `objective_role` | Sí | jerarquía |
| `objective_definition` | Sí | significado |
| `objective_kind` | Sí | naturaleza |
| `evaluation_method` | Sí | cómo sabremos si mejora |
| `origin` | Sí | procedencia |
| `validation_state` | Sí | fiabilidad contractual |
| `status` | Sí | vigencia |
| `source_refs[]` | Sí | trazabilidad |

---

# **7\. OBJECTIVE\_ROLE**

P1 deberá distinguir:

### **PRIMARY**

Objetivo dominante del contexto.

Responde:

> si solo pudiéramos optimizar una cosa en esta decisión, ¿cuál sería?

### **SECONDARY**

Objetivo que debe mejorar o protegerse cuando sea posible.

### **SUPPORTING**

Objetivo instrumental que ayuda al objetivo principal.

Un contexto deberá tener:

**exactamente un PRIMARY**

salvo que exista explícitamente un contrato multiobjetivo que permita varios objetivos co-dominantes.

No debe permitirse accidentalmente:

`PRIMARY + PRIMARY + PRIMARY`

sin regla de resolución.

---

# **8\. MULTI-OBJECTIVE CONTEXT**

Algunos negocios tendrán objetivos simultáneos legítimos.

Ejemplo:

* recuperar margen;  
* mantener crecimiento;  
* no deteriorar caja.

P1 deberá soportarlo.

Pero deberá declarar explícitamente la política multiobjetivo.

Campo:

`objective_policy`

Estados conceptuales:

### **SINGLE\_PRIMARY**

Un objetivo domina.

### **LEXICOGRAPHIC**

Los objetivos tienen una precedencia explícita.

Ejemplo:

1. preservar solvencia;  
2. recuperar rentabilidad;  
3. crecer.

### **SATISFICING**

Deben alcanzarse ciertos mínimos antes de optimizar otro objetivo.

### **TRADEOFF\_REQUIRED**

Existen objetivos en conflicto y ninguna precedencia válida ha sido establecida.

Este último estado puede obligar a validación humana antes de P10.

---

# **9\. OBJECTIVE\_KIND**

No conviene construir un enum gigantesco de objetivos ecommerce.

El contrato debe modelar su naturaleza.

Valores iniciales:

`QUANTITATIVE_TARGET`

`QUANTITATIVE_DIRECTION`

`QUALITATIVE_STATE`

`RISK_AVOIDANCE`

`CAPABILITY_BUILDING`

`STRATEGIC_OPTION`

Esto permite representar objetivos muy distintos sin codificar cientos de casos.

---

# **10\. OBJETIVO CUANTITATIVO**

Cuando el objetivo dependa de una métrica deberá existir:

**METRIC\_OBJECTIVE**

con:

* `metric_ref`;  
* `optimization_direction`;  
* `baseline_ref`;  
* `target_definition`;  
* `target_period`.

`optimization_direction`:

`MAXIMIZE`

`MINIMIZE`

`INCREASE`

`DECREASE`

`MAINTAIN`

`REACH_TARGET`

`KEEP_WITHIN_RANGE`

---

# **11\. TARGET\_DEFINITION**

Una meta puede representarse como:

### **EXACT**

Existe objetivo concreto.

### **MINIMUM**

Debe alcanzar al menos determinado umbral.

### **MAXIMUM**

No debe superar determinado umbral.

### **RANGE**

Debe mantenerse entre límites.

### **DIRECTIONAL**

Solo se conoce la dirección deseada.

### **UNKNOWN\_TARGET**

El objetivo está claro pero todavía no existe target cuantificado.

Esto es importante.

Ejemplo:

> mejorar margen

puede ser un objetivo válido aunque todavía no exista:

> margen objetivo \= 17,3 %.

No debemos inventarlo.

---

# **12\. OBJETIVOS CUALITATIVOS**

No todo objetivo empresarial debe convertirse artificialmente en una métrica.

Ejemplos:

* estabilizar operaciones;  
* reducir dependencia de paid media;  
* preparar expansión internacional;  
* desarrollar capacidad de retención;  
* reducir fragilidad de supply chain.

Estos objetivos deberán representarse como:

`QUALITATIVE_STATE`

con:

* estado deseado;  
* criterios observables;  
* evidencia necesaria;  
* horizonte temporal.

Nunca asignaremos arbitrariamente:

`strategic_objective_score = 82`.

---

# **13\. ORIGEN DEL OBJETIVO**

Cada objetivo debe declarar cómo fue obtenido.

`objective_origin`:

### **EXPLICIT**

Declarado directamente por usuario, dirección o fuente autorizada.

### **DOCUMENTED**

Extraído de documentación estratégica existente.

### **DERIVED**

Derivado determinísticamente de una regla empresarial explícita.

### **INFERRED**

Inferido por IA.

### **UNKNOWN**

Procedencia insuficiente.

---

# **14\. REGLA PARA OBJETIVOS INFERIDOS**

Un objetivo inferido por IA nunca puede adquirir silenciosamente la misma autoridad que un objetivo explícito.

Si:

`origin = INFERRED`

deberá existir:

`validation_state`.

Posibles valores:

`CONFIRMED`

`SUPPORTED`

`REQUIRES_CONFIRMATION`

`CONFLICTING`

`REJECTED`

Si el objetivo inferido puede cambiar materialmente el ranking y todavía requiere confirmación:

> P1 deberá marcar el contexto como no suficientemente validado para decisión definitiva.

---

# **15\. PROHIBICIÓN DE OBJETIVOS RETROINFERIDOS**

El motor no puede hacer:

> “Este candidato parece muy importante, por tanto el objetivo debe ser aquello que lo hace importante.”

Primero se establece el objetivo.

Después se evalúan candidatos.

Nunca al revés.

Esto evita reasoning circular.

---

# **16\. DECISION\_SCOPE**

Toda decisión debe definir qué parte del negocio abarca.

Entidad:

**DECISION\_SCOPE**

Puede hacer referencia a:

* negocio completo;  
* mercado;  
* país;  
* tienda;  
* unidad de negocio;  
* canal;  
* producto;  
* categoría;  
* customer segment;  
* proceso;  
* equipo;  
* iniciativa.

Campos:

`scope_type`

`scope_refs[]`

`inclusion_rules[]`

`exclusion_rules[]`

No debe copiar los objetos originales.

Solo referenciarlos.

---

# **17\. SCOPE INVARIANT**

Un candidato fuera del ámbito definido no debe entrar en comparación salvo que:

1. el scope se amplíe explícitamente;  
2. se cree un nuevo contexto.

Ejemplo:

si estamos priorizando:

> problemas de adquisición en España

no debe introducirse silenciosamente:

> rediseñar operaciones logísticas de Estados Unidos.

---

# **18\. DECISION\_HORIZON**

La prioridad cambia con el tiempo.

P1 deberá representar el horizonte mediante:

**DECISION\_HORIZON**

con:

* `start_at`;  
* `end_at`;  
* `horizon_label` opcional;  
* `source`;  
* `certainty`.

Debemos priorizar fechas reales cuando existan.

No utilizar arbitrariamente:

SHORT\_TERM \= 30 días

MEDIUM\_TERM \= 90 días

sin que exista una configuración explícita que lo defina.

---

# **19\. HORIZON ≠ URGENCY**

Distinción protegida:

**DECISION HORIZON**

≠

**URGENCY**

P1 define:

> durante qué periodo estamos decidiendo.

P3 determinará:

> qué ocurre si esperamos.

Un horizonte de 90 días no significa automáticamente alta o baja urgencia.

---

# **20\. OBJECTIVE DEADLINE**

Un objetivo puede tener deadline propio.

Ejemplo:

`decision_horizon`

01/10 → 31/12

pero un objetivo puede requerir:

`objective_deadline = 15/11`.

Por tanto:

`decision_horizon.end_at`

y

`objective.deadline`

son conceptos distintos.

---

# **21\. BUSINESS CONTEXT REFERENCES**

P1 puede necesitar contexto empresarial anterior.

Pero no debe duplicarlo.

Debe utilizar:

`business_context_refs[]`

para enlazar:

* estado de madurez;  
* business model;  
* situación financiera;  
* mercados activos;  
* estrategia vigente;  
* operating model;  
* otros snapshots relevantes.

La información sigue perteneciendo a sus productores originales.

---

# **22\. CURRENT BUSINESS INTENT**

Conviene diferenciar:

**BUSINESS STATE**

de

**BUSINESS INTENT**.

El estado describe:

> dónde está el negocio.

El intent describe:

> qué intenta conseguir ahora.

P1 será propietario únicamente del segundo.

---

# **23\. SUCCESS CRITERIA**

Cada objetivo deberá indicar cómo reconocer que se ha cumplido.

Entidad:

**SUCCESS\_CRITERION**

Tipos:

`METRIC_THRESHOLD`

`METRIC_RANGE`

`STATE_CHANGE`

`MILESTONE`

`EVIDENCE_BASED`

`QUALITATIVE_VALIDATION`

Campos:

* `criterion_id`;  
* `objective_id`;  
* `criterion_type`;  
* `definition`;  
* `measurement_ref`;  
* `target`;  
* `validation_method`.

Esto prepara Fase 9\.

Pero P1 no evaluará todavía resultados ni aprendizaje.

---

# **24\. BASELINE**

Cuando el objetivo sea relativo a un estado actual, deberá existir:

`baseline_ref`.

Nunca debemos guardar dentro de P1 una copia desconectada del KPI si ya existe en el snapshot empresarial.

Ejemplo:

`baseline_ref → metrics_snapshot.gross_margin`

y no:

`gross_margin_baseline = 21.7`

duplicado sin procedencia.

---

# **25\. OBJECTIVE CONFLICT**

P1 debe ser capaz de detectar conflictos entre objetivos.

Entidad:

**OBJECTIVE\_RELATIONSHIP**

Tipos mínimos:

`SUPPORTS`

`CONFLICTS_WITH`

`TRADEOFF_WITH`

`REQUIRES`

`INDEPENDENT`

Ejemplo:

crecer paid acquisition

`TRADEOFF_WITH`

preservar caja

en determinadas condiciones.

La relación no determina todavía qué candidato elegir.

Solo hace explícito que existe una tensión.

---

# **26\. CONFLICT RESOLUTION**

Cuando dos objetivos relevantes entren en conflicto:

### **Caso A — precedencia explícita**

Se aplica la precedencia declarada.

### **Caso B — satisficing definido**

Se respetan mínimos establecidos.

### **Caso C — trade-off permitido**

P8 podrá evaluar opportunity cost y capturable value.

### **Caso D — sin política de resolución**

El sistema debe:

`REQUIRES_VALIDATION`

y no inventar pesos arbitrarios.

Queda prohibido crear automáticamente:

`profit_weight = 0.6`

`growth_weight = 0.4`

si nadie ha definido esos pesos.

---

# **27\. OBJETIVOS Y CONSTRAINTS**

Debe mantenerse:

**OBJECTIVE**

≠

**CONSTRAINT**

Ejemplo:

“Maximizar crecimiento”

es objetivo.

“Caja disponible máxima: X”

puede ser constraint.

“Cumplir legislación”

puede actuar como hard gate.

P1 podrá almacenar referencias a restricciones conocidas:

`constraint_refs[]`

pero P5 será su source of truth.

---

# **28\. OBJETIVO Y KPI**

Debe mantenerse:

**OBJECTIVE**

≠

**KPI**

Un KPI mide.

Un objetivo declara una dirección o estado deseado.

Ejemplo:

`MER`

es una métrica.

> Mejorar eficiencia de adquisición manteniendo volumen rentable

es un objetivo.

No todo KPI observado debe convertirse automáticamente en objetivo.

---

# **29\. OBJETIVO Y DIAGNÓSTICO**

Debe mantenerse:

**PROBLEM**

≠

**OBJECTIVE**

Ejemplo:

Diagnóstico:

> margen de contribución deteriorándose.

Objetivo:

> recuperar rentabilidad sostenible.

El diagnóstico describe una condición.

El objetivo define el estado deseado.

P1 no debe redefinir el diagnóstico.

---

# **30\. CONTEXT\_VALIDITY**

P1 deberá producir:

`context_validity`.

Estados:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`CONFLICTING`

`INSUFFICIENT`

`STALE`

`INVALID`

---

# **31\. VALIDACIÓN MÍNIMA DEL CONTEXTO**

Para considerar:

`VALID`

deberá existir como mínimo:

* business identificado;  
* decision problem válido;  
* scope definido;  
* horizonte interpretable;  
* objetivo PRIMARY válido;  
* procedencia del objetivo;  
* objective policy coherente;  
* ausencia de conflictos irresueltos capaces de cambiar la decisión.

---

# **32\. CONTEXTO INSUFICIENTE**

Ejemplos:

### **Sin objetivo**

> “Dime qué debería mejorar.”

pero no existe ninguna inferencia defendible sobre qué intenta conseguir el negocio.

Resultado:

`INSUFFICIENT`

o

`REQUIRES_VALIDATION`.

### **Objetivos contradictorios**

> Maximizar crecimiento a cualquier coste.

y simultáneamente:

> No aumentar gasto ni consumir caja.

Sin política de resolución.

Resultado:

`CONFLICTING`.

### **Scope ambiguo**

No sabemos si priorizamos:

* empresa completa;  
* paid media;  
* tienda española;  
* nuevo mercado.

Resultado:

`REQUIRES_VALIDATION`.

---

# **33\. DEFAULTS**

Los defaults deberán utilizarse con enorme cautela.

Un default puede existir para:

* formatos;  
* versionado;  
* valores técnicos;  
* reglas organizativas previamente configuradas.

No debe existir default universal para:

* objetivo empresarial;  
* apetito de riesgo;  
* horizonte;  
* crecimiento deseado;  
* rentabilidad mínima;  
* importancia relativa.

---

# **34\. OVERRIDE HUMANO DEL CONTEXTO**

Una persona autorizada podrá corregir:

* objetivo;  
* scope;  
* horizonte;  
* precedencia entre objetivos;  
* targets.

Pero el cambio nunca debe sobrescribir la versión anterior.

Debe generar:

`new DECISION_CONTEXT version`.

Auditando:

* quién;  
* qué cambió;  
* motivo;  
* cuándo;  
* contexto reemplazado.

---

# **35\. CAMBIO MATERIAL**

P1 deberá distinguir:

**material\_change**

de

**non\_material\_change**.

Cambios materiales:

* nuevo objetivo PRIMARY;  
* cambio de target;  
* cambio de horizonte significativo;  
* cambio de scope;  
* nueva precedencia entre objetivos;  
* objetivo activado/desactivado;  
* objetivo inferido posteriormente confirmado/rechazado;  
* cambio de política multiobjetivo.

Estos cambios pueden obligar a recalcular Fase 4\.

---

# **36\. CAMBIOS NO MATERIALES**

No deberían recalcular:

* corrección ortográfica;  
* reformulación textual equivalente;  
* traducción;  
* cambio de etiqueta visual;  
* modificación de metadata no decisional;  
* orden diferente de objetivos con misma precedencia lógica.

Debe existir:

`decision_context_fingerprint`

calculado sobre significado estructurado, no sobre representación textual.

---

# **37\. OUTPUT DE P1**

Contrato:

**DECISION\_CONTEXT\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `decision_context_id` | contexto |
| `context_validity` | estado |
| `decision_problem_ref` | problema |
| `primary_objective_ref` | objetivo dominante |
| `secondary_objective_refs[]` | secundarios |
| `objective_policy` | relación entre objetivos |
| `scope_ref` | ámbito |
| `horizon_ref` | horizonte |
| `success_criterion_refs[]` | criterios |
| `constraint_refs[]` | referencias externas |
| `unresolved_conflicts[]` | conflictos |
| `unknowns[]` | incógnitas |
| `warnings[]` | limitaciones |
| `source_refs[]` | trazabilidad |
| `context_fingerprint` | identidad semántica |

---

# **38\. REASON CODES DE P1**

Familia:

`CONTEXT.*`

`OBJECTIVE.*`

`SCOPE.*`

`HORIZON.*`

Ejemplos:

`CONTEXT.MISSING_PRIMARY_OBJECTIVE`

`CONTEXT.CONFLICTING_OBJECTIVES`

`OBJECTIVE.INFERRED_UNCONFIRMED`

`OBJECTIVE.TARGET_UNKNOWN`

`OBJECTIVE.PRECEDENCE_UNDEFINED`

`SCOPE.AMBIGUOUS`

`SCOPE.OUTSIDE_BOUNDARY`

`HORIZON.MISSING`

`HORIZON.STALE`

`CONTEXT.REQUIRES_VALIDATION`

---

# **39\. INVARIANTES P1**

1. Toda priorización posee contexto.  
2. Todo contexto válido tiene objetivo principal.  
3. Un objetivo inferido no equivale automáticamente a uno confirmado.  
4. No se inventan targets.  
5. No se inventan pesos entre objetivos.  
6. Scope debe ser explícito.  
7. Horizonte no equivale a urgencia.  
8. KPI no equivale a objetivo.  
9. Diagnóstico no equivale a objetivo.  
10. Constraint no equivale a objetivo.  
11. Objetivos históricos no se sobrescriben.  
12. Cambios materiales generan nueva versión.  
13. P1 no decide qué candidato tiene prioridad.  
14. P1 no genera playbooks.  
15. Los datos empresariales externos se referencian, no se duplican.

---

# **40\. PRECONDICIONES**

P1 necesita:

* `business_id`;  
* snapshot empresarial accesible;  
* petición de decisión o contexto suficiente para construirla;  
* fuentes disponibles;  
* esquema compatible.

No necesita todavía disponer de candidatos P2.

Esto permite establecer primero:

> qué estamos intentando conseguir.

Y después:

> qué alternativas compiten.

---

# **41\. POSTCONDICIONES**

P1 termina correctamente cuando existe:

* problema decisional explícito;  
* objetivo principal;  
* política multiobjetivo definida;  
* scope;  
* horizonte;  
* procedencia;  
* validez;  
* conflictos conocidos;  
* unknowns preservados;  
* trazabilidad.

---

# **42\. FAILURE MODES**

## **Goal hallucination**

La IA inventa el objetivo empresarial.

**Prevención:** origin \+ validation state.

---

## **Revenue default**

Todo termina optimizando ventas.

**Prevención:** objetivo PRIMARY explícito.

---

## **Metric substitution**

La IA detecta un KPI malo y decide que mejorarlo es el objetivo.

**Prevención:** KPI ≠ OBJECTIVE.

---

## **Scope creep**

Se introducen problemas de áreas fuera de la decisión.

**Prevención:** DECISION\_SCOPE.

---

## **Time-horizon collapse**

Todo problema importante se convierte en urgente.

**Prevención:** HORIZON ≠ URGENCY.

---

## **Arbitrary weighting**

El modelo decide que crecimiento pesa 70 % y beneficio 30 %.

**Prevención:** no weights sin autoridad explícita.

---

## **Objective contradiction**

Dos objetivos incompatibles pasan silenciosamente a ranking.

**Prevención:** OBJECTIVE\_RELATIONSHIP \+ context validity.

---

## **Context overwrite**

El usuario modifica el objetivo y desaparece la decisión anterior.

**Prevención:** versionado inmutable.

---

# **43\. TESTS CONTRACTUALES**

| Test | Resultado |
| ----- | ----- |
| contexto sin PRIMARY | inválido |
| un PRIMARY válido | válido |
| dos PRIMARY sin policy | conflicto |
| objetivo inferido no confirmado | limitation/validation |
| objetivo explícito | autoridad válida |
| target desconocido | permanece UNKNOWN |
| KPI sin objetivo | no se convierte en objective |
| cambio textual equivalente | mismo fingerprint semántico |
| cambio de target | nuevo fingerprint |
| cambio de scope | recalcular |
| cambio de horizonte material | recalcular |
| conflicto sin precedencia | REQUIRES\_VALIDATION |
| candidato fuera de scope posteriormente | P2/P0 deberá rechazarlo |
| objetivo cualitativo | permitido |
| objetivo sin métrica | permitido si semánticamente válido |
| peso inventado | rechazo |
| diagnóstico utilizado como objective automáticamente | rechazo |

---

# **44\. EVALS PARA LA CAPA IA**

### **Goal extraction**

¿Extrae correctamente objetivos explícitos de lenguaje natural?

### **Goal hallucination**

¿Evita inventar objetivos inexistentes?

### **Objective/KPI separation**

¿Distingue una métrica problemática de una intención empresarial?

### **Scope fidelity**

¿Mantiene el ámbito solicitado?

### **Conflict detection**

¿Reconoce objetivos contradictorios?

### **Unknown preservation**

¿Evita inventar targets o deadlines?

### **Temporal separation**

¿Evita convertir horizonte en urgencia?

### **Boundary adherence**

¿Evita priorizar o generar estrategia dentro de P1?

---

# **45\. EJEMPLO ESTRUCTURAL**

Contexto empresarial:

> Ecommerce creciendo un 40 % anual pero con deterioro fuerte de caja.

Dirección declara:

> Durante los próximos seis meses queremos recuperar generación de caja sin destruir el crecimiento orgánico conseguido.

P1 podría representar:

**PRIMARY OBJECTIVE**

`QUALITATIVE_STATE`

> recuperar generación sostenible de caja.

**SECONDARY OBJECTIVE**

> proteger crecimiento orgánico.

**OBJECTIVE POLICY**

`LEXICOGRAPHIC`

1. proteger solvencia/caja;  
2. preservar crecimiento cuando sea compatible.

**HORIZON**

6 meses.

P1 todavía NO concluye:

> reducir Meta Ads.

NO concluye:

> renegociar proveedores.

NO concluye:

> aumentar precios.

NO concluye:

> CRO primero.

Eso aparecerá únicamente cuando candidatos y dimensiones posteriores sean evaluados.

---

# **46\. RELACIÓN CON P2**

La secuencia correcta será:

**P1**

WHAT ARE WE TRYING TO ACHIEVE?

↓

**P2**

WHAT REAL OPTIONS COMPETE?

Por tanto P2 recibirá:

`decision_context_ref`

y cada candidato deberá poder demostrar que:

1. pertenece al scope;  
2. es relevante para el decision problem;  
3. puede contribuir directa o indirectamente a algún objetivo activo.

Esto evita llenar el ranking de problemas técnicamente ciertos pero irrelevantes para la decisión actual.

---

# **47\. DEFINITION OF DONE — P1**

P1 se considera completo cuando el sistema puede responder estructuralmente:

**WHY ARE WE DECIDING?**

Existe un problema decisional.

**WHAT ARE WE OPTIMIZING FOR?**

Existe un objetivo principal explícito.

**WHAT ELSE MATTERS?**

Existen objetivos secundarios diferenciados.

**HOW DO OBJECTIVES INTERACT?**

Existe política de precedencia o conflicto.

**WHERE DOES THIS DECISION APPLY?**

Existe scope.

**FOR WHAT PERIOD?**

Existe horizonte.

**HOW WILL SUCCESS BE RECOGNIZED?**

Existen criterios verificables.

**WHO/WHAT DEFINED THE OBJECTIVE?**

Existe procedencia.

**WHAT DO WE NOT KNOW?**

Los unknowns permanecen explícitos.

**IS THE CONTEXT SAFE TO USE?**

Existe `context_validity`.

**WOULD A MATERIAL CHANGE FORCE A NEW DECISION?**

Existe versionado y fingerprint.

P1 no decide todavía qué merece prioridad.

Solo garantiza que, cuando P2–P12 empiecen a comparar, estén intentando resolver **el problema empresarial correcto**.

