-- Tareas con 1 o varias categorias de modulo (a peticion de Rafa): una tarea
-- puede cruzar integraciones -- p. ej. "alinear el calendario de campanas de
-- email con las entradas de stock" toca Klaviyo y Shopify a la vez. Hasta ahora
-- `tasks.category` era un unico varchar. Pasa a `categories text[]`.
--
-- La categoria sigue siendo determinista: la fija el modulo que crea la tarea
-- (agente IA via AGENT_TASK_CATEGORY, motor de reglas via la plantilla, o el
-- consultor a mano). El LLM solo puede AÑADIR una categoria extra a su
-- propuesta, y decideAgentOutput la valida contra el conjunto permitido antes
-- de escribirla -- nunca es texto libre que el modelo "adivina".
--
-- alert_rule_templates.category se queda como varchar unico: una regla de
-- alerta pertenece a un solo modulo; al materializar la tarea se envuelve en
-- array[template.category].

-- Reescrita idempotente (2026-09-08). La version original hacia
-- `drop constraint tasks_category`, `rename column` y `create index` a pelo, asi
-- que solo se podia aplicar una vez: al replicar el historial sobre un proyecto
-- limpio moria con `constraint "tasks_category" of relation "tasks" does not
-- exist`. Eso bloqueaba el proyecto de pruebas y, con el, la suite que
-- comprueba el aislamiento entre inquilinos.
--
-- El estado final es EXACTAMENTE el mismo, asi que en produccion (donde ya
-- consta aplicada) esto no cambia nada. CLAUDE.md: toda migracion se escribe
-- idempotente, precisamente para poder recuperarse de una deriva.

create extension if not exists btree_gin with schema extensions;

alter table public.tasks drop constraint if exists tasks_category;
drop index if exists tasks_organization_category_idx;

-- La conversion y el renombrado solo tienen sentido mientras exista la columna
-- vieja. Si ya se hizo, este bloque no hace nada.
do $tasks_categories$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'category'
  ) then
    alter table public.tasks
      alter column category drop default,
      alter column category type text[] using array[category]::text[],
      alter column category set default array['general']::text[];

    alter table public.tasks rename column category to categories;
  end if;
end
$tasks_categories$;

alter table public.tasks drop constraint if exists tasks_categories_valid;
alter table public.tasks
  add constraint tasks_categories_valid check (
    categories <@ array['shopify', 'meta', 'klaviyo', 'general']::text[]
    and cardinality(categories) >= 1
  );

-- Predicado real de la lista de tareas: organizacion + (opcional) filtro por
-- categoria. btree_gin permite el indice compuesto que calza con ambos.
create index if not exists tasks_organization_categories_idx
  on public.tasks using gin (organization_id, categories);

comment on column public.tasks.categories is 'Modulos que toca la tarea (1 o varias): shopify, meta, klaviyo, general. Determinista: la fija el modulo creador; el LLM solo puede añadir una categoria validada.';
