# **P9 — STRATEGIC FIT, MADUREZ Y COHERENCIA CON EL SISTEMA**

## **0\. Propósito**

P9 define cómo debe representar el sistema si un candidato:

* encaja con los objetivos estratégicos actuales;  
* corresponde al nivel de madurez del ecommerce;  
* es coherente con las capacidades y arquitectura del negocio;  
* fortalece o contradice la dirección deseada;  
* es prematuro;  
* pertenece realmente al siguiente nivel de desarrollo del sistema.

Su responsabilidad es responder:

> ¿Tiene sentido para este negocio, en este momento de su evolución, dedicar atención a este candidato?

P9 NO responde:

* cuánto valor tiene → P4;  
* cuánto cuesta → P6/P8;  
* cuánto riesgo tiene → P7;  
* cuál queda primero → P10;  
* cómo ejecutarlo → Fase 5\.

---

# **1\. Principio fundamental**

Debe mantenerse:

**STRATEGIC FIT**

≠

**ECONOMIC ATTRACTIVENESS**

≠

**MATURITY FIT**

≠

**FEASIBILITY**

≠

**PRIORITY**

≠

**MANAGEMENT PREFERENCE**

Una iniciativa puede ser:

* rentable pero estratégicamente incoherente;  
* estratégicamente correcta pero prematura;  
* madura pero económicamente mediocre;  
* factible pero irrelevante;  
* importante pero no apropiada todavía.

---

# **2\. Entidad principal**

Entidad:

**STRATEGIC\_FIT\_ASSESSMENT**

Relación:

`PRIORITY_CANDIDATE`

→ `STRATEGIC_FIT_ASSESSMENT`

Cada evaluación pertenece a:

* candidate;  
* prioritization run;  
* decision context;  
* strategy snapshot;  
* maturity snapshot.

P9 será source of truth de:

**STRATEGIC / MATURITY / SYSTEM COHERENCE FIT**

---

# **3\. Estructura base**

| Campo | Obligatorio | Función |
| ----- | ----- | ----- |
| `strategic_fit_assessment_id` | Sí | identidad |
| `candidate_id` | Sí | candidato |
| `prioritization_run_id` | Sí | ejecución |
| `assessment_state` | Sí | validez |
| `strategy_alignment_refs[]` | Condicional | alineación estratégica |
| `maturity_fit_ref` | Sí | encaje con madurez |
| `system_coherence_ref` | Sí | coherencia sistémica |
| `capability_stage_fit_refs[]` | Opcional | preparación estructural |
| `prematurity_flags[]` | Opcional | señales de prematuridad |
| `strategic_conflict_refs[]` | Opcional | contradicciones |
| `future_option_refs[]` | Opcional | optionality |
| `evidence_refs[]` | Sí | soporte |
| `unknowns[]` | Opcional | desconocidos |
| `evaluated_at` | Sí | timestamp |
| `policy_version` | Sí | reglas |

---

# **4\. STRATEGY SNAPSHOT**

P9 no debe inventar la estrategia del negocio.

Debe consumir:

**STRATEGY\_SNAPSHOT**

proveniente de:

* objetivos explícitos;  
* estrategia documentada;  
* decision context P1;  
* configuración empresarial autorizada.

Campos referenciables:

* strategic objectives;  
* strategic priorities;  
* excluded directions;  
* market focus;  
* business model;  
* operating model;  
* horizon.

---

# **5\. STRATEGY ≠ OBJECTIVE**

P1 define:

> qué intenta conseguir el negocio en esta decisión.

P9 evalúa:

> si el candidato es coherente con la dirección estratégica más amplia.

Por tanto:

**DECISION OBJECTIVE**

≠

**BUSINESS STRATEGY**

Un candidato puede ayudar al objetivo inmediato y aun así generar conflicto estratégico.

---

# **6\. STRATEGIC ALIGNMENT**

Entidad:

**STRATEGY\_ALIGNMENT**

Puede relacionar un candidato con uno o varios strategic objectives.

Estados:

`DIRECTLY_SUPPORTS`

`INDIRECTLY_SUPPORTS`

`NEUTRAL`

`POTENTIALLY_CONFLICTS`

`CONFLICTS`

`UNKNOWN`

---

# **7\. STRATEGIC FIT NO ES SCORE**

No utilizar como source of truth:

`strategic_fit = 8.4/10`

sin metodología real.

El sistema debe conservar:

* qué objetivo soporta;  
* cómo lo soporta;  
* qué contradice;  
* qué evidencia existe.

---

