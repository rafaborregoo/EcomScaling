import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const p = await c.query("select coalesce(provider,'(sin registrar)') as provider, count(*)::int as n from agent_runs group by 1 order by 2 desc");
console.log("proveedor que atendio:", p.rows);
const cb = await c.query("select count(*)::int as n, min(created_at)::date as desde, max(created_at)::date as hasta from agent_runs where error_message like '%credit balance is too low%'");
console.log("fallos por saldo:", cb.rows[0]);
await c.end();
