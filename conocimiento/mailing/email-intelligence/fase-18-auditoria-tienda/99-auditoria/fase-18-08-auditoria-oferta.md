# Fase 18.8 — Oferta

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de oferta evalúa si los incentivos aportan valor sin destruir margen ni entrenar dependencia promocional.

Debe revisar tipo de oferta, descuento efectivo, stacking, thresholds, shipping, gifts, bundles, elegibilidad, vigencia, consistencia, historial promocional y margin protection.

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
