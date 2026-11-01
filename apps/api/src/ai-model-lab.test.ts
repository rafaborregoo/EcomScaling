import assert from "node:assert/strict";
import { test } from "node:test";
import { getAdminAiModelLab } from "./ai-model-lab.js";
import type { AuthContext } from "./auth-context.js";

test("el laboratorio exige platform_admin antes de leer datos del disco", async () => {
  const result = await getAdminAiModelLab({ SUPABASE_URL: "https://example.supabase.co" }, { profile: { platform_role: "consultant" } } as AuthContext, "../../secrets");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.statusCode, 403);
});
