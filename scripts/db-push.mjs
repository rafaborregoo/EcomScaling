/**
 * Aplica las migraciones pendientes de supabase/migrations contra la base de
 * datos remota (SUPABASE_DB_URL) y las registra en
 * supabase_migrations.schema_migrations -- el mismo efecto que `supabase db
 * push`, pero sin el binario del CLI (bloqueado por el Control inteligente de
 * aplicaciones de Windows 11 Home por no estar firmado).
 *
 * Uso:
 *   npm run db:push                aplica las pendientes (entorno de .env.local)
 *   npm run db:push -- --dry-run   solo lista las pendientes
 *   npm run db:push:prod           aplica contra produccion (.env.production.local)
 *
 * Produccion esta protegida: si SUPABASE_DB_URL apunta al proyecto de
 * produccion hace falta "--prod" explicito. Aplicar migraciones a los datos
 * reales creyendo estar en desarrollo es el accidente que esto evita.
 *
 * "Pendiente" = fichero <version>_<nombre>.sql cuyo <version> (prefijo numerico)
 * no esta en schema_migrations. Cada migracion se aplica en su propia
 * transaccion. No soporta `create index concurrently` (no puede ir en
 * transaccion); para eso, SQL Editor del dashboard.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../supabase/migrations",
);
const dryRun = process.argv.includes("--dry-run");
// Dos ficheros con la misma version se aplican los dos pero solo registran una
// fila (insert ... on conflict do nothing): a partir de ahi uno de los dos
// queda "aplicado" sin haberse ejecutado nunca en el siguiente entorno. Paso
// real, encontrado al levantar el proyecto de desarrollo desde cero.
function assertVersionesUnicas(lista) {
  const vistas = new Map();
  for (const m of lista) {
    if (vistas.has(m.version)) {
      throw new Error(
        `Dos migraciones comparten version ${m.version}: ${vistas.get(m.version)} y ${m.file}. Renombra una con otra marca de tiempo.`,
      );
    }
    vistas.set(m.version, m.file);
  }
}

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL no definido (esta en .env.local)");

// Ref del proyecto de produccion (mismo valor que `npm run supabase:link`).
const PRODUCTION_SUPABASE_PROJECT_REF = "cthjwpeygpzwdmjkxeqa";
const targetsProduction = url.includes(PRODUCTION_SUPABASE_PROJECT_REF);
const allowProduction = process.argv.includes("--prod");

if (targetsProduction && !allowProduction) {
  throw new Error(
    "SUPABASE_DB_URL apunta a PRODUCCION (" +
      PRODUCTION_SUPABASE_PROJECT_REF +
      "). Usa `npm run db:push:prod` si es lo que quieres, o apunta este entorno al proyecto de desarrollo.",
  );
}
if (!targetsProduction && allowProduction) {
  throw new Error(
    "--prod pero SUPABASE_DB_URL no es la de produccion: revisa que fichero de entorno estas usando.",
  );
}

console.log(
  `Destino: ${targetsProduction ? "PRODUCCION" : "desarrollo"} (${new URL(url).host})`,
);

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const parsed = files.map((file) => {
  const match = /^(\d+)_(.+)\.sql$/.exec(file);
  if (!match) throw new Error(`Nombre de migracion no valido: ${file}`);
  return { file, version: match[1], name: match[2] };
});

assertVersionesUnicas(parsed);

// El endpoint Postgres de Supabase encadena a una CA autofirmada; toda su
// tooling conecta con verificacion desactivada. Sigue siendo TLS cifrado, y es
// la BD del propio usuario.
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  // En un proyecto recien creado no existe todavia: la crea el CLI de Supabase
  // en su primer push, y aqui no usamos el CLI. Misma forma que la suya
  // (version text pk, name text, statements text[]), para que el dia que se use
  // el binario oficial lea el mismo historial.
  await client.query("create schema if not exists supabase_migrations");
  await client.query(
    `create table if not exists supabase_migrations.schema_migrations (
       version text primary key,
       name text,
       statements text[]
     )`,
  );

  const { rows } = await client.query(
    "select version from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.version));
  const pending = parsed.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log("Sin migraciones pendientes.");
  } else if (dryRun) {
    console.log(`Pendientes (${pending.length}):`);
    for (const m of pending) console.log(`  ${m.file}`);
  } else {
    for (const m of pending) {
      const sql = readFileSync(path.join(dir, m.file), "utf8");
      process.stdout.write(`Aplicando ${m.file}... `);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          `insert into supabase_migrations.schema_migrations (version, name, statements)
           values ($1, $2, array[$3])
           on conflict (version) do nothing`,
          [m.version, m.name, sql],
        );
        await client.query("commit");
        console.log("ok");
      } catch (error) {
        await client.query("rollback");
        console.log("FALLO");
        throw error;
      }
    }
    console.log(`Aplicadas ${pending.length} migracion(es).`);
  }
} finally {
  await client.end();
}
