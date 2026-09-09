-- AI-30: cerrar las ejecuciones que se quedaron en 'running' para siempre.
--
-- Diagnostico sobre produccion (2026-09-09): 18 de 175 filas de `agent_runs`
-- estaban en `status = 'running'`, la mas antigua desde el 2026-07-19. Nadie
-- las cierra: si el proceso de la API muere a mitad de turno -- despliegue,
-- OOM, reinicio del contenedor -- la fila se inserto al empezar y ya no hay
-- nadie vivo que la actualice.
--
-- El dano no es solo cosmetico. Una ejecucion eternamente "en curso" falsea
-- cualquier recuento de trabajo en vuelo, ensucia el panel y no se distingue de
-- un agente que de verdad esta corriendo ahora mismo.
--
-- Se marcan como `timeout`, no como `failed`: el estado existe desde
-- 20260909130000 y dice la verdad -- no sabemos que paso, sabemos que dejo de
-- responder. `latency_ms` se queda en NULL a proposito: no medimos su duracion,
-- y un numero inventado seria peor que la ausencia (misma regla que el resto de
-- AI-30: `null` es "no lo sabemos").
--
-- El umbral lo decide quien llama (`p_before`). El default operativo son 30
-- minutos, calculado en apps/api/src/ai-context-retention.ts: el turno mas
-- largo observado en produccion fue de 8,5 minutos y el techo teorico son 16
-- llamadas al modelo con timeout de 45 s cada una, asi que 30 minutos deja
-- margen de sobra para no matar a un agente que sigue trabajando.
--
-- Idempotente (ADR-0014 / CLAUDE.md): `drop` previo y `create or replace`.

drop function if exists private.reap_stalled_agent_runs(timestamptz, integer);

create or replace function private.reap_stalled_agent_runs(
  p_before timestamptz,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  reaped_count integer;
begin
  if p_before >= clock_timestamp() then
    raise exception 'reap_cutoff_must_be_in_the_past';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'reap_limit_out_of_range';
  end if;

  -- `for update skip locked`: si otra pasada del cron (o dos instancias de la
  -- API) coinciden, cada una se lleva un lote distinto en vez de bloquearse.
  with candidates as (
    select id
    from public.agent_runs
    where status = 'running'
      and started_at < p_before
    order by started_at asc
    limit p_limit
    for update skip locked
  )
  update public.agent_runs target
  set status = 'timeout',
      finished_at = now(),
      error_message = coalesce(
        target.error_message,
        'agent_run_stalled_no_terminal_status'
      )
  from candidates
  where target.id = candidates.id;
  get diagnostics reaped_count = row_count;

  return jsonb_build_object('stalled_agent_runs_reaped', reaped_count);
end;
$$;

revoke all on function private.reap_stalled_agent_runs(timestamptz, integer) from public;
grant execute on function private.reap_stalled_agent_runs(timestamptz, integer) to service_role;

comment on function private.reap_stalled_agent_runs(timestamptz, integer) is
  'Marca como timeout las ejecuciones de agente que llevan demasiado tiempo en running. Cubre el caso de que el proceso de la API muera a mitad de turno y deje la fila sin estado terminal.';

-- El predicado del reaper es (status, started_at). El indice parcial mantiene
-- la pasada barata aunque `agent_runs` crezca: solo indexa las filas en curso,
-- que son pocas por definicion.
create index if not exists agent_runs_running_started_idx
  on public.agent_runs (started_at)
  where status = 'running';
