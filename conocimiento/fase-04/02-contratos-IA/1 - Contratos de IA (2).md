# **P2 — NORMALIZACIÓN DE CANDIDATOS**

## **0\. Propósito**

P2 define qué elementos pueden entrar legítimamente en una decisión de prioridad.

Su responsabilidad es transformar información procedente del diagnóstico, del contexto empresarial y de otras fuentes autorizadas en un conjunto controlado de:

**PRIORITY\_CANDIDATES**

que posteriormente podrán ser evaluados por P3–P9.

P2 responde:

> ¿Qué elementos reales están compitiendo por atención dentro de esta decisión?

P2 NO decide todavía cuál tiene más prioridad.

P2 determina:

* qué puede competir;  
* qué no puede competir;  
* qué representa realmente cada candidato;  
* qué elementos son equivalentes;  
* cuáles son duplicados;  
* cuáles están mal definidos;  
* cuáles están fuera de scope;  
* cuáles deben permanecer separados;  
* qué relaciones existen entre ellos;  
* qué evidencia justifica su existencia.

La regla fundamental es:

> NO TODO LO DETECTADO ES AUTOMÁTICAMENTE UN CANDIDATO DE PRIORIDAD.

---

# **1\. Entidad raíz**

La entidad principal será:

**PRIORITY\_CANDIDATE**

Representa:

> una unidad normalizada de atención empresarial que puede ser evaluada dentro de un DECISION\_CONTEXT concreto.

Relación:

`DECISION_CONTEXT`

→ `CANDIDATE_SET`

→ `PRIORITY_CANDIDATE[]`

P2 será source of truth del conjunto de candidatos utilizado por la ejecución de Fase 4\.

---

# **2\. CANDIDATE\_SET**

Toda ejecución utilizará un conjunto explícito:

**CANDIDATE\_SET**

Campos:

| Campo | Obligatorio | Propósito |
| ----- | ----- | ----- |
| `candidate_set_id` | Sí | identidad del conjunto |
| `decision_context_id` | Sí | contexto que lo gobierna |
| `business_id` | Sí | ecommerce |
| `candidate_ids[]` | Sí | miembros |
| `set_version` | Sí | versionado |
| `normalization_policy_version` | Sí | reglas empleadas |
| `created_at` | Sí | creación |
| `source_snapshot_refs[]` | Sí | procedencia |
| `set_fingerprint` | Sí | equivalencia semántica |

Un `CANDIDATE_SET` puede contener cero candidatos válidos.

Eso no constituye un error técnico.

Puede producir posteriormente:

`NO_VALID_CANDIDATES`.

---

# **3\. PRIORITY\_CANDIDATE NO ES UNA ACCIÓN**

Esta frontera es crítica.

Un candidato representa:

> aquello que puede merecer atención.

No representa todavía:

> cómo resolverlo.

Ejemplo válido:

> baja conversión mobile checkout.

Ejemplo todavía válido:

> incertidumbre crítica sobre profitability por cohortes.

Ejemplo NO válido en P2:

> instalar una herramienta determinada y lanzar tres tests A/B.

Eso pertenece a Fase 5\.

Por tanto:

**PRIORITY\_CANDIDATE**

≠

**INTERVENTION**

≠

**PLAYBOOK**

≠

**EXECUTION\_TASK**

---

# **4\. ESTRUCTURA DE PRIORITY\_CANDIDATE**

Contrato conceptual:

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `candidate_id` | Sí | identidad |
| `candidate_set_id` | Sí | conjunto |
| `business_id` | Sí | negocio |
| `decision_context_id` | Sí | contexto |
| `subject_ref` | Sí | objeto original |
| `candidate_kind` | Sí | naturaleza |
| `candidate_statement` | Sí | representación humana |
| `scope_fit` | Sí | compatibilidad con P1 |
| `normalization_state` | Sí | estado del candidato |
| `source_refs[]` | Sí | procedencia |
| `evidence_refs[]` | Condicional | soporte |
| `epistemic_state` | Sí | naturaleza del conocimiento |
| `granularity_level` | Sí | nivel |
| `parent_candidate_id` | Opcional | jerarquía |
| `related_candidate_ids[]` | Opcional | relaciones |
| `canonical_key` | Sí | deduplicación |
| `created_at` | Sí | trazabilidad |
| `candidate_version` | Sí | versionado |

---

# **5\. CANDIDATE\_KIND**

No debemos reducir todos los candidatos a `"problem"`.

Un candidato puede representar diferentes tipos de objeto decisional.

Taxonomía mínima:

`ISSUE`

Problema empresarial observado o diagnosticado.

`ROOT_CAUSE`

Causa raíz suficientemente soportada.

`CONSTRAINT`

Factor que limita el sistema.

`OPPORTUNITY`

Potencial de mejora o captura de valor.

`RISK_EXPOSURE`

Riesgo relevante que puede necesitar atención.

`UNCERTAINTY`

Información desconocida suficientemente material como para competir por validación.

