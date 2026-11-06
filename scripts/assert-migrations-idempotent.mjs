/**
 * Guard: toda migracion tiene que poder reaplicarse sin reventar.
 *
 * Por que existe. CLAUDE.md ya lo exigia por escrito y aun asi el 40% del
 * historial no lo cumplia: `create table` sin guarda, `insert` de catalogo sin
 * `on conflict`, `create trigger` sin su `drop` previo. Nadie lo vio porque no
 * habia nada que lo comprobara, y el sintoma solo aparece cuando intentas
 * levantar un proyecto desde cero -- que es justo lo que bloqueaba el proyecto
 * de pruebas y, con el, la suite de aislamiento entre inquilinos.
 *
 * La regla practica: si el esquema se ha tocado por fuera, `db:push` tiene que
 * poder reaplicar la migracion sin dano. Eso es lo que hace recuperable una
 * deriva.
 *
 * Solo mira ficheros nuevos respecto a lo ya sano: si algun dia hiciera falta
 * una excepcion justificada, se anade a EXCEPCIONES con su motivo.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

/** Migraciones con permiso explicito para saltarse una regla, y por que. */
const EXCEPCIONES = new Map([
  // IMP-02 preserves the TABLE signatures of margin, finance and advertising
  // RPCs and replaces only their bodies. Real PostgreSQL fixtures apply the
  // migration twice; dropping these functions would discard existing grants.
  ["20270115120000_imp02_financial_comparability.sql", ["function-returns-table"]],
  // Solo corrige el cuerpo (desempate por created_at) conservando la firma y el
  // returns table de 20260907240000: `create or replace` basta y es
  // reaplicable. Un `drop` delante borraria los grants y el search_path que
  // fijaron migraciones anteriores, y esta ya esta aplicada en produccion.
  ["20261106090000_klaviyo_email_report_created_at.sql", ["function-returns-table"]],
  // Both functions are introduced with their final TABLE signatures in this
  // migration and later replace only their bodies. Dropping the public wrapper
  // would also discard its grant; signatures are unchanged on replay.
  ["20261215120000_agent_judge_holdout_freeze_release_gate.sql", ["function-returns-table"]],
  // This migration introduces the monthly sales RPC with its final row shape;
  // reapplication replaces only the query body.
  ["20261130000000_a19_seasonal_intelligence.sql", ["function-returns-table"]],
]);

/** Quita comentarios y cuerpos $$...$$ para no analizar el texto de un prompt. */
function soloSql(fuente) {
  let salida = "";
  let i = 0;
  while (i < fuente.length) {
    const resto = fuente.slice(i);

    const dolar = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(resto);
    if (dolar) {
      const cierre = fuente.indexOf(dolar[0], i + dolar[0].length);
      if (cierre === -1) break;
      salida += " ";
      i = cierre + dolar[0].length;
      continue;
    }

    if (resto.startsWith("--")) {
      const salto = fuente.indexOf("\n", i);
      i = salto === -1 ? fuente.length : salto;
      continue;
    }

    if (fuente[i] === "'") {
      const fin = fuente.indexOf("'", i + 1);
      salida += " ";
      i = fin === -1 ? fuente.length : fin + 1;
      continue;
    }

    salida += fuente[i];
    i += 1;
  }
  return salida;
}

const TABLAS_CATALOGO = [
  "agent_definitions",
  "agent_versions",
  "prompt_versions",
];

const REGLAS = [
  {
    id: "create-table",
    detecta: /\bcreate\s+table\s+(?!if\s+not\s+exists\b)(?:public|private)\./gi,
    mensaje: "`create table` sin `if not exists`",
  },
  {
    id: "create-index",
    detecta:
      /\bcreate\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists\b|concurrently\b)[a-z0-9_]+\s+on\b/gi,
    mensaje: "`create index` sin `if not exists`",
  },
  {
    id: "add-column",
    detecta: /\badd\s+column\s+(?!if\s+not\s+exists\b)/gi,
    mensaje: "`add column` sin `if not exists`",
  },
  {
    id: "drop-constraint",
    detecta: /\bdrop\s+constraint\s+(?!if\s+exists\b)/gi,
    mensaje: "`drop constraint` sin `if exists`",
  },
  {
    id: "drop-column",
    detecta: /\bdrop\s+column\s+(?!if\s+exists\b)/gi,
    mensaje: "`drop column` sin `if exists`",
  },
];

