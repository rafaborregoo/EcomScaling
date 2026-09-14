# Fase 03 · D06 — Tenant context del motor de síntomas

## Propósito

Contexto específico del ecommerce necesario para que un patrón de señales se convierta en el síntoma correcto.

No contiene valores concretos de ningún cliente.

---

## 1. Business Scope

El tenant puede tener scopes como:

- markets;
- channels;
- products;
- SKUs;
- customer segments;
- cohorts;
- devices;
- browsers;
- payment methods;
- operational units.

La taxonomía concreta determina dónde puede localizarse un síntoma.

---

## 2. Funnel Structure

La estructura real del funnel puede incluir:

- PDP;
- Cart;
- Checkout;
- Payment;
- Order;
- otros pasos específicos.

D6 debe usar el funnel del tenant y no asumir siempre uno idéntico.

---

## 3. Business Relationships

Las relaciones operativas relevantes pueden depender del modelo del ecommerce.

Ejemplos:

- subscription;
- DTC;
- marketplace;
- multi-market;
- wholesale/hybrid.

Esto puede modificar qué patrones son coherentes.

---

## 4. Capability Map

El tenant puede organizar capabilities y subcapabilities de forma concreta.

D6 necesita esa jerarquía para:

- parent-child symptoms;
- localization;
- cross-capability patterns.

---

## 5. Current Context

D2 puede aportar:

- promotion state;
- pricing changes;
- launches;
- market shifts;
- audience mix;
- seasonality;
- product mix.

Estos elementos pueden cambiar el síntoma correcto.

---

## 6. Maturity Context

D3 aporta el maturity profile concreto.

Algunos patrones estructurales pueden interpretarse de forma distinta según complejidad y stage.

---

## 7. Health Context

D4 aporta health state actual.

El mismo symptom puede coexistir con:

- healthy capability;
- fragile capability;
- bad capability.

Health no debe sustituir symptom.

---

## 8. Known Symptom Patterns

Cada tenant puede acumular patrones previamente observados.

Deben conservar:

- scope;
- context;
- recurrence;
- confidence;
- previous outcome.

Pertenecen principalmente a experience-learning; tenant-context solo referencia su disponibilidad y aplicabilidad.

---

## 9. Business Model

El modelo de negocio puede modificar:

- symptom relevance;
- expected relationships;
- funnel structure;
- critical capabilities;
- time lags.

---

## 10. Segment Importance

Un síntoma localizado puede importar más si afecta:

- high-value segment;
- strategic market;
- hero product;
- major channel;
- critical payment method.

---

## 11. Qualitative Sources

La disponibilidad de:

- reviews;
- support tickets;
- calls;
- surveys;
- logs;

determina qué síntomas multimodales pueden evaluarse.

---

## 12. Historical Comparability

Para reutilizar diagnostic memory debe conocerse si el contexto actual es comparable al episodio histórico.

---

## 13. Exclusiones

No pertenecen a tenant-context:

- taxonomía universal de síntomas;
- guardrails;
- rules de pattern coherence;
- runtime state de una ejecución;
- historical diagnostic memory completa;
- causal graph.
