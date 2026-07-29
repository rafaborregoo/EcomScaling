# INT-04 - Loom y Fathom

## Estado

- **Estado real:** `in_progress` (compuesto: Loom manual `done`, Fathom automatizado `planned`)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** INT-00, DB-08 (llamadas), AI-01 (analista de llamadas)
- **Bloqueador (solo para Fathom):** **Q-011 resuelta 2026-07-29** (Rafa decidio API key interna, ver mas
  abajo), pero construir/validar el modulo real sigue bloqueado -- falta una API key de una cuenta de
  prueba de Fathom que Rafa tiene que proporcionar (ADR-0006 exige validar contra cuenta real antes de
  cerrar un modulo, no se puede construir a ciegas sin poder probarlo).
- **Evidencia:** `apps/api/src/calls.ts` (enlace manual + transcripcion versionada),
  `apps/api/src/ai-runtime.ts:860` (`runCallAnalyst`, agente `a01_analista_llamadas`).

## Loom - fase 1 (real, no aspiracional)

No hay conexion OAuth con cuentas Loom ni ningun cliente HTTP de Loom en el codigo — la "integracion" es
manual por diseño, no una limitacion pendiente de arreglar:

- El consultor pega manualmente una URL (`calls.ts`, `parseRecordingUrl`, valida dominio permitido).
- `recording_provider` se guarda como `loom` (campo libre entre `loom | fathom | meet | zoom | other`, no
  hay validacion de que la URL realmente sea de ese dominio mas alla del parseo).
- La transcripcion se pega manualmente y se versiona en `call_transcripts` (`source: manual`, con
  `is_current` para saber cual es la version vigente).
- Desde ahi, `runCallAnalyst` ejecuta A01 sobre la transcripcion actual y genera un borrador con acciones
  propuestas, que requiere aprobacion humana antes de materializar tareas (`calls.ts:457`).

**Este flujo ya esta completo y en uso — no depende de ninguna API externa de Loom.**

## Fathom - fase 2 (no implementada)

No existe endpoint de webhook, ni OAuth, ni cliente HTTP de Fathom en `apps/api/src`
(`grep -rl fathom apps/api/src` solo devuelve `calls.ts`, donde `fathom` es un valor de enum de
`recording_provider`/`source`, no una integracion funcional).

Decisiones a tomar antes de programar:

- **Modo de auth**: **decidido 2026-07-29 (Q-011, Rafa) -- API key interna**, mas simple para el piloto con
  pocos clientes (una sola cuenta controlada). Revisar si se pasa a OAuth cuando se ofrezca conexion
  multi-cliente (Fathom recomienda OAuth para apps publicas multi-usuario, pero no es el caso hoy).
- **Multitenancy del webhook**: la organizacion debe resolverse desde la `integration_connection` que
  registro el webhook (el secreto identifica la conexion), nunca deduciendola del correo del invitado a la
  reunion — evita que una reunion se materialice en la organizacion equivocada.
- **Verificacion de firma**: HMAC SHA-256 sobre el cuerpo sin parsear, con comparacion en tiempo constante
  y tolerancia de timestamp (Fathom recomienda ~5 minutos) para evitar replay.
- **Deduplicacion**: por `external_meeting_id`/`recording_id`/`webhook_id` de Fathom; considerar un
  fingerprint secundario (`recorded_by` + `scheduled_start_time` + `meeting_url`) para casos borde.
- **Particularidad de la API**: segun la documentacion de Fathom, resumen y transcripcion completos no
  siempre estan disponibles via `list meetings` para apps OAuth — pueden requerir el endpoint de
  recordings. Verificar esto antes de disenar el cliente, no asumir un unico endpoint.

## Pendiente antes de avanzar Fathom

1. ~~Decidir modo de auth (API key vs OAuth)~~ — **resuelto 2026-07-29 (Q-011): API key interna.**
2. Conseguir una API key de una cuenta de prueba real de Fathom (Rafa) — bloquea todo lo demas: sin ella no
   se puede construir ni validar el modulo (ADR-0006, punto 8).
3. Diseñar el flujo webhook -> verificar firma -> deduplicar -> resolver organizacion por conexion ->
   guardar `call_transcripts` con `source: fathom` -> ejecutar A01 -> aprobacion humana (mismo punto de
   entrada que ya usa Loom manual, para no duplicar el pipeline de A01).
4. Definir pruebas: webhook valido, firma incorrecta, timestamp expirado, webhook duplicado, reunion sin
   transcripcion, retry que no duplica tareas.

## Criterios de cierre

- Nada se publica al cliente sin aprobacion humana (cumplido para Loom manual; debe seguir cumplido para
  Fathom).
- Reintentos de webhook de Fathom no duplican resumenes ni tareas (pendiente, no implementado todavia).
