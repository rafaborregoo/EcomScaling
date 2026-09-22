// Inventario de metricas: una fila por funcion SQL, cruzada con la pantalla que
// la muestra y la tool que la expone a los agentes.
//
// Existe porque las tres preguntas ("se calcula", "alguien lo ve", "el agente
// puede leerlo") se respondian abriendo ficheros a mano, y la respuesta
// caducaba al commit siguiente. Se regenera, no se edita:
//
//   node scripts/inventario-metricas.mjs
//
// Salida: docs/INVENTARIO_METRICAS.md
//
// Dos heuristicas, con su techo escrito para que nadie las lea como verdad
// exacta:
//  - el area sale del nombre de la funcion (AREAS), no de su contenido;
//  - la pantalla se traza funcion -> modulo de api -> simbolo exportado ->
//    ruta /v1 mas cercana por encima en server.ts -> fichero de apps/web que la
//    menciona. La ventana de 120 lineas entre ruta y llamada es empirica.
// Ambas fallan por exceso antes que por defecto: comprueba a mano antes de dar
// por muerta una metrica que el inventario marque "sin uso".

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const BACKSLASH = String.fromCharCode(92);
const PAREN = String.fromCharCode(40);
const TICK = String.fromCharCode(96);
const rel = (p) => relative(ROOT, p).split(BACKSLASH).join("/");
const tick = (s) => TICK + s + TICK;

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".next", ".git"].includes(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => entry.endsWith(x))) out.push(p);
  }
  return out;
}

// --- 1. funciones SQL y las tablas que leen --------------------------------
const fns = new Map();
for (const file of walk(join(ROOT, "supabase/migrations"), [".sql"])) {
  const src = readFileSync(file, "utf8");
  const re = /create (?:or replace )?function public\.([a-z_0-9]+)\s*\(/gi;
  let m;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index);
    const next = rest.slice(10).search(/create (?:or replace )?function/i);
    const body = next > 0 ? rest.slice(0, next + 10) : rest;
    const tables = new Set();
    for (const t of body.matchAll(/\b(?:from|join)\s+public\.([a-z_0-9]+)/gi)) {
      tables.add(t[1]);
    }
    fns.set(m[1], { tables: [...tables] });
  }
}

// --- 2. quien llama a cada funcion, y que exporta ese modulo ---------------
const apiFiles = [
  ...walk(join(ROOT, "apps/api/src"), [".ts"]),
  ...walk(join(ROOT, "apps/worker/src"), [".ts"]),
].filter((f) => !f.includes(".test."));

const callers = new Map();
const exportsOf = new Map();
for (const file of apiFiles) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
    if (!callers.has(m[1])) callers.set(m[1], new Set());
    callers.get(m[1]).add(rel(file));
  }
  const symbols = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    symbols.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) symbols.add(m[1]);
  exportsOf.set(rel(file), symbols);
}

// --- 3. simbolo exportado -> ruta /v1 que lo invoca ------------------------
const serverLines = readFileSync(join(ROOT, "apps/api/src/server.ts"), "utf8").split("\n");
const routeAt = [];
serverLines.forEach((line, i) => {
  const m = line.match(/"(\/v1\/[a-zA-Z0-9/:_-]+)"/);
  if (m) routeAt.push({ route: m[1], line: i });
});

function routesForSymbol(symbol) {
  const needle = symbol + PAREN;
  const found = new Set();
  serverLines.forEach((line, i) => {
    if (!line.includes(needle)) return;
    let best = null;
    for (const r of routeAt) if (r.line <= i && (!best || r.line > best.line)) best = r;
    if (best && i - best.line < 120) found.add(best.route);
  });
  return found;
}

// --- 4. ruta -> pantalla de apps/web ---------------------------------------
const webPages = walk(join(ROOT, "apps/web/src"), [".ts", ".tsx"])
  .map((f) => ({ path: rel(f), src: readFileSync(f, "utf8") }))
  .filter((w) => w.path.includes("/app/"));

function screensForRoute(route) {
  const segments = route.split("/").filter((s) => s && !s.startsWith(":") && s !== "v1");
  const needle = segments.slice(-2).join("/");
  const hits = new Set();
  if (needle.length < 4) return hits;
  for (const page of webPages) if (page.src.includes(needle)) hits.add(page.path);
  return hits;
}