# **8\. STRATEGIC CONFLICT**

Entidad:

**STRATEGIC\_CONFLICT**

Representa:

> incompatibilidad material entre un candidato y una dirección estratégica vigente.

Ejemplos:

* candidate aumenta dependencia de paid media cuando estrategia explícita busca reducirla;  
* candidate sacrifica margen cuando estrategia actual exige cash preservation;  
* candidate introduce complejidad internacional mientras negocio está consolidando mercado doméstico.

---

# **9\. CONFLICT ≠ LOW FIT AUTOMÁTICO**

Puede existir conflicto legítimo que requiera:

* override;  
* reconsideración estratégica;  
* decisión consciente.

P9 no debe esconderlo mediante una nota negativa.

Debe hacerlo explícito.

---

# **10\. STRATEGIC OVERRIDE**

Si una autoridad válida cambia temporalmente la estrategia:

debe existir:

`strategy_override_ref`.

Nunca debe asumirlo la IA.

---

# **11\. MATURITY SNAPSHOT**

P9 debe consumir el resultado de Fase 2\.

No debe reconstruir la madurez desde cero.

Referencia:

`maturity_snapshot_ref`

Puede incluir:

* stage;  
* capability maturity;  
* operational maturity;  
* data maturity;  
* financial maturity;  
* channel maturity;  
* organizational maturity.

---

# **12\. MATURITY FIT**

Entidad:

**MATURITY\_FIT**

Representa:

> si el candidato corresponde al nivel actual de desarrollo del sistema.

Estados:

`FOUNDATIONAL`

`APPROPRIATE_NOW`

`STRETCH_BUT_REASONABLE`

`PREMATURE`

`SEVERELY_PREMATURE`

`BELOW_CURRENT_LEVEL`

`UNKNOWN`

---

# **13\. FOUNDATION FIRST ≠ ALWAYS FIRST**

Que algo sea foundational no implica automáticamente prioridad nº1.

Puede ser:

* ya suficientemente resuelto;  
* irrelevante al contexto;  
* no material.

P10 decidirá prioridad.

P9 solo declara naturaleza.

---

# **14\. PREMATURE**

Un candidato es prematuro cuando:

> requiere o presupone una capa de madurez que el negocio todavía no posee.

Ejemplo:

optimización avanzada de incrementality

cuando:

* tracking básico no es fiable;  
* attribution está rota;  
* datos no son consistentes.

---

# **15\. PREMATURITY ≠ INFEASIBILITY**

Una iniciativa prematura podría ser técnicamente factible.

Puede existir:

`FEASIBLE_NOW`

en P6

y

`PREMATURE`

en P9.

Eso es correcto.

---

# **16\. PREMATURITY ≠ LOW VALUE**

Una iniciativa prematura puede tener enorme theoretical value.

Pero el value capturable actual puede estar condicionado.

P9 no modifica directamente P4.

Expone la incoherencia.

---

# **17\. BELOW CURRENT LEVEL**

También puede ocurrir lo contrario.

Un ecommerce maduro puede estar dedicando atención excesiva a:

> optimizaciones demasiado básicas o marginales

cuando su constraint real está en otro nivel.

P9 puede marcar:

`BELOW_CURRENT_LEVEL`

si el candidato representa una distracción estructural.

---

# **18\. MATURITY DIMENSION FIT**

No debe utilizarse un único maturity stage cuando la madurez sea desigual.

Ejemplo:

* paid media madura;  
* retention inmadura;  
* operations media;  
* analytics avanzada.

Por tanto P9 debe permitir:

`domain_maturity_refs[]`.

---

# **19\. DOMAIN MATURITY**

Candidate de retention debe evaluarse principalmente contra:

* retention maturity;  
* customer data maturity;  
* operational capability relevante;

no únicamente contra un stage global.

---

# **20\. CAPABILITY STAGE FIT**

Entidad:

**CAPABILITY\_STAGE\_FIT**

Responde:

> ¿existen los fundamentos conceptuales necesarios para que esta capability tenga sentido?

Estados:

`FOUNDATION_MISSING`

`FOUNDATION_PARTIAL`

`READY`

`ADVANCED_READY`

`UNKNOWN`

---

# **21\. CAPABILITY FIT ≠ RESOURCE AVAILABILITY**

P6:

> tenemos recursos.

P9:

> estamos preparados como sistema.

Puede haber presupuesto y equipo para una iniciativa que el negocio todavía no está preparado para absorber.

---

# **22\. ABSORPTIVE CAPACITY**

P9 puede considerar:

