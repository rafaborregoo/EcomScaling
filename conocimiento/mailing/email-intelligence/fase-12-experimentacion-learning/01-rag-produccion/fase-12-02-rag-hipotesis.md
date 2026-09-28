# Fase 12.2 — Hipótesis

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una hipótesis convierte una observación o pregunta en una afirmación comprobable.

Debe expresar:
```text
si hacemos X
en población Y
esperamos cambio Z
porque mecanismo M
```

Debe ser falsable y suficientemente específica.

La IA debe separar hipótesis de recomendación. Una idea plausible no se convierte en verdad hasta generar evidencia.

Antipatrones: hipótesis vagas, múltiples variables a la vez, resultado definido después del test o justificación circular.

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
