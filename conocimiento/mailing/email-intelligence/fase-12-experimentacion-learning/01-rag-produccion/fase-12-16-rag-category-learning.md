# Fase 12.16 — Category Learning

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Category Learning agrupa patrones que parecen repetirse dentro de una categoría de producto o negocio.

Está entre el conocimiento local y el global.

Ejemplos:
- replenishment más corto en consumibles;
- cierto tipo de demostración funciona en productos visuales.

Debe apoyarse en evidencia de múltiples contextos y conservar incertidumbre.

Antipatrones: crear categoría con una sola tienda, ignorar diferencias de ticket/mercado o presentar promedio como regla para todos.

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