**ABSORPTIVE\_CAPACITY**

Es decir:

> capacidad de la organización para integrar y utilizar productivamente el cambio.

Puede depender de:

* procesos;  
* ownership;  
* data;  
* governance;  
* operating discipline.

No debe transformarse en score arbitrario.

---

# **23\. SYSTEM COHERENCE**

Entidad:

**SYSTEM\_COHERENCE\_ASSESSMENT**

Responde:

> ¿mejora este candidato el sistema o solo optimiza localmente una parte?

Estados:

`SYSTEM_REINFORCING`

`SYSTEM_COMPATIBLE`

`LOCALLY_OPTIMAL`

`SYSTEM_CONFLICTING`

`SYSTEM_DESTABILIZING`

`UNKNOWN`

---

# **24\. LOCAL OPTIMUM**

P9 debe detectar potenciales:

**LOCAL\_OPTIMUM**

Ejemplo:

mejorar ROAS reduciendo prospecting

puede mejorar eficiencia local

pero perjudicar:

* customer acquisition;  
* future revenue;  
* learning.

P9 no decide si ocurre realmente sin evidencia.

Pero debe poder representarlo.

---

# **25\. LOCAL METRIC ≠ SYSTEM OUTCOME**

Hard rule:

> mejorar un KPI local no demuestra mejora del ecommerce.

La coherencia debe evaluarse contra el sistema completo.

---

# **26\. SYSTEM EFFECT**

Puede existir:

**SYSTEM\_EFFECT**

Tipos:

`REINFORCES`

`NEUTRAL`

`SHIFTS_CONSTRAINT`

`CREATES_NEW_CONSTRAINT`

`TRANSFERS_PROBLEM`

`DESTABILIZES`

`UNKNOWN`

---

# **27\. PROBLEM TRANSFER**

Debe detectarse cuando un candidate potencialmente:

> mejora una parte desplazando el problema a otra.

Ejemplos:

más acquisition

→ stock pressure.

descuento agresivo

→ CVR mejora pero margin se deteriora.

---

# **28\. CONSTRAINT SHIFT**

Una mejora puede resolver el constraint actual y hacer aparecer otro.

Eso no invalida candidate.

Pero es relevante para coherencia sistémica.

P9 puede referenciar:

`anticipated_constraint_shift`.

No inventar el nuevo constraint sin evidencia.

---

# **29\. STRATEGIC SEQUENCE**

Puede existir una secuencia de desarrollo:

FOUNDATION

↓

RELIABILITY

↓

EFFICIENCY

↓

SCALE

↓

OPTIMIZATION

↓

ADVANCED CAPABILITY

Pero no debe codificarse como una escalera universal rígida.

Debe provenir de:

* maturity framework;  
* dominio;  
* business model.

---

# **30\. STAGE PREREQUISITE**

Cuando una maturity stage requiera otra:

P9 puede producir:

`maturity_prerequisite_ref`.

P5 será responsable de representarlo como dependency si se convierte en una precedencia real.

---

# **31\. P9 NO DUPLICA DEPENDENCIES**

P9 puede decir:

> maturity foundation missing.

P5 dice:

> candidate B requires A.

Una describe coherencia de desarrollo.

La otra secuencia contractual.

---

# **32\. STRATEGIC FIT AND BUSINESS MODEL**

Un candidato puede ser diferente según modelo:

* subscription;  
* repeat purchase;  
* high-ticket;  
* low-frequency;  
* marketplace;  
* DTC;  
* inventory-heavy.

P9 puede consumir:

`business_model_ref`.

No debe hardcodear que una estrategia sea universalmente correcta.

---

# **33\. CHANNEL DEPENDENCY AND FIT**

Ejemplo:

un negocio altamente dependiente de paid media.

Candidate:

> incrementar aún más dependencia.

Puede ser económicamente atractivo en corto plazo.

P9 puede detectar:

`STRATEGIC_CONCENTRATION_CONFLICT`

si contradice objetivo explícito de resiliencia.

---

# **34\. CUSTOMER MODEL FIT**

Ejemplo:

negocio de baja recurrencia.

Candidate:

> sofisticación extrema de loyalty.

Podría ser:

`PREMATURE`

o estratégicamente débil

si el modelo económico no soporta esa inversión.

Pero no debe inferirse sin evidencia.

---

# **35\. UNIT ECONOMICS FIT**

P9 puede referenciar:

unit economics state.

Ejemplo:

escalar acquisition con economics deteriorados.

P9 puede señalar incoherencia sistémica.

