import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL_REQUIRED");
const productionRef = "cthjwpeygpzwdmjkxeqa";
const isProduction = url.includes(productionRef);
if (isProduction !== process.argv.includes("--prod")) {
  throw new Error(isProduction ? "PRODUCTION_REQUIRES_--prod" : "--prod_TARGET_IS_NOT_PRODUCTION");
}
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query(`
    select
      (select pg_get_functiondef(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'agent_version_has_release_evidence'
       order by p.oid desc limit 1) as gate,
      exists (select 1 from supabase_migrations.schema_migrations where version = '20261216100000') as migration_applied
  `);
  const state = rows[0];
  const gate = typeof state?.gate === "string" ? state.gate : "";
  const required = [
    "candidate_judge_status",
    "candidate_judge_rubric_version",
    "candidate_judge_score",
    "candidate_judged_output_sha256",
    "judge-rubrics-v1",
  ];
  const missing = required.filter((field) => !gate.includes(field));
  if (state?.migration_applied !== true || missing.length) {
    throw new Error(`AGENT_JUDGE_RELEASE_GATE_MISSING:${missing.join(",") || "migration_not_recorded"}`);
  }
  console.log(`AGENT_JUDGE_RELEASE_GATE_OK: ${isProduction ? "production" : "test"}; candidate output requires a passing judge result bound by SHA-256.`);
} finally {
  await client.end();
}
