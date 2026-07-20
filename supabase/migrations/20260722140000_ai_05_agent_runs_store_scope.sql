-- Fix: los diagnosticos automaticos (A02/A04/A06) siempre pasaban
-- target_store_id = null a las funciones SQL, es decir, mezclaban todas las
-- tiendas de la organizacion aunque el consultor tuviera una tienda concreta
-- seleccionada en el header. Para que la cache de 24h (getCachedDiagnostic)
-- pueda distinguir "diagnostico de la tienda X" de "diagnostico de toda la
-- organizacion" sin reventar el ahorro de coste en el caso comun (1 tienda),
-- agent_runs necesita saber con que tienda se genero cada run.

alter table public.agent_runs
  add column store_id uuid references public.shopify_stores (id) on delete set null;

comment on column public.agent_runs.store_id is 'Tienda Shopify activa cuando se genero el run (null = todas las tiendas de la organizacion).';
