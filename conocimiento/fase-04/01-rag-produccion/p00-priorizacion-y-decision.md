# Fase 04 · P00 — Priorización y decisión

## Propósito

Fase 4 responde:

> De todo lo que sabemos que está ocurriendo en el ecommerce, ¿qué merece atención antes que el resto y por qué?

P00 define el lenguaje, fronteras y principios fundamentales del sistema de decisión.

F3 diagnostica.  
F4 decide precedencia.  
F5 diseña estrategia/playbook.

Reglas base:

`DIAGNOSIS ≠ DECISION`

`DIAGNOSTIC ORDER ≠ DECISION ORDER`

---

## 1. Definición de prioridad

En EcomScaling IA:

> PRIORITY es la precedencia relativa que un asunto merece frente a otros asuntos competidores dadas las condiciones actuales del negocio.

La prioridad es:

- relativa;
- contextual;
- temporal;
- comparativa;
- dinámica.

No es una propiedad intrínseca y permanente del problema.

Debe evaluarse dentro de un `DECISION_CONTEXT`.

---

## 2. Qué no es prioridad

### Priority ≠ Severity

Severity responde:

> ¿Qué tan grave es?

Priority responde:

> ¿Qué merece atención antes?

Un problema menos severo puede preceder a otro si:

- afecta mucho más negocio;
- acumula daño rápidamente;
- bloquea otros asuntos;
- amenaza continuidad;
- cierra una ventana de intervención.

### Priority ≠ Impact

`MAX IMPACT ≠ MAX PRIORITY`

El impacto potencial puede ser enorme pero:

- lejano;
- improbable;
- incierto;
- no urgente.

### Priority ≠ Urgency

Urgency es una dimensión.

Priority integra urgency junto con otros factores.

### Priority ≠ Constraint

`CURRENT CONSTRAINT ≠ AUTOMATIC PRIORITY #1`

Una emergencia transaccional puede preemptar temporalmente un constraint estructural.

### Priority ≠ Confidence

HIGH diagnostic confidence no implica “hacer primero”.

LOW confidence tampoco implica ignorar.

Puede ser prioritario:

> reducir incertidumbre.

### Priority ≠ Effort

No existe:

`LOW EFFORT → DO FIRST`

Los quick wins no deben desplazar indefinidamente problemas estructurales.

### Priority ≠ ROI simple

`Expected Impact / Effort` puede ser una señal, pero no una definición suficiente.

Puede ignorar:

- urgency;
- dependencies;
- survival;
- cash;
- irreversibility;
- critical paths;
- forward risk;
- strategic commitments;
- optionality;
- constraints.

---

## 3. Prioridad comparativa

La unidad real de razonamiento es:

`A vs B`

y posteriormente:

`A vs B vs C vs D...`

F4 debe poder explicar:

> Why A should precede B.

No solo:

> Why A is important.

---

## 4. Opportunity Cost

Toda prioridad consume recursos escasos:

- time;
- attention;
- cash;
- team capacity;
- engineering capacity;
- creative capacity;
- inventory;
- management bandwidth.

Elegir A primero implica B, C y D no primero.

Toda prioridad contiene `OPPORTUNITY_COST`.

---

## 5. Management Attention

La atención de dirección es un recurso limitado.

Si todo es P1, no existe priorización.

F4 debe producir:

- escasez decisional;
- concentración de atención.

---

## 6. Attention Priority vs Intervention

F4 decide principalmente:

`WHAT REQUIRES DECISIONAL ATTENTION`

No todavía:

`WHAT EXACT ACTION MUST BE EXECUTED`

Puede concluir:

- Payment integrity issue requires immediate attention.

sin todavía decidir:

- rollback;
- provider change;
- checkout modification.

---

## 7. Validation as Priority

No todo elemento prioritario debe corregirse inmediatamente.

Cuando existe:

- potencial impacto muy alto;
- diagnostic confidence baja;
- validation cost baja;
- validation time corta;

puede ser prioridad:

`RESOLVE DIAGNOSTIC UNCERTAINTY`

