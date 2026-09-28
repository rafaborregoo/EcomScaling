# Fase 12.6 — Holdout

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Holdout es un grupo deliberadamente no expuesto a una intervención para estimar qué habría ocurrido sin ella.

Es especialmente útil para medir incrementality.

Puede existir a nivel:
- campaña;
- flow;
- canal;
- estrategia.

El holdout debe mantenerse suficientemente aislado de la intervención.

Antipatrones: enviar otras comunicaciones equivalentes al holdout, excluirlo después del resultado o hacerlo tan pequeño que no permita aprendizaje.

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