/** create trigger / create policy necesitan su `drop ... if exists` delante. */
function faltaDropPrevio(sql, tipo) {
  const patron =
    tipo === "trigger"
      ? /\bcreate\s+trigger\s+([a-z0-9_]+)/gi
      : /\bcreate\s+policy\s+("[^"]+"|[a-z0-9_]+)/gi;

  const fallos = [];
  let m;
  while ((m = patron.exec(sql)) !== null) {
    const nombre = m[1];
    const anterior = sql.slice(Math.max(0, m.index - 400), m.index);
    // Sin `\b` al final a proposito: los nombres de policy van entre comillas
    // dobles y `"` no es caracter de palabra, asi que un limite ahi no casa
    // nunca y todo saldria como fallo.
    const dropEsperado = new RegExp(
      `drop\\s+${tipo}\\s+if\\s+exists\\s+${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    );
    if (!dropEsperado.test(anterior)) fallos.push(nombre);
  }
  return fallos;
}

/**
 * `create or replace function ... returns table (...)` necesita su drop: si una
 * migracion posterior anade una columna al returns, Postgres responde "cannot
 * change return type of existing function".
 */
function funcionesDeTablaSinDrop(sql) {
  const patron =
    /\bcreate\s+or\s+replace\s+function\s+((?:public|private)\.[a-z0-9_]+)\s*\([^;]*?\)\s*returns\s+table\s*\(/gi;
  const fallos = [];
  let m;
  while ((m = patron.exec(sql)) !== null) {
    const nombre = m[1];
    const anterior = sql.slice(Math.max(0, m.index - 400), m.index);
    const dropEsperado = new RegExp(
      `drop\\s+function\\s+if\\s+exists\\s+${nombre.replace(".", "\\.")}\\s*\\(`,
      "i",
    );
    if (!dropEsperado.test(anterior)) fallos.push(nombre);
  }
  return fallos;
}

/** Los inserts del catalogo de agentes tienen que converger, no duplicar. */
function insertsDeCatalogoSinConflicto(sql) {
  const fallos = [];
  for (const tabla of TABLAS_CATALOGO) {
    const patron = new RegExp(`insert\\s+into\\s+public\\.${tabla}\\b`, "gi");
    let m;
    while ((m = patron.exec(sql)) !== null) {
      // La sentencia acaba en el primer `;` (los $$ ya se han vaciado).
      const fin = sql.indexOf(";", m.index);
      const sentencia = sql.slice(m.index, fin === -1 ? sql.length : fin);
      if (!/on\s+conflict/i.test(sentencia)) fallos.push(tabla);
    }
  }
  return fallos;
}

const ficheros = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const problemas = [];

for (const fichero of ficheros) {
  const excepcion = EXCEPCIONES.get(fichero);
  const bruto = await readFile(path.join(migrationsDir, fichero), "utf8");
  const sql = soloSql(bruto);

  for (const regla of REGLAS) {
    if (excepcion?.includes(regla.id)) continue;
    const encontrados = sql.match(regla.detecta);
    if (encontrados?.length) {
      problemas.push(`${fichero}: ${encontrados.length}x ${regla.mensaje}`);
    }
  }

  for (const tipo of ["trigger", "policy"]) {
    if (excepcion?.includes(`create-${tipo}`)) continue;
    const sinDrop = faltaDropPrevio(sql, tipo);
    if (sinDrop.length) {
      problemas.push(
        `${fichero}: create ${tipo} sin \`drop ${tipo} if exists\` delante (${sinDrop.join(", ")})`,
      );
    }
  }

  if (!excepcion?.includes("function-returns-table")) {
    const sinDrop = funcionesDeTablaSinDrop(sql);
    if (sinDrop.length) {
      problemas.push(
        `${fichero}: funcion que devuelve table sin \`drop function if exists\` delante (${sinDrop.join(", ")})`,
      );
    }
  }

  if (!excepcion?.includes("catalog-insert")) {
    const sinConflicto = insertsDeCatalogoSinConflicto(sql);
    if (sinConflicto.length) {
      problemas.push(
        `${fichero}: insert sin \`on conflict\` en ${[...new Set(sinConflicto)].join(", ")}`,
      );
    }
  }
}

if (problemas.length > 0) {
  console.error(
    "MIGRATIONS_NOT_IDEMPOTENT: estas migraciones no se pueden reaplicar.\n" +
      "Una migracion que solo funciona la primera vez impide levantar un\n" +
      "proyecto desde cero y hace irrecuperable cualquier deriva de esquema.\n",
  );
  for (const problema of problemas) console.error(`  - ${problema}`);
  console.error(
    `\n${problemas.length} problema(s) en ${ficheros.length} migraciones.`,
  );
  process.exit(1);
}

console.log(
  `MIGRATIONS_IDEMPOTENT_OK: ${ficheros.length} migraciones se pueden reaplicar`,
);