`OBLIGATION`

Necesidad no discrecional proveniente de una obligación externa o interna válida.

`CAPABILITY_GAP`

Capacidad estructural ausente o insuficiente.

`STRATEGIC_GAP`

Brecha respecto al estado estratégico deseado.

El enum puede ampliarse si aparecen nuevas categorías realmente distintas.

No debe convertirse en un catálogo de áreas ecommerce.

---

# **6\. ORIGEN ≠ NATURALEZA**

Debe distinguirse:

`candidate_kind`

de

`candidate_origin`.

Ejemplo:

un `CONSTRAINT`

puede proceder de:

* diagnóstico;  
* regla empresarial;  
* sistema externo;  
* usuario;  
* análisis operativo.

Por tanto:

`candidate_origin` podría contener:

`DIAGNOSTIC`

`BUSINESS_RULE`

`USER_DECLARED`

`SYSTEM_DETECTED`

`EXTERNAL_REQUIREMENT`

`MODEL_INFERENCE`

`OTHER_AUTHORIZED_SOURCE`

La procedencia no altera la naturaleza conceptual del candidato.

---

# **7\. SOURCE OBJECT**

P2 no debe copiar los objetos de Fase 3\.

Debe utilizar:

`subject_ref`

Ejemplo:

`subject_ref → diagnosis.root_cause.482`

P2 añade únicamente la representación necesaria para convertir ese objeto en candidato de prioridad.

La source of truth del diagnóstico sigue perteneciendo a Fase 3\.

---

# **8\. CANDIDATE\_STATEMENT**

Cada candidato deberá disponer de una formulación suficientemente precisa para permitir comparación.

Debe describir:

> qué merece potencialmente atención.

No debe contener:

* estrategia;  
* playbook;  
* solución concreta;  
* ranking;  
* valoración de impacto;  
* urgencia;  
* esfuerzo;  
* recomendación.

Ejemplo correcto:

> Dependencia excesiva de adquisición pagada para generar nuevos ingresos.

Ejemplo contaminado:

> Dependencia excesiva de paid media que debemos resolver inmediatamente diversificando con SEO y afiliación.

El segundo ya mezcla:

* candidato;  
* prioridad;  
* urgencia;  
* estrategia.

Debe rechazarse o normalizarse.

---

# **9\. NORMALIZATION\_STATE**

Todo candidato tendrá estado:

`RAW`

Recibido pero todavía no normalizado.

`NORMALIZING`

En proceso.

`VALID`

Unidad válida para evaluación.

`VALID_WITH_LIMITATIONS`

Puede entrar pero existen limitaciones.

`REQUIRES_REFINEMENT`

Demasiado ambiguo o amplio.

`DUPLICATE`

Representa sustancialmente otro candidato.

`MERGED`

Integrado en otro candidato.

`OUT_OF_SCOPE`

No pertenece al contexto P1.

`UNSUPPORTED`

No existe soporte mínimo.

`INVALID`

No representa un candidato legítimo.

Solo candidatos:

`VALID`

o

`VALID_WITH_LIMITATIONS`

pueden pasar normalmente a P3–P9.

---

# **10\. PRINCIPIO DE GRANULARIDAD**

El candidato debe tener un nivel suficiente para ser evaluado.

No puede ser tan amplio como:

> Marketing.

Ni tan microscópico como:

> El botón \#A17 tiene 2 px menos de padding.

salvo que esa característica sea material para el problema decisional.

P2 deberá representar:

`granularity_level`.

Valores iniciales:

`SYSTEM`

`DOMAIN`

`CAPABILITY`

`PROCESS`

`ISSUE`

`SUB_ISSUE`

No significan prioridad.

Representan profundidad estructural.

---

# **11\. GRANULARITY COMPATIBILITY**

Dos candidatos pueden coexistir con diferente granularidad.

Pero no deben competir ingenuamente si uno contiene al otro.

Ejemplo:

A:

> baja rentabilidad global.

B:

> CAC elevado.

C:

> CPM de Meta elevado.

Si B y C son componentes explicativos de A, P2 debe registrar la relación.

No debemos rankearlos como tres elementos completamente independientes.

---

# **12\. CANDIDATE\_RELATIONSHIP**

Entidad:

**CANDIDATE\_RELATIONSHIP**

Tipos iniciales:

`PARENT_OF`

`CHILD_OF`

`CONTRIBUTES_TO`

`CAUSED_BY`

`CAUSES`

`OVERLAPS_WITH`

`DUPLICATES`

`MUTUALLY_EXCLUSIVE_WITH`

`RELATED_TO`

`SAME_UNDERLYING_ISSUE`

Estas relaciones NO sustituyen las dependencias de P5.

---

# **13\. RELATIONSHIP ≠ DEPENDENCY**

Distinción obligatoria:

`CAUSES`

≠

`REQUIRES_BEFORE_EXECUTION`

Ejemplo:

el problema A puede causar B.

Eso no implica necesariamente:

> A debe resolverse antes que B.

