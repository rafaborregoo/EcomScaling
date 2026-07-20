# AI-01 - A01 Analista de llamadas

## Estado

- **Estado real:** `pilot_ready` (no `done`)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-00
- **Bloqueador:** ninguno
- **Evidencia:** migracion `20260720120000_ai_01_analista_llamadas`, contrato
  `callSummaryOutputSchema`/`callSummaryJsonSchema` en `packages/ai`, `runCallAnalyst`/`decideSummary` en
  `apps/api/src/calls.ts`, endpoint `POST /calls/:callId/analyze`.
- **Que funciona y es el agente mejor delimitado del proyecto**: fuente unica (transcripcion, sin tools,
  para no inventar), contrato que separa hechos/decisiones/recomendaciones, citas textuales, riesgos,
  tareas propuestas con owner, aprobacion humana obligatoria antes de materializar tareas
  (`required_before_publish`), trazabilidad via `run_id`. Validado en vivo con una transcripcion sintetica
  sobre la tienda real: 4 tareas accionables no duplicadas, ~26s, ~0,05 USD.
- **Gaps reales verificados en codigo (no solo teoricos):**
  - **Dedup de tareas por titulo exacto normalizado** (`calls.ts:474-516`: `trim().toLowerCase()` contra
    los titulos ya enlazados) — dos tareas semanticamente iguales con redaccion distinta ("Revisar costes
    de envio" vs "Validar los costes logisticos") no se detectan como duplicadas.
  - **La reaprobacion devuelve 404** (`calls.ts:454`, `pending_summary_not_found`) en vez de un 200/409 que
    distinga "ya estaba aprobada" de "recurso inexistente" — funciona para no duplicar, pero el codigo de
    estado es enganoso.
  - Las citas (`key_quotes`) guardan texto citado, no una referencia estructurada a segmento/timestamp de
    la transcripcion.
  - Sin dataset de evaluacion mas alla de la transcripcion sintetica de la validacion inicial (llamada sin
    tareas, audio deficiente, varios interlocutores, tareas sin responsable, etc. — ver AI-06).
  - Sin feedback estructurado post-aprobacion (aprobado sin cambios / con cambios / rechazado) que permita
    medir si A01 realmente ahorra tiempo.
- **Siguiente accion:** definir el fingerprint de dedup (`organization_id + call_id + normalized_title +
  action_type + owner_id + due_date`) y anadir feedback estructurado antes de declarar `done`.

## Objetivo

Resumir llamadas y proponer tareas con revision del consultor.

## Entregables

- Prompt versionado.
- Parser de transcripcion.
- Salida: resumen, decisiones, tareas, riesgos y fuentes.
- Approval flow consultor.
- Tests con transcripciones sinteticas.

## Criterios de cierre

- No publica nada sin aprobacion.
- Tareas son accionables y deduplicables.
- El resumen separa hechos, decisiones y recomendaciones.
