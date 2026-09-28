# Fase 12.5 — Control

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

El control representa la condición de referencia frente a la que se compara un tratamiento.

Puede ser:
- experiencia actual;
- no cambio;
- contenido existente;
- ausencia de intervención.

Un control debe ser suficientemente estable para interpretar la diferencia.

La IA debe evitar describir control como “peor versión”; su función es proporcionar comparación.

Antipatrones: cambiar control durante el test, utilizar control distinto entre segmentos o excluir del análisis comportamientos negativos del control.

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
