// Sube los .md de una carpeta como conocimiento GLOBAL (metodologia de
// plataforma: visibility 'global', organization_id null). Un fichero = un
// documento; el titulo sale del primer `# ` o del nombre del fichero.
//
// Uso:
//   npm run conocimiento:ingest -- conocimiento/fase-01 --dry-run
//   npm run conocimiento:ingest -- conocimiento/fase-01 --limit=1
//   npm run conocimiento:ingest -- conocimiento/fase-01
//
// Auth: KNOWLEDGE_ADMIN_TOKEN (bearer ya emitido) o
// KNOWLEDGE_ADMIN_EMAIL/KNOWLEDGE_ADMIN_PASSWORD de una cuenta platform_admin.
//
// Limites de Voyage: la API ya reintenta con backoff los 429 dentro de una
// peticion (withAgentResilience, packages/ai/src/resilience.ts), pero eso no
// evita agotar el ritmo por minuto encadenando documentos. Por eso aqui:
// secuencial, pausa entre documentos (INGEST_DELAY_MS) y `--limit` para
// ingestar de N en N en vez de soltar la carpeta entera.
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const folder = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

if (!folder || Number.isNaN(limit) || limit < 1) {
  console.error(
    "uso: node scripts/ingest-conocimiento.mjs <carpeta> [--dry-run] [--limit=N]",
  );
  process.exit(1);
}

const audience = process.env.KNOWLEDGE_AUDIENCE ?? "consultant_only";
const apiUrl =
  process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
const delayMs = Number(process.env.INGEST_DELAY_MS ?? 2000);

// Estimacion, no medicion: ~4 chars por token en español, el mismo ratio que
// usa createKnowledgeDocument para token_count. Sirve para decidir antes de
// gastar, no para facturar.
const estimateTokens = (chars) => Math.ceil(chars / 4);
const estimateChunks = (chars) => Math.ceil(chars / 1300);

