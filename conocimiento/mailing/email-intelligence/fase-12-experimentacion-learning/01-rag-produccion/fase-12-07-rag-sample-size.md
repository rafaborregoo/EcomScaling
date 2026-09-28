# Fase 12.7 — Sample Size

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Sample Size determina cuántas observaciones son necesarias para detectar un efecto con un nivel de incertidumbre aceptable.

Depende de:
- baseline rate;
- efecto mínimo relevante;
- variabilidad;
- nivel de confianza;
- potencia;
- número de variantes.

No existe un tamaño universal.

La IA debe diferenciar significancia estadística de relevancia comercial.

Antipatrones: “1000 usuarios siempre basta”, terminar por intuición, ignorar baja tasa base o aumentar variantes sin recalcular muestra.

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
