# Estados y evidencia — patron obligatorio para toda fase

> Referencia unica. Cualquier documento de fase (`DB-XX`, `BE-XX`, `FE-XX`, `AI-XX`, `INT-XX`, `SQO-XX`, `OPS-XX`)
> declara su estado usando esta taxonomia y este formato de evidencia. No se aceptan estados libres
> tipo "Completado" o "Aplicada" sin la evidencia correspondiente.

## Taxonomia de estados

| Estado                 | Significado                                                                                                                                                                          | Requisito para entrar en este estado                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `planned`              | Definido en el roadmap, sin trabajo iniciado.                                                                                                                                        | Alcance y dependencias documentados.                          |
| `in_progress`          | Trabajo activo, sin cerrar.                                                                                                                                                          | Al menos un commit o migracion asociada.                      |
| `blocked`              | No puede avanzar por una dependencia externa (credenciales, aprobacion de terceros, otra fase).                                                                                      | Bloqueador nombrado explicitamente con quien/que lo resuelve. |
| `verification_pending` | El trabajo existe (migracion aplicada / codigo desplegado) pero falta la prueba que demuestra que cumple el criterio de cierre (tests, evidencia real, validacion con datos reales). | Lista explicita de que evidencia falta.                       |
| `done`                 | Criterios de cierre cumplidos con evidencia verificable.                                                                                                                             | Seccion de evidencia completa (ver formato abajo).            |
| `deprecated`           | Sustituido, fusionado en otra fase o descartado.                                                                                                                                     | Referencia al documento que lo reemplaza.                     |

Regla dura: **una fase no pasa a `done` solo porque el codigo o la migracion existen.** Si falta la prueba,
el estado correcto es `verification_pending`, nunca `done`.

## Incumplimiento conocido de esta regla (2026-07-20) y como se corrige

`ESTADO_GLOBAL.md` y varios documentos de fase (BE-04..07, FE-00..08, AI-00..07, SQO-00..03) usan hoy
estados compuestos que no estan en la tabla de arriba: `blocked_external_validation`,
`functionally_complete_verification_pending`, `superseded_by_FE-08`, `shadow_pilot`, `pilot_ready`,
`security_verification_pending`, `foundational_work_in_progress`,
`planned_architecture_revision_required`, `planned_critical`, entre otros. Eso viola directamente la regla
de "no estados libres" de este mismo documento — se señalo en una auditoria externa y es correcto.

**Causa**: el estado canonico de 6 valores es demasiado grueso para comunicar en una sola palabra la
diferencia real entre, por ejemplo, "bloqueado porque el codigo esta mal" y "bloqueado porque Meta no ha
aprobado la app" — esa diferencia importa para decidir la siguiente accion, y los autores de cada fase
fueron inventando calificadores ad-hoc para no perderla.

**Correccion formal, sin reescribir 30 documentos de golpe**: el estado canonico sigue siendo unicamente
uno de los 6 valores de la tabla. La matizacion va en campos separados, no en el nombre del estado:

```md
- **Estado real:** verification_pending
- **Matiz:** <opcional, texto corto, ej. "listo para piloto", "guarda de calidad completada, dataset pendiente">
- **Tipo de bloqueador (solo si Estado real = blocked):** external_approval | credentials | internal_decision | dependency
```

Ejemplo de conversion: `blocked_external_validation` (BE-04) pasa a ser `Estado real: blocked` con
`Tipo de bloqueador: external_approval`. `shadow_pilot` (AI-02) pasa a ser `Estado real: verification_pending`
con `Matiz: shadow pilot, sin friccion para ver, aprobacion solo para escribir`.

**Estado de la migracion**: este documento ya usa el formato correcto desde 2026-07-20. Los documentos de
fase que usan el formato viejo (estado compuesto en una sola palabra) **no se han reescrito todavia** —
migrarlos es trabajo mecanico de prioridad P1, no P0, y se hace la proxima vez que se toque cada archivo,
no de golpe. No tratar los estados compuestos existentes como si fueran parte de la taxonomia valida: son
deuda documental reconocida, con ruta de correccion definida arriba.

## Formato de evidencia (obligatorio en todo estado `done` o `verification_pending`)

```md
## Estado

- **Estado real:** verification_pending
- **Responsable:** <nombre o "sin asignar">
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-01, DB-02
- **Bloqueador:** ninguno | <descripcion concreta>
- **Evidencia:**
  - Migracion: `supabase/migrations/2026....sql` (aplicada en remoto el 2026-07-20)
  - Tests remotos: `test:remote` con proyecto aislado — 11/11 pass (2026-07-20; evidencia histórica).
  - PR/commit: <hash o "sin commitear, en working tree">
- **Gaps identificados:** <lista concreta de lo que falta para `done`>
- **Siguiente accion:** <accion concreta, no generica>
```

Nunca se acepta como evidencia de seguridad/aislamiento un resumen sin comando ni resultado
(p. ej. "Supabase Advisor sin warnings" no es evidencia de aislamiento funcional, solo de ausencia
de ciertos patrones detectables estaticamente).

## Regla de resolucion de contradicciones

Cuando dos fuentes no coinciden sobre el estado real de algo, se resuelve en este orden
(la de arriba gana):

1. **Migraciones aplicadas** (`supabase/migrations/*.sql`, confirmadas con `supabase migration list` o
   `db push --dry-run` sin pendientes) — es la unica fuente ejecutable de verdad para el esquema.
2. **Codigo y tests** (`apps/*/src`, resultado real de `npm run test`/`npm run typecheck`).
3. **Documentacion operativa** (los documentos de fase en `roadmap/roadmaps/*/fases/`).
4. **Roadmap tecnico maestro** (`EcomScaling_IA_Roadmap_Tecnico_Implementacion_v0_1.md`).
5. **Modelo conceptual** (`Base de Datos/BDD EcomScaling.png`, `schema_conceptual_snapshot.sql`) — es
   una referencia de diseño, nunca una fuente ejecutable ni de estado.

Si la documentacion operativa dice "completado" pero las migraciones o los tests dicen otra cosa,
la documentacion esta mal y se corrige — nunca al reves.

## Release activo

Ver [`ESTADO_GLOBAL.md`](ESTADO_GLOBAL.md) para el release/fase activa por dominio,
[`RIESGOS.md`](RIESGOS.md) para riesgos abiertos y [`PREGUNTAS_ABIERTAS.md`](PREGUNTAS_ABIERTAS.md) /
[`ADR_LOG.md`](ADR_LOG.md) para decisiones pendientes y tomadas (ADRs tambien en `docs/decisions/`).
