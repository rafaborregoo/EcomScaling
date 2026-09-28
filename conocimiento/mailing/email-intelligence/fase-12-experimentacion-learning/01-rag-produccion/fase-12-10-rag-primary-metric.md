# Fase 12.10 — Primary Metric

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Primary Metric es la métrica principal utilizada para evaluar la hipótesis.

Debe definirse antes del experimento y estar directamente conectada con el objetivo.

Ejemplos:
- conversion rate;
- contribution profit per recipient;
- second purchase rate;
- incremental revenue.

La IA debe evitar elegir la métrica que mejor quedó después del test.

Antipatrones: múltiples métricas primarias sin prioridad, cambiar KPI post hoc, usar open rate para una hipótesis de profit o ignorar latencia de la métrica.

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
