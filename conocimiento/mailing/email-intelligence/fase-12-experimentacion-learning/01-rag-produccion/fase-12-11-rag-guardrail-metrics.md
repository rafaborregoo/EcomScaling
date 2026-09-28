# Fase 12.11 — Guardrail Metrics

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Guardrail Metrics protegen dimensiones que no deben deteriorarse mientras se optimiza la métrica primaria.

Ejemplos:
- unsubscribe;
- complaints;
- margin;
- refund rate;
- deliverability;
- customer support load.

Un experimento puede mejorar conversion y aun ser inaceptable si rompe un guardrail.

Antipatrones: mirar guardrails solo al final, elegirlos después del resultado o considerar que cualquier mejora primaria justifica deterioro colateral.

---

## Marco epistemológico

La IA debe separar:

```text
OBSERVATION
→ HYPOTHESIS
→ EXPERIMENT
→ RESULT
→ EVIDENCE
→ LEARNING
```

Cada paso aumenta estructura, pero no todos los experimentos producen conocimiento reutilizable.

---

## Principios

- observar antes de explicar;
- definir hipótesis antes de medir;
- decidir métricas antes de ver resultados;
- preservar resultados negativos;
- diferenciar correlación y causalidad;
- mantener alcance y contexto;
- expresar incertidumbre;
- no promocionar automáticamente aprendizaje local a global.

---

## Preguntas del agente

```text
¿Qué sabemos realmente?
¿Qué estamos suponiendo?
¿Cómo podría falsarse?
¿Qué evidencia necesitamos?
¿Cuál es la población?
¿Qué métrica decide?
¿Qué guardrails existen?
¿La muestra y duración son suficientes?
¿Qué alcance tiene el resultado?
¿Con qué confianza puede reutilizarse?
```

---

## Principio maestro

El sistema debe aprender de evidencia sin convertir cada resultado en una regla.
