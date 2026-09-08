import { readFile } from "node:fs/promises";
import process from "node:process";

const migration = await readFile(
  "supabase/migrations/20260820110000_db_10_instagram_foundation.sql",
  "utf8",
);

const tables = [
  "instagram_accounts",
  "instagram_account_snapshots",
  "instagram_account_insight_values",
  "instagram_media",
  "instagram_media_insight_values",
  "instagram_follower_winners",
];
const missing = [];

if (
  /\b(insert\s+into|update\s+public\.|delete\s+from\s+public\.)/i.test(
    migration,
  )
) {
  missing.push("foundation must not mutate public business rows");
}

// Las migraciones se hicieron idempotentes (`create table if not exists`) y las
// policies pasaron a una sola linea, asi que estos patrones toleran ambas
// formas: lo que se exige es que la tabla y su policy existan, no su sintaxis.
for (const table of tables) {
  if (!new RegExp(`create table (?:if not exists )?public\\.${table}\\b`, "i").test(migration)) {
    missing.push(`${table}: create table`);
  }
  if (
    !new RegExp(
      `alter table public\\.${table} enable row level security`,
      "i",
    ).test(migration)
  ) {
    missing.push(`${table}: RLS`);
  }
  if (
    !new RegExp(`create policy [^\\n]+\\s+on public\\.${table}\\b`, "i").test(
      migration,
    )
  ) {
    missing.push(`${table}: tenant policy`);
  }
  if (
    !new RegExp(`grant select on public\\.${table} to authenticated`, "i").test(
      migration,
    )
  ) {
    missing.push(`${table}: authenticated select grant`);
  }
}

if (missing.length > 0) {
  console.error("INSTAGRAM_FOUNDATION_VIOLATION");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(
  "INSTAGRAM_FOUNDATION_OK: six tables have RLS, tenant policies and read grants",
);
