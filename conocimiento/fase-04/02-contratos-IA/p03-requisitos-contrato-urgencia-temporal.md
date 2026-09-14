# Fase 04 · P03 — Requisitos contractuales de urgencia y sensibilidad temporal

## Estado

P03 es `RAG / KNOWLEDGE`.

No define schemas técnicos, enums formales ni APIs.

Este archivo recoge únicamente **requisitos conceptuales de representación futura**.

---

## 1. Temporal Assessment

Un futuro objeto de evaluación temporal debería poder representar:

- candidate reference;
- current state;
- trajectory;
- time to damage;
- time to material damage;
- damage velocity;
- acceleration;
- cost of delay;
- intervention window;
- decision deadline;
- time to irreversibility;
- decision lead time;
- execution lead time;
- result latency;
- total response time;
- recovery time;
- opportunity expiry;
- recoverability;
- temporal dependencies;
- slack;
- temporal uncertainty;
- urgency assessment.

---

## 2. Trajectory

Debe poder distinguir conceptualmente:

- STABLE
- LINEAR_DETERIORATION
- ACCELERATING
- THRESHOLD_OR_CLIFF
- COMPOUNDING
- TEMPORARY_WINDOW

La fuente no define un enum técnico final.

---

## 3. Time-to-Damage

Debe poder representar:

- earliest plausible damage;
- base estimate;
- latest plausible damage;
- confidence/range;
- material damage onset.

No debe forzarse un valor puntual.

---

## 4. Cost of Delay

Debe poder representar:

- economic loss rate;
- operational loss;
- strategic loss;
- opportunity decay;
- qualitative category;
- curve shape.

---

## 5. Cost-of-Delay Curve

Debe poder describirse conceptualmente como:

- linear;
- accelerating;
- decelerating;
- step;
- cliff;
- windowed;
- seasonal.

---

## 6. Intervention Window

Debe poder representar:

- window open time;
- window close time;
- remaining time;
- whether meaningful options still exist.

---

## 7. Decision Deadline

Debe poder mantenerse separado de:

- event date;
- damage date;
- execution deadline.

---

## 8. Lead Times

Debe poder representar por separado:

- decision lead time;
- execution lead time;
- result latency;
- total response time.

---

## 9. Reversibility / Recoverability

Debe poder representar:

- reversibility of decision;
- reversibility of cause/intervention;
- recoverability of lost value;
- time to irreversibility.

---

## 10. Deadline Type

Conceptualmente debe poder distinguir:

- hard deadline;
- soft deadline;
- artificial deadline.

No se define enum formal.

---

## 11. Opportunity Window

Debe poder representar:

- opportunity value;
- expiry;
- decay;
- window duration;
- evidence supporting window.

---

## 12. Temporal Dependency

Debe poder representar:

- predecessor;
- successor;
- must-finish-before relation;
- deadline fed by predecessor;
- slack;
- critical-path status.

---

## 13. Parallelism / Resource Conflict

Debe poder representar:

- resource required;
- whether two candidates can run in parallel;
- shared bottleneck;
- queue/preemption cost.

---

## 14. Validation Time Budget

Debe poder representar:

- validation time available;
- value of additional information;
- cost of waiting;
- unresolved uncertainty;
- decision risk.

---

## 15. Forecast Timing

Debe poder separar:

- forecast horizon;
- forecast confidence;
- warning horizon;
- actionability horizon;
- earliest plausible event;
- best/base/downside scenario.

---

## 16. Temporal Exposure

Debe poder asociar:

- business exposure by time;
- peak exposure;
- event exposure;
- temporal concentration of damage.

---

## 17. Incident Temporal Profile

Debe poder representar:

- start;
- duration;
- frequency;
- recovery;
- recurrence;
- mean-time-between-failure concept if later implemented.

---

## 18. Detection / Response Latency

Debe poder representar:

- problem start;
- detection time;
- decision time;
- execution time;
- recovery time.

---

## 19. Evidence Freshness

Debe poder asociar:

- evidence timestamp;
- phenomenon frequency;
- freshness requirement;
- stale flag/assessment.

---

## 20. Temporal Uncertainty

Debe poder conservar:

- range;
- worst plausible timing;
- best plausible timing;
- base case;
- uncertainty source.

---

## 21. Urgency Explanation

Toda evaluación material debería poder responder:

- why time matters;
- what happens if we wait;
- when damage begins;
- how fast it grows;
- when options close;
- how long response takes.

---

## 22. Boundary

P03 no define:

- JSON Schema;
- exact urgency score;
- weighting formula;
- exact time thresholds;
- DB schema;
- alerting engine;
- scheduler;
- API.

No deben inventarse.
