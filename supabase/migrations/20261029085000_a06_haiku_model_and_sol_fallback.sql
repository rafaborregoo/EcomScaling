-- A06 usa Haiku 5.5 por defecto y Sol como respaldo de mayor capacidad
-- cuando Anthropic no puede completar la llamada.
alter table public.platform_ai_agent_settings
  drop constraint if exists platform_ai_agent_settings_model_known;

alter table public.platform_ai_agent_settings
  add constraint platform_ai_agent_settings_model_known check (
    model is null or model in (
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-haiku-5-5',
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-6.1-sol',
      'gpt-6.1-terra'
    )
  );

insert into public.platform_ai_agent_settings (agent_code, model)
values ('a06_planificador_stock', 'claude-haiku-5-5')
on conflict (agent_code) do update
set model = excluded.model,
    updated_at = now();
