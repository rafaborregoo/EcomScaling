# Fase 18.15 — Riesgos

## Tipo de artefacto
`99-auditoria`

## Objetivo

Los riesgos describen posibles consecuencias negativas si el estado actual continúa o si se ejecuta un cambio.

Dimensiones: compliance, deliverability, revenue, margin, customer experience, operational, data quality y brand.

Cada riesgo debe incluir evidencia, trigger y mitigación.

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
