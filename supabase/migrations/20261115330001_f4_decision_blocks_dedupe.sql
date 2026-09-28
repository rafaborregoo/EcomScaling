-- F4/P07-P12: limpia las filas repetidas que dejo la huella con `as_of`.
--
-- Hasta el 2026-09-27 los contratos de risk, allocation, strategic-fit,
-- ranking, portfolio y decision-output calculaban `input_fingerprint` con la
-- fecha dentro, asi que la deduplicacion por (organization_id,
-- input_fingerprint) nunca encontraba la fila anterior y cada noche se
-- insertaba otra identica. El codigo ya excluye `as_of` del hash; esto borra
-- lo acumulado.
--
-- Criterio: dos filas son la misma evaluacion si son de la misma organizacion
-- y su `result` coincide quitando `as_of`, `evaluated_at` e
-- `input_fingerprint`. De cada grupo se conserva la mas reciente.
--
-- Idempotente: si ya no hay repetidas, no borra nada. Ninguna tabla tiene
-- claves ajenas que apunten a estas, y sus lectores (F5, F7, Copiloto) leen la
-- ultima fila por organizacion.

do $$
declare
  t text;
  deleted bigint;
begin
  foreach t in array array[
    'decision_risk_assessments',
    'decision_allocation_assessments',
    'decision_strategic_fit_assessments',
    'decision_rankings',
    'decision_portfolio_assessments',
    'decision_outputs'
  ] loop
    execute format($f$
      delete from public.%1$I d
      using (
        select id,
               row_number() over (
                 partition by organization_id, (result - 'as_of' - 'evaluated_at' - 'input_fingerprint')
                 order by assessed_at desc, id desc
               ) as rn
        from public.%1$I
      ) ranked
      where d.id = ranked.id and ranked.rn > 1
    $f$, t);
    get diagnostics deleted = row_count;
    raise notice '% : % filas repetidas borradas', t, deleted;
  end loop;
end
$$;