La incertidumbre puede bloquear una decisión de gran valor.

---

## 8. Preventive Priority

F4 debe considerar:

- `CURRENT_DAMAGE`
- `FORWARD_DAMAGE`

Un asunto con baja current severity puede tener alta `DECISION_URGENCY` si la ventana de intervención se está cerrando.

---

## 9. Protect Value vs Unlock Value

Las prioridades pueden existir para:

### PROTECT VALUE

- checkout failure;
- stockout;
- cash crisis;
- deliverability collapse.

### UNLOCK VALUE

- creative capacity;
- conversion bottleneck;
- retention opportunity;
- margin improvement;
- expansion.

F4 debe poder comparar protección y desbloqueo de valor.

---

## 10. Decision Portfolio

La cola decisional puede contener:

- PROBLEMS
- CONSTRAINTS
- RISKS
- OPPORTUNITIES
- VALIDATION NEEDS

No todo diagnosis debe convertirse automáticamente en decision candidate.

---

## 11. Decision Horizon

Toda prioridad debe entenderse dentro de un horizonte.

Conceptualmente:

- immediate/now;
- days;
- weeks;
- month;
- quarter;
- long term.

`PRIORITY_NOW ≠ STRATEGIC_PRIORITY`

---

## 12. Decision Confidence

La decisión opera bajo incertidumbre sobre:

- diagnosis;
- impact;
- timing;
- effort;
- dependencies;
- future states;
- business response.

Por tanto:

`DECISION_CONFIDENCE ≠ DIAGNOSTIC_CONFIDENCE`

Podemos conocer perfectamente el problema y todavía no saber bien cómo compararlo con otros candidatos.

---

## 13. Reversibility

Las decisiones reversibles permiten:

- menor information requirement;
- experimentación;
- feedback loops rápidos.

Las irreversibles pueden requerir:

- más evidence;
- mayor confidence;
- scenario analysis;
- más validation;
- human approval.

---

## 14. Time-to-Damage

`TIME_TO_DAMAGE`

Pregunta:

> ¿Cuánto tiempo tenemos antes de que no decidir empiece a generar consecuencias materiales?

Relacionado:

`TIME_TO_IRREVERSIBILITY`

Pregunta:

> ¿Cuándo dejarán de existir opciones razonables de intervención?

---

## 15. Cost of Delay

Esperar también destruye valor.

Deben distinguirse:

- `VALUE_OF_ACTION`
- `COST_OF_DELAY`

En algunos casos el coste principal no es actuar, sino esperar hasta que las opciones desaparezcan.

---

## 16. Option Value

Una decisión puede ser importante porque preserva alternativas futuras.

`OPTION_VALUE`

A veces la mejor decisión inmediata es la que evita cerrar opciones mañana.

---

## 17. Critical Path

La posición dentro del sistema importa.

Si Payment está roto dentro de:

`Traffic → Product View → Cart → Checkout → Payment → Order`

optimizar acquisition carece de sentido inmediato.

---

## 18. Dependencies

Las decisiones pueden depender unas de otras.

Si:

`A → B → C`

y B no puede mejorar antes de A, A puede recibir precedencia aunque B tenga mayor impacto directo.

---

## 19. Dominance

Cuando A es claramente mejor que B en todas las dimensiones relevantes:

`A DOMINATES B`

No hace falta inventar complejidad.

---

## 20. Trade-offs

Los casos difíciles ocurren cuando:

- A tiene más impact;
- B más urgency;
- A más confidence;
- B más upside;
- A es más fácil;
- B más estratégica;
- A protege corto plazo;
- B elimina un constraint estructural.

Ese conflicto multidimensional es el núcleo de F4.

---

## 21. Objective Awareness

No existe ranking universal independiente del objetivo.

Ejemplos de objetivos:

- cash preservation;
- contribution growth;
- revenue expansion.

Pero:

> Strategic Objective does not override Survival.

Objetivos operan dentro de guardrails críticos.

---

## 22. Root-level Decision

