# Fase 9 — Dropshipping

## Estado
`COMPLETA`

## Arquitectura aplicada

- `01-rag-produccion`: conocimiento experto específico de dropshipping.
- `03-runtime`: estados operativos de shipping, tracking, refunds y post-purchase cuando corresponde.
- `04-policies-guardrails`: límites duros sobre promesas, claims, devoluciones y comunicación operativa.
- `06-tenant-context`: realidad concreta de proveedores, fulfillment, shipping, soporte, catálogo y marca.

Los contratos de agentes siguen centralizados en Fase 14 y la autonomía global en Fase 17.

## Cobertura

- **9.1 — Particularidades del dropshipping** — RAG, Tenant Context
- **9.2 — Confianza** — RAG, Tenant Context
- **9.3 — Producto commodity** — RAG, Tenant Context
- **9.4 — Problem / Solution** — RAG
- **9.5 — Demonstration** — RAG, Tenant Context
- **9.6 — Social Proof** — RAG, Tenant Context
- **9.7 — UGC** — RAG, Tenant Context
- **9.8 — Impulse Buying** — RAG
- **9.9 — Shipping Expectations** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **9.10 — Tracking** — RAG, Runtime, Tenant Context
- **9.11 — Shipping Delays** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **9.12 — Split Shipments** — RAG, Runtime, Tenant Context
- **9.13 — Buyer Remorse** — RAG
- **9.14 — Refund Prevention** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **9.15 — Chargeback Prevention** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **9.16 — Order Reassurance** — RAG
- **9.17 — Product Education** — RAG, Tenant Context
- **9.18 — Claims** — RAG, Tenant Context, Policies/Guardrails
- **9.19 — Post-Purchase** — RAG, Runtime, Tenant Context
- **9.20 — Construcción de marca** — RAG, Tenant Context
