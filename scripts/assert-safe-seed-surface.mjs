import { readFile } from "node:fs/promises";

const [demoSource, shopifySource, enoraSource] = await Promise.all([
  readFile(new URL("./seed-demo-user.ts", import.meta.url), "utf8"),
  readFile(new URL("./seed-shopify-store.ts", import.meta.url), "utf8"),
  readFile(new URL("./seed-enora-12m.ts", import.meta.url), "utf8"),
]);
const requiredMarkers = [
  'ALLOW_DEMO_SEED: z.literal("true")',
  "SUPABASE_PRODUCTION_PROJECT_REF",
  "DEMO_SEED_PRODUCTION_PROJECT_REFUSED",
];
const requiredShopifyMarkers = [
  'ALLOW_SHOPIFY_SEED: z.literal("true")',
  "SHOPIFY_PRODUCTION_DOMAIN",
  "SHOPIFY_SEED_PRODUCTION_DOMAIN_REFUSED",
];
const requiredEnoraMarkers = [
  'ALLOW_ENORA_SYNTHETIC_SEED: z.literal("true")',
  "SUPABASE_PRODUCTION_PROJECT_REF",
  "ENORA_SEED_PRODUCTION_PROJECT_REFUSED",
  "ENORA_SEED_REAL_CONNECTION_REFUSED",
];

const missing = requiredMarkers
  .filter((marker) => !demoSource.includes(marker))
  .concat(
    requiredShopifyMarkers.filter((marker) => !shopifySource.includes(marker)),
    requiredEnoraMarkers.filter((marker) => !enoraSource.includes(marker)),
  );
if (missing.length > 0) {
  console.error(`UNSAFE_DEMO_SEED_SURFACE: missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log("SAFE_DEMO_SEED_SURFACE_OK");
