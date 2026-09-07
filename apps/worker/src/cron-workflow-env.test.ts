/**
 * OPS-00: cada cron de GitHub Actions que arranca un entrypoint del worker
 * tiene que declarar todas las variables que `loadApiEnv` exige, no solo las
 * de su proveedor.
 *
 * Fallo real que motiva este test: `loadApiEnv` exige SHOPIFY_API_KEY/SECRET/
 * SCOPES/REDIRECT_URI siempre, aunque el cron no toque Shopify. Ni
 * `klaviyo-reconcile.yml` ni `meta-reconcile.yml` las declaraban, asi que
 * ambos abortaban al arrancar antes de leer una sola conexion — con el
 * workflow "corriendo" cada 6 h y cada dia respectivamente.
 *
 * El test no repite una lista de variables requeridas: construye un entorno
 * falso con exactamente lo que el workflow declara y se lo pasa a la funcion
 * real. Si alguien anade un requisito nuevo a `loadApiEnv`, este test dice que
 * workflows se quedan cortos sin tener que acordarse de actualizarlo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadApiEnv } from "@ecomscaling/config";

// Resolver relativo al fichero, no al cwd: CI, `tsx --test` y el workspace
// local pueden arrancar el proceso desde directorios distintos.
const WORKFLOWS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  ".github",
  "workflows",
);

/** Claves del bloque `env:` de nivel job (dos niveles de indentacion). */
function declaredEnvKeys(content: string): string[] {
  // Normaliza CRLF: en Windows git dejaba \r\n en algun workflow y el bloque
  // env: no se encontraba, dando un falso "el cron no declara nada".
  const envBlock = content.replace(/\r\n/g, "\n").match(
    /\n {4}env:\n((?: {6}\S[^\n]*\n|\n|(?: {6}#[^\n]*\n))+)/,
  );
  if (!envBlock) return [];
  return [...envBlock[1]!.matchAll(/^ {6}([A-Z0-9_]+):/gm)].map(
    (match) => match[1]!,
  );
}

/**
 * Valor que satisface el schema sin parecerse a un secreto real. Las claves de
 * URL/URI necesitan una URL valida porque zod las valida como tal.
 */
function placeholder(key: string): string {
  return /(_URL|_URI)$/.test(key) ? "https://placeholder.test" : "placeholder";
}

const cronWorkflows = readdirSync(WORKFLOWS_DIR)
  .filter((file) => file.endsWith(".yml"))
  .map((file) => ({
    file,
    content: readFileSync(join(WORKFLOWS_DIR, file), "utf8"),
  }))
  .filter(({ content }) => content.includes("npm run start:"));

test("hay crons de worker que analizar", () => {
  assert.ok(
    cronWorkflows.length >= 5,
    `esperaba varios workflows con 'npm run start:', encontre ${cronWorkflows.length}`,
  );
});

test("el guard detecta el fallo real que lo motivo", () => {
  // Bloque env: exacto que tenia klaviyo-reconcile.yml antes del arreglo.
  const before = [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "KLAVIYO_CLIENT_ID",
    "KLAVIYO_CLIENT_SECRET",
    "KLAVIYO_REDIRECT_URI",
    "KLAVIYO_SCOPES",
    "INTEGRATION_FEATURE_FLAGS",
  ];

  assert.throws(
    () =>
      loadApiEnv(
        Object.fromEntries(before.map((key) => [key, placeholder(key)])),
      ),
    /SHOPIFY_API_KEY is required/,
  );
});

for (const { file, content } of cronWorkflows) {
  test(`${file} declara todo lo que loadApiEnv exige`, () => {
    const keys = declaredEnvKeys(content);
    assert.ok(keys.length > 0, `${file}: no se encontro bloque env: del job`);

    const fakeEnv = Object.fromEntries(
      keys.map((key) => [key, placeholder(key)]),
    );

    assert.doesNotThrow(
      () => loadApiEnv(fakeEnv),
      `${file} declara ${keys.length} variables pero loadApiEnv sigue fallando: el cron abortaria al arrancar`,
    );
  });
}
