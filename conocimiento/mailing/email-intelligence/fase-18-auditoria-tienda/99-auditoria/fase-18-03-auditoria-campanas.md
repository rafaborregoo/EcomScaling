# Fase 18.3 — Campañas

## Tipo de artefacto
`99-auditoria`

## Objetivo

La auditoría de campañas debe comprobar si existe disciplina de planificación y no solo envíos aislados.

Debe revisar objetivo, audiencia, calendario, frecuencia, producto, oferta, creative, medición, presión, conflictos con flows y consistencia con aprendizaje histórico.

La calidad se evalúa respecto al objetivo de cada campaña, no mediante una métrica universal.

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
