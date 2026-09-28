# Fase 12.3 — Experimento

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un experimento es una intervención diseñada para aprender si un cambio produce un efecto.

Debe definir antes de ejecutarse:
- hipótesis;
- población;
- tratamiento;
- comparación;
- métrica primaria;
- guardrails;
- duración o stopping rule;
- criterios de análisis.

El diseño debe minimizar sesgos y cambios simultáneos no controlados.

Antipatrones: empezar sin hipótesis, cambiar variante a mitad, detener al ver un resultado favorable, mezclar objetivos o analizar solo conversiones positivas.

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