Las relaciones causales proceden principalmente de Fase 3\.

Las dependencias decisionales/operativas pertenecen a P5.

P2 conserva relaciones estructurales pero no inventa execution sequence.

---

# **14\. DUPLICADOS**

Dos observaciones diferentes pueden acabar representando el mismo candidato.

Ejemplo:

Fuente A:

> CVR móvil cae.

Fuente B:

> sesiones mobile convierten significativamente peor.

Fuente C:

> checkout mobile presenta deterioro.

P2 deberá determinar si estamos ante:

* el mismo candidato;  
* candidatos parcialmente solapados;  
* causas diferentes;  
* síntomas diferentes.

Nunca debe hacer deduplicación únicamente por similitud textual.

---

# **15\. CANONICAL\_KEY**

Cada candidato deberá disponer de:

`canonical_key`

generada a partir de su identidad semántica normalizada.

No debe depender únicamente del texto.

Conceptualmente puede considerar:

* business;  
* scope;  
* subject;  
* candidate kind;  
* entidad afectada;  
* nivel de granularidad;  
* temporalidad relevante.

Sirve para:

* deduplicación;  
* idempotencia;  
* comparación entre runs;  
* candidate drift.

---

# **16\. DUPLICATE RESOLUTION**

Cuando dos candidatos son materialmente equivalentes:

uno se mantiene como:

`VALID`

y los demás pasan a:

`DUPLICATE`

o

`MERGED`.

Debe conservarse:

`merged_into_candidate_id`

y

`original_source_refs[]`.

Ninguna evidencia debe perderse al fusionar candidatos.

---

# **17\. PROHIBICIÓN DE MERGE DESTRUCTIVO**

Un merge no puede destruir diferencias materialmente relevantes.

Ejemplo:

> baja conversión mobile.

y

> baja conversión desktop.

No deberían fusionarse en:

> baja conversión.

si:

* sus causas pueden ser distintas;  
* su impacto puede ser distinto;  
* su urgencia puede ser distinta;  
* pueden requerir decisiones distintas.

La normalización debe reducir ruido, no información decisional.

---

# **18\. EQUIVALENCIA SEMÁNTICA**

Dos candidatos pueden considerarse equivalentes únicamente si, dentro del contexto P1:

> tratarlos como una misma unidad no altera materialmente la evaluación posterior.

Esta es la prueba clave.

Si fusionarlos puede cambiar:

* impacto;  
* urgencia;  
* riesgo;  
* factibilidad;  
* dependencia;  
* ranking;

no son equivalentes para Fase 4\.

---

# **19\. SCOPE\_FIT**

Cada candidato deberá ser validado contra P1.

`scope_fit`:

`IN_SCOPE`

`PARTIALLY_IN_SCOPE`

`OUT_OF_SCOPE`

`UNCERTAIN`

`PARTIALLY_IN_SCOPE` requiere decidir si:

* se normaliza solo la parte aplicable;  
* se divide el candidato;  
* se amplía el contexto;  
* se excluye.

No debe entrar intacto silenciosamente.

---

# **20\. OBJECTIVE\_RELEVANCE**

Un candidato debería poder relacionarse con al menos un objetivo de P1.

Contrato:

`objective_refs[]`

Esto significa:

> existe una razón plausible para que este candidato importe dentro del contexto actual.

No significa todavía:

> este candidato tiene gran impacto.

Eso pertenece a P4.

---

# **21\. CANDIDATE RELEVANCE ≠ IMPACT**

P2 puede decidir:

> candidato relevante para el objetivo.

Pero no:

> candidato muy importante.

La relevancia es un gate semántico de inclusión.

El impacto es una dimensión posterior.

---

# **22\. EPISTEMIC STATE**

Todo candidato deberá conservar el estado epistemológico de su fundamento.

Valores compatibles con P0:

`OBSERVED`

`CALCULATED`

`ESTIMATED`

`INFERRED`

`UNKNOWN`

Cuando el candidato dependa de múltiples fuentes podrá existir:

`epistemic_composition`.

Ejemplo:

diagnóstico soportado parcialmente por:

* métricas observadas;  
* inferencia causal.

Debe conservarse esa mezcla.

---

# **23\. CANDIDATO BASADO EN HIPÓTESIS**

Una hipótesis puede convertirse en candidato únicamente si el objeto prioritario es realmente:

> validar esa incertidumbre.

Ejemplo:

Hipótesis:

> la caída de CVR podría proceder de problemas mobile.

No debería convertirse automáticamente en:

> solucionar problemas mobile.

Puede convertirse en:

`UNCERTAINTY`

> validar si el deterioro mobile explica la caída de conversión.

Esto protege:

HYPOTHESIS ≠ FACT.

---

# **24\. CANDIDATOS DE VALIDACIÓN**

Esta categoría es fundamental.

A veces lo prioritario no es:

> actuar.

Sino:

> descubrir algo.

Por tanto un `UNCERTAINTY` puede competir por atención cuando:

