# ADR-0016: Retención y redacción de transcripciones de llamadas

- **Fecha:** 2026-07-27
- **Estado:** Aprobada, para el estado actual del proyecto (pre-piloto, sin clientes reales todavía).
  Reevaluar cuando exista un piloto real con datos de clientes o un requisito legal/contractual explícito
  de un cliente.
- **Relacionada:** [`DB-08-llamadas-runtime-agentes.md`](../../roadmap/roadmaps/01-base-de-datos/fases/DB-08-llamadas-runtime-agentes.md)
  (gap que motiva esta decisión), [`SQO-03-privacidad-auditoria.md`](../../roadmap/roadmaps/06-seguridad-qa-observabilidad/fases/SQO-03-privacidad-auditoria.md)
  (política de retención de `audit_logs`, decisión separada — no cubierta por esta ADR).

## Contexto

`call_transcripts` (migración `20260719100000_db_08d_llamadas_consultoria.sql`) guarda el texto completo de
la transcripción de cada llamada de consultoría sin límite de tiempo ni mecanismo de purga, y sin ningún
paso de redacción de datos personales (emails, teléfonos, nombres de terceros) antes de insertarla. DB-08
señalaba esto como gap desde 2026-07-20 sin que hubiera una decisión explícita — documentar el estado
actual sin decisión no es lo mismo que decidir no actuar, y esta ADR cierra esa ambigüedad.

## Decisión

1. **Sin retención por tiempo ni purga automática.** Las transcripciones se conservan indefinidamente salvo
   borrado manual explícito (p. ej. al purgar una organización completa vía `purgeExpiredDeletions`, que ya
   elimina en cascada). Motivo: el valor de las transcripciones como fuente para la memoria acumulativa
   (AI-07) y para el propio consultor supera hoy el riesgo de exposición — no hay todavía clientes reales ni
   requisito contractual o legal que obligue a limitar la ventana.
2. **Sin redacción de PII antes de guardar.** El texto se almacena tal cual lo pega el consultor. El control
   de acceso existente (RLS: `call_transcripts_select_authorized`, visible solo a consultor asignado/
   `platform_admin`, y al cliente solo si `consulting_calls.is_visible_to_client`) es la única barrera de
   privacidad hoy — no hay enmascarado de contenido.
3. **Ambos puntos se reevalúan, no son permanentes**, en cuanto ocurra cualquiera de: (a) entrada de un
   cliente real en el Piloto 1 (OPS-01), (b) un cliente pide explícitamente una política de retención o
   redacción como condición contractual, o (c) una jurisdicción aplicable lo exige. Ninguno de los tres ha
   ocurrido todavía.

## Consecuencias

- DB-08 puede cerrar el gap de "sin política de retención/redacción documentada" citando esta ADR — la
  ausencia de mecanismo ahora es una decisión explícita, no un olvido.
- Si en el futuro se decide redactar PII, es trabajo de código real (detección/enmascarado antes del
  insert), no solo un cambio de este documento — ver Siguiente acción en DB-08 si se reabre.
- No afecta la política de retención de `audit_logs` (SQO-03), que sigue pendiente y es una decisión
  independiente (datos de auditoría vs. contenido de llamada).

## Historial relacionado

Gap original señalado en DB-08 desde 2026-07-20; decisión tomada 2026-07-27 a petición de Rafa.
