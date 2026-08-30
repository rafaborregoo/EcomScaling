-- Expone tasks.categories (text[], 1+ de shopify/meta/klaviyo/general) a la
-- vista de solo lectura ai.tasks que usa el SQL Gateway de los agentes IA
-- (sql-gateway.ts). Antes la vista no exponia la categoria en absoluto, asi que
-- a04/a08 no podian filtrar tareas por modulo via sql_select.
--
-- `create or replace view` solo permite AÑADIR columnas al final del select:
-- `categories` se agrega detras de `created_at`, el resto identico a la
-- migracion db_08b. Los grants existentes sobre ai.tasks se conservan.

create or replace view ai.tasks as
select id, alert_id, source, status, priority, title, description, due_at,
  completed_at, created_at, categories
from public.tasks
where organization_id = private.gateway_org_id();
