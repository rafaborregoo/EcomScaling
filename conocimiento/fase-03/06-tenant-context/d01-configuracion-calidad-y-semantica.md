# Fase 03 · D01 — Contexto configurable por tenant para calidad de datos

## Propósito

Este documento reúne únicamente conceptos del D1 que dependen de la arquitectura, configuración o contexto comercial de cada ecommerce.

No contiene datos concretos de ningún cliente y no define un schema técnico.

---

## 1. Cadencia esperada por fuente y dataset

La evaluación de freshness necesita contexto configurable sobre la frecuencia esperada de cada fuente o dataset.

Ejemplos conceptuales del corpus muestran que:

- pedidos live pueden requerir una cadencia de minutos;
- contabilidad puede tolerar horas;
- un P&L mensual puede tolerar días.

Estos valores no deben convertirse en defaults universales sin validación del tenant.

Contexto necesario:

- fuente o dataset;
- cadencia esperada;
- sensibilidad temporal del uso;
- tolerancia a retraso.

---

## 2. Source of Truth por fenómeno

Cada ecommerce puede resolver de forma distinta qué sistema es fuente primaria de:

- orders;
- revenue;
- payments;
- inventory;
- spend;
- refunds;
- otras métricas.

El tenant context debe poder expresar la jerarquía apropiada según su arquitectura:

- primary;
- secondary;
- validation;
- derived.

No debe asumirse que Shopify, ERP, WMS, PSP o analytics ocupan siempre la misma posición.

---

## 3. Definiciones de métricas del negocio

El significado de métricas derivadas puede depender de la metodología interna.

Contexto configurable relevante:

- definición de CAC;
- definición de MER;
- definición de revenue;
- tratamiento de descuentos;
- tratamiento de refunds;
- inclusión o exclusión de shipping;
- inclusión o exclusión de taxes;
- scope de la métrica;
- moneda de reporting.

El sistema necesita mantener consistencia con la definición elegida por el negocio.

---

## 4. Monedas y reglas de reporting

En ecommerce internacional pueden variar:

- monedas nativas por mercado o fuente;
- reporting currency;
- metodología de conversión;
- momento de conversión.

Este contexto es necesario para distinguir crecimiento económico de efectos de FX.

---

## 5. Timezones y calendarios operativos

El tenant puede operar con distintas zonas horarias entre:

- ecommerce;
- plataformas publicitarias;
- analytics;
- finanzas;
- ERP/WMS.

Debe conocerse la referencia temporal usada para reporting y análisis, especialmente en comparativas diarias.

---

## 6. Arquitectura de integración

El significado de un dato depende de cómo esté conectada la tienda.

Contexto configurable relevante:

- fuentes conectadas;
- objetos o dominios disponibles por fuente;
- permisos esperados;
- mecanismo de ingestión: webhook, batch u otro;
- cadencia de sync;
- dependencias entre datasets;
- existencia de backfills o procesos de carga histórica.

El hecho de que una integración esté conectada no implica que disponga de todos los scopes necesarios.

---

## 7. Attribution configuration

Para interpretar marketing debe conocerse, cuando aplique:

- attribution window por plataforma;
- modelo de atribución;
- si existen conversiones modeladas;
- cambios históricos de configuración;
- configuración de Consent Mode o mecanismos equivalentes;
- tracking browser-side o server-side;
- despliegues relevantes de píxel o tracking.

Este contexto permite separar deterioro de medición de deterioro real.

---

## 8. Reglas de revenue y refunds

La tienda puede utilizar metodologías distintas para:

- gross sales;
- net sales;
- total sales;
- recognized revenue;
- reconocimiento temporal de refunds.

El diagnóstico debe utilizar la metodología del tenant y no una definición universal implícita.

---

## 9. Estados y filtros comerciales relevantes

Puede ser necesario conocer qué estados de pedido forman parte del análisis real del negocio.

El corpus menciona:

- paid;
- pending;
- cancelled;
- refunded;
- partially refunded;
- fraudulent;
- test.

La inclusión o exclusión concreta debe alinearse con la metodología del tenant.

---

## 10. Segmentos con fiabilidad diferenciada

Una misma fuente puede comportarse de manera distinta por:

- mercado;
- canal;
- tipo de pedido;
- suscripción;
- producto;
- moneda;
- integración auxiliar.

El tenant context debe permitir registrar excepciones conocidas o scopes con fiabilidad diferente, sin convertirlas en reglas globales para todos los clientes.

---

## 11. Fuentes de validación disponibles

La capacidad de cross-validation depende de la arquitectura del ecommerce.

El sistema debe conocer qué fuentes existen para validar fenómenos como:

- orders;
- revenue;
- payments;
- traffic;
- spend;
- inventory;
- email revenue;
- refunds.

La matriz concreta de validación debe configurarse por tenant.

---

## 12. Baselines y periodos especiales

La comparabilidad puede depender de eventos propios del negocio:

- promociones;
- Black Friday;
- lanzamientos;
- cambios de mercado;
- periodos atípicos.

El D1 solo exige reconocer que el baseline puede no ser técnicamente comparable. La definición y gestión completa de baselines puede corresponder a capas posteriores del sistema de diagnóstico.

---

## 13. Lo que no pertenece a tenant-context

No deben almacenarse aquí como contexto configurable:

- principios universales de calidad de datos;
- guardrails;
- lógica de propagación de reliability;
- reglas de no sumar atribución;
- estados runtime del diagnóstico;
- datos observados de una ejecución concreta.

Tenant-context describe configuración estable o relativamente estable del ecommerce, no telemetría de una ejecución.