// El titulo va a una columna, no a un render markdown: fuera enfasis
// (**2. Producto**) y escapes de markdown (2\. Producto).
function limpia(raw) {
  return raw
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\\([.\-#])/g, "$1")
    .trim();
}

function encabezados(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .map(limpia)
    .filter((title) => title.length > 0);
}

/**
 * Titula cada documento con su primer encabezado, PERO una carpeta puede tener
 * varios ficheros que comparten el primero (fase-02: los 12 ficheros abren con
 * "FASE 2 - CICLO DE VIDA..." y lo que los distingue es el segundo, "E1 -
 * NACIMIENTO"). Con el titulo repetido, el dedupe por titulo se comeria once
 * de los doce, asi que a los que chocan se les anade el primer encabezado que
 * no comparten.
 */
function titula(documentos) {
  const porTitulo = new Map();
  for (const doc of documentos) {
    const base = doc.headings[0] ?? path.basename(doc.file, ".md");
    if (!porTitulo.has(base)) porTitulo.set(base, []);
    porTitulo.get(base).push(doc);
  }

  for (const [base, grupo] of porTitulo) {
    if (grupo.length === 1) {
      grupo[0].title = base.slice(0, 255);
      continue;
    }
    for (const doc of grupo) {
      const distintivo = doc.headings.slice(1).find((heading) => heading !== base);
      doc.title = (distintivo ? `${base} — ${distintivo}` : path.basename(doc.file, ".md"))
        .slice(0, 255);
    }
  }

  return documentos;
}

async function resolveToken() {
  if (process.env.KNOWLEDGE_ADMIN_TOKEN) return process.env.KNOWLEDGE_ADMIN_TOKEN;

  const email = process.env.KNOWLEDGE_ADMIN_EMAIL;
  const password = process.env.KNOWLEDGE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "falta KNOWLEDGE_ADMIN_TOKEN o KNOWLEDGE_ADMIN_EMAIL + KNOWLEDGE_ADMIN_PASSWORD",
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login fallido: ${error.message}`);
  return data.session.access_token;
}

const files = (await readdir(folder))
  .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
  .sort(new Intl.Collator("es", { numeric: true }).compare);

if (files.length === 0) {
  console.error(`sin .md en ${folder}`);
  process.exit(1);
}

const leidos = [];
const porChecksum = new Map();

for (const file of files) {
  const content = await readFile(path.join(folder, file), "utf8");
  // Ficheros identicos en la misma carpeta (una descarga repetida) son UN
  // documento: ingerirlos dos veces duplica el corpus y reparte la busqueda
  // entre dos copias del mismo texto.
  const checksum = createHash("sha256").update(content).digest("hex");
  const gemelo = porChecksum.get(checksum);
  if (gemelo) {
    console.log(`IDENTICO a "${gemelo}", se ignora: ${file}`);
    continue;
  }
  porChecksum.set(checksum, file);
  leidos.push({ file, content, headings: encabezados(content) });
}

const documentos = titula(leidos);

if (dryRun) {
  let totalChars = 0;
  let totalChunks = 0;
  // Las ventanas de contexto NO se comparten entre documentos: cada uno se
  // embebe aparte, asi que las peticiones se suman por documento.
  let requests = 0;

  for (const doc of documentos) {
    totalChars += doc.content.length;
    totalChunks += estimateChunks(doc.content.length);
    requests += Math.ceil(estimateChunks(doc.content.length) / 64);
    console.log(
      `${String(doc.content.length).padStart(7)} chars  ~${String(
        estimateChunks(doc.content.length),
      ).padStart(3)} chunks  ~${String(
        estimateTokens(doc.content.length),
      ).padStart(6)} tokens  ${doc.title}`,
    );
  }

  console.log(
    `\nTOTAL ${documentos.length} documentos, ${totalChars} chars, ~${totalChunks} chunks,` +
      ` ~${estimateTokens(totalChars)} tokens de embedding.` +
      `\nVoyage: ~${requests} peticiones a /contextualizedembeddings` +
      ` (max 64 fragmentos por ventana), 1 documento cada ${delayMs}ms.`,
  );
  process.exit(0);
}

const token = await resolveToken();
const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };

// knowledge_documents no tiene unique por checksum: reejecutar duplicaria el
// corpus. Se salta por titulo ya presente.
// ponytail: dedupe por titulo. Si hace falta reingestar de verdad, archivar
// el documento viejo desde /admin/conocimiento y volver a lanzar.
const listed = await fetch(`${apiUrl}/v1/organizations/global/knowledge/documents`, { headers });
if (!listed.ok) {
  console.error(`no se pudo listar lo ya ingestado: ${listed.status} ${await listed.text()}`);
  process.exit(1);
}
const existing = new Set(
  ((await listed.json()).documents ?? [])
    .filter((document) => document.status !== "archived")
    .map((document) => document.title),
);

let ingested = 0;
let skipped = 0;

for (const { file, content, title } of documentos) {
  if (existing.has(title)) {
    skipped += 1;
    console.log(`SALTADO ${file} (ya existe: "${title}")`);
    continue;
  }

  const started = Date.now();
  const response = await fetch(`${apiUrl}/v1/organizations/global/knowledge/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: path.join(folder, file),
      content,
      source_type: "upload",
      audience,
    }),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`FALLO ${file}: ${response.status} ${JSON.stringify(body)}`);
    continue;
  }

  existing.add(title);
  ingested += 1;
  console.log(
    `OK ${file} -> ${body.chunk_count} chunks, ${body.embedding_model}, audience ${body.audience}, ${(
      (Date.now() - started) / 1000
    ).toFixed(1)}s`,
  );

  if (ingested >= limit) {
    console.log(`\nlimite de ${limit} alcanzado, parando`);
    break;
  }

  if (delayMs > 0) await sleep(delayMs);
}

console.log(`\n${ingested} ingestados, ${skipped} saltados, de ${files.length} ficheros`);
