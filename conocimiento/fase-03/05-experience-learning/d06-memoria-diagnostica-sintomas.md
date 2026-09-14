# Fase 03 · D06 — Experience & Learning de síntomas

## Propósito

D6 genera memoria diagnóstica útil para reconocer patrones recurrentes del propio ecommerce, pero no aprende todavía causalidad como verdad.

---

## 1. Diagnostic Memory

Debe poder conservarse histórico de:

- symptom;
- family;
- scope;
- onset;
- duration;
- valence;
- depth;
- linked signals;
- context;
- confidence;
- subsequent outcome cuando exista.

---

## 2. Recurring Symptoms

Ejemplo:

> Stockout pressure every major launch.

La recurrencia puede indicar un patrón estructural que fases posteriores deberán investigar.

D6 registra recurrencia, no concluye la causa.

---

## 3. Chronic Symptoms

Un síntoma persistente durante periodos prolongados puede clasificarse como `CHRONIC`.

Ejemplo:

- discount dependency durante muchos meses.

La memoria temporal es necesaria para diferenciar cronicidad de episodios puntuales.

---

## 4. Acute Symptoms

Los fallos abruptos pueden registrarse como `ACUTE`.

Ejemplo:

- payment completion failure apareciendo en minutos.

---

## 5. Pattern Memory

El sistema puede recordar:

- síntomas previamente observados;
- señales que los acompañaron;
- scopes afectados;
- contexto;
- duración;
- evolución posterior.

Ejemplo soportado por la fuente:

> La última vez que apareció este patrón, también existía creative pipeline weakness.

---

## 6. Positive Symptom Memory

D6 debe conservar también mejoras.

Esto permite posteriormente estudiar:

> qué cambió antes de que el rendimiento mejorara.

F9 necesita tanto experiencias positivas como negativas.

---

## 7. Symptom Sequence Memory

Puede conservarse el orden temporal de síntomas:

- may_precede;
- may_follow;
- often_cooccurs.

Con suficiente historia, F9 o capas causales posteriores podrán estudiar si esos patrones son repetitivos.

---

## 8. Leading Symptom Validation

Ejemplos:

- creative pipeline weakness antes de CAC deterioration;
- stockout pressure antes de conversion deterioration.

D6 registra secuencias; no convierte recurrencia en causalidad por sí sola.

---

## 9. Scope-specific Memory

Un síntoma debe recordarse junto con su scope.

No es equivalente:

- global acquisition deterioration;
- France prospecting deterioration;
- Safari payment regression.

---

## 10. Context Snapshot

La memoria útil debe conservar suficiente contexto para saber si dos síntomas históricos son comparables.

Puede incluir referencias a:

- market;
- channel;
- promotion;
- price;
- launch;
- mix;
- maturity;
- health state.

---

## 11. Pattern Reuse Boundary

Un patrón histórico puede:

- aumentar atención;
- orientar investigación;
- ayudar a formular hipótesis posteriores.

No puede:

- confirmar root cause;
- activar una acción automáticamente;
- convertirse sin validación en regla global.

---

## 12. Límites de aprendizaje

La fuente no define:

- cross-tenant symptom learning;
- automatic knowledge promotion;
- decay;
- causal weight updating;
- reinforcement;
- autonomous remediation.

Estos mecanismos quedan fuera de D6.