* la incertidumbre es material;  
* puede cambiar una decisión;  
* existe posibilidad real de reducirla;  
* el coste de decidir sin validarla es relevante.

P7/P8 podrán posteriormente valorar esa importancia.

P2 solo habilita el objeto.

---

# **25\. OPPORTUNITY CANDIDATES**

Fase 4 no debe trabajar exclusivamente sobre problemas.

También puede priorizar oportunidades.

Ejemplo:

> expansión rentable demostrada de un producto hacia un segmento adyacente.

Puede existir aunque el negocio no tenga una “avería”.

Esto evita que el motor se convierta únicamente en un sistema de reparación.

---

# **26\. OBLIGATION CANDIDATES**

Algunas unidades de atención pueden proceder de obligaciones.

Ejemplo conceptual:

* deadline contractual;  
* requirement operativo obligatorio;  
* requirement regulatorio;  
* compromiso empresarial aprobado.

P2 las admite como:

`OBLIGATION`.

P3/P5 determinarán posteriormente sus efectos temporales o de gate.

P2 no asume automáticamente máxima prioridad.

---

# **27\. ROOT CAUSE Y SYMPTOM**

Cuando Fase 3 proporciona:

SYMPTOM

CAUSE

ROOT\_CAUSE

P2 debe preservar cada tipo.

La existencia de una root cause NO implica automáticamente que:

* los síntomas desaparezcan del candidate set;  
* todos los síntomas sean irrelevantes;  
* solo la causa raíz pueda ser prioritaria.

Pero debe evitar tratarlos como unidades independientes cuando exista relación conocida.

---

# **28\. CANDIDATE COLLAPSE**

Puede existir un caso:

A \= síntoma

B \= causa

C \= root cause

y solamente C merece existir como candidato autónomo.

P2 puede colapsar A/B dentro de C si:

* A y B no necesitan atención independiente;  
* no poseen consecuencias independientes;  
* su evaluación separada solo duplicaría valor;  
* la trazabilidad causal se conserva.

Resultado:

C permanece candidato.

A/B permanecen accesibles como fuentes o relaciones diagnósticas.

---

# **29\. CANDIDATE SPLIT**

También puede ocurrir lo contrario.

Raw candidate:

> problemas de logística.

Demasiado amplio.

Puede necesitar dividirse en:

* stockouts recurrentes;  
* lead time excesivo;  
* coste de fulfillment;  
* tasa de incidencias.

Solo si representan problemas decisionalmente separables.

El sistema no divide por gusto taxonómico.

Divide cuando las unidades pueden:

* tener prioridades diferentes;  
* depender de factores distintos;  
* requerir evaluación independiente.

---

# **30\. REQUIRES\_REFINEMENT**

Un candidato pasa a:

`REQUIRES_REFINEMENT`

cuando no puede evaluarse responsablemente.

Ejemplos:

> mejorar marketing.

> trabajar branding.

> arreglar operaciones.

> escalar.

> optimizar la web.

No deben recibir scores.

Primero deben convertirse en unidades evaluables.

---

# **31\. REFINEMENT RESULT**

Una refinación puede producir:

### **CLARIFIED**

Mismo candidato, mayor precisión.

### **SPLIT**

Uno se convierte en varios.

### **REJECTED**

No existía problema suficientemente definido.

### **DEFERRED**

La evidencia actual no permite estructurarlo.

Toda transformación debe mantener lineage.

---

# **32\. COMPARABILITY**

P2 deberá declarar si los candidatos pertenecen a un espacio razonablemente comparable.

Campo:

`comparison_domain`.

Esto no significa que solo puedan competir candidatos del mismo área.

Puede competir:

* logística;  
* marketing;  
* finance;  
* retention.

Pero el sistema debe conocer qué está comparando.

---

# **33\. CROSS-DOMAIN PRIORITIZATION**

Fase 4 debe permitir competencia entre dominios.

Ejemplo:

* paid media;  
* cash flow;  
* supply chain;  
* CRO.

Porque la dirección empresarial necesita saber:

> dónde poner recursos primero.

Por tanto nunca debemos crear rankings aislados obligatorios por departamento como regla universal.

Los domains son metadata.

No fronteras de prioridad.

---

# **34\. NON-COMPARABLE CANDIDATES**

Dos candidatos no deberían compararse directamente cuando pertenecen a decisiones distintas.

Ejemplo:

Contexto A:

> prioridades del negocio durante Q4.

Contexto B:

> selección del proveedor logístico para Alemania.

Ambos podrían ser relevantes empresarialmente.

Pero pertenecen a diferentes `DECISION_CONTEXT`.

No deben aparecer en el mismo candidate set.

---

# **35\. CANDIDATE ELIGIBILITY**

Después de normalizar, cada candidato recibirá:

`eligibility_state`.

Valores:

`ELIGIBLE`

`ELIGIBLE_WITH_LIMITATIONS`

`INELIGIBLE`

`PENDING_INFORMATION`