Diagnósticos del mismo árbol causal no deben convertirse automáticamente en prioridades independientes.

Ejemplo:

`Inventory → Availability → Conversion → CAC`

puede requerir una sola unidad decisional root-level.

---

## 23. Dynamic Priority

Las prioridades caducan.

Todo ranking debe entenderse:

- as of a specific time;
- under a specific context;
- under a specific horizon.

Un cambio de contexto puede alterar el ranking sin cambiar el diagnóstico.

---

## 24. Priority Invalidators

Toda prioridad material debería poder responder:

> What would change this priority?

Ejemplos:

- inventory arrives;
- payment failure resolves;
- confidence drops;
- business objective changes;
- dependency removed;
- exposure revised.

La prioridad debe ser falsable y actualizable.

---

## 25. Ranking Equivalence

Si la evidencia no distingue materialmente A y B:

- no fabricar diferencias;
- admitir `TIED`;
- admitir equivalence range.

`PRIORITY_SCORE ≠ TRUTH`

---

## 26. Ranking Stability

Un ranking es frágil si pequeños cambios razonables en inputs producen grandes saltos de posición.

Eso debe:

- reducir decision confidence;
- o producir `RANKING_INSTABILITY`.

---

## 27. Decision Classes

Tratamientos decisionales conceptuales:

- REQUIRES_IMMEDIATE_ATTENTION
- PRIORITIZE
- VALIDATE_FIRST
- SCHEDULE
- MONITOR
- DEFER
- BLOCKED
- EXCLUDE

No son playbooks.

---

## 28. Priority Tiers

Tiers conceptuales:

- P0_EMERGENCY
- P1_CRITICAL
- P2_HIGH
- P3_MEDIUM
- P4_LOW

`RANK ≠ PRIORITY_TIER`

Puede existir:

- rank = 1
- tier = P2_HIGH

si ningún asunto es crítico.

---

## 29. Emergency Semantics

`P0_EMERGENCY` debe reservarse para situaciones excepcionales que comprometan inmediatamente:

- transaction continuity;
- major revenue integrity;
- customer safety;
- legal/compliance integrity;
- security;
- business continuity;
- catastrophic financial exposure.

---

## 30. Anti-patterns

### Biggest Number Wins
El mayor porcentaje no determina priority.

### Loudest Problem Wins
No priorizar por:
- founder anxiety;
- latest Slack;
- complaints alone;
- agency opinion;
- team politics;
- recency bias.

### Easy Wins Forever
No dejar que small + easy desplace permanentemente large + structural.

### Score Worship
El score apoya; no sustituye decision reasoning.

### False Precision
La precisión del output no puede superar la evidencia.

### Everything Is P1
Si todo es crítico, nada está priorizado.

### Objective Blindness
No asumir maximize revenue universalmente.

### Duplicate Priorities
No inflar el portfolio con síntomas dependientes del mismo root.

---

## 31. Resultado conceptual

F4 debe evolucionar de:

> We found 12 problems.

a:

1. This deserves attention first.
2. This comes next.
3. This can wait.
4. This requires more evidence.
5. This is blocked by #1.
6. This should currently be monitored.

---

## 32. Preguntas de razonamiento

Para cada candidato:

- What value is at risk?
- What value could be unlocked?
- What happens if we wait?
- How quickly does it deteriorate?
- Is damage accumulating?
- When does the intervention window close?
- Is this blocking something else?
- Is another issue causing this one?
- Does another decision need to happen first?
- How confident are we?
- What is the cost of being wrong?
- How reversible is the eventual decision?
- Can uncertainty be reduced cheaply?
- Does this threaten a critical path?
- Does it affect the current constraint?
- How much business is exposed?
- Does it support the current objective?
- What resources would it consume?
- What are we giving up by choosing it?
- What evidence could change its position?

---

## 33. Principio final

F4 no existe para producir una lista ordenada que parezca inteligente.

Existe para producir una decisión:

- comparativa;
- contextual;
- trazable;
- falsable;
- defendible;

sobre dónde debe concentrarse primero la atención limitada del negocio.