Pero P4/P8 contienen la economía cuantitativa.

---

# **36\. SCALE READINESS**

Puede existir:

**SCALE\_READINESS**

cuando candidate implique ampliar volumen.

Debe valorar si:

* operations;  
* inventory;  
* support;  
* cash;  
* measurement

están preparados.

Sin duplicar datos.

P9 consume refs.

---

# **37\. OPTIMIZATION READINESS**

Antes de optimizaciones avanzadas debe existir una base suficientemente estable.

Puede declararse:

`optimization_readiness`.

Ejemplo:

no tiene sentido microoptimizar creative taxonomy si tracking central está roto.

---

# **38\. AUTOMATION READINESS**

Igualmente:

automatizar un proceso inestable puede:

> escalar el error.

P9 debe poder marcar:

`AUTOMATION_PREMATURE`.

No significa que automatización sea mala.

Significa que el proceso subyacente aún no está preparado.

---

# **39\. AI READINESS**

Si posteriormente el ecommerce utiliza automatización/IA:

P9 puede evaluar si existen:

* datos suficientes;  
* proceso estable;  
* ownership;  
* feedback loop;  
* guardrails.

Esto debe modelarse como capability readiness, no entusiasmo tecnológico.

---

# **40\. STRATEGIC OPTION**

Algunos candidatos crean:

**FUTURE OPTIONALITY**

Ejemplo:

construir data capability que habilita futuras decisiones.

P4 puede valorar strategic option value.

P9 evalúa:

> si esa option está alineada con la dirección del negocio.

---

# **41\. OPTION PRESERVATION**

Algunas decisiones preservan flexibilidad futura.

Puede existir:

`option_preservation_state`.

Especialmente relevante cuando incertidumbre es alta.

P9 no calcula EV de la option.

P8 puede hacerlo si es posible.

---

# **42\. LOCK-IN**

Un candidato puede generar:

`STRATEGIC_LOCK_IN`.

Ejemplos:

* vendor;  
* channel;  
* architecture;  
* market;  
* cost structure.

P7 evalúa risk.

P9 evalúa coherencia estratégica.

---

# **43\. PATH DEPENDENCY**

Puede existir:

**STRATEGIC\_PATH\_DEPENDENCY**

cuando una decisión actual restringe futuras opciones.

P9 registra la relación.

No necesariamente la rechaza.

---

# **44\. REVERSIBILITY INTERFACE**

P7 puede decir:

> decisión difícil de revertir.

P9 puede decir:

> además crea lock-in contrario a la estrategia.

Son dimensiones distintas pero complementarias.

---

# **45\. STRATEGIC CONSISTENCY OVER TIME**

Un candidate puede haber sido correcto hace seis meses y no serlo ahora.

P9 debe trabajar sobre:

`strategy_snapshot_version`.

Las decisiones históricas no se reescriben.

---

# **46\. STRATEGY DRIFT**

Debe detectarse cuando:

* estrategia cambia;  
* candidate permanece igual;  
* fit cambia materialmente.

Eso puede obligar a recalcular.

---

# **47\. MATURITY DRIFT**

Cuando el negocio avanza de madurez:

una iniciativa antes prematura puede pasar a:

`APPROPRIATE_NOW`.

Esto debe activar reconsideración.

---

# **48\. MATURITY REGRESSION**

También puede ocurrir regresión.

Ejemplo:

* pérdida de equipo;  
* tracking degradado;  
* operations deterioradas.

P9 debe permitir que readiness disminuya.

Madurez no es necesariamente monotónica.

---

# **49\. FIT WITH PRIMARY OBJECTIVE**

P9 puede validar consistencia con P1:

`primary_objective_alignment`.

Pero no debe duplicar `objective relevance` de P2.

P2:

> candidate pertenece a la decisión.

P9:

> candidate es coherente estratégicamente con cómo queremos avanzar.

---

# **50\. RELEVANT ≠ STRATEGICALLY FIT**

Candidate puede ser relevante porque afecta objetivo actual.

Pero puede ser estratégica o sistémicamente problemático.

Ambos estados pueden coexistir.

---

# **51\. STRATEGIC TRADEOFF**

Entidad:

**STRATEGIC\_TRADEOFF**

Ejemplo:

short-term cash

vs

long-term brand.

P9 identifica trade-off.

P10/P11 lo utilizarán.

No asignar weights arbitrarios.

---

# **52\. SHORT TERM VS LONG TERM**

P9 debe permitir diferenciar:

`SHORT_TERM_ALIGNMENT`

y

