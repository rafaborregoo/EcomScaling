# Fase 04 · P03 — Runtime conceptual de urgencia y sensibilidad temporal

## Propósito

P03 evalúa cómo cambia el valor de una decisión con el tiempo.

No rankea por sí solo toda la cartera, pero produce la capa temporal que bloques posteriores usarán en la priorización comparativa.

---

## 1. Inputs

Puede consumir:

- current diagnosis;
- current impact;
- trajectory;
- forecasts;
- lead times;
- calendars/events;
- inventory;
- capacity;
- cash obligations;
- dependencies;
- recovery history;
- evidence freshness;
- uncertainty.

---

## 2. Paso 1 — Determinar current state

Responder:

- Is damage happening now?
- Is there only risk?
- Is there only opportunity?

---

## 3. Paso 2 — Determinar trajectory

Clasificar conceptualmente:

- stable;
- linear;
- accelerating;
- threshold/cliff;
- compounding;
- temporary window.

---

## 4. Paso 3 — Estimar time to material damage

No solo event date.

Considerar:

- earliest plausible;
- base;
- downside;
- range.

---

## 5. Paso 4 — Evaluar damage velocity

Preguntar:

- how fast does damage accumulate?
- is velocity itself accelerating?

---

## 6. Paso 5 — Evaluar cost of delay

Para intervalos relevantes:

- 1 hour;
- 1 day;
- 1 week;
- 1 month.

No asumir linealidad.

---

## 7. Paso 6 — Identificar threshold/cliff

Buscar:

- stockout;
- capacity saturation;
- covenant;
- SLA;
- minimum viable assortment;
- cash cliff.

---

## 8. Paso 7 — Determinar intervention window

Preguntar:

- when do reasonable options start disappearing?
- is the window already closed?

---

## 9. Paso 8 — Evaluar lead times

Separar:

- decision time;
- execution time;
- result latency.

Calcular conceptualmente:

`TOTAL RESPONSE TIME`

y compararlo con:

`AVAILABLE WINDOW`.

---

## 10. Paso 9 — Evaluar irreversibility

Preguntar:

- when does intervention become impossible?
- when does it become disproportionately expensive?

---

## 11. Paso 10 — Evaluar recoverability

Distinguir:

- delayed value;
- destroyed value;
- recoverable damage;
- persistent damage.

---

## 12. Paso 11 — Evaluar opportunity expiry

Si es una oportunidad:

- does it decay?
- when does window close?
- will opportunity still exist later?

---

## 13. Paso 12 — Evaluar dependencies

Mapear:

- predecessors;
- deadlines;
- critical path;
- slack;
- unlock relations.

---

## 14. Paso 13 — Evaluar parallelism

No crear conflicto falso si candidatos usan recursos diferentes.

---

## 15. Paso 14 — Evaluar resource bottlenecks

Si varios candidatos compiten por el mismo recurso:
- secuenciación importa;
- calcular coste conceptual de preemption.

---

## 16. Paso 15 — Evaluar information value

Comparar:

`VALUE OF ADDITIONAL INFORMATION`

vs

`COST OF WAITING`

---

## 17. Paso 16 — Definir validation time budget

Si cheap/fast validation puede cambiar decisión:
- elevar validation urgency.

Si validation tarda más que window:
- no retrasar indefinidamente.

---

## 18. Paso 17 — Evaluar evidence freshness

Pregunta:

> Is data fresh enough for this decision?

Si no:
- temporal assessment confidence debe degradarse.

---

## 19. Paso 18 — Evaluar detection latency

Distinguir:

- issue became urgent;
- issue was detected late.

---

## 20. Paso 19 — Evaluar recurrence

Considerar:

- frequency;
- duration;
- recovery;
- stable vs temporary recovery.

---

## 21. Paso 20 — Evaluar peak exposure

Business exposure puede variar por hora/día/evento.

---

## 22. Paso 21 — Construir temporal scenarios

Cuando existe incertidumbre:

- BEST CASE
- BASE CASE
- DOWNSIDE CASE

No producir falsa precisión.

---

## 23. Paso 22 — Calcular temporal feasibility

Pregunta:

> Is there still enough time for meaningful intervention?

Si no:
- la naturaleza del caso puede pasar de prevent a contain/adapt,
  sin definir todavía acciones concretas.

---

## 24. Paso 23 — Evaluar urgency

Usar conceptualmente:

- time to damage;
- damage velocity;
- intervention window;
- lead time;
- recoverability;
- deadline;
- opportunity expiry;
- dependency timing;
- uncertainty.

No existe fórmula universal en P03.

---

## 25. Paso 24 — Explicar urgency

Debe producir:

- why time matters;
- what happens if we wait;
- when material damage begins;
- how fast it grows;
- when options close;
- response lead time;
- uncertainty.

---

## 26. Paso 25 — Reassess dynamically

Reevaluar cuando cambien:

- forecast;
- velocity;
- deadline;
- lead time;
- capacity;
- inventory;
- cash;
- confidence;
- external conditions;
- dependencies.

---

## 27. Preemption

Una nueva emergencia puede preemptar temporalmente otra prioridad.

Pero la anterior debe conservarse como pausada y reingresar después.

---

## 28. Preventive Escalation

Debe ser posible elevar urgency antes del daño si:

- warning horizon sufficient;
- lead time long;
- window closing;
- downside material.

---

## 29. De-escalation

Debe reducirse cuando:

- replenishment confirmed;
- risk window extends;
- damage stabilizes;
- alternative appears;
- incident resolves.

---

## 30. Boundary

P03 no:
- calcula ranking final;
- prescribe acciones F5;
- convierte deadline en priority automáticamente;
- inventa exactitud temporal;
- sustituye impact/severity/confidence.
