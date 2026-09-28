# Fase 12.8 — Duración

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

La duración de un experimento debe permitir capturar suficiente muestra y representar ciclos relevantes del negocio.

No debe decidirse únicamente por alcanzar significancia momentánea.

Debe considerar:
- volumen;
- weekday effects;
- seasonality;
- purchase lag;
- attribution window.

La IA debe evitar detener tests por picos tempranos.

Antipatrones: parar en cuanto B va ganando, duración distinta por variante o extender indefinidamente hasta obtener resultado favorable.

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
