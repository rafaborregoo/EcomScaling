# Fase 13 — Motores deterministas

## Estado
`COMPLETA`

## Arquitectura aplicada

- `03-runtime`: núcleo de los motores de decisión.
- `04-policies-guardrails`: restricciones duras donde corresponde.
- `06-tenant-context`: pesos, thresholds, definiciones y prioridades configurables por ecommerce.

## Decisión arquitectónica

Esta fase no se rellena con RAG artificial. Su objetivo es separar la lógica determinista del razonamiento generativo. Los contratos de entrada/salida de agentes se formalizan en Fase 14.

## Flujo general

```text
RAW EVENTS / STATE
→ LIFECYCLE / INTENT / ENGAGEMENT
→ SEGMENTATION / ELIGIBILITY
→ PRESSURE
→ FLOW / CAMPAIGN ARBITRATION
→ PRODUCT / OFFER
→ COMPLIANCE
→ MEASUREMENT / EVIDENCE
→ SEND DECISION
```

## Cobertura

- **13.1 — Lifecycle Engine** — Runtime, Tenant Context
- **13.2 — Intent Engine** — Runtime, Tenant Context
- **13.3 — Engagement Engine** — Runtime, Tenant Context
- **13.4 — Segmentation Engine** — Runtime, Tenant Context
- **13.5 — Eligibility Engine** — Runtime, Tenant Context, Policies/Guardrails
- **13.6 — Contact Pressure Engine** — Runtime, Tenant Context, Policies/Guardrails
- **13.7 — Flow Arbitration Engine** — Runtime, Tenant Context
- **13.8 — Campaign Arbitration Engine** — Runtime, Tenant Context
- **13.9 — Offer Engine** — Runtime, Tenant Context, Policies/Guardrails
- **13.10 — Product Recommendation Engine** — Runtime, Tenant Context
- **13.11 — Compliance Engine** — Runtime, Tenant Context, Policies/Guardrails
- **13.12 — Measurement Engine** — Runtime, Tenant Context
- **13.13 — Evidence Engine** — Runtime, Tenant Context, Policies/Guardrails
- **13.14 — Send Decision Engine** — Runtime, Tenant Context, Policies/Guardrails