`LONG_TERM_ALIGNMENT`.

Una alternativa puede:

* beneficiar hoy;  
* perjudicar estrategia futura.

No reducir ambos a un único fit.

---

# **53\. HORIZON CONSISTENCY**

P9 debe consumir Decision Horizon de P1.

Una iniciativa con valor en 3 años puede no encajar con una decisión de supervivencia de 90 días.

Eso no significa que la iniciativa sea mala.

Significa:

`HORIZON_MISMATCH`.

---

# **54\. HORIZON MISMATCH ≠ LOW VALUE**

Debe mantenerse separado.

P4 puede mostrar alto valor.

P9 puede mostrar:

`NOT_ALIGNED_WITH_CURRENT_HORIZON`.

---

# **55\. ORGANIZATIONAL COHERENCE**

Candidate puede requerir un operating model incompatible con el actual.

Ejemplo:

expansión multicanal compleja en organización sin ownership.

P6 evalúa recursos.

P9 evalúa coherencia organizativa.

---

# **56\. GOVERNANCE FIT**

Algunas capabilities requieren:

* ownership;  
* decision rights;  
* process discipline.

P9 puede referenciar:

`governance_readiness_ref`.

No duplicar governance data.

---

# **57\. MEASUREMENT READINESS**

Un candidate puede ser difícil de evaluar si el negocio no puede medir su resultado.

P9 puede declarar:

`MEASUREMENT_FOUNDATION_MISSING`.

P5/P6 podrán convertirlo en dependency/resource gap cuando corresponda.

---

# **58\. LEARNING LOOP READINESS**

Una estrategia avanzada puede requerir:

* measurement;  
* feedback;  
* experimentation;  
* decision cadence.

Si no existe:

P9 puede marcar prematurity.

No propone cómo construirlo.

---

# **59\. STRATEGIC FIT STATE**

Síntesis semántica:

`STRONGLY_ALIGNED`

`ALIGNED`

`CONDITIONALLY_ALIGNED`

`NEUTRAL`

`MISALIGNED`

`STRONGLY_MISALIGNED`

`UNKNOWN`

Solo con reglas/evidencia.

---

# **60\. NO FIT SCORE UNIVERSAL**

No utilizar:

`strategic_fit_score = 83`.

Si posteriormente P10 necesita una representación ordinal auxiliar:

debe derivarse de estados estructurados.

No sustituirlos.

---

# **61\. MATURITY FIT STATE**

Síntesis:

`APPROPRIATE_NOW`

`STRETCH`

`PREMATURE`

`SEVERELY_PREMATURE`

`BELOW_LEVEL`

`UNKNOWN`

---

# **62\. SYSTEM COHERENCE STATE**

Síntesis:

`REINFORCING`

`COMPATIBLE`

`LOCAL_OPTIMUM_RISK`

`CONFLICTING`

`DESTABILIZING`

`UNKNOWN`

---

# **63\. MULTIPLE FIT DIMENSIONS**

P9 nunca debe reducir automáticamente:

strategy alignment

* 

maturity fit

* 

system coherence

a una única cifra.

Un candidate puede ser:

* strategically aligned;  
* premature;  
* system reinforcing.

Esa combinación debe conservarse.

---

# **64\. HARD STRATEGIC CONSTRAINT**

Algunos elementos estratégicos pueden ser no negociables.

Ejemplo:

dirección decide explícitamente:

> no entrar en nuevos mercados este año.

Candidate:

> expansión internacional.

Esto debería referenciarse a P5 como hard strategic constraint.

P9 identifica conflicto.

P5 aplica la restricción.

---

# **65\. STRATEGIC PREFERENCE**

Otras directrices son preferencias, no gates.

Ejemplo:

> preferimos reducir dependencia de descuentos.

P9 puede utilizarlo como alignment factor.

No convertirlo automáticamente en prohibición.

---

# **66\. MATURITY OVERRIDE**

Un negocio puede decidir conscientemente asumir una iniciativa “stretch”.

Debe existir:

`maturity_override_ref`

si una autoridad válida acepta:

* mayor complejidad;  
* aprendizaje;  
* transición.

P9 no debe bloquearla automáticamente.

---

# **67\. PREMATURITY GATE**

`SEVERELY_PREMATURE` puede activar:

`MATURITY_VALIDATION_REQUIRED`

cuando una policy explícita lo determine.

No debe existir un gate universal:

> todo lo prematuro queda prohibido.

---

# **68\. SYSTEMIC CONTRADICTION**

Si candidate produce:

* local optimization;  
* global deterioration;

