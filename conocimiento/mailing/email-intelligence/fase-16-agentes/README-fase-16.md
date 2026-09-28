# Fase 16 — Agentes especializados

## Estado
`COMPLETA`

## Arquitectura aplicada

- `02-contratos-IA`: definición de responsabilidades, contexto, herramientas, outputs y límites de cada agente.

## Decisión arquitectónica

Esta fase no duplica el runtime de Fase 15 ni los motores de Fase 13. Tampoco define todavía niveles de autonomía: eso pertenece a Fase 17.

Cada agente especifica:

```text
QUÉ SABE
QUÉ CONTEXTO RECIBE
QUÉ HERRAMIENTAS PUEDE USAR
QUÉ CONTRATO DEVUELVE
QUÉ NO PUEDE DECIDIR
```

## Cobertura

- **16.1 — Strategy Copilot**
- **16.2 — Campaign Planner**
- **16.3 — Flow Architect**
- **16.4 — Email Copywriter**
- **16.5 — Creative Director**
- **16.6 — Merchandising Agent**
- **16.7 — Lifecycle Analyst**
- **16.8 — Experimentation Analyst**
- **16.9 — Deliverability Agent**
- **16.10 — Audit Agent**
- **16.11 — Orquestación entre agentes** — handoffs, conflictos y ownership
