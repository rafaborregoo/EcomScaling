import { readFile } from "node:fs/promises";

const [demoSource, shopifySource] = await Promise.all([
  readFile(new URL("./seed-demo-user.ts", import.meta.url), "utf8"),
  readFile(new URL("./seed-shopify-store.ts", import.meta.url), "utf8"),
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

const missing = requiredMarkers
  .filter((marker) => !demoSource.includes(marker))
  .concat(
    requiredShopifyMarkers.filter((marker) => !shopifySource.includes(marker)),
  );
if (missing.length > 0) {
  console.error(`UNSAFE_DEMO_SEED_SURFACE: missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log("SAFE_DEMO_SEED_SURFACE_OK");