y existe evidencia fuerte,

P9 puede producir:

`SYSTEM_CONFLICTING`.

P10 debe tratarlo como una señal material.

---

# **69\. COHERENCE WITH CURRENT CONSTRAINT**

La estrategia debería considerar el constraint dominante del sistema cuando esté identificado.

Candidate que mejora una zona no limitante puede tener:

`LOW_CONSTRAINT_RELEVANCE`.

Pero P9 no redefine cuál es el constraint.

Consume P5/Fase 3\.

---

# **70\. CONSTRAINT RELEVANCE ≠ PRIORITY**

Un candidate que no actúa sobre el constraint dominante podría seguir ser prioritario por:

* obligación;  
* riesgo;  
* time sensitivity.

No convertir constraint theory en ley única.

---

# **71\. STRATEGIC FIT CONFIDENCE**

Siguiendo P0:

`SUFFICIENT_TO_ASSESS`

`SUFFICIENT_WITH_LIMITATIONS`

`VALIDATION_REQUIRED`

`INSUFFICIENT`

`UNKNOWN`

No inventar porcentaje.

---

# **72\. STRATEGY UNKNOWN**

Si no existe estrategia documentada:

P9 no debe inventar una.

Puede trabajar con:

* explicit P1 objectives;  
* business model;  
* maturity state;

pero debe marcar:

`STRATEGY_CONTEXT_INCOMPLETE`.

---

# **73\. MATURITY UNKNOWN**

Si Fase 2 no tiene evidencia suficiente:

`maturity_fit = UNKNOWN`.

No asumir “intermedio”.

---

# **74\. SYSTEM COHERENCE UNKNOWN**

Si no conocemos efectos sistémicos:

UNKNOWN.

No:

`COMPATIBLE`

por defecto.

---

# **75\. RECALCULATION TRIGGERS**

P9 deberá recalcular cuando cambie materialmente:

* strategy snapshot;  
* primary business objective;  
* business model;  
* maturity stage;  
* domain maturity;  
* capability readiness;  
* operating model;  
* strategic exclusions;  
* current dominant constraint;  
* decision horizon.

---

# **76\. NON-MATERIAL CHANGES**

No debería recalcular por:

* reformulación textual;  
* rename de strategic objective;  
* cambio de etiquetas;  
* metadata sin significado decisional;  
* actualización de timestamp sin cambios estructurales.

---

# **77\. OUTPUT P9**

Contrato:

**STRATEGIC\_FIT\_RESULT**

Campos:

| Campo | Función |
| ----- | ----- |
| `candidate_id` | candidato |
| `assessment_state` | validez |
| `strategic_fit_state` | alineación |
| `strategy_alignment_refs[]` | objetivos/dirección |
| `strategic_conflict_refs[]` | contradicciones |
| `maturity_fit_state` | madurez |
| `maturity_fit_ref` | detalle |
| `capability_stage_fit_refs[]` | readiness |
| `system_coherence_state` | coherencia |
| `system_effect_refs[]` | efectos |
| `strategic_tradeoff_refs[]` | trade-offs |
| `future_option_refs[]` | optionality |
| `prematurity_flags[]` | señales |
| `unknowns[]` | desconocidos |
| `warnings[]` | limitaciones |
| `evidence_refs[]` | soporte |
| `rule_trace_refs[]` | trazabilidad |

---

# **78\. ASSESSMENT\_STATE**

Valores:

`VALID`

`VALID_WITH_LIMITATIONS`

`REQUIRES_VALIDATION`

`INSUFFICIENT_INFORMATION`

`STALE`

`NOT_APPLICABLE`

`INVALID`

---

# **79\. REASON CODES**

Familias:

`STRATEGY.*`

`MATURITY.*`

`SYSTEM.*`

`READINESS.*`

Ejemplos:

`STRATEGY.DIRECTLY_ALIGNED`

`STRATEGY.CONFLICT`

`STRATEGY.HORIZON_MISMATCH`

`STRATEGY.CONTEXT_INCOMPLETE`

`MATURITY.APPROPRIATE_NOW`

`MATURITY.PREMATURE`

`MATURITY.FOUNDATION_MISSING`

`MATURITY.BELOW_LEVEL`

`SYSTEM.REINFORCING`

`SYSTEM.LOCAL_OPTIMUM_RISK`

`SYSTEM.PROBLEM_TRANSFER`

`SYSTEM.DESTABILIZING`

`READINESS.MEASUREMENT_MISSING`

---

# **80\. INVARIANTES P9**