// --- 5. tools de solo lectura expuestas a los agentes ----------------------
const toolSrc = readFileSync(join(ROOT, "packages/ai/src/tool-layer.ts"), "utf8");
const tools = new Set();
{
  const block = toolSrc.slice(
    toolSrc.indexOf("const readTools"),
    toolSrc.indexOf("const proposedTools"),
  );
  for (const m of block.matchAll(/"([a-z_0-9]+)"/g)) tools.add(m[1]);
}

// Que funcion SQL sirve a cada tool. Se lee del registro real
// (`registerScopedReadTool("nombre", ..., handler)`) y de las .rpc que hay
// dentro de ese handler, no de "el fichero menciona el nombre": ai-runtime.ts
// nombra las 27 tools, asi que por fichero toda metrica parecia expuesta por
// todas. El corte es hasta el siguiente register*, que es como esta escrito el
// fichero hoy.
const fnToTools = new Map();
for (const file of apiFiles) {
  const src = readFileSync(file, "utf8");
  const marks = [...src.matchAll(/register[A-Za-z]*\(\s*"([a-z_0-9]+)"/g)];
  marks.forEach((mark, i) => {
    const tool = mark[1];
    if (!tools.has(tool)) return;
    const body = src.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : src.length);
    for (const call of body.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
      if (!fnToTools.has(call[1])) fnToTools.set(call[1], new Set());
      fnToTools.get(call[1]).add(tool);
    }
  });
}

// --- 6. area de negocio: las de fase-05 / fase-06 --------------------------
const AREAS = [
  [
    "Plataforma (no es metrica de negocio)",
    /^admin_|^consultant_|invite|^es_|gateway|knowledge|copilot|billable|plazas|activity_digest|maturity|^context_|^reorder_/,
  ],
  ["Adquisicion y demanda", /demand_source|attribution_by_channel|acquisition/],
  ["Paid media", /^meta_|spend|creative|delivery_health|learning_phase|pixel_health|audience/],
  ["Conversion y CRO", /funnel|checkout_recovery|session/],
  ["Oferta, pricing y AOV", /top_products|discount_cost|order_mix|margin/],
  ["Retencion, CRM y LTV", /^klaviyo_|cohort|customer_recurrence|customer_value|customer_health/],
  ["Unit economics y rentabilidad", /financial_summary|financial_monthly|sales_summary|sales_daily/],
  ["Producto, catalogo e inventario", /stock|inventory/],
  ["Operaciones y CX", /delivery_times|return_rate|fulfillment/],
];
const areaOf = (name) => (AREAS.find(([, re]) => re.test(name)) ?? ["Sin clasificar"])[0];

