# Fase 12.13 — Evidencia

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Evidencia es información que aumenta o reduce la confianza en una afirmación.

Puede provenir de:
- experimento;
- observación repetida;
- datos operativos;
- análisis;
- investigación.

No toda evidencia tiene el mismo peso.

La IA debe distinguir evidencia causal, correlacional, anecdótica y externa.

Antipatrones: una campaña = regla universal, ignorar evidencia contraria, combinar datos incompatibles o tratar opinión como evidencia.

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
