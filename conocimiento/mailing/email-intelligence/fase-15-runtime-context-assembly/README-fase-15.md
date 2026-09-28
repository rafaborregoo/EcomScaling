# Fase 15 — Runtime y Context Assembly

## Estado
`COMPLETA`

## Arquitectura aplicada

- `03-runtime`: construcción, retrieval, routing, freshness, source-of-truth y validación.
- `04-policies-guardrails`: límites duros sobre privacidad, autoridad, vigencia y ejecución.
- `06-tenant-context`: fuentes, budgets, reglas y configuración específica de cada ecommerce.

## Flujo principal

```text
REQUEST
→ CUSTOMER CONTEXT
→ STORE CONTEXT
→ PRODUCT CONTEXT
→ COMMERCIAL CONTEXT
→ CAMPAIGN / FLOW CONTEXT
→ POLICY CONTEXT
→ EXPERIENCE CONTEXT
→ RAG RETRIEVAL
→ CONTEXT ASSEMBLY
→ TOOL ROUTING
→ OUTPUT VALIDATION
```

## Jerarquía de autoridad

```text
HARD POLICY
> AUTHORITATIVE RUNTIME DATA
> TENANT CONTEXT
> EXPERIENCE LEARNING
> RAG
> MODEL INFERENCE
```

## Cobertura

- **15.1 — Customer Context** — Runtime, Tenant Context, Policies/Guardrails
- **15.2 — Store Context** — Runtime, Tenant Context
- **15.3 — Product Context** — Runtime, Tenant Context, Policies/Guardrails
- **15.4 — Commercial Context** — Runtime, Tenant Context, Policies/Guardrails
- **15.5 — Campaign Context** — Runtime, Tenant Context
- **15.6 — Flow Context** — Runtime, Tenant Context
- **15.7 — Policy Context** — Runtime, Tenant Context, Policies/Guardrails
- **15.8 — Experience Context** — Runtime, Tenant Context, Policies/Guardrails
- **15.9 — RAG Retrieval** — Runtime, Tenant Context, Policies/Guardrails
- **15.10 — Context Assembly** — Runtime, Tenant Context, Policies/Guardrails
- **15.11 — Tool Routing** — Runtime, Tenant Context, Policies/Guardrails
- **15.12 — Data Freshness** — Runtime, Tenant Context, Policies/Guardrails
- **15.13 — Source of Truth** — Runtime, Tenant Context, Policies/Guardrails
- **15.14 — Output Validation** — Runtime, Tenant Context, Policies/Guardrails
