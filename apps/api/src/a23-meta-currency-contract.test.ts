import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "pgsql-ast-parser";

test("A23 exposes the account currency and never compares creative spend across currencies", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20260929061805_a23_currency_safe_meta_creative_metrics.sql", import.meta.url),
    "utf8",
  );

  const performanceStart = migration.indexOf(
    "create or replace function public.meta_creative_performance",
  );
  const rankingStart = migration.indexOf(
    "create or replace function public.meta_creative_ranking_distribution",
  );
  assert.notEqual(performanceStart, -1);
  assert.notEqual(rankingStart, -1);
  const creativePerformance = migration.slice(performanceStart, rankingStart);
  const rankingDistribution = migration.slice(rankingStart);

  assert.match(creativePerformance, /spend_currency text/);
  assert.match(creativePerformance, /join public\.meta_ad_accounts account[\s\S]*?account\.id = c\.ad_account_id/);
  assert.match(creativePerformance, /account\.currency_code::text as spend_currency/);
  assert.match(creativePerformance, /r\.organization_id = target_organization_id/);
  assert.match(creativePerformance, /security invoker[\s\S]*?set search_path to 'pg_catalog', 'public'/);
  assert.match(rankingDistribution, /currency_code text/);
  assert.match(rankingDistribution, /group by ad_id, ad_account_id/);
  assert.match(rankingDistribution, /group by dimension, ranking_value, currency_code/);
  assert.match(rankingDistribution, /partition by dimension, currency_code/);
  assert.match(rankingDistribution, /case when currency_code is not null then sum\(spend\)/);
  assert.match(rankingDistribution, /r\.organization_id = target_organization_id/);
  assert.match(rankingDistribution, /security invoker[\s\S]*?set search_path to 'pg_catalog', 'public'/);
  assert.match(migration, /revoke all on function public\.meta_creative_performance\([\s\S]*?from public, anon/);
  assert.match(migration, /revoke all on function public\.meta_creative_ranking_distribution\([\s\S]*?from public, anon/);
  assert.match(migration, /to authenticated, service_role/);
});

test("A23 SQL query bodies parse with the repository PostgreSQL parser", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20260929061805_a23_currency_safe_meta_creative_metrics.sql", import.meta.url),
    "utf8",
  );
  const bodies = [...migration.matchAll(/as \$function\$([\s\S]*?)\$function\$/gi)];

  assert.equal(bodies.length, 2);
  for (const [index, match] of bodies.entries()) {
    assert.ok(match[1]);
    assert.ok(parse(match[1]).length > 0, `A23 SQL function ${index + 1} must parse`);
  }
});
