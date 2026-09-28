# Fase 12.12 — Resultado

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El resultado de un experimento debe describir qué ocurrió respecto a la hipótesis.

Puede concluir:
- support;
- no support;
- inconclusive;
- harmful;
- mixed.

No todo test produce un ganador.

La IA debe separar resultado estadístico, impacto económico y decisión de negocio.

Antipatrones: llamar “fracaso” a un resultado nulo, ocultar resultados negativos o convertir inconcluso en “casi ganador”.

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
