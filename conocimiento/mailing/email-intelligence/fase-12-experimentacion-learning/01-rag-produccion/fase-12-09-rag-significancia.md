# Fase 12.9 — Significancia

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Significancia estadística evalúa si una diferencia observada sería poco compatible con el azar bajo un modelo determinado.

No indica:
- tamaño del efecto;
- importancia económica;
- causalidad por sí sola;
- replicabilidad garantizada.

La IA debe presentar significancia junto con efecto, intervalo e impacto práctico.

Antipatrones: p<0.05 = verdad, ignorar múltiples comparaciones, declarar empate por falta de significancia o ganador comercial con efecto trivial.

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
