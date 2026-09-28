# Fase 18.11 — Contact Pressure

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de presión analiza la experiencia total del contacto, no campañas y flows por separado.

Debe revisar frecuencia, caps, cooldowns, saturación, fatiga, conflictos, campaña vs flow, flow vs flow e intensidad promocional.

Debe detectar tanto sobrepresión como ausencia injustificada de contacto.

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
