# Fase 14 — Contratos de IA

## Estado
`COMPLETA`

## Arquitectura aplicada

- `02-contratos-IA`: capa principal y exclusiva de esta fase.

## Decisión arquitectónica

Esta fase no duplica RAG, Runtime, Policies ni Tenant Context. Los contratos referencian esas capas y obligan a los agentes a consumirlas y devolver outputs estructurados.

## Contrato transversal

Todos los agentes comparten cuatro piezas críticas:

- `confidence`
- `missing_information`
- `evidence`
- `risks`

Además, toda recomendación que dependa de lógica determinista permanece `PROPOSED` hasta validación del motor correspondiente.

## Jerarquía de autoridad

```text
POLICY / COMPLIANCE
> RUNTIME SOURCE OF TRUTH
> TENANT CONTEXT
> EXPERIENCE LEARNING
> RAG
> MODEL INFERENCE
```

## Cobertura

- **14.1 — Email Strategy Contract** — Contrato IA
- **14.2 — Campaign Strategy Contract** — Contrato IA
- **14.3 — Flow Strategy Contract** — Contrato IA
- **14.4 — Copy Contract** — Contrato IA
- **14.5 — Creative Brief Contract** — Contrato IA
- **14.6 — Segmentation Contract** — Contrato IA
- **14.7 — Offer Contract** — Contrato IA
- **14.8 — Product Recommendation Contract** — Contrato IA
- **14.9 — Audit Contract** — Contrato IA
- **14.10 — Experiment Contract** — Contrato IA
- **14.11 — Learning Contract** — Contrato IA
- **14.12 — Confidence** — Contrato IA
- **14.13 — Missing Information** — Contrato IA
- **14.14 — Evidence** — Contrato IA
- **14.15 — Risks** — Contrato IA
- **14.16 — Contrato base transversal** — envelope común para todos los agentes