Razones de ineligibilidad pueden incluir:

* fuera de scope;  
* duplicado;  
* mal definido;  
* unsupported;  
* pertenece a otra decisión;  
* no es una unidad de atención;  
* representa una acción de Fase 5\.

---

# **36\. ELIGIBILITY ≠ PRIORITY**

Un candidato:

`ELIGIBLE`

solo significa:

> puede ser evaluado.

No significa:

> merece atención.

P3–P10 determinarán eso.

---

# **37\. MINIMUM EVIDENCE REQUIREMENT**

P2 necesita soporte mínimo para crear un candidato válido.

No necesariamente certeza.

Debe existir al menos una de estas condiciones:

* referencia diagnóstica válida;  
* dato observado relevante;  
* obligación externa acreditada;  
* objetivo estratégico documentado;  
* declaración autorizada;  
* inferencia explícitamente marcada y soportada.

Queda prohibido crear candidatos únicamente porque el modelo generativo “cree que podría ser buena idea revisar algo”.

---

# **38\. MODEL-GENERATED CANDIDATES**

La IA puede proponer candidatos no explícitos cuando el sistema lo autorice.

Pero deberán identificarse:

`candidate_origin = MODEL_INFERENCE`

y requerir:

* evidence refs;  
* inference ref;  
* epistemic state;  
* reason code;  
* validation state.

Una sugerencia generativa sin evidencia no entra automáticamente en el candidate set válido.

---

# **39\. CANDIDATE VALIDATION STATE**

Para candidatos inferidos o débiles:

`CONFIRMED`

`SUPPORTED`

`PROVISIONAL`

`REQUIRES_VALIDATION`

`CONFLICTING`

`REJECTED`

Un candidato `PROVISIONAL` puede, dependiendo de política, llegar a P3–P9 con limitaciones.

Un `REQUIRES_VALIDATION` puede transformarse precisamente en un candidato `UNCERTAINTY`.

---

# **40\. MATERIAL DUPLICATION**

P2 debe prevenir especialmente el double counting.

Ejemplo:

1. baja rentabilidad;  
2. margen deteriorado;  
3. contribution margin insuficiente;  
4. beneficio por pedido bajo.

Podrían representar:

* cuatro fenómenos distintos;  
* o distintas expresiones del mismo deterioro económico.

Si todos pasan independientes a P4/P8, el sistema puede contar cuatro veces el mismo valor.

P2 debe resolver esto antes.

---

# **41\. VALUE DOUBLE COUNTING PROTECTION**

P2 no calcula valor.

Pero deberá proporcionar a P4/P8 suficiente estructura para detectar:

`shared_value_pool`.

Cuando candidatos están ligados al mismo resultado económico:

`potential_shared_value = true`

o mediante relación equivalente.

Esto permite evitar:

> sumar €100k \+ €100k \+ €100k

cuando los tres candidatos están capturando el mismo €100k subyacente.

---

# **42\. CANDIDATE GROUP**

Cuando varios candidatos pertenecen a un mismo problema superior puede utilizarse:

**CANDIDATE\_GROUP**

Campos:

* `candidate_group_id`;  
* `group_type`;  
* `member_candidate_ids[]`;  
* `parent_subject_ref`;  
* `group_reason`.

No debe utilizarse para fabricar prioridades grupales automáticamente.

Sirve para estructura y portfolio.

---

# **43\. TEMPORAL IDENTITY**

Dos apariciones del mismo problema en momentos diferentes pueden representar:

* el mismo candidato persistente;  
* una recaída;  
* un nuevo evento.

P2 deberá separar:

`candidate_id`

de

`canonical_candidate_identity`.

Esto permitirá posteriormente saber:

> este constraint lleva apareciendo seis meses.

sin modificar runs anteriores.

---

# **44\. CANDIDATE INSTANCE**

Puede modelarse:

**CANDIDATE\_INSTANCE**

como aparición de una identidad canónica dentro de un run.

Conceptualmente:

`CANONICAL_CANDIDATE`

→ múltiples `CANDIDATE_INSTANCE`

Esto permite longitudinalidad sin romper inmutabilidad.

No es obligatorio implementar físicamente dos tablas si una arquitectura más simple mantiene ambas identidades.

Pero conceptualmente deben distinguirse.

---

# **45\. SOURCE LINEAGE**

Toda instancia deberá poder reconstruirse:

SOURCE

↓

OBSERVATION / FACT / INFERENCE

↓

DIAGNOSIS / BUSINESS CONTEXT

↓

RAW CANDIDATE

↓

NORMALIZATION TRANSFORMATION

↓

PRIORITY\_CANDIDATE

La normalización nunca debe borrar el origen.

---

# **46\. NORMALIZATION\_TRACE**

Toda transformación significativa deberá registrar:

**NORMALIZATION\_TRACE**

Campos:

