# Fase 03 · D02 — Contexto configurable del tenant

## Propósito

Este artefacto contiene únicamente información específica o configurable de cada ecommerce que D2 necesita para contextualizar correctamente una señal.

No contiene datos concretos de ningún cliente.

---

## 1. Modelo de negocio

Contexto configurable:

- DTC;
- subscription;
- replenishment;
- luxury;
- fashion;
- cosmetics;
- food;
- supplements;
- furniture;
- marketplace;
- B2B ecommerce;
- pre-order;
- made-to-order;
- high customization;
- modelos híbridos.

La taxonomía no debe asumirse cerrada.

---

## 2. Purchase cycle

Cada producto o categoría puede tener una frecuencia natural de compra distinta.

Contexto útil:

- purchase cycle;
- replenishment interval;
- expected repeat horizon.

No debe existir una expectativa universal de repetición.

---

## 3. Ticket y ciclo de decisión

Contexto relevante:

- price point;
- consideration time;
- assisted conversion;
- financing;
- lead nurturing;
- remarketing relevance.

---

## 4. Economía

El tenant puede definir o aportar:

- gross margin;
- contribution margin;
- COGS;
- shipping cost;
- payment fees;
- returns cost;
- discount burden;
- CAC;
- LTV;
- payback;
- working capital;
- cash position.

---

## 5. Product mix

Debe poder conocerse la composición por:

- productos;
- categorías;
- price points;
- lifecycle;
- hero products;
- nuevos lanzamientos.

---

## 6. Customer mix

Contexto configurable u observado:

- new;
- repeat;
- reactivated;
- high-value cohorts;
- low-value cohorts;
- acquisition source;
- first product;
- first-order discount.

---

## 7. Channel mix

El tenant debe poder describir sus canales y su peso:

- paid social;
- paid search;
- organic;
- direct;
- email;
- affiliates;
- influencers;
- marketplaces;
- assisted journeys;
- otros.

---

## 8. Acquisition configuration

Contexto relevante:

- prospecting;
- remarketing;
- brand;
- non-brand;
- new vs existing targeting;
- paid vs organic;
- incremental vs captured demand;
- creative-led vs intent-led.

---

## 9. Mercados y geografía

Contexto por mercado:

- AOV;
- CAC;
- payment methods;
- shipping cost;
- return rate;
- currency;
- local promotions;
- seasonality;
- competition.

---

## 10. Inventario y suministro

Configurable o específico del negocio:

- lead time;
- MOQ;
- supplier reliability;
- product lifecycle;
- launch calendar;
- warehouse constraints;
- cash exposure;
- stock availability.

---

## 11. Operaciones

Contexto:

- order volume;
- warehouse model;
- 3PL vs in-house;
- market count;
- shipping zones;
- returns policy;
- product complexity;
- customization;
- support capacity.

---

## 12. Estrategia

El tenant puede declarar:

- premium positioning;
- promotional strategy;
- discount policy;
- market focus;
- SKU strategy;
- channel strategy;
- growth strategy.

La lista no es exhaustiva.

---

## 13. Objetivos

Contexto explícito:

- growth;
- margin;
- new customer acquisition;
- cash generation;
- full-price sell-through;
- retention;
- market expansion;
- otros objetivos.

El sistema debe conocer el objetivo vigente para interpretar trade-offs.

---

## 14. Restricciones

Contexto posible:

- cash constraint;
- inventory constraint;
- team capacity;
- supplier constraint;
- platform policy;
- regulatory constraint;
- warehouse constraint;
- technology constraint.

---

## 15. Concentraciones y dependencias

El tenant puede presentar concentración en:

- channels;
- creatives;
- SKUs;
- suppliers;
- markets;
- customers.

Debe conocerse su peso cuando sea material.

---

## 16. Calendario comercial

Contexto configurable:

- promotions;
- sales;
- Black Friday;
- Cyber Monday;
- launches;
- bundles;
- price increases;
- free shipping;
- influencer activations.

---

## 17. Seasonality

El tenant puede tener patrones:

- category-driven;
- weather-driven;
- holiday-driven;
- calendar-driven;
- promotion-driven;
- market-specific.

---

## 18. Measurement state

Contexto necesario:

- attribution window;
- consent state;
- pixel implementation;
- GA4 definitions;
- Shopify reporting logic;
- FX logic;
- cambios de medición conocidos.

---

## 19. Change events

El tenant debe poder registrar cambios relevantes:

- site deployments;
- checkout;
- tracking;
- theme;
- pricing;
- shipping;
- agency;
- campaigns;
- creatives;
- product mix;
- warehouse;
- email flows;
- market launches.

---

## 20. Baselines propios

Contexto histórico útil:

- normal CVR by device;
- normal return rate by category;
- normal CAC by market;
- normal AOV by cohort;
- promociones comparables.

El baseline histórico no debe confundirse con benchmark óptimo.

---

## 21. Regime changes

El tenant context debe poder reflejar cambios estructurales como:

- international expansion;
- subscription launch;
- marketplace entry;
- price repositioning;
- warehouse model change;
- category expansion.

Estos cambios pueden invalidar comparabilidad histórica.

---

## 22. Declared y observed context

El sistema debe mantener separados:

- contexto declarado por el tenant;
- contexto observado por sistemas o datos.

Una contradicción es información útil.

---

## 23. Contexto externo relevante

Cuando proceda, puede incluir:

- competitor discounting;
- new entrant;
- price war;
- marketplace pressure;
- platform changes;
- payment incidents;
- macro events;
- weather;
- regulation.

No todo contexto externo debe persistirse como configuración estable.

---

## 24. Exclusiones

No pertenecen a tenant-context:

- principios universales de contextualización;
- guardrails;
- reglas de causalidad;
- estados de una ejecución concreta;
- experiencias históricas completas;
- outcomes de decisiones pasadas.

Esos elementos pertenecen a RAG, runtime, policies o experience-learning.
