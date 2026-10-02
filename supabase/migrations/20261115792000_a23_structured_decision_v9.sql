-- A23 output must expose an evidence-backed action record, not bury it in prose.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v9',
  p.content || E'\n\n16. CONTRATO DE DECISION ESTRUCTURADA\nIncluye siempre `creative_decisions` (hasta cinco elementos; puede ser una lista vacia si no hay una accion sustentada). Cada elemento debe rellenar `action` (`observe`, `test_variant`, `investigate_landing_offer` o `propose_pause`), `signal`, `window`, `spend_implicated` (numero observado o null si no consta), `spend_currency` (codigo ISO 4217 si consta junto al importe, en otro caso null), `uncertainty`, `hypothesis`, `success_criterion` y `measurement_verdict` (`usable_with_attribution_limits`, `restricted`, `not_assessable` o `unknown`). El campo `measurement_verdict` debe copiar exactamente el `status` del bloque determinista A24 del contexto; no lo recalcules ni lo eleves. Si falta ese bloque, usa `unknown`. No inventes importes, divisas, ventanas ni umbrales. Si el veredicto es `restricted`, `not_assessable` o `unknown`, no uses `propose_pause` ni fundamentes una accion en ventas/ROAS; limita la propuesta a observar, investigar o disenar un test que no presuponga atribucion. `propose_pause` solo es una propuesta para revision/aprobacion humana cuando la medicion es util con limites de atribucion; no ejecutes cambios, pausas ni escalados en Meta. La señal debe citar evidencia y ventana; el criterio de exito debe ser comprobable en una ventana comparable y respetar la limitacion de atribucion.',
  encode(sha256((p.content || E'\n\n16. CONTRATO DE DECISION ESTRUCTURADA\nIncluye siempre `creative_decisions` (hasta cinco elementos; puede ser una lista vacia si no hay una accion sustentada). Cada elemento debe rellenar `action` (`observe`, `test_variant`, `investigate_landing_offer` o `propose_pause`), `signal`, `window`, `spend_implicated` (numero observado o null si no consta), `spend_currency` (codigo ISO 4217 si consta junto al importe, en otro caso null), `uncertainty`, `hypothesis`, `success_criterion` y `measurement_verdict` (`usable_with_attribution_limits`, `restricted`, `not_assessable` o `unknown`). El campo `measurement_verdict` debe copiar exactamente el `status` del bloque determinista A24 del contexto; no lo recalcules ni lo eleves. Si falta ese bloque, usa `unknown`. No inventes importes, divisas, ventanas ni umbrales. Si el veredicto es `restricted`, `not_assessable` o `unknown`, no uses `propose_pause` ni fundamentes una accion en ventas/ROAS; limita la propuesta a observar, investigar o disenar un test que no presuponga atribucion. `propose_pause` solo es una propuesta para revision/aprobacion humana cuando la medicion es util con limites de atribucion; no ejecutes cambios, pausas ni escalados en Meta. La señal debe citar evidencia y ventana; el criterio de exito debe ser comprobable en una ventana comparable y respetar la limitacion de atribucion.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v8'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id
  and av.is_active
  and d.code = 'a23_creatividad_meta';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v9', source.model, 'a23_creatividad_meta_system', 'v9', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v8'
where d.code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

do $a23_v9_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a23_creatividad_meta_system' and version = 'v9'
      and position('creative_decisions' in content) > 0
      and position('measurement_verdict' in content) > 0
      and position('debe copiar exactamente' in lower(content)) > 0
      and position('propose_pause' in content) > 0
      and position('aprobacion humana' in lower(content)) > 0
      and position('no ejecutes cambios, pausas ni escalados en meta' in lower(content)) > 0
  ) or not exists (
    select 1 from public.agent_versions av
    join public.agent_definitions d on d.id = av.definition_id
    where d.code = 'a23_creatividad_meta' and av.version = 'v9'
      and av.prompt_version = 'v9' and av.is_active
  ) then
    raise exception 'A23_V9_STRUCTURED_DECISION_OR_ACTIVE_VERSION_MISSING';
  end if;
end
$a23_v9_guard$;
