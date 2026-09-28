# Fase 18.14 — Gaps

## Tipo de artefacto
`99-auditoria`

## Objetivo

Un gap es una capacidad, dato, cobertura o control necesario que no existe o no es suficiente.

Tipos útiles: knowledge, data, lifecycle, flow, measurement, policy, tooling y execution gap.

La auditoría debe separar “no existe” de “existe pero no funciona” y enlazar cada gap con evidencia e impacto.

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
