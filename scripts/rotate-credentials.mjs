/**
 * Recifra private.integration_credentials con CREDENTIALS_ENCRYPTION_KEY (v2).
 *
 * Lee cada credencial con la clave con la que se guardo: v1 (heredada,
 * derivada de SUPABASE_JWT_SECRET / service key / SHOPIFY_API_SECRET, mismo
 * orden que la API) o v2 con la clave actual o la anterior
 * (CREDENTIALS_ENCRYPTION_KEY_PREVIOUS). La vuelve a cifrar con la actual y el
 * id de la conexion como AAD. Una fila que no se puede leer se cuenta y se deja
 * como esta: no se borra nada.
 *
 * Uso:
 *   npm run credentials:rotate -- --dry-run     cuenta sin escribir
 *   npm run credentials:rotate                  desarrollo (.env.local)
 *   npm run credentials:rotate:prod             produccion (exige --prod)
 */
import crypto from "node:crypto";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const allowProduction = process.argv.includes("--prod");
const PRODUCTION_SUPABASE_PROJECT_REF = "cthjwpeygpzwdmjkxeqa";

const url = process.env.SUPABASE_DB_URL;
const current = process.env.CREDENTIALS_ENCRYPTION_KEY;
const previous = process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
const legacy =
  process.env.SUPABASE_JWT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SHOPIFY_API_SECRET;

if (!url) throw new Error("SUPABASE_DB_URL no definido");
if (!current || current.length < 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY no definido o con menos de 32 caracteres");
if (url.includes(PRODUCTION_SUPABASE_PROJECT_REF) && !allowProduction) {
  throw new Error("SUPABASE_DB_URL apunta a produccion: añade --prod si de verdad quieres recifrar alli.");
}

const keyOf = (secret) => crypto.createHash("sha256").update(secret).digest();

function decryptV1(payload, secret) {
  const raw = Buffer.from(payload, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

function decryptV2(payload, secret, aad) {
  const raw = Buffer.from(payload.slice(3), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

function encryptV2(plain, secret, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyOf(secret), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v2:" + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function readAny(payload, aad) {
  if (!payload.startsWith("v2:")) return { plain: decryptV1(payload, legacy), from: "v1" };
  try {
    return { plain: decryptV2(payload, current, aad), from: "v2-actual" };
  } catch (error) {
    if (!previous) throw error;
    return { plain: decryptV2(payload, previous, aad), from: "v2-anterior" };
  }
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const counts = { leidas: 0, recifradas: 0, ya_al_dia: 0, ilegibles: 0 };
try {
  const { rows } = await client.query(
    "select id, connection_id, encrypted_payload from private.integration_credentials order by created_at",
  );
  for (const row of rows) {
    counts.leidas += 1;
    let read;
    try {
      read = readAny(row.encrypted_payload, row.connection_id);
    } catch {
      counts.ilegibles += 1;
      console.warn(`ilegible: credencial ${row.id} (conexion ${row.connection_id})`);
      continue;
    }
    if (read.from === "v2-actual") {
      counts.ya_al_dia += 1;
      continue;
    }
    counts.recifradas += 1;
    if (dryRun) continue;
    await client.query(
      "update private.integration_credentials set encrypted_payload = $1, encryption_key_version = 'v2', rotated_at = now() where id = $2",
      [encryptV2(read.plain, current, row.connection_id), row.id],
    );
  }
} finally {
  await client.end();
}
console.log(dryRun ? "Simulacion (sin escribir):" : "Hecho:", counts);
