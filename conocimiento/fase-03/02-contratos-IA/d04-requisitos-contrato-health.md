# Fase 03 · D04 — Requisitos contractuales de salud por capacidad

## Estado

La fuente define vocabulario, estados, dimensiones y estructuras conceptuales de salida, pero no un schema técnico implementado.

No se inventan JSON Schema, tablas, APIs ni nombres definitivos de campos.

---

## 1. Capability Health State

El sistema debe poder representar, por capability:

- health state;
- scope;
- confidence;
- maturity;
- required maturity;
- trajectory;
- risk;
- evidence;
- business exposure;
- structural risk;
- current impact;
- current failure;
- assessment status.

Health states presentes:

- `ELITE`
- `HEALTHY`
- `FRAGILE`
- `BAD`
- `CRITICAL`
- `DISASTER`
- `UNKNOWN`
- `NOT_ASSESSABLE`

---

## 2. Health dimensions

Debe poder intercambiarse información sobre:

- performance;
- efficiency;
- stability;
- trend;
- reliability;
- resilience;
- capacity;
- exposure;
- dependency;
- control.

La fuente no define ponderaciones universales.

---

## 3. Trajectory

Estados conceptuales:

- `IMPROVING`
- `STABLE`
- `DETERIORATING`
- `RAPIDLY_DETERIORATING`
- `RECOVERING`
- `VOLATILE`

Health y trajectory deben ser campos conceptualmente separados.

---

## 4. Scope y segmentación

Una evaluación debe poder asociarse a:

- capability global;
- subcapability;
- canal;
- dispositivo;
- mercado;
- cohorte;
- SKU;
- segmento;
- otro scope relevante.

Debe poder coexistir parent HEALTHY con subcapability CRITICAL.

---

## 5. Evidence

Cada health assessment debería poder asociar:

- supporting evidence;
- contradicting evidence;
- positive evidence;
- source;
- time window;
- baseline;
- target;
- confidence.

La fuente no define formato de evidence objects.

---

## 6. Baseline y target

Debe poder distinguirse:

- self baseline;
- adjusted baseline;
- business target;
- economic guardrail;
- external benchmark cuando exista.

D4 debe funcionar sin depender de benchmark externo.

---

## 7. Health horizon

Debe poder representar:

- current health;
- near-term risk;
- horizonte.

Horizontes conceptuales:

- NOW
- 7D
- 30D
- 90D

No se trata de forecast completo.

---

## 8. Early Warning

Debe poder emitirse un `EARLY_WARNING` con:

- capability;
- scope;
- leading signals;
- trajectory;
- risk;
- confidence;
- exposición.

---

## 9. Primary vs downstream

Debe poder distinguirse:

- `PRIMARY_HEALTH_ISSUE`
- `DOWNSTREAM_HEALTH_EFFECT`

sin afirmar causalidad formal.

---

## 10. Propagation Risk

Debe poder representarse:

- capability origen;
- capabilities potencialmente afectadas;
- nivel o naturaleza del propagation risk;
- evidencia o dependencia conocida.

---

## 11. Structural Risk

Debe poder coexistir:

- current health;
- maturity gap;
- structural risk.

Un estado HEALTHY puede tener HIGH structural risk.

---

## 12. Acute / chronic

Debe poder distinguirse:

- `ACUTE_FAILURE`
- `CHRONIC_WEAKNESS`
- chronic fragility;
- `HEALTH_DEBT`

La fuente no define thresholds temporales.

---

## 13. Severity

Debe representarse por separado de health.

- Health = estado de capability.
- Severity = daño de finding concreto.

---

## 14. Findings

Una capability puede tener múltiples findings.

Cada finding debería poder preservar:

- description;
- supporting evidence;
- contradicting evidence;
- severity;
- scope;
- impact;
- trajectory;
- confidence.

---

## 15. Business Criticality

Debe poder existir conocimiento/configuración sobre critical capabilities según modelo de negocio.

Ejemplos conceptuales:

- DTC físico: Payment, Inventory, Fulfillment, Acquisition.
- Subscription: Retention, Billing.
- Marketplace: supply liquidity, demand liquidity, matching.

---

## 16. Impact Vector

Debe poder expresar impacto potencial o actual sobre:

- revenue;
- contribution;
- cash;
- customer experience;
- operations;
- brand;
- risk;
- continuity.

---

## 17. Capability Health Card

La fuente propone una estructura conceptual con:

- capability;
- health;
- maturity;
- required maturity;
- trajectory;
- confidence;
- scope;
- primary signals;
- business exposure;
- current impact;
- structural risk;
- current failure.

No se considera schema implementado.

---

## 18. Business Health Matrix

Debe poder agregarse una vista por capability con:

- maturity;
- health;
- trajectory;
- risk.

La matriz es una presentación derivada, no la fuente de razonamiento.

---

## 19. Business Health Layers

Debe poder agregarse por capas:

- Commercial Health;
- Economic Health;
- Operating Health;
- Structural Health;
- Data Health.

---

## 20. Continuous State

El sistema debe poder conservar el health state a lo largo del tiempo para habilitar stateful consulting y monitorización.

---

## 21. Not Assessable

Cuando falta evidencia necesaria:

- `NOT_ASSESSABLE`

No debe sustituirse por HEALTHY.

---

## 22. Límites contractuales

D4 no debe producir como salida final:

- root cause confirmada;
- prioridad;
- playbook;
- recomendación definitiva.

Puede producir estado, evidence, risk, trajectory e interacción plausible.

---

## 23. Elementos no definidos

No están definidos en la fuente:

- JSON Schema;
- tipos TypeScript;
- tablas;
- algoritmos de scoring;
- ponderaciones;
- thresholds;
- política exacta de agregación;
- APIs;
- persistencia.
