# Fase 04 · P05 — Runtime conceptual de constraints y dependencias

## Propósito

P05 transforma un portfolio de decision candidates en una estructura sistémica:

`CONSTRAINT MAP + DEPENDENCY GRAPH`

que permite distinguir:
- importance;
- sequence;
- blockers;
- unlocks;
- resource conflicts;
- parallelism.

---

## 1. Inputs

Puede consumir:

- P1 objective/context;
- P2 decision candidates;
- P3 urgency;
- P4 impact/value;
- F3 root causes;
- F3 current constraints;
- capacities;
- queues;
- resources;
- dependencies;
- lead times;
- forecasts;
- redundancy;
- external actors.

---

## 2. Paso 1 — Definir system objective

No buscar constraint sin objective.

Pregunta:

> WHAT OUTPUT ARE WE TRYING TO INCREASE, PROTECT OR STABILIZE?

---

## 3. Paso 2 — Mapear flow

Construir conceptualmente:

- capabilities;
- inputs/outputs;
- upstream/downstream;
- shared resources;
- external dependencies.

---

## 4. Paso 3 — Detectar clues

Buscar:

### Saturation
- persistent high utilization;
- ceiling;
- capacity shortfall.

### Accumulation
- queue;
- backlog;
- waiting;
- excess inventory;
- unspent demand/budget.

### Starvation
- downstream resource waiting for inputs.

### Idle capacity
- clue de upstream constraint.

---

## 5. Paso 4 — Generar constraint hypotheses

No asumir worst metric.

Crear:
- candidate A;
- candidate B;
- etc.

cuando evidence todavía sea incompleta.

---

## 6. Paso 5 — Aplicar binding test

Preguntar:

> If this capacity stays unchanged, how much more system output can we create?

Si la respuesta es little/not much:
- support ↑.

---

## 7. Paso 6 — Aplicar removal counterfactual

Preguntar:

> If it disappeared tomorrow, would system output materially increase?

---

## 8. Paso 7 — Evaluar demand vs capacity

Cuando sea posible:

`DEMAND ON CAPABILITY > AVAILABLE CAPACITY`

---

## 9. Paso 8 — Evaluar evidence

Buscar:
- persistent saturation;
- queues;
- lost throughput;
- ceilings;
- blocked opportunities;
- counterfactuals;
- repeated downstream effects.

---

## 10. Paso 9 — Definir falsifier

Preguntar:

> What observation would prove this is NOT the constraint?

---

## 11. Paso 10 — Clasificar constraint

Separar:
- primary;
- near;
- non-constraint;
- possible.

Y:
- current;
- emerging;
- future.

---

## 12. Paso 11 — Detectar shadow / next constraint

Preguntar:

> If current constraint is elevated, what saturates next?

---

## 13. Paso 12 — Evaluar constraint consumption

Mapear:
- scarce capacity;
- high-value work;
- low-value work;
- queue;
- starvation;
- pollution.

---

## 14. Paso 13 — Construir dependency graph

Para cada candidate:
- what does it need?
- what blocks it?
- what does it block?
- what enables?
- what alternatives exist?
- what shared resources exist?

---

## 15. Paso 14 — Clasificar dependency

Por:
- type;
- strength;
- certainty.

---

## 16. Paso 15 — Detectar hard vs soft

### HARD
B no puede crear value meaningful sin A.

### SOFT
B puede avanzar con menor value/quality o mayor risk.

---

## 17. Paso 16 — Detectar minimum viable prerequisite

No exigir perfección.

Preguntar:

> What minimum state of A lets B start safely?

---

## 18. Paso 17 — Buscar alternative paths

Preguntar:

> Is A the only way to enable B?

Si no:
- registrar substitution option.

---

## 19. Paso 18 — Evaluar redundancy

Distinguir:
- effective;
- partial;
- theoretical only.

Considerar switching lead time y capacity.

---

## 20. Paso 19 — Detectar hidden common dependencies

Buscar:
- same API;
- source;
- supplier;
- team;
- provider.

Esto puede invalidar falsa redundancy.

---

## 21. Paso 20 — Calcular sequencing structure

Identificar:
- precedence;
- critical path;
- zero-slack nodes;
- slack;
- blockers.

---

## 22. Paso 21 — Detectar parallelism

Preguntar:

> What can start now without waiting?

No serializar por defecto.

---

## 23. Paso 22 — Detectar shared resource conflicts

A y B pueden ser causalmente independientes pero competir por:
- same engineer;
- creative;
- cash;
- founder;
- warehouse.

---

## 24. Paso 23 — Distinguir importance vs sequence

Permitir:
- high-value but blocked;
- lower-direct-value prerequisite first.

No degradar importance por no ser executable today.

---

## 25. Paso 24 — Evaluar upstream leverage

Buscar nodos que:
- remove multiple symptoms;
- unlock multiple decisions;
- reduce downstream work.

---

## 26. Paso 25 — Evaluar containment need

Root/upstream fix no siempre es first intervention point.

Preservar:
- structural fix;
- containment;
como necesidades distintas.

---

## 27. Paso 26 — Evaluar external dependency risk

Por:
- reliance;
- control;
- redundancy;
- switching lead time.

---

## 28. Paso 27 — Detectar reinforcing loops

Ejemplo:

`cash ↓ → inventory buys ↓ → stockouts ↑ → revenue ↓ → cash ↓`

Registrar loop sin seleccionar todavía la intervención final.

---

## 29. Paso 28 — Integrar P3

Para constraints/dependencies:
- time to damage;
- lead time;
- intervention window;
- switching time.

---

## 30. Paso 29 — Integrar P4

Calcular:
- value prevented from flowing;
- blocker unlock value;
- constraint release value;
- value caps.

---

## 31. Paso 30 — Ajustar opportunity capture

Una opportunity puede quedar limitada por:
- inventory;
- cash;
- operations;
- dependencies.

No usar theoretical upside como capturable value.

---

## 32. Paso 31 — Detectar non-constraint optimization

Antes de recomendar capacidad adicional:
- comprobar si system output realmente subiría.

---

## 33. Paso 32 — Emitir constraint map

Debe poder resumir:
- current primary;
- near constraints;
- emerging/future;
- evidence;
- confidence;
- falsifier;
- next likely constraint.

---

## 34. Paso 33 — Emitir dependency graph

Debe poder resumir:
- nodes;
- edges;
- hard/soft;
- blockers;
- unlocks;
- alternatives;
- shared resources;
- critical path;
- slack;
- parallelism.

---

## 35. Paso 34 — Recalcular dinámicamente

Triggers:
- constraint release;
- replenishment;
- supplier failure;
- capacity increase;
- objective change;
- blocker resolution;
- dependency failure;
- resource reallocation.

Cuando cambie estructura:

`PRIORITIES MUST BE RECONSIDERED`

---

## 36. Paso 35 — Constraint removal test

Después de cambio:
- did system output improve?
- did expected next constraint appear?
- was original diagnosis false?

---

## 37. Output conceptual

P05 aporta a la priorización:

- constraint position;
- dependency position;
- blocker status;
- unlock value;
- critical path;
- parallelism;
- scarce resource conflicts;
- next-likely constraints.

---

## 38. Boundary

P05 no:
- prescribe playbooks;
- build project schedule;
- rank by constraint alone;
- assume root cause must be first;
- invent dependencies;
- optimize non-constraints by default.
