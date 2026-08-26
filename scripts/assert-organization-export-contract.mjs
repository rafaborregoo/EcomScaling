import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve("supabase/migrations/20260826180000_ops_organization_export.sql"),
  "utf8",
);

const required = [
  "private.export_organization_data",
  "p_organization_id uuid",
  "id = p_organization_id",
  "integration_connections",
  "agent_runs",
  "call_transcripts",
  "audit_logs",
  "Credentials remain excluded",
];
const forbidden = [
  "encrypted_payload",
  "service_role_key",
  "access_token",
  "refresh_token",
];

const failures = [];
const exportList = source.slice(
  source.indexOf("export_tables"),
  source.indexOf("];", source.indexOf("export_tables")),
);
if (exportList.includes("integration_credentials")) {
  failures.push("private credentials table present in export allowlist");
}
for (const token of required) {
  if (!source.includes(token)) failures.push(`required token missing: ${token}`);
}
for (const token of forbidden) {
  if (source.includes(token)) failures.push(`secret-shaped token present: ${token}`);
}

if (failures.length) {
  console.error("ORGANIZATION_EXPORT_CONTRACT_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("ORGANIZATION_EXPORT_CONTRACT_OK: tenant filter and secret exclusion verified");
}
