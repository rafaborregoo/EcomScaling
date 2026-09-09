-- AI-30: retencion de los eventos de seguridad de IA.
--
-- `private.purge_expired_ai_context` (20260826173000) redacta el contexto de IA
-- a los 180 dias. Los eventos de seguridad NO pueden colgar de esa politica por
-- dos motivos:
--
--   1. Deben vivir MAS que el contexto, no menos. Un patron de ataque se ve
--      comparando meses; borrarlos a la vez que la evidencia operativa deja el
--      analisis ciego justo donde hace falta memoria larga.
--   2. No hay nada que redactar. La tabla es metadata-only por diseno (nunca el
--      texto que provoco el evento), asi que la operacion correcta al vencer el
--      plazo es borrar la fila, no vaciarle campos.
--
-- Funcion aparte y no un parametro mas en la existente: anadir un parametro con
-- `default` a una funcion ya desplegada crea una sobrecarga y deja la llamada
-- antigua ambigua (ver CLAUDE.md). Dos horizontes distintos justifican dos
-- funciones distintas.
--
-- Idempotente (ADR-0014 / CLAUDE.md): `create or replace` y `drop` previo.

drop function if exists private.purge_expired_ai_security_events(timestamptz, integer);

create or replace function private.purge_expired_ai_security_events(
  p_before timestamptz,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  deleted_count integer;
begin
  if p_before >= clock_timestamp() then
    raise exception 'purge_cutoff_must_be_in_the_past';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'purge_limit_out_of_range';
  end if;

  with candidates as (
    select id from public.ai_security_events
    where created_at < p_before
    order by created_at asc limit p_limit
  )
  delete from public.ai_security_events target
  using candidates
  where target.id = candidates.id;
  get diagnostics deleted_count = row_count;

  return jsonb_build_object('ai_security_events_deleted', deleted_count);
end;
$$;

revoke all on function private.purge_expired_ai_security_events(timestamptz, integer) from public;
grant execute on function private.purge_expired_ai_security_events(timestamptz, integer) to service_role;

comment on function private.purge_expired_ai_security_events(timestamptz, integer) is
  'Borra eventos de seguridad de IA vencidos. Horizonte mas largo que el del contexto (private.purge_expired_ai_context): la evidencia de seguridad necesita memoria larga para poder comparar meses.';
