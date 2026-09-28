# Fase 10 — Deliverability y Compliance

## Estado
`COMPLETA`

## Arquitectura aplicada

- `01-rag-produccion`: conocimiento experto de deliverability, consentimiento y autenticación.
- `03-runtime`: estados técnicos, reputación, autenticación y procesamiento determinista.
- `04-policies-guardrails`: obligaciones y límites que no puede sobreescribir el modelo.
- `06-tenant-context`: dominios, proveedores, mercados, políticas y configuración propia.

## Regla arquitectónica crítica

Los requisitos de Gmail, Yahoo, estándares técnicos y normativa no se tratan como conocimiento eterno. Deben almacenarse/versionarse con fuente, vigencia y última comprobación.

## Fuentes oficiales verificadas para esta versión

- Gmail Sender Guidelines — support.google.com/mail/answer/81126
- Gmail Sender Guidelines FAQ — support.google.com/mail/answer/14229414
- Yahoo Sender Best Practices — senders.yahooinc.com/best-practices/
- IETF RFC 8058 — datatracker.ietf.org/doc/rfc8058/
- EDPB — bases jurídicas y consentimiento
- Directiva 2002/58/CE — art. 13

## Cobertura

- **10.1 — Consentimiento** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.2 — Opt-in** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.3 — Double Opt-in** — RAG, Runtime, Tenant Context
- **10.4 — Unsubscribe** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.5 — Suppression** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.6 — Bounces** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.7 — Complaints** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.8 — List Hygiene** — RAG, Runtime, Tenant Context
- **10.9 — Engagement y deliverability** — RAG, Runtime, Tenant Context
- **10.10 — Domain Reputation** — RAG, Runtime, Tenant Context
- **10.11 — IP Reputation** — RAG, Runtime, Tenant Context
- **10.12 — SPF** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.13 — DKIM** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.14 — DMARC** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.15 — One-click Unsubscribe** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.16 — Warming** — RAG, Runtime, Tenant Context
- **10.17 — Volumen** — RAG, Runtime, Tenant Context
- **10.18 — Privacidad** — RAG, Tenant Context, Policies/Guardrails
- **10.19 — Reglas Gmail / Yahoo / Proveedores** — RAG, Runtime, Tenant Context, Policies/Guardrails
- **10.20 — Versionado de políticas** — RAG, Runtime, Tenant Context, Policies/Guardrails
