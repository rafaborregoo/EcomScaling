# Fase 12.20 — Deprecación de aprendizajes

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Un aprendizaje debe poder dejar de utilizarse cuando:
- queda contradicho;
- expira;
- cambia el contexto;
- aparece evidencia superior;
- su fuente deja de ser fiable.

Deprecar no significa borrar.

El sistema debe conservarlo para auditoría y evitar recuperarlo como conocimiento vigente.

La IA debe reconocer que conocimiento útil puede perder validez con el tiempo.

Antipatrones: borrar aprendizajes antiguos, mantenerlos activos para siempre, deprecar sin razón o reemplazarlo sin conservar lineage.

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
