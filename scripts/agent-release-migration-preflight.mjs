/** Guards db-push against activating an agent version unless the hardened
 * database gate is already installed in that target project. The trigger is
 * the authority; this preflight prevents a deployment path from silently
 * running an activation migration against a database without that trigger.
 */
export function migrationActivatesAgentVersion(sql) {
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, (value) => " ".repeat(value.length))
    .replace(/--[^\r\n]*/g, (value) => " ".repeat(value.length));

  // Mask function bodies so an implementation of the approved promotion RPC
  // is not mistaken for a direct migration activation. DO blocks are inspected
  // separately because they can contain dynamic migration-time writes.
  const dollarBodies = [];
  const visibleSql = withoutComments.replace(/\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/g, (block) => {
    dollarBodies.push(block);
    return " ".repeat(block.length);
  }).replace(/'(?:''|[^'])*'/g, (value) => " ".repeat(value.length));

  const activationPattern = /(?:insert\s+into|update|merge\s+into)\s+(?:public\s*\.\s*)?agent_versions\b/ig;
  let match;
  while ((match = activationPattern.exec(visibleSql))) {
    const statementEnd = visibleSql.indexOf(";", match.index);
    const statement = visibleSql.slice(match.index, statementEnd < 0 ? undefined : statementEnd);
    if (/\bis_active\b[\s\S]{0,100}?\btrue\b/i.test(statement)) return true;
    if (/\bis_active\b/i.test(statement) && /\bvalues\b[\s\S]{0,300}?\btrue\b/i.test(statement)) return true;
  }

  // Anonymous blocks are not masked from review: if they contain an agent
  // version write and activate it, require the same preflight.
  for (const body of dollarBodies) {
    if (/\bdo\b/i.test(withoutComments.slice(Math.max(0, withoutComments.indexOf(body) - 20), withoutComments.indexOf(body)))
      && /(?:insert\s+into|update|merge\s+into)\s+(?:public\s*\.\s*)?agent_versions\b[\s\S]{0,2000}?\bis_active\b[\s\S]{0,100}?\btrue\b/i.test(body)) {
      return true;
    }
  }
  return false;
}

export async function assertHardenedAgentReleaseGate(client) {
  const { rows } = await client.query(`
    select
      exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'agent_versions'
          and t.tgname = 'agent_versions_release_evidence_required'
          and not t.tgisinternal and t.tgenabled in ('O', 'A')
          and pg_get_triggerdef(t.oid) ilike '%require_agent_version_release_evidence%'
      ) as trigger_ready,
      (select pg_get_functiondef(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'agent_version_has_release_evidence'
       order by p.oid desc limit 1) as evidence_gate,
      (select pg_get_functiondef(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'promote_agent_version'
       order by p.oid desc limit 1) as promotion_rpc
  `);
  const state = rows[0];
  const evidenceGate = typeof state?.evidence_gate === "string" ? state.evidence_gate : "";
  const promotionRpc = typeof state?.promotion_rpc === "string" ? state.promotion_rpc : "";
  const requiredEvidenceChecks = [
    "candidate_pin_verified",
    "executed_agent_code",
    "executed_agent_version_id",
    "executed_candidate_fingerprint",
    "candidate_judge_status",
    "candidate_judge_rubric_version",
    "candidate_judged_output_sha256",
    "holdout_manifest_sha256",
  ];
  const missing = requiredEvidenceChecks.filter((marker) => !evidenceGate.includes(marker));
  if (state?.trigger_ready !== true || missing.length > 0 || !promotionRpc.includes("agent_version_has_release_evidence")) {
    throw new Error(`agent_release_gate_preflight_failed:${[
      state?.trigger_ready === true ? null : "trigger_missing_or_disabled",
      ...missing.map((marker) => `gate_missing_${marker}`),
      promotionRpc.includes("agent_version_has_release_evidence") ? null : "promotion_rpc_not_hardened",
    ].filter(Boolean).join(",")}`);
  }
}

export async function assertMigrationReleasePreflight(client, migration) {
  const sql = typeof migration === "string" ? migration : migration.sql;
  if (!migrationActivatesAgentVersion(sql)) return;
  await assertHardenedAgentReleaseGate(client);
}
