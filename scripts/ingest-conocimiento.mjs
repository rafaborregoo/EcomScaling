// Sincroniza una carpeta de conocimiento/ con el conocimiento GLOBAL de la BD
// (visibility 'global', organization_id null). Un fichero = un documento; el
// titulo sale del primer `# ` o del nombre del fichero.
//
// Uso:
//   npm run conocimiento:ingest -- conocimiento/fase-10/01-rag-produccion --dry-run
//   npm run conocimiento:ingest -- conocimiento/fase-10/01-rag-produccion
//   npm run conocimiento:ingest -- <carpeta> --limit=N   como mucho N create+update
//   npm run conocimiento:ingest -- conocimiento/fase-01/00-corpus-maestro --legacy-corpus
//
// La carpeta ES el scope: solo se crean, actualizan o archivan documentos
// cuya ruta (columna `description`) cuelga directamente de ella. Nada fuera
// del scope se toca. Para cada .md el plan decide:
//   CREATE     no hay documento activo con esa ruta
//   UPDATE     existe y su checksum difiere -> PATCH: sube version, rechunkea,
//              reembebe y sustituye los chunks (mismo documento, no uno nuevo)
//   UNCHANGED  mismo checksum -> no se llama a Voyage
//   ARCHIVE    documento activo del scope cuyo .md ya no existe
//   ERROR      conflicto que no se resuelve solo (titulo usado por otra ruta,
//              dos documentos activos con la misma ruta, fallo HTTP)
// --dry-run lee la BD y enseña el plan sin escribir nada.
//
// Identidad = ruta relativa (description) + titulo unico entre globales
// activos (indice knowledge_documents_global_titulo_unico). Con eso basta: no
// hace falta columna nueva.
//
// Auth: CREATE/UPDATE van por la API (es la que embebe), con
// KNOWLEDGE_ADMIN_TOKEN o KNOWLEDGE_ADMIN_EMAIL/KNOWLEDGE_ADMIN_PASSWORD de
// una cuenta platform_admin. Leer el estado (con checksum) y ARCHIVE van con
// SUPABASE_SERVICE_ROLE_KEY, como scripts/archiva-conocimiento-global.mjs:
// archivar solo cambia `status`, no necesita embeddings.
//
// Limites de Voyage: la API reintenta los 429 dentro de una peticion, pero eso
// no evita agotar el ritmo por minuto encadenando documentos. Por eso:
// secuencial, pausa entre documentos (INGEST_DELAY_MS) y `--limit`.
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Solo 01-rag-produccion es RAG de produccion (conocimiento/README.md). Lista
// blanca, no negra: contratos, runtime, policies, experience, tenant y
// auditoria nunca se indexan. 00-corpus-maestro solo con --legacy-corpus:
// fase-01 y fase-02 no tienen destilado y su conocimiento vivo sigue saliendo
// de ahi (verificado en BD 2026-09-29); ninguna otra fase debe usarlo.
// `contexto-RAG` se retiro: no queda carpeta ni documento con esa ruta.
export const CAPA_RAG = "01-rag-produccion";
export const CAPA_LEGACY = "00-corpus-maestro";

export function capaPermitida(folder, { legacyCorpus = false } = {}) {
  const hoja = normalizaRuta(folder).split("/").pop();
  if (hoja === CAPA_RAG) return { ok: true };
  if (hoja === CAPA_LEGACY && legacyCorpus) return { ok: true };
  return {
    ok: false,
    motivo:
      hoja === CAPA_LEGACY
        ? `${folder} es corpus maestro: no es RAG de produccion. Solo fase-01/fase-02 lo usan, y exige --legacy-corpus.`
        : `${folder} no es una carpeta indexable. Solo se ingesta ${CAPA_RAG}.`,
  };
}