1. Strategic fit no equivale a priority.  
2. Economic attractiveness no equivale a strategic fit.  
3. Maturity fit no equivale a feasibility.  
4. Premature no equivale a impossible.  
5. Foundational no equivale automáticamente a first.  
6. KPI improvement no equivale a system improvement.  
7. Local optimum no equivale a global optimum.  
8. Strategy no puede ser inventada por la IA.  
9. Maturity debe provenir de Fase 2\.  
10. Domain maturity puede diferir de global maturity.  
11. Candidate relevante no implica strategic alignment.  
12. Short-term alignment puede diferir de long-term alignment.  
13. System coherence no debe reducirse a score único.  
14. UNKNOWN strategy no equivale a neutral alignment.  
15. P9 no crea dependency graph.  
16. P9 no calcula expected value.  
17. P9 no prescribe estrategia concreta.  
18. Los conflicts materiales deben permanecer explícitos.

---

# **81\. PRECONDICIONES**

P9 necesita:

* candidate válido P2;  
* decision context P1;  
* maturity snapshot Fase 2;  
* business model/context;  
* strategy snapshot cuando exista;  
* relevant system relationships.

P9 puede operar parcialmente sin estrategia formal, pero deberá reflejar limitaciones.

---

# **82\. POSTCONDICIONES**

P9 termina correctamente cuando puede responder:

* si el candidate soporta la estrategia;  
* si la contradice;  
* si corresponde al nivel de madurez;  
* si existen foundations necesarias;  
* si es prematuro;  
* si es demasiado básico;  
* si produce coherencia sistémica;  
* si genera local optimum;  
* si transfiere problemas;  
* si preserva o restringe opciones futuras;  
* qué permanece desconocido.

---

# **83\. FAILURE MODES**

## **Strategy hallucination**

La IA decide:

> “La estrategia debería ser crecer.”

**Prevención:** strategy snapshot obligatorio cuando se afirma alignment estratégico.

---

## **Maturity universalism**

“Ecommerce de €1M \= nivel X.”

**Error:** madurez no depende únicamente de revenue.

---

## **Advanced-is-better bias**

Se favorecen iniciativas sofisticadas.

**Prevención:** maturity fit.

---

## **Foundation absolutism**

Siempre se prioriza lo básico aunque ya sea suficientemente bueno.

**Prevención:** foundational ≠ priority.

---

## **Local optimization**

Optimizar ROAS deteriorando crecimiento total.

**Prevención:** system coherence.

---

## **Feasibility contamination**

“Podemos hacerlo, por tanto encaja.”

**Prevención:** P6 ≠ P9.

---

## **Economics contamination**

“Da dinero, por tanto está alineado.”

**Prevención:** P8 ≠ P9.

---

## **Preference-as-strategy**

Una opinión aislada se trata como estrategia oficial.

**Prevención:** strategy source y authority.

---

## **Prematurity-as-ban**

Todo lo avanzado queda descartado.

**Prevención:** stretch/maturity overrides.

---

# **84\. TESTS CONTRACTUALES**

| Caso | Resultado esperado |
| ----- | ----- |
| candidate soporta estrategia explícita | ALIGNED |
| candidate contradice exclusión estratégica | conflict |
| estrategia desconocida | no inventar |
| maturity snapshot ausente | maturity UNKNOWN |
| advanced optimization sin data foundation | PREMATURE |
| candidate factible pero premature | ambos estados preservados |
| high EV pero strategic conflict | P9 no oculta conflicto |
| foundational issue ya suficientemente resuelto | no first automático |
| local KPI mejora / system deteriora | SYSTEM\_CONFLICTING |
| negocio cambia estrategia | recalculation |
| rename estratégico sin cambio semántico | no recalculation |
| domain maturity distinta | usar dominio relevante |
| short-term aligned / long-term conflict | conservar ambos |
| explicit maturity override | permitido y trazable |
| P9 propone playbook | rechazo |

---

# **85\. EVALS IA**

### **Strategy adherence eval**

¿Utiliza estrategia real y no inventada?

### **Maturity-fit eval**

¿Distingue iniciativas apropiadas de prematuras?

### **Advanced-bias eval**

¿Evita favorecer sofisticación por sí misma?

### **Local-optimum eval**

¿Detecta mejora local con deterioro sistémico?

### **Business-model fit eval**

¿Contextualiza correctamente según modelo?

### **Horizon-fit eval**

¿Distingue valor futuro de prioridad actual?

### **Unknown preservation eval**

¿Evita asumir strategy/maturity inexistentes?

