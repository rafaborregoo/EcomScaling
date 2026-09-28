# Fase 18.2 — Flows

## Tipo de artefacto
`99-auditoria`

## Objetivo

Auditar flows implica revisar cobertura, arquitectura y comportamiento real: triggers, entry/exit/re-entry, eligibility, delays, branching, conflictos, presión, objetivos, conversiones, gaps del lifecycle y redundancias.

Debe distinguirse un flow existente de un flow realmente operativo y sano.

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
