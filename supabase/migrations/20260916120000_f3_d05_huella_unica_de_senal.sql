-- FASE 3 / D05 — Huella unica de una senal.
--
-- El motor se reejecuta: si corre dos veces el mismo dia sobre la misma tienda,
-- vuelve a detectar la misma desviacion. Sin una huella unica eso serian dos
-- filas identicas y, aguas abajo, dos avisos del mismo fenomeno -- que es
-- exactamente lo que el guardrail 29 prohibe, solo que por un motivo tonto.
--
-- La huella es (organizacion, metrica, scope, fin de ventana, tipo). Dos
-- senales distintas sobre la misma metrica el mismo dia existen de verdad --
-- un cambio de nivel y una tendencia son cosas distintas -- y por eso el tipo
-- entra en la clave.
--
-- Va en migracion aparte y no editando `20260916090000` porque aquella ya esta
-- aplicada en test: cambiarla dejaria test y produccion con esquemas distintos
-- sin que nadie se enterara.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

create unique index if not exists signals_huella_idx
  on public.signals (organization_id, metric, scope, window_end, signal_type);

comment on index public.signals_huella_idx is
  'F3/D05. Reejecutar el motor el mismo dia actualiza la senal en vez de duplicarla.';
