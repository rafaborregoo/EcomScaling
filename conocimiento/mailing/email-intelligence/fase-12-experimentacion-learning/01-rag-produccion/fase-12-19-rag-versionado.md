# Fase 12.19 — Versionado

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Versionado permite saber qué hipótesis, experimento, evidencia o aprendizaje estaba vigente en cada momento.

Nunca debe sobrescribirse conocimiento histórico de forma destructiva.

Cada versión puede incluir:
- created_at;
- valid_from;
- status;
- reason;
- evidence set;
- supersedes.

Esto permite reproducir decisiones pasadas.

Antipatrones: editar aprendizajes in-place, perder evidencia antigua o aplicar conocimiento futuro a análisis históricos.

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