| Campo | Función |
| ----- | ----- |
| `normalization_trace_id` | identidad |
| `input_refs[]` | objetos originales |
| `operation` | transformación |
| `output_candidate_ids[]` | resultado |
| `rule_id` | regla |
| `reason_codes[]` | motivo |
| `model_inference_ref` | si intervino IA |
| `created_at` | momento |

Operaciones posibles:

`CREATE`

`CLARIFY`

`MERGE`

`SPLIT`

`REJECT`

`MARK_DUPLICATE`

`MARK_OUT_OF_SCOPE`

`RECLASSIFY`

---

# **47\. DETERMINISTIC VS AI**

## **Debe ser determinista cuando sea posible**

* validación de IDs;  
* scope explícito;  
* duplicados exactos;  
* canonical refs;  
* reglas de incompatibilidad;  
* estados;  
* relaciones ya conocidas;  
* constraints de schema;  
* transformations declaradas.

## **Puede requerir IA**

* equivalencia semántica;  
* detección de solapamiento;  
* clasificación de candidate kind;  
* refinamiento de lenguaje;  
* identificación de granularidad;  
* detección de candidatos implícitos.

Pero la IA debe producir:

* resultado estructurado;  
* evidencia;  
* inference trace;  
* incertidumbres.

---

# **48\. PROHIBICIÓN DE NORMALIZACIÓN CREATIVA**

La función de normalización no es:

> inventar mejores problemas.

Es:

> representar correctamente los problemas existentes.

Si durante normalización aparece un candidato completamente nuevo:

deberá tratarse como:

`MODEL_INFERENCE`

y no como una transformación neutra.

---

# **49\. CANDIDATE DRIFT**

Debe poder detectarse cuando un candidato históricamente identificado cambia materialmente de significado.

Ejemplo inicial:

> problemas de adquisición.

Posteriormente:

> deterioro exclusivo de Meta prospecting en Alemania.

No debe reutilizarse la misma identidad canónica automáticamente.

La semántica ha cambiado.

---

# **50\. CANDIDATE SET COMPLETENESS**

P2 puede declarar:

`candidate_set_completeness`.

Estados:

`SUFFICIENT`

`SUFFICIENT_WITH_LIMITATIONS`

`POTENTIALLY_INCOMPLETE`

`KNOWN_INCOMPLETE`

`UNKNOWN`

No pretende garantizar:

> hemos encontrado absolutamente todos los problemas del ecommerce.

Significa:

> disponemos de un universo suficientemente representativo para esta decisión.

---

# **51\. COMPLETENESS ≠ CERTAINTY**

Un candidate set puede ser completo respecto al contexto y contener candidatos inciertos.

Y puede contener candidatos muy bien demostrados pero ser claramente incompleto.

Son dimensiones diferentes.

---

# **52\. ABSTENTION CONDITIONS**

P2 puede provocar abstención cuando:

* no existe ningún candidato válido;  
* el set está gravemente incompleto;  
* la granularidad impide comparación;  
* existen duplicidades irresolubles materialmente importantes;  
* el scope no permite determinar pertenencia;  
* candidatos críticos están basados exclusivamente en inferencias sin soporte.

No toda limitación requiere abstenerse.

Puede utilizarse:

`VALID_WITH_LIMITATIONS`.

---

# **53\. OUTPUT DE P2**

Contrato:

**CANDIDATE\_NORMALIZATION\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_set_id` | conjunto |
| `decision_context_id` | contexto |
| `candidate_ids[]` | candidatos válidos |
| `excluded_candidate_refs[]` | excluidos |
| `merged_candidate_refs[]` | merges |
| `candidate_group_refs[]` | agrupaciones |
| `normalization_trace_refs[]` | trazabilidad |
| `set_completeness` | suficiencia |
| `unknowns[]` | incertidumbres |
| `warnings[]` | limitaciones |
| `set_fingerprint` | equivalencia |
| `normalization_validity` | resultado |

---

# **54\. NORMALIZATION\_VALIDITY**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT`

`NO_VALID_CANDIDATES`

`INVALID`

---

# **55\. REASON CODES**

Familia:

`CANDIDATE.*`

`NORMALIZATION.*`

Ejemplos:

`CANDIDATE.OUT_OF_SCOPE`

`CANDIDATE.DUPLICATE`

`CANDIDATE.UNSUPPORTED`

`CANDIDATE.TOO_BROAD`

`CANDIDATE.TOO_GRANULAR`

`CANDIDATE.ACTION_NOT_PRIORITY_OBJECT`

`CANDIDATE.MODEL_INFERRED`

`CANDIDATE.REQUIRES_REFINEMENT`

`NORMALIZATION.MERGED`

`NORMALIZATION.SPLIT`

`NORMALIZATION.SEMANTIC_CONFLICT`

`NORMALIZATION.SET_INCOMPLETE`

`NORMALIZATION.NO_VALID_CANDIDATES`

---

# **56\. INVARIANTES P2**

