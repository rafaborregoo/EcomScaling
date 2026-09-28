# Fase 12.15 — Tenant Learning

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Tenant Learning contiene aprendizajes válidos principalmente para una tienda concreta.

Ejemplos:
- determinado segmento responde peor a descuento;
- una cadencia funciona mejor en esa audiencia;
- cierto producto genera más second purchase.

Debe tener prioridad sobre generalizaciones externas cuando existe evidencia local suficientemente fuerte.

La IA no debe extrapolar automáticamente este aprendizaje a otras tiendas.

Antipatrones: convertir un patrón local en best practice global, mezclar tenants o utilizar datos de una tienda para personalizar otra.

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
