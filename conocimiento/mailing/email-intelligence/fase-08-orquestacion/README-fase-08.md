# Fase 8 — Orquestación

## Estado
`COMPLETA`

## Arquitectura aplicada

- `01-rag-produccion`: conocimiento experto para razonar sobre presión, prioridades y conflictos.
- `03-runtime`: arbitraje determinista entre campañas, flows y estados.
- `04-policies-guardrails`: límites duros que no puede saltarse el modelo.
- `06-tenant-context`: caps, cooldowns, prioridades y políticas propias de cada ecommerce.

Esta fase prepara directamente el futuro `Send Decision Engine` y los motores de arbitraje de la Fase 13, sin mezclar aquí contratos de agentes de la Fase 14.

## Cobertura

- **8.1 — Contact Pressure** — RAG, Runtime, Tenant Context
- **8.2 — Frequency Caps** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.3 — Cooldowns** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.4 — Prioridades** — RAG, Runtime, Tenant Context
- **8.5 — Campaña vs Flow** — RAG, Runtime, Tenant Context
- **8.6 — Flow vs Flow** — RAG, Runtime, Tenant Context
- **8.7 — Transaccional vs Marketing** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.8 — Exclusiones** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.9 — Supresiones** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.10 — Fatiga** — RAG, Runtime, Tenant Context
- **8.11 — Saturación** — RAG, Runtime, Tenant Context
- **8.12 — Cannibalización** — RAG, Runtime, Tenant Context
- **8.13 — Conflictos de producto** — RAG, Runtime, Tenant Context
- **8.14 — Conflictos de oferta** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.15 — SEND** — RAG, Runtime, Policies/Guardrails
- **8.16 — DELAY** — RAG, Runtime, Tenant Context
- **8.17 — SUPPRESS** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **8.18 — NO_SEND** — RAG, Runtime, Tenant Context, Policies/Guardrails
