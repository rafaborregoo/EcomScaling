-- meta_pixel_health y meta_learning_phase_status son funciones `stable` y `security invoker`
-- (ADR-0006): leen con los permisos y la RLS de quien llama, así que ejecutarlas como el
-- usuario es seguro y es como las lee el resto de métricas de Meta. A24 les quitó el EXECUTE a
-- `authenticated` y la pantalla de Meta dejó de poder leer el píxel y el aprendizaje
-- ("permission denied"). Se devuelve; `anon` y `public` siguen sin acceso.
do $$
begin
  if to_regprocedure('public.meta_pixel_health(uuid,date,date,uuid)') is not null then
    grant execute on function public.meta_pixel_health(uuid,date,date,uuid) to authenticated;
  end if;
  if to_regprocedure('public.meta_learning_phase_status(uuid,date,date,uuid,uuid)') is not null then
    grant execute on function public.meta_learning_phase_status(uuid,date,date,uuid,uuid) to authenticated;
  end if;
  if to_regprocedure('public.meta_learning_phase_status(uuid,date,date,uuid)') is not null then
    grant execute on function public.meta_learning_phase_status(uuid,date,date,uuid) to authenticated;
  end if;
end $$;