### **Boundary eval**

¿Evita prescribir qué estrategia ejecutar?

---

# **86\. EJEMPLO 1 — ADVANCED ATTRIBUTION**

Candidate:

> construir sistema avanzado de incrementality.

Negocio:

* tracking inconsistente;  
* data pipeline inestable;  
* poca disciplina experimental.

P6 podría decir:

`FEASIBLE_WITH_RESOURCES`.

P8:

potencial económico relevante.

P9:

`PREMATURE`

por foundation insuficiente.

No significa:

> nunca hacerlo.

Significa:

> el sistema todavía no está preparado para absorber correctamente esa capability.

---

# **87\. EJEMPLO 2 — PAID MEDIA**

Candidate:

> aumentar spend en Meta.

P8:

alto marginal EV.

Pero estrategia vigente:

> reducir concentración de adquisición.

P9:

`POTENTIALLY_CONFLICTS`

o

`CONFLICTS`

según magnitud.

P10 debe conocer ambos hechos.

---

# **88\. EJEMPLO 3 — MICRO CRO**

Ecommerce maduro.

Candidate:

> microoptimización de un elemento de PDP con impacto pequeño.

Puede ser:

* factible;  
* barato;  
* positivo.

Pero P9 puede detectar:

`BELOW_CURRENT_LEVEL`

si existe un constraint mucho más estructural.

Eso no basta por sí solo para descartarlo.

---

# **89\. EJEMPLO 4 — AUTOMATION**

Candidate:

> automatizar proceso operativo.

Pero el proceso:

* cambia constantemente;  
* carece de owner;  
* no tiene reglas claras.

P9:

`AUTOMATION_PREMATURE`.

Automatizarlo podría escalar inconsistencia.

P9 no prescribe:

> primero documenta el proceso.

Eso pertenece a Fase 5\.

---

# **90\. EJEMPLO 5 — SCALE**

Candidate:

> escalar acquisition.

P4/P8:

alto upside.

Pero:

* inventory frágil;  
* support saturado;  
* cash limitado.

P9:

`SYSTEM_CONFLICTING` o readiness limitada.

Los datos originales permanecen en P5/P6.

P9 solo sintetiza coherencia sistémica.

---

# **91\. INTERFAZ CON P10**

Después de P9 ya existen todas las dimensiones principales:

P1 → objetivo/contexto

P2 → candidatos

P3 → tiempo

P4 → impacto

P5 → constraints/dependencies

P6 → effort/resources

P7 → risk

P8 → economics

P9 → strategic/maturity/system fit

P10 podrá por primera vez responder:

> ¿qué merece prioridad?

Pero deberá respetar la estructura completa.

---

# **92\. P9 NO DEBE CONVERTIRSE EN "VETO SUBJETIVO"**

Este es un riesgo importante.

“Strategic fit” puede convertirse fácilmente en una excusa para justificar cualquier opinión.

Por tanto todo:

* conflict;  
* alignment;  
* maturity mismatch;  
* system incoherence

debe referenciar:

* evidencia;  
* regla;  
* strategy snapshot;  
* maturity snapshot;  
* business context.

Sin ello:

`UNKNOWN`

o

`REQUIRES_VALIDATION`.

---

# **93\. DEFINITION OF DONE — P9**

P9 está completo cuando el sistema puede responder:

**DOES THIS SUPPORT WHERE THE BUSINESS IS GOING?**

Existe strategic alignment.

**DOES IT CONTRADICT ANYTHING IMPORTANT?**

Existen conflicts explícitos.

**IS THE BUSINESS READY FOR THIS?**

Existe maturity fit.

**ARE THE FOUNDATIONS PRESENT?**

Existe capability readiness.

**IS THIS TOO EARLY?**

Existe prematurity state.

**IS THIS TOO BASIC RELATIVE TO THE CURRENT CONSTRAINT?**

Puede identificarse BELOW\_CURRENT\_LEVEL.

**DOES THIS IMPROVE THE SYSTEM OR ONLY A LOCAL KPI?**

Existe system coherence.

**DOES IT TRANSFER THE PROBLEM ELSEWHERE?**

Puede identificarse problem transfer.

**DOES IT CREATE OR PRESERVE FUTURE OPTIONS?**

Existe strategic optionality.

**WHAT DON'T WE KNOW?**

UNKNOWN permanece explícito.

P9 no responde todavía:

> ¿cuál es el nº1?

Responde:

> **¿es este candidato coherente con el negocio que existe hoy y con el negocio que estamos intentando construir?**

