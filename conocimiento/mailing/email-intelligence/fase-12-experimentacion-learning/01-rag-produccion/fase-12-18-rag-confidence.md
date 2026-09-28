# Fase 12.18 — Confidence

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Confidence expresa cuánto respaldo tiene una inferencia o aprendizaje.

No debe confundirse con probabilidad exacta si el sistema no la ha calibrado.

Puede depender de:
- calidad de evidencia;
- tamaño de muestra;
- replicación;
- consistencia;
- actualidad;
- aplicabilidad al contexto.

La IA debe utilizar confidence para modular el lenguaje y la autonomía.

Antipatrones: 95% inventado por el LLM, confianza alta por una sola observación o mantener confidence aunque la evidencia quede obsoleta.

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