1. Todo candidato pertenece a exactamente un candidate set dentro de una ejecución.  
2. Todo candidate set pertenece a un Decision Context.  
3. Ningún candidato fuera de scope pasa a evaluación normal.  
4. Ningún playbook se representa como PRIORITY\_CANDIDATE.  
5. Ningún duplicado debe recibir evaluación independiente sin justificación.  
6. Ningún merge destruye diferencias decisionalmente materiales.  
7. Ningún candidato inferido se presenta como observado.  
8. Todo candidato conserva source lineage.  
9. HYPOTHESIS no se convierte automáticamente en FACT.  
10. SYMPTOM no se convierte automáticamente en ROOT\_CAUSE.  
11. CAUSAL RELATIONSHIP no implica EXECUTION DEPENDENCY.  
12. ELIGIBILITY no implica PRIORITY.  
13. RELEVANCE no implica IMPACT.  
14. Candidate kind no debe codificar áreas funcionales.  
15. Ninguna normalización puede introducir una solución de Fase 5\.  
16. UNKNOWN permanece UNKNOWN.  
17. Una transformación semántica significativa debe ser trazable.  
18. El mismo value pool no debe multiplicarse por duplicación conceptual.

---

# **57\. PRECONDICIONES**

Para ejecutar P2 debe existir:

* `DECISION_CONTEXT` utilizable;  
* business identificado;  
* scope disponible;  
* objetivos disponibles;  
* fuentes candidatas accesibles;  
* contratos upstream compatibles.

Si P1 es:

`INVALID`

P2 no debería continuar.

Si P1 es:

`VALID_WITH_LIMITATIONS`

P2 puede continuar preservando dichas limitaciones.

---

# **58\. POSTCONDICIONES**

P2 finaliza correctamente cuando:

* existe candidate set;  
* cada candidato posee identidad;  
* cada candidato tiene naturaleza;  
* cada candidato está dentro de scope;  
* cada candidato posee procedencia;  
* duplicados relevantes han sido tratados;  
* relaciones estructurales se preservan;  
* unidades excesivamente amplias han sido refinadas;  
* acciones/playbooks han sido rechazados;  
* completeness ha sido evaluada;  
* existe normalization trace.

---

# **59\. FAILURE MODES**

## **Raw finding ranking**

Todo hallazgo del diagnóstico pasa directamente al ranking.

**Consecuencia:** ruido y duplicación.

**Prevención:** normalization state.

---

## **Problem/action mixing**

Compiten:

> CAC elevado

contra

> lanzar email marketing.

**Consecuencia:** comparación semánticamente inválida.

**Prevención:** PRIORITY\_CANDIDATE ≠ INTERVENTION.

---

## **Duplicate inflation**

Cinco síntomas del mismo problema reciben cinco prioridades.

**Consecuencia:** double counting.

**Prevención:** canonical identity \+ relationships.

---

## **Root-cause absolutism**

Solo se permiten root causes.

**Consecuencia:** se pierden riesgos, oportunidades o incertidumbres relevantes.

**Prevención:** candidate kinds separados.

---

## **Semantic overmerge**

Todo se fusiona en:

> mejorar rentabilidad.

**Consecuencia:** candidato inútil.

**Prevención:** material equivalence rule.

---

## **Semantic oversplit**

Cada métrica genera un candidato.

**Consecuencia:** cientos de unidades artificiales.

**Prevención:** granularity rules.

---

## **Strategy leakage**

Los candidatos contienen soluciones.

**Consecuencia:** P4 compara acciones antes de Fase 5\.

**Prevención:** rejection rule.

---

## **AI candidate hallucination**

El modelo inventa problemas razonables sin evidencia.

**Consecuencia:** decisiones sobre problemas inexistentes.

**Prevención:** model inference contract.

---

# **60\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| diagnosis válido dentro de scope | candidato válido |
| elemento fuera de scope | OUT\_OF\_SCOPE |
| mismo candidato con dos textos | deduplicación |
| textos similares con significado distinto | no merge |
| síntoma y root cause relacionados | relación preservada |
| causalidad conocida | no crear dependency automática |
| candidato `"mejorar marketing"` | REQUIRES\_REFINEMENT |
| candidato contiene playbook | rechazo/normalización |
| oportunidad acreditada | candidato permitido |
| incertidumbre material | UNCERTAINTY permitido |
| inferencia IA sin evidencia | UNSUPPORTED |
| inferencia IA con evidencia | PROVISIONAL/SUPPORTED |
| candidato duplicado | no evaluación independiente |
| candidato dividido | lineage preservado |
| merge | todas las fuentes preservadas |
| mismo input semántico | mismo set fingerprint |
| cambio solo de redacción | misma identidad semántica |
| cambio material de scope | nueva identidad/set |
| candidate set vacío | NO\_VALID\_CANDIDATES |
| UNKNOWN | no convertido en dato |

---

# **61\. EVALS DE IA**

### **Semantic deduplication eval**

¿Detecta dos formulaciones equivalentes sin fusionar conceptos distintos?

### **Granularity eval**

¿Evita candidatos excesivamente amplios o microscópicos?

### **Strategy leakage eval**

