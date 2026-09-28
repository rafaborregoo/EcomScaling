# Fase 18.4 — Segmentación

## Tipo de artefacto
`99-auditoria`

## Objetivo

La segmentación debe ser accionable, reproducible y conectada con decisiones reales.

Debe revisar lifecycle, engagement, intent, RFM, affinity, value, promotion sensitivity, geography, suppressions y exclusiones.

Un antipatrón central es acumular segmentos descriptivos que nunca cambian una decisión.

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
