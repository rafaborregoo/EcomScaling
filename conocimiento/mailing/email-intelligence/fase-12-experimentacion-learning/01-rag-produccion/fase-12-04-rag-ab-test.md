# Fase 12.4 — A/B Test

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un A/B test compara dos o más variantes asignadas a poblaciones comparables.

Su valor depende de:
- asignación correcta;
- exposición real;
- muestra suficiente;
- métrica definida;
- ventana coherente.

La variante B no debe considerarse mejor simplemente porque su métrica observada sea mayor.

La IA debe interpretar diferencia, incertidumbre y relevancia práctica.

Antipatrones: “winner” por diferencia mínima, grupos desbalanceados sin explicación, contaminación entre variantes o múltiples cambios que impiden saber qué causó el efecto.

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
