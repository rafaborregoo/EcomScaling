# Fase 03 · D03 — Requisitos contractuales de madurez

## Estado

La fuente define estados, dimensiones y requisitos conceptuales, pero no un schema técnico implementado.

No se inventan JSON Schema, tablas, endpoints ni tipos definitivos.

---

## 1. Requisitos de perfil de madurez

Debe poder representarse:

- business stage;
- maturity por capability;
- required maturity;
- available maturity;
- confidence;
- evidencia;
- gap;
- interpretación del gap.

---

## 2. Stage Gates

El sistema debe poder referenciar stages E0–E12 definidos en Fase 2.

D3 consume estos stages; no los redefine.

Debe preservarse consistencia de nombres y significado.

---

## 3. Capability profile

Debe poder existir un perfil por áreas como:

- Market;
- Product;
- Offer;
- Unit Economics;
- Acquisition;
- Creative;
- Conversion;
- Retention;
- Inventory;
- Operations;
- Finance;
- Data;
- Technology;
- Team;
- Strategy.

---

## 4. Capability maturity ladder

La fuente define:

- `ABSENT`
- `AD_HOC`
- `REPEATABLE`
- `DEFINED`
- `MEASURED`
- `OPTIMIZED`
- `ADAPTIVE`

No se define todavía un mapping técnico definitivo a E0–E12.

---

## 5. Dimensiones de capability

Una evaluación debería poder considerar:

- existence;
- consistency;
- repeatability;
- measurement;
- ownership;
- automation;
- predictability;
- optimization;
- resilience;
- learning.

---

## 6. Required maturity

Debe poder intercambiarse contexto suficiente para estimar madurez requerida a partir de:

- revenue scale;
- order volume;
- SKU complexity;
- market count;
- channel count;
- team size;
- fulfillment complexity;
- customer base;
- growth rate;
- inventory exposure;
- cash exposure.

---

## 7. Expectation bands

Por capability y stage, la fuente contempla:

- `MINIMUM`
- `EXPECTED`
- `ADVANCED`

También introduce `MINIMUM_VIABLE_CAPABILITY`.

---

## 8. Findings estructurales

D3 debe poder expresar estados o findings como:

- `CAPABILITY_NOT_YET_DEVELOPED`
- `STRUCTURAL_WEAKNESS`
- `GROWTH_SYSTEM_GAP`
- `OVERENGINEERING`
- `STRUCTURAL_DEBT`
- `FRAGILE_GROWTH`
- `SUSTAINABLE_GROWTH`
- `MATURITY_BOTTLENECK`
- `MATURITY_REGRESSION`
- `LATENT_STRUCTURAL_RISK`
- `STRUCTURAL_IMBALANCE`
- `COMPLEXITY_THEATER`
- `PREMATURE_SCALING`
- `APPROPRIATE`
- `CRITICALLY_BEHIND`

La fuente no define un enum contractual cerrado.

---

## 9. State vs Stage

El contrato debe preservar por separado:

- structural stage;
- current health/state.

Un incidente actual no debe sobrescribir automáticamente el stage.

---

## 10. Evidencia

Debe poder asociarse evidencia a una evaluación de madurez.

Jerarquía conceptual:

1. observed system behavior;
2. system data;
3. documented process;
4. user claim.

Debe poder conservarse confidence y provenance.

---

## 11. Advancement evidence

Para justificar avance de maturity debe poder registrarse evidencia nueva, como:

- structured testing;
- process adoption;
- ownership;
- measured outcomes;
- feedback loops;
- forecasting;
- resilience.

---

## 12. Regression evidence

Debe poder distinguirse:

- temporary failure;
- structural regression.

La regresión estructural requiere evidencia persistente de deterioro de capacidad.

---

## 13. Dependency graph

Debe poder representarse que una capability depende de otras.

Ejemplo conceptual:

Acquisition Scaling requiere soporte de:

- Inventory;
- Finance;
- Creative;
- Conversion;
- Operations;
- Data.

No se define aquí un formato de grafo.

---

## 14. Capability ceiling

Debe poder expresarse que una capability limita a otra.

Ejemplo:

- creative production capacity → paid acquisition scalability.

---

## 15. Outcome evidence

Debe poder registrarse, cuando exista:

- capability;
- expected behavior;
- observed outcome;
- measurement;
- influence on decisions.

---

## 16. Maturity profile evolution

El sistema debe poder actualizar el perfil cuando aparece nueva evidencia.

Debe distinguirse entre:

- cambio real de madurez;
- reducción de incertidumbre;
- aumento de confidence.

---

## 17. Ownership y decision rights

Debe poder registrarse:

- owner;
- responsibility;
- decision authority;
- key-person dependency;
- founder dependency.

---

## 18. Learning maturity

Debe poder representarse la existencia de mecanismos como:

- postmortems;
- test repositories;
- creative learnings;
- forecast accuracy reviews;
- campaign learnings.

---

## 19. Elementos no definidos

No están definidos en la fuente:

- schema JSON;
- modelo de tablas;
- algoritmo de scoring;
- fórmula de confidence;
- mapping exacto ladder ↔ E0–E12;
- ponderaciones;
- thresholds;
- persistencia;
- API.
