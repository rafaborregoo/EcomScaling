/**
 * Compara el esquema de dos entornos (DEV_DB_URL vs PROD_DB_URL) y lista la
 * deriva: tablas y columnas que estan en uno y no en el otro.
 *
 * Existe porque produccion se construyo por capas mientras los ficheros de
 * migracion se editaban por detras: los dos "historiales" coinciden pero los
 * esquemas no. Desde que hay un entorno creado desde cero, esta comparacion es
 * la unica forma barata de saber donde.
 *
 *   npx dotenv -e .env.local -- node scripts/schema-diff.mjs
 *   (lee DEV de SUPABASE_DB_URL y PROD de PROD_DB_URL)
 */
import pg from "pg";

async function leer(url) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, column_name
  `);
  await c.end();
  const porTabla = new Map();
  for (const r of rows) {
    if (!porTabla.has(r.table_name)) porTabla.set(r.table_name, new Map());
    porTabla.get(r.table_name).set(r.column_name, `${r.data_type}${r.is_nullable === "NO" ? " not null" : ""}`);
  }
  return porTabla;
}

const dev = await leer(process.env.SUPABASE_DB_URL);
const prod = await leer(process.env.PROD_DB_URL);

const tablas = [...new Set([...dev.keys(), ...prod.keys()])].sort();
let deriva = 0;
for (const tabla of tablas) {
  const d = dev.get(tabla);
  const p = prod.get(tabla);
  if (!d) { console.log(`TABLA solo en PROD: ${tabla}`); deriva += 1; continue; }
  if (!p) { console.log(`TABLA solo en DEV:  ${tabla}`); deriva += 1; continue; }
  const soloDev = [...d.keys()].filter((c) => !p.has(c));
  const soloProd = [...p.keys()].filter((c) => !d.has(c));
  const distinto = [...d.keys()].filter((c) => p.has(c) && p.get(c) !== d.get(c));
  if (soloDev.length || soloProd.length || distinto.length) {
    deriva += 1;
    console.log(`\n${tabla}`);
    if (soloDev.length) console.log(`  solo en DEV:  ${soloDev.join(", ")}`);
    if (soloProd.length) console.log(`  solo en PROD: ${soloProd.join(", ")}`);
    for (const c of distinto) console.log(`  distinto ${c}: dev=${d.get(c)} prod=${p.get(c)}`);
  }
}
console.log(`\ntablas comparadas: ${tablas.length} | con deriva: ${deriva}`);
