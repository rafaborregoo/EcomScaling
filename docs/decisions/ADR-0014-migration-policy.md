# ADR-0014: Política de migraciones

- **Fecha:** 2026-07-23
- **Estado:** Aprobada, para el estado actual del proyecto (Piloto 1, un solo entorno real, equipo de una
  persona). Reevaluar cuando exista staging o un segundo desarrollador; la ausencia de staging esta aceptada
  explicitamente por R-015 y no bloquea el piloto actual.
- **Relacionada:** [`RB-005-failed-migration.md`](../../roadmap/roadmaps/07-operacion-despliegue/runbooks/RB-005-failed-migration.md)
  (el hallazgo real de drift de version que motiva esta politica), OPS-00 (entorno/CI-CD, entregable
  "politica de migraciones" pendiente desde el origen del roadmap).

## Contexto

El proyecto no tiene staging separado de produccion (R-015, `RIESGOS.md`, cerrado explícitamente el
2026-07-22: Vercel preview + cron cubren la necesidad real hoy). Todas las migraciones de
`supabase/migrations/` se han aplicado hasta ahora directamente contra el único proyecto Supabase real
(`SaaS-EcomScaling`), a mano, durante el desarrollo — sin política escrita de quién puede aplicar, cómo, ni
qué hacer cuando algo sale mal. Esa falta de política ya produjo un incidente real y no solo teórico: 10 de
46 migraciones tienen hoy un timestamp de archivo local distinto a la versión que Supabase tiene registrada
como aplicada, por haberse renombrado localmente después de aplicar (ver RB-005 para el detalle completo y
la corrección).

## Decisión

Mientras el proyecto siga en esta fase (un entorno real, sin staging, equipo de una persona):

1. **Toda migración vive en `supabase/migrations/` antes de aplicarse.** Nunca se ejecuta SQL de esquema
   directamente contra el proyecto real sin que exista primero el archivo `.sql` correspondiente en el
   repositorio — el archivo es la fuente de verdad, no el estado de la base de datos.
2. **El timestamp del nombre de archivo es inmutable una vez aplicado.** Si hace falta reordenar migraciones
   del mismo día, se usa un timestamp nuevo (segundos/minutos siguientes), nunca se renombra retroactivamente
   un archivo ya aplicado — es la causa raíz exacta del drift real encontrado en RB-005.
3. **Aplicación**: via Supabase CLI (`supabase db push`) o el MCP de Supabase (`apply_migration`), ambos
   indistintamente válidos hoy porque no hay diferencia de entorno que proteger (no hay staging que saltarse
   por error). Cuando exista staging, la migración se aplica ahí primero, se verifica, y solo entonces se
   aplica a producción — no antes.
4. **Ninguna migración ya aplicada se edita.** Un problema encontrado después de aplicar se corrige con una
   migración nueva (forward-fix), nunca modificando el archivo original — mismo principio que RB-005 para
   una migración fallida.
5. **Verificación de drift antes de cualquier automatización de `supabase db push` en CI**: comparar
   `list_migrations` (remoto) contra `ls supabase/migrations/` por nombre+version antes de activar un paso
   de CI que aplique migraciones automáticamente. Sin esta comprobación, el primer `db push` automático
   fallaría con `already exists` sobre las migraciones con drift ya corregido manualmente (ver RB-005).
6. **Sin revisión formal por PR todavía** — equipo de una persona, no hay a quién pedir revisión. Cuando se
   incorpore un segundo desarrollador, una migración de esquema no se aplica a producción sin que otra
   persona la haya revisado primero (gap reconocido, no implementado hoy).

## Consecuencias

- El drift real de RB-005 no debería volver a producirse mientras se respete la regla 2.
- Sigue sin existir un gate automático que bloquee un `push` a `main` si añade una migración con un
  timestamp anterior a la última ya aplicada (fuera de alcance de esta ADR — requeriría CI, ver OPS-00).
- Esta política asume buena fe y disciplina manual, no hay enforcement técnico todavía — aceptable para el
  tamaño actual del equipo, no lo sería con más gente tocando el esquema.

## Historial relacionado

### Verificación 2026-08-02

Durante la aplicación de AI-14 se detectaron dos archivos con el timestamp `20260802130000`.
El timestamp ya aplicado correspondía a AI-11; AI-14 se renombró antes de desplegarse a
`20260802130100_ai_14_abstention_quality_tools.sql`, sin modificar ninguna migración aplicada.
`supabase migration list --linked` y un `db push --dry-run` posterior confirmaron que el historial
local y remoto están alineados y no quedan migraciones pendientes.

Hallazgo y corrección del drift real: `RB-005-failed-migration.md` (2026-07-23).
