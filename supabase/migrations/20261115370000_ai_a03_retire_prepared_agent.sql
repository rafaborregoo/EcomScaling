-- A03 was only a prepared catalog/eval entry and never had a runtime. Keep its
-- historical definition/version rows for referential integrity and audit, but
-- make its inactive state explicit and idempotent.
update public.agent_definitions
set is_active = false
where code = 'a03_analista_adquisicion'
  and is_active is distinct from false;
