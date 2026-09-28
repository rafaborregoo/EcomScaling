# Fase 12.1 — Observación

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Una observación es un hecho o patrón detectado en datos, comportamiento o resultados.

Debe distinguirse de una conclusión causal.

Ejemplos:
- cae el CTR;
- aumenta el abandono de checkout;
- un segmento compra menos;
- una campaña genera más revenue atribuido.

La IA debe formular observaciones de forma descriptiva antes de explicar por qué ocurrió algo.

Antipatrones: convertir correlaciones en causas, seleccionar solo anomalías llamativas, ignorar tamaño de muestra o redactar observaciones con lenguaje causal sin experimento.

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
