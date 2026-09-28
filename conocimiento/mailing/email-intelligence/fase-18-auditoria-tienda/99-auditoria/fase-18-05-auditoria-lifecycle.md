# Fase 18.5 — Lifecycle

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de lifecycle comprueba si la tienda reconoce estados reales del cliente y adapta comunicación a ellos.

Debe cubrir subscriber/prospect, browser/product viewer, cart/checkout, first-time buyer, repeat buyer, high-value/VIP, at-risk, lapsed y reactivated, además de transiciones, cobertura y estados UNKNOWN.

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