// --- 7. una fila por metrica -----------------------------------------------
const rows = [...fns]
  .map(([name, info]) => {
    const callerFiles = callers.get(name) ?? new Set();
    // El runtime de IA se excluye del rastreo de pantallas: es el camino del
    // agente, no el de la UI, y sus simbolos cuelgan de tantas rutas que toda
    // metrica parecia estar en todas las pantallas. Lo que expone al agente ya
    // lo dice la columna Tool.
    const uiCallers = [...callerFiles].filter((f) => !f.endsWith("/ai-runtime.ts"));
    const routes = new Set();
    for (const caller of uiCallers) {
      for (const symbol of exportsOf.get(caller) ?? []) {
        for (const route of routesForSymbol(symbol)) routes.add(route);
      }
    }
    const screens = new Set();
    for (const route of routes) for (const s of screensForRoute(route)) screens.add(s);
    const viaTool = [...(fnToTools.get(name) ?? [])];
    return {
      name,
      area: areaOf(name),
      tables: info.tables,
      callers: [...callerFiles],
      screens: [...screens],
      tools: viaTool,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// --- 8. markdown -----------------------------------------------------------
const ORDEN = [
  "Adquisicion y demanda",
  "Paid media",
  "Conversion y CRO",
  "Oferta, pricing y AOV",
  "Retencion, CRM y LTV",
  "Unit economics y rentabilidad",
  "Producto, catalogo e inventario",
  "Operaciones y CX",
  "Sin clasificar",
  "Plataforma (no es metrica de negocio)",
];
const BLOQUE = {
  "Adquisicion y demanda": "5.01 / 6.03",
  "Paid media": "5.02 / 6.04",
  "Conversion y CRO": "5.03 / 6.05",
  "Oferta, pricing y AOV": "5.04 / 6.06",
  "Retencion, CRM y LTV": "5.05 / 6.07",
  "Unit economics y rentabilidad": "5.06 / 6.08",
  "Producto, catalogo e inventario": "5.07 / 6.10",
  "Operaciones y CX": "5.08 / 6.09",
};

const conector = (n) => {
  if (n.startsWith("meta_")) return "Meta";
  if (n.startsWith("klaviyo_")) return "Klaviyo";
  if (n.startsWith("shopify_")) return "Shopify";
  return "propio";
};
const short = (p) =>
  p.replace("apps/web/src/app/", "").replace("/page.tsx", "").replace(".tsx", "");
const listCell = (items, format, max = 2) =>
  items.length === 0
    ? "**--**"
    : items.slice(0, max).map(format).map(tick).join("<br>") +
      (items.length > max ? " +" + (items.length - max) : "");

const out = [];
out.push("# Inventario de metricas");
out.push("");
out.push("Una fila por funcion SQL de metrica, cruzada con quien la consume.");
out.push("**Generado por script desde el codigo** -- no se edita a mano, se regenera:");
out.push("");
out.push("```");
out.push("node scripts/inventario-metricas.mjs");
out.push("```");
out.push("");
out.push("Cada columna vacia es una cola de trabajo distinta:");
out.push("");
out.push("| Columna vacia | Que falta | Punto del DoD |");
out.push("| --- | --- | --- |");
out.push("| **Pantalla** | la cifra se calcula pero nadie la ve | 7 (la vista existe) |");
out.push("| **Tool** | ningun agente puede leerla | 8 (consumo por agentes) |");
out.push("| **sin uso** | no la llama ni la UI ni un agente | trabajo pagado y muerto |");
out.push("");
out.push(
  "El eje son las **areas de negocio** de " +
    tick("fase-05") +
    " / " +
    tick("fase-06") +
    ", no los",
);
out.push("conectores: el corpus esta organizado asi y el consultor pregunta asi. El");
out.push("conector solo dice de donde sale el dato.");
out.push("");
out.push("Las heuristicas de area y de pantalla fallan por exceso: comprueba a mano antes");
out.push("de dar por muerta una metrica marcada **sin uso**.");
out.push("");
out.push("## Resumen");
out.push("");
out.push("| Area | Bloque | Metricas | Sin pantalla | Sin tool | Sin uso |");
out.push("| --- | --- | --- | --- | --- | --- |");
for (const area of ORDEN) {
  const rs = rows.filter((r) => r.area === area);
  if (!rs.length) continue;
  out.push(
    "| " +
      area +
      " | " +
      (BLOQUE[area] ?? "--") +
      " | " +
      rs.length +
      " | " +
      rs.filter((r) => r.callers.length && !r.screens.length).length +
      " | " +
      rs.filter((r) => !r.tools.length).length +
      " | " +
      rs.filter((r) => !r.callers.length).length +
      " |",
  );
}

for (const area of ORDEN) {
  const rs = rows.filter((r) => r.area === area);
  if (!rs.length) continue;
  out.push("");
  out.push("## " + area + (BLOQUE[area] ? " -- bloques " + tick(BLOQUE[area]) : ""));
  out.push("");
  out.push("| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const r of rs) {
    out.push(
      "| " +
        tick(r.name) +
        " | " +
        conector(r.name) +
        " | " +
        (r.callers.length ? listCell(r.screens, short) : "**sin uso**") +
        " | " +
        (r.tools.length ? r.tools.map(tick).join(", ") : "**--**") +
        " | " +
        listCell(r.tables, (t) => t, 3) +
        " |",
    );
  }
}
out.push("");

writeFileSync(join(ROOT, "docs/INVENTARIO_METRICAS.md"), out.join("\n"), "utf8");
console.log(
  "docs/INVENTARIO_METRICAS.md: " + rows.length + " metricas, " + out.length + " lineas",
);