/** Rutas comparables entre Windows (description con `\`) y POSIX. */
export function normalizaRuta(ruta) {
  return String(ruta ?? "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

// Mismo calculo que createKnowledgeDocument/updateKnowledgeDocument (trim).
export const checksumDe = (content) =>
  createHash("sha256").update(content.trim()).digest("hex");

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
 * "FASE 2 - CICLO DE VIDA..." y lo que los distingue es el segundo). A los que
 * chocan se les anade el primer encabezado que no comparten.
 */
export function titula(documentos) {
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

const VIVO = (doc) => doc.status !== "archived" && doc.status !== "superseded";

/**
 * Plan puro repo -> BD. `local`: [{ path, title, checksum }] del scope.
 * `remote`: documentos globales de la BD [{ id, title, description, status,
 * checksum }]; checksum null = desconocido (se trata como cambiado).
 */
export function planSync({ scope, local, remote, prune = true }) {
  const raiz = normalizaRuta(scope);
  const vivos = remote.filter(VIVO).map((doc) => ({ ...doc, path: normalizaRuta(doc.description) }));
  const porRuta = new Map();
  for (const doc of vivos) {
    if (!porRuta.has(doc.path)) porRuta.set(doc.path, []);
    porRuta.get(doc.path).push(doc);
  }

  const rutasLocales = new Set(local.map((doc) => normalizaRuta(doc.path)));
  const plan = { create: [], update: [], unchanged: [], archive: [], error: [] };

  // Solo hijos directos del scope: la lectura local no es recursiva, asi que
  // un subdirectorio no leido nunca cuenta como "borrado".
  for (const doc of vivos) {
    if (prune && path.posix.dirname(doc.path) === raiz && !rutasLocales.has(doc.path)) {
      plan.archive.push({ id: doc.id, path: doc.path, title: doc.title });
    }
  }
  const titulosLiberados = new Map(plan.archive.map((doc) => [doc.title, doc.id]));

  for (const item of local) {
    const ruta = normalizaRuta(item.path);
    const coincidencias = porRuta.get(ruta) ?? [];

    if (coincidencias.length > 1) {
      plan.error.push({
        path: ruta,
        motivo: `${coincidencias.length} documentos activos con la misma ruta (${coincidencias
          .map((doc) => doc.id)
          .join(", ")}): archivar el sobrante a mano`,
      });
      continue;
    }

    const [existente] = coincidencias;
    if (existente) {
      if (existente.checksum && existente.checksum === item.checksum) {
        plan.unchanged.push({ id: existente.id, path: ruta, title: existente.title });
      } else {
        plan.update.push({
          id: existente.id,
          path: ruta,
          title: item.title,
          remoteTitle: existente.title,
          from: existente.checksum ?? null,
          to: item.checksum,
        });
      }
      continue;
    }

    // Sin documento en esta ruta: el titulo no puede estar cogido por otra
    // (indice unico). Si lo tiene un documento del scope que se archiva en
    // este mismo plan, es un renombrado: se archiva antes de crear.
    const duenoTitulo = vivos.find((doc) => doc.title === item.title);
    if (duenoTitulo && !titulosLiberados.has(item.title)) {
      plan.error.push({
        path: ruta,
        motivo: `titulo "${item.title}" ya usado por ${duenoTitulo.path || duenoTitulo.id}`,
      });
      continue;
    }
    plan.create.push({
      path: ruta,
      title: item.title,
      to: item.checksum,
      ...(duenoTitulo ? { replaces: titulosLiberados.get(item.title) } : {}),
    });
  }

  return plan;
}

/**
 * Aplica un plan con un cliente de API inyectable. Orden: UPDATE, CREATE (un
 * renombrado archiva primero el documento cuyo titulo reutiliza) y el resto
 * de ARCHIVE al final, para no dejar huecos si algo falla a mitad.
 */
export async function executePlan(plan, api, { limit = Infinity, delayMs = 0, log = console.log } = {}) {
  const manifest = { created: [], updated: [], unchanged: plan.unchanged, archived: [], errors: [...plan.error] };
  const archivados = new Set();
  let embebidos = 0;
  let fallosSeguidos = 0;
  const MAX_FALLOS_SEGUIDOS = 3;

  const registraFallo = (entry, error) => {
    manifest.errors.push({ path: entry.path, motivo: String(error?.message ?? error) });
    fallosSeguidos += 1;
    // Una clave invalida o un limite de Voyage no se arreglan solos a mitad de
    // carpeta: tres seguidos y se para en vez de gastar peticiones.
    return fallosSeguidos >= MAX_FALLOS_SEGUIDOS;
  };

  const archiva = async (entry) => {
    if (archivados.has(entry.id)) return;
    await api.archive(entry.id);
    archivados.add(entry.id);
    manifest.archived.push({ id: entry.id, path: entry.path, title: entry.title });
    log(`ARCHIVED ${entry.path} (${entry.id})`);
  };

  const trabajos = [
    ...plan.update.map((entry) => ({ kind: "update", entry })),
    ...plan.create.map((entry) => ({ kind: "create", entry })),
  ];

  for (const { kind, entry } of trabajos) {
    if (embebidos >= limit) {
      log(`limite de ${limit} alcanzado: ${entry.path} queda pendiente`);
      continue;
    }
    try {
      if (kind === "update") {
        const body = await api.update(entry.id, entry);
        manifest.updated.push({ id: entry.id, path: entry.path, version: body.version, chunks: body.chunk_count });
        log(`UPDATED ${entry.path} -> v${body.version}, ${body.chunk_count} chunks`);
      } else {
        const reemplazado = plan.archive.find((doc) => doc.id === entry.replaces);
        if (reemplazado) await archiva(reemplazado);
        const body = await api.create(entry);
        manifest.created.push({ id: body.document_id, path: entry.path, chunks: body.chunk_count });
        log(`CREATED ${entry.path} -> ${body.document_id}, ${body.chunk_count} chunks`);
      }
      embebidos += 1;
      fallosSeguidos = 0;
    } catch (error) {
      log(`ERROR ${entry.path}: ${error?.message ?? error}`);
      if (registraFallo(entry, error)) {
        log("3 fallos seguidos: se para para no gastar mas peticiones.");
        return manifest;
      }
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  // An incomplete/failed import cannot retire the knowledge it was meant to replace.
  if (manifest.errors.length || embebidos < trabajos.length) return manifest;
  for (const entry of plan.archive) {
    try {
      await archiva(entry);
    } catch (error) {
      log(`ERROR archivando ${entry.path}: ${error?.message ?? error}`);
      registraFallo(entry, error);
    }
  }

  return manifest;
}

// Estimacion, no medicion: ~4 chars por token, el mismo ratio que usa
// createKnowledgeDocument para token_count.
const estimateTokens = (chars) => Math.ceil(chars / 4);
const estimateChunks = (chars) => Math.ceil(chars / 1300);

export function imprimePlan(plan, contenidos, log = console.log) {
  const seccion = (nombre, filas, linea) => {
    log(`${nombre}: ${filas.length}`);
    for (const fila of filas) log(`  ${linea(fila)}`);
  };
  seccion("CREATE", plan.create, (e) =>
    `${e.path}  "${e.title}"${e.replaces ? `  (renombrado, archiva ${e.replaces})` : ""}`);
  seccion("UPDATE", plan.update, (e) =>
    `${e.path} -> ${e.id}  checksum ${String(e.from ?? "desconocido").slice(0, 12)} -> ${e.to.slice(0, 12)}` +
    (e.remoteTitle !== e.title ? `  (titulo en BD se conserva: "${e.remoteTitle}")` : ""));
  seccion("UNCHANGED", plan.unchanged, (e) => `${e.path} -> ${e.id}`);
  seccion("ARCHIVE", plan.archive, (e) => `${e.path} -> ${e.id}  "${e.title}"`);
  seccion("ERROR", plan.error, (e) => `${e.path}: ${e.motivo}`);

  const chars = [...plan.create, ...plan.update].reduce((sum, e) => sum + (contenidos.get(e.path)?.length ?? 0), 0);
  log(
    `\nEmbeddings a generar (solo CREATE+UPDATE): ~${estimateChunks(chars)} chunks, ~${estimateTokens(chars)} tokens.`,
  );
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

async function leeLocales(folder) {
  const files = (await readdir(folder))
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .sort(new Intl.Collator("es", { numeric: true }).compare);

  const leidos = [];
  const porChecksum = new Map();
  for (const file of files) {
    const content = await readFile(path.join(folder, file), "utf8");
    // Ficheros identicos en la misma carpeta (una descarga repetida) son UN
    // documento: ingerirlos dos veces reparte la busqueda entre dos copias.
    const checksum = checksumDe(content);
    const gemelo = porChecksum.get(checksum);
    if (gemelo) {
      console.log(`IDENTICO a "${gemelo}", se ignora: ${file}`);
      continue;
    }
    porChecksum.set(checksum, file);
    leidos.push({ file, content, checksum, headings: encabezados(content) });
  }
  return titula(leidos);
}

async function main() {
  const args = process.argv.slice(2);
  const folder = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const legacyCorpus = args.includes("--legacy-corpus");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

  if (!folder || Number.isNaN(limit) || limit < 1) {
    console.error(
      "uso: node scripts/ingest-conocimiento.mjs <carpeta> [--dry-run] [--limit=N] [--legacy-corpus]",
    );
    process.exit(1);
  }

  const capa = capaPermitida(folder, { legacyCorpus });
  if (!capa.ok) {
    console.error(capa.motivo);
    process.exit(1);
  }

  // La ruta del scope es relativa a la raiz del repo (desde donde corre npm),
  // igual que las `description` ya guardadas.
  const scope = normalizaRuta(path.relative(process.cwd(), path.resolve(folder)));
  const documentos = await leeLocales(folder);
  if (documentos.length === 0) {
    // Una carpeta vacia archivaria todo su scope: eso se decide a mano.
    console.error(`sin .md en ${folder}: no se sincroniza (evita archivar el scope entero)`);
    process.exit(1);
  }

  const audience = process.env.KNOWLEDGE_AUDIENCE ?? "consultant_only";
  const apiUrl =
    process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
  const delayMs = Number(process.env.INGEST_DELAY_MS ?? 3000);

  const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: documents, error: listError } = await service
    .from("knowledge_documents")
    .select("id, title, description, status, checksum")
    .eq("visibility", "global")
    .is("organization_id", null);
  if (listError) throw new Error(`no se pudo leer el estado de la BD: ${listError.message}`);

  const local = documentos.map((doc) => ({
    path: `${scope}/${doc.file}`,
    title: doc.title,
    checksum: doc.checksum,
  }));
  const plan = planSync({ scope, local, remote: documents ?? [] });
  const contenidos = new Map(documentos.map((doc) => [`${scope}/${doc.file}`, doc.content]));
  console.log(`Destino: ${apiUrl}  scope: ${scope}  audience: ${audience}${dryRun ? "  [DRY-RUN]" : ""}\n`);
  imprimePlan(plan, contenidos);

  if (dryRun) process.exit(plan.error.length ? 2 : 0);

  const token = await resolveToken();
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const base = `${apiUrl}/v1/organizations/global/knowledge/documents`;
  const pide = async (url, init) => {
    const response = await fetch(url, { headers, ...init });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
    return body;
  };

  const api = {
    create: (entry) =>
      pide(base, {
        method: "POST",
        body: JSON.stringify({
          title: entry.title,
          description: entry.path,
          content: contenidos.get(entry.path),
          source_type: "upload",
          audience,
        }),
      }),
    update: (id, entry) =>
      pide(`${base}/${id}`, { method: "PATCH", body: JSON.stringify({ content: contenidos.get(entry.path) }) }),
    archive: async (id) => {
      const { data, error } = await service
        .from("knowledge_documents")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("visibility", "global")
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(`archive ${id}: ${error?.message ?? "no encontrado"}`);
      return data;
    },
  };

  const manifest = await executePlan(plan, api, { limit, delayMs });
  console.log("\nMANIFIESTO");
  console.log(JSON.stringify({ scope, ...manifest }, null, 2));
  process.exit(manifest.errors.length ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
