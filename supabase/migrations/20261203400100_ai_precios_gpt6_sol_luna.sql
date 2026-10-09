-- Tarifa de gpt-6-sol y gpt-6-luna (OpenAI, lanzados el 22-sep-2026).
--
-- Sin precio, las ejecuciones de A19 (que usa gpt-6-sol) y del resto de agentes
-- (gpt-6-luna) salian con coste nulo y el limite de gasto por ejecucion no podia
-- actuar. USD por millon de tokens, hasta 272K de entrada por peticion (por
-- encima, entrada y cache x2 y salida x1,5). Fuente: tarifas publicadas del
-- lanzamiento; el job diario ai-pricing-sync las contrasta con LiteLLM cuando
-- las incluya. Idempotente.
insert into public.ai_model_prices
  (model, provider, input_per_mtok, output_per_mtok, cache_read_per_mtok, source, source_url, checked_at, updated_at)
values
  ('gpt-6-sol', 'openai', 2.000000, 10.000000, 0.200000, 'manual', 'https://llmgateway.io/changelog/gpt-6-sol-luna', now(), now()),
  ('gpt-6-luna', 'openai', 0.100000, 0.500000, 0.010000, 'manual', 'https://llmgateway.io/changelog/gpt-6-sol-luna', now(), now())
on conflict (model) do update
set provider = excluded.provider,
    input_per_mtok = excluded.input_per_mtok,
    output_per_mtok = excluded.output_per_mtok,
    cache_read_per_mtok = excluded.cache_read_per_mtok,
    source = excluded.source,
    source_url = excluded.source_url,
    checked_at = now(),
    updated_at = case
      when public.ai_model_prices.input_per_mtok is distinct from excluded.input_per_mtok
        or public.ai_model_prices.output_per_mtok is distinct from excluded.output_per_mtok
      then now() else public.ai_model_prices.updated_at end;

-- Pone coste a las ejecuciones que se quedaron sin el por modelo desconocido.
select public.reprice_unknown_agent_runs();
