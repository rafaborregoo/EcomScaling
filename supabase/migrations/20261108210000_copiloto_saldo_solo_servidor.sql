-- ---------------------------------------------------------------------------
-- El saldo del copiloto solo se calcula en el servidor
-- ---------------------------------------------------------------------------
--
-- `copilot_bank_organization` y `copilot_tokens_consumidos` son security
-- definer y estaban concedidas a `authenticated`. Con eso cualquier usuario con
-- sesion podia llamar por RPC a la segunda con el id de otra organizacion y
-- leer su consumo de tokens del mes, o a la primera con el id de otro usuario y
-- saber a que consultora pertenece. Las dos unicas llamadas
-- (apps/api/src/copilot-saldo.ts y el chat de ai-runtime.ts) usan la clave de
-- servicio, asi que basta con dejarlas solo para `service_role`.

revoke execute on function public.copilot_bank_organization(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.copilot_tokens_consumidos(uuid, timestamptz, timestamptz) from public, anon, authenticated;

grant execute on function public.copilot_bank_organization(uuid, uuid) to service_role;
grant execute on function public.copilot_tokens_consumidos(uuid, timestamptz, timestamptz) to service_role;
