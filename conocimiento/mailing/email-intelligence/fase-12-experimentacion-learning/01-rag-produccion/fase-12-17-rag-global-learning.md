# Fase 12.17 — Global Learning

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Global Learning contiene patrones suficientemente generales para informar razonamiento transversal.

Debe ser la capa con mayor exigencia de evidencia porque tiene mayor alcance.

Un aprendizaje global no debe contener datos específicos de clientes o tiendas.

Puede expresar principios probabilísticos, no reglas absolutas.

Antipatrones: promocionar un resultado local a global, borrar excepciones, usar datos confidenciales o convertir benchmark en verdad universal.

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
