# Fase 12.14 — Aprendizaje

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un aprendizaje es una conclusión operativa extraída de evidencia suficiente.

Debe expresar:
- qué se aprendió;
- para qué población/contexto;
- bajo qué condiciones;
- con qué confianza;
- qué evidencia lo soporta.

No debe convertirse automáticamente en regla global.

La IA debe mantener el alcance del aprendizaje.

Antipatrones: generalizar desde un test, omitir condiciones, convertir hipótesis plausible en conocimiento o mantener aprendizajes después de quedar contradichos.

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
