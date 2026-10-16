-- A04 pasa a v13 (prompt v13: contexto de otros agentes + fechas comerciales
-- acotadas). Pedido explícito de Rafa el 2026-10-16, ya sin gate de release.
-- La v9 queda inactiva en la misma transacción (promote_agent_version).
-- Idempotente: si v13 ya está activa no hace nada.
select public.promote_agent_version(v.id)
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a04_generador_tareas' and v.version = 'v13' and v.is_active is not true;
