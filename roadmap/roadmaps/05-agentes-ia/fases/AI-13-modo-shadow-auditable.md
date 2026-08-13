# AI-13 - Modo shadow auditable

## Objetivo

El piloto debe operar en `shadow` de forma explícita y verificable. Una etiqueta
de la UI no basta: cada ejecución se persiste con `agent_runs.execution_mode`.

## Contrato vigente

- `shadow` es el valor por defecto y el único modo que escribe el runtime actual.
- Una salida puede contener evidencia, fuentes, citas y propuestas.
- Las propuestas de escritura siguen requiriendo decisión humana mediante
  `decideAgentOutput`; aprobarlas es la única vía de materialización.
- `live` queda reservado para una activación futura explícita, con guardas y
  revisión independiente. No se activa por una instrucción del modelo.

## Evidencia

- Migración: `supabase/migrations/20260802110000_ai_13_shadow_execution_mode.sql`.
- Runtime: `apps/api/src/ai-runtime.ts` persiste `execution_mode: "shadow"` en
  los flujos de diagnóstico, A01 y A09.
- API de trazas/listado: devuelve el modo persistido.
- UI: `/agentes` muestra el modo junto al estado de cada ejecución.

## Verificación

La migración es aditiva y conserva ejecuciones históricas con el valor por
defecto. El cierre requiere typecheck API/web, build web y `db lint` tras
aplicar la migración enlazada.