¿Evita convertir soluciones en candidatos?

### **Candidate hallucination eval**

¿Evita introducir objetos sin soporte?

### **Diagnostic distinction eval**

¿Mantiene symptom, cause, root cause y constraint separados?

### **Scope adherence eval**

¿Excluye correctamente elementos ajenos a P1?

### **Uncertainty candidate eval**

¿Reconoce cuándo la validación de una incertidumbre merece convertirse en objeto de atención?

### **Merge safety eval**

¿Evita merges que puedan alterar evaluaciones posteriores?

---

# **62\. EJEMPLO CONCEPTUAL**

Supongamos que Fase 3 produce:

A.

> MER cae durante ocho semanas.

B.

> CAC aumenta un 28 %.

C.

> Meta prospecting presenta deterioro de eficiencia.

D.

> Creatividades llevan 70 días sin renovación significativa.

E.

> Hipótesis: existe creative fatigue.

Una normalización incorrecta produciría cinco candidatos.

P2 debe reconstruir la estructura.

Por ejemplo:

**Candidate 1**

`ISSUE`

> Deterioro de eficiencia de adquisición en Meta prospecting.

Relacionado con:

* MER;  
* CAC;  
* diagnóstico del canal.

**Candidate 2**

`ROOT_CAUSE` o `ISSUE`, dependiendo de Fase 3

> degradación del rendimiento creativo.

Solo si existe soporte suficiente.

Si todavía no está demostrada:

**Candidate 2**

`UNCERTAINTY`

> Validar si creative fatigue explica materialmente el deterioro de adquisición.

P2 todavía NO concluye:

> Candidate 2 es más importante.

Tampoco concluye:

> producir 20 nuevos anuncios.

Eso corresponde a fases posteriores.

---

# **63\. INTERFAZ CON P3–P9**

Cada candidato válido sale de P2 con identidad estable.

Posteriormente:

P3 preguntará:

> ¿Qué ocurre temporalmente con este candidato?

P4:

> ¿Qué valor está en juego?

P5:

> ¿Qué lo bloquea y de qué depende?

P6:

> ¿Qué recursos exige?

P7:

> ¿Qué downside y reversibilidad existen?

P8:

> ¿Cuál es el EV y coste de oportunidad?

P9:

> ¿Encaja con negocio, estrategia y madurez?

P2 no responde ninguna de ellas.

Su trabajo es garantizar que todas estén evaluando **la misma unidad semántica**.

---

# **64\. CONTRATO CON P10**

P10 solo podrá rankear:

`ELIGIBLE PRIORITY_CANDIDATES`.

Nunca:

* raw findings;  
* duplicates;  
* rejected;  
* out-of-scope;  
* playbooks;  
* candidates pendientes de refinamiento no autorizados.

Esto debe ser un hard gate del runtime.

---

# **65\. CONTRATO CON P11**

Las relaciones construidas en P2 permitirán a P11 detectar posteriormente:

* candidatos relacionados;  
* grupos;  
* solapamientos;  
* shared value pools;  
* posibles conflictos de portfolio.

Pero P2 NO decide concurrencia.

---

# **66\. CONTRATO CON P12**

P12 deberá poder explicar:

> por qué este objeto fue considerado candidato.

Por tanto deberá disponer de:

* subject refs;  
* source refs;  
* evidence;  
* normalization trace;  
* merges;  
* splits;  
* exclusions;  
* reason codes.

La explicación no debe empezar en P10.

Empieza en P2.

---

# **67\. DEFINITION OF DONE — P2**

P2 está completo cuando el sistema puede responder estructuralmente:

**WHAT IS COMPETING?**

Existe candidate set explícito.

**WHAT EXACTLY IS EACH CANDIDATE?**

Existe unidad semántica precisa.

**WHY DOES IT EXIST?**

Existe source lineage.

**DOES IT BELONG HERE?**

Existe scope fit.

**IS IT A PROBLEM, CONSTRAINT, OPPORTUNITY OR UNCERTAINTY?**

Existe candidate kind.

**IS IT REALLY DISTINCT?**

Existen canonical identity y deduplicación.

**IS IT TOO BROAD OR TOO SMALL?**

Existe granularity control.

**ARE WE DOUBLE COUNTING THE SAME THING?**

Existen relationships, groups y merge rules.

**IS IT A REAL ATTENTION OBJECT OR ALREADY A SOLUTION?**

La frontera con Fase 5 está protegida.

**CAN IT BE EVALUATED?**

Existe eligibility state.

**HOW COMPLETE IS OUR DECISION UNIVERSE?**

Existe set completeness.

**CAN WE RECONSTRUCT THE NORMALIZATION?**

Existe NORMALIZATION\_TRACE.

Una vez terminado P2, el sistema todavía no sabe cuál candidato debe ganar.

Pero ya sabe exactamente **qué está comparando**.

Y sin esa garantía, cualquier ranking posterior sería matemáticamente elegante pero conceptualmente defectuoso.

