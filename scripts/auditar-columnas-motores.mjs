// Comprueba que cada `first(xResult)?.columna` de los motores corresponde a una
// columna que la funcion SQL devuelve de verdad. Un nombre que no existe no da
// error: devuelve undefined en silencio y el motor sigue marcando la fuente
// como disponible.
//
// LIMITE CONOCIDO: el binding es posicional sobre el Promise.all. Si ese
// Promise.all mezcla .rpc() con otras consultas (.from(), etc.), las variables
// se desalinean y salen falsos positivos -- comprobado en
// product-inventory-benchmarks-engine.ts. Tambien marca campos del objeto de
// evidencia que no corresponden a ninguna columna y que nunca se rellenan, que
// es correcto (hecho declarado y honestamente UNKNOWN). Filtra .data/.error/
// .available/.days, que son del resultado de Supabase, no de la fila.
// Revisa cada hallazgo contra el SQL antes de tocar nada.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIG = "supabase/migrations";
const cols = new Map();
for (const f of readdirSync(MIG).sort().filter((x) => x.endsWith(".sql"))) {
  const src = readFileSync(join(MIG, f), "utf8");
  const re = /create (?:or replace )?function public\.([a-z_0-9]+)\s*\([\s\S]*?returns\s+table\s*\(([\s\S]*?)\)\s*language/gi;
  let m;
  while ((m = re.exec(src))) {
    const names = m[2]
      .split("\n")
      .flatMap((l) => l.replace(/--.*$/, "").split(","))
      .map((s) => s.trim().split(/\s+/)[0])
      .filter((x) => /^[a-z][a-z_0-9]*$/.test(x));
    cols.set(m[1], new Set(names));
  }
}

// Parte el contenido de un array en sus elementos de primer nivel.
function topLevelItems(body) {
  const items = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      items.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) items.push(current);
  return items;
}

// variable -> funcion SQL, por posicion dentro del Promise.all. Se empareja
// elemento a elemento: un .from() entre dos .rpc() ya no desalinea el resto.
function bindings(src) {
  const map = new Map();
  const re = /const \[([^\]]+)\]\s*=\s*await Promise\.all\(\[/g;
  let m;
  while ((m = re.exec(src))) {
    const vars = m[1].split(",").map((s) => s.trim());
    // Recorre hasta el `]` que cierra el array, respetando anidamiento.
    let depth = 1;
    let end = re.lastIndex;
    while (end < src.length && depth > 0) {
      if ("([{".includes(src[end])) depth++;
      if (")]}".includes(src[end])) depth--;
      end++;
    }
    topLevelItems(src.slice(re.lastIndex, end - 1)).forEach((item, i) => {
      const fn = item.match(/\.rpc\(\s*"([a-z_0-9]+)"/)?.[1];
      if (fn && vars[i]) map.set(vars[i], fn);
    });
  }
  for (const x of src.matchAll(/const ([A-Za-z0-9_]+) = first\(([A-Za-z0-9_]+)\)/g)) {
    if (map.has(x[2])) map.set(x[1], map.get(x[2]));
  }
  return map;
}

// Parseo a mano de `algo?.col`, para no pelearme con escapes de regex.
// Devuelve el identificador que precede al `?.`, saltando un `(...)` si el
// acceso es sobre una llamada -- que es la forma `first(xResult)?.col`.
function accesses(src) {
  const ident = /[A-Za-z0-9_]/;
  const out = [];
  for (let i = 1; i < src.length - 1; i++) {
    if (src[i] !== "?" || src[i + 1] !== ".") continue;
    let j = i - 1;
    if (src[j] === ")") {
      let depth = 1;
      j--;
      while (j >= 0 && depth > 0) {
        if (src[j] === ")") depth++;
        else if (src[j] === "(") depth--;
        j--;
      }
      // dentro del parentesis: el argumento de first(...)
      let e = j + 2;
      let s = e;
      while (s < src.length && !ident.test(src[s])) s++;
      let arg = "";
      while (s < src.length && ident.test(src[s])) arg += src[s++];
      let k = i + 2;
      let col = "";
      while (k < src.length && ident.test(src[k])) col += src[k++];
      if (arg && col) out.push({ varName: arg, col });
      continue;
    }
    let end = j;
    while (end >= 0 && ident.test(src[end])) end--;
    const varName = src.slice(end + 1, j + 1);
    let k = i + 2;
    let col = "";
    while (k < src.length && ident.test(src[k])) col += src[k++];
    if (varName && col) out.push({ varName, col });
  }
  return out;
}

// Propiedades del resultado de Supabase o del envoltorio del motor, no de la fila.
const RESULT_PROPS = new Set(["data", "error", "available", "days"]);

// Lecturas de un campo que ninguna funcion devuelve, a sabiendas, con su motivo.
const ACEPTADOS = new Map([
  // Hecho declarado sin fuente: queda UNKNOWN, que es honesto
  // (conocimiento/TAREAS_PENDIENTES.md, "conversion_cro.product_views").
  ["conversion-cro-benchmarks-engine.ts:shopify_funnel_summary.product_views", "sin fuente"],
]);

const dir = "apps/api/src";
const bad = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith("-engine.ts") && !x.includes(".test."))) {
  const src = readFileSync(join(dir, f), "utf8");
  const bind = bindings(src);
  for (const a of accesses(src)) {
    const fn = bind.get(a.varName);
    if (!fn) continue;
    const real = cols.get(fn);
    if (!real || real.has(a.col) || RESULT_PROPS.has(a.col)) continue;
    if (ACEPTADOS.has(`${f}:${fn}.${a.col}`)) continue;
    bad.push(f.padEnd(42) + fn.padEnd(30) + "-> ." + a.col);
  }
}
const uniq = [...new Set(bad)].sort();
if (uniq.length) {
  console.error("Motores leyendo columnas que su funcion SQL no devuelve:\n" + uniq.join("\n"));
  process.exit(1);
}
console.log("ENGINE_COLUMNS_OK: cada columna leida por un motor existe en su funcion SQL");
