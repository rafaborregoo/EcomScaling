# Fase 18.12 — Métricas

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de métricas verifica que la tienda mide lo necesario para decidir.

Debe revisar definiciones, denominadores, conversion, revenue, RPR, AOV, margin, profit, guardrails, attribution, cohorts e incrementality.

Debe detectar vanity metrics y discrepancias de definición entre herramientas.

---

## Estructura de hallazgo

```text
finding_id
domain
observation
evidence
current_state
expected_or_required_state
gap
risk
confidence
dependencies
recommended_action
validation_method
```

## Estados recomendados

```text
OK
PARTIAL
GAP
RISK
BLOCKED
UNKNOWN
NOT_APPLICABLE
```

`UNKNOWN` no debe convertirse en `OK`.

## Evidencia

Distinguir siempre:
- dato observado;
- output de runtime;
- configuración del tenant;
- policy vigente;
- evidencia experimental;
- interpretación de IA.

## Principio maestro

Una auditoría útil construye una cadena trazable de evidencia → gap/riesgo → acción → validación.
