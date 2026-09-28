# Fase 18.13 — Experimentación

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de experimentación determina si la organización aprende de forma sistemática.

Debe revisar observaciones, hipótesis, A/B, control, holdout, sample size, duración, primary metric, guardrails, resultados, evidence, learning, versionado y deprecación.

Debe distinguir cultura de testing de simple rotación de creatividades.

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
