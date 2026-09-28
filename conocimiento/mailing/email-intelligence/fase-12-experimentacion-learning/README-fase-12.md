# Fase 12 — Experimentación y Aprendizaje

## Estado
`COMPLETA`

## Arquitectura aplicada

- `01-rag-produccion`: conocimiento experto sobre experimentación, evidencia y aprendizaje.
- `03-runtime`: asignación, cálculos, estados, métricas, confidence y versionado determinista.
- `04-policies-guardrails`: integridad experimental y límites de promoción/deprecación.
- `05-experience-learning`: resultados, evidencia y aprendizajes reutilizables.
- `06-tenant-context`: métricas, thresholds y política local de aprendizaje.

## Regla arquitectónica crítica

`05-experience-learning` es la memoria de resultados del sistema. No se debe contaminar `01-rag-produccion` con cada test local. El RAG contiene conocimiento conceptual; la experiencia contiene lo que el sistema ha observado y aprendido.

## Flujo de conocimiento

```text
OBSERVATION
→ HYPOTHESIS
→ EXPERIMENT
→ RESULT
→ EVIDENCE
→ LEARNING CANDIDATE
→ TENANT / CATEGORY / GLOBAL LEARNING
→ VERSION / DEPRECATION
```

## Cobertura

- **12.1 — Observación** — RAG, Runtime, Experience Learning
- **12.2 — Hipótesis** — RAG, Runtime, Experience Learning
- **12.3 — Experimento** — RAG, Runtime, Experience Learning, Policies/Guardrails
- **12.4 — A/B Test** — RAG, Runtime, Experience Learning
- **12.5 — Control** — RAG, Runtime, Experience Learning
- **12.6 — Holdout** — RAG, Runtime, Experience Learning, Policies/Guardrails
- **12.7 — Sample Size** — RAG, Runtime, Experience Learning
- **12.8 — Duración** — RAG, Runtime, Experience Learning
- **12.9 — Significancia** — RAG, Runtime, Experience Learning
- **12.10 — Primary Metric** — RAG, Runtime, Experience Learning, Tenant Context
- **12.11 — Guardrail Metrics** — RAG, Runtime, Experience Learning, Tenant Context, Policies/Guardrails
- **12.12 — Resultado** — RAG, Runtime, Experience Learning
- **12.13 — Evidencia** — RAG, Runtime, Experience Learning
- **12.14 — Aprendizaje** — RAG, Runtime, Experience Learning
- **12.15 — Tenant Learning** — RAG, Runtime, Experience Learning, Tenant Context, Policies/Guardrails
- **12.16 — Category Learning** — RAG, Runtime, Experience Learning
- **12.17 — Global Learning** — RAG, Runtime, Experience Learning, Policies/Guardrails
- **12.18 — Confidence** — RAG, Runtime, Experience Learning, Tenant Context
- **12.19 — Versionado** — RAG, Runtime, Experience Learning, Policies/Guardrails
- **12.20 — Deprecación de aprendizajes** — RAG, Runtime, Experience Learning, Policies/Guardrails
