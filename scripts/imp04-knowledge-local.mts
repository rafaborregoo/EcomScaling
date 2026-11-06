import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import {
  chunkText,
  createRagEmbeddingProvider,
  RAG_EMBEDDING_PROFILE,
} from "@e-nora/ai";
import { embedChunksInOrder } from "../apps/api/src/embedding-batching.js";
import { loadKnowledgeRelease } from "./knowledge-release.mjs";
import { checksumDe } from "./ingest-conocimiento.mjs";

const output = "tmp/imp04-2026-11-03";
const container = "supabase_db_E-NORA";
const database = `enora_imp04_test_${randomBytes(6).toString("hex")}`;
const org = "10000000-0000-4000-8000-000000000001",
  otherOrg = "10000000-0000-4000-8000-000000000002";
const store = "20000000-0000-4000-8000-000000000001",
  otherStore = "20000000-0000-4000-8000-000000000002";
let created = false,
  requests = 0;
const results: Array<{ name: string; ok: boolean; detail?: unknown }> = [];
const retrievalEvidence: Array<unknown> = [];
const quote = (value: unknown) =>
  value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const sql = (text: string, db = database) => {
  assert.ok(db === database || db === "postgres");
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input: text, encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  ).trim();
};
const json = (query: string) => JSON.parse(sql(query));
const check = (name: string, work: () => unknown) => {
  work();
  results.push({ name, ok: true });
  console.log(`OK ${name}`);
};

await mkdir(output, { recursive: true });
const release = await loadKnowledgeRelease(process.cwd());
const bases = JSON.parse(await readFile(release.manifest.bases_file, "utf8"));
const env = parse(await readFile(".env.local", "utf8"));
if (!env.VOYAGE_API_KEY)
  throw Error("VOYAGE_API_KEY is required; no synthetic embedding fallback.");
const provider = createRagEmbeddingProvider(env.VOYAGE_API_KEY);
const cacheFile = `${output}/voyage-cache.json`;
let cache: Record<string, number[][]> = {};
try {
  const saved = JSON.parse(await readFile(cacheFile, "utf8"));
  if (
    saved.model === provider.model &&
    saved.chunking === RAG_EMBEDDING_PROFILE.version
  )
    cache = saved.vectors;
} catch {}
const cacheSave = () =>
  writeFile(
    cacheFile,
    JSON.stringify({
      model: provider.model,
      chunking: RAG_EMBEDDING_PROFILE.version,
      vectors: cache,
    }),
  );
const vectors = async (content: string, type: "document" | "query") => {
  const texts = type === "document" ? chunkText(content) : [content];
  const key = `${type}:${checksumDe(content)}`;
  if (!cache[key]) {
    if (++requests > 40) throw Error("Embedding request budget exceeded.");
    cache[key] =
      type === "document"
        ? await embedChunksInOrder(texts, provider)
        : await provider.embed(texts, "query");
    await cacheSave();
  }
  assert.equal(cache[key]!.length, texts.length);
  for (const vector of cache[key]!)
    assert.ok(vector.length === 1024 && vector.every(Number.isFinite));
  return { texts, vectors: cache[key]! };
};
const material = new Map<string, Awaited<ReturnType<typeof vectors>>>();
const before = new Map<string, Awaited<ReturnType<typeof vectors>>>();
const queries = new Map<string, number[]>();
const chars = release.documents.reduce(
  (n: any, d: any) =>
    n + d.content.length + (bases[d.path]?.content.length ?? 0),
  0,
);
assert.ok(chars < 200000, "Corpus exceeds the bounded validation budget.");

try {
  for (const doc of release.documents) {
    console.log(`Voyage ${doc.path}`);
    material.set(doc.path, await vectors(doc.content, "document"));
    if (doc.base)
      before.set(doc.path, await vectors(doc.base.content.trim(), "document"));
  }
  for (const query of release.manifest.questions) {
    console.log(`Voyage ${query.id}`);
    queries.set(query.id, (await vectors(query.question, "query")).vectors[0]!);
  }
  const endpoint = execFileSync(
    "docker",
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8" },
  ).trim();
  assert.match(endpoint, /^(npipe:\/\/|unix:\/\/)/);
  assert.match(database, /^enora_imp04_test_[a-f0-9]{12}$/);
  sql(`create database "${database}" template template0;`, "postgres");
  created = true;
  sql(await readFile("scripts/fixtures/imp04-knowledge-schema.sql", "utf8"));
  const extract = (source: string, name: string) => {
    const at = source.indexOf(`create or replace function public.${name}(`);
    assert.ok(at >= 0);
    return source.slice(at, source.indexOf("$$;", at) + 3);
  };
  const indexing = await readFile(
    "supabase/migrations/20261229100000_a08_privacy_digest_atomic_index.sql",
    "utf8",
  );
  const search = await readFile(
    "supabase/migrations/20260910120000_ai_04_retrieval_espanol_y_rrf.sql",
    "utf8",
  );
  sql(
    extract(indexing, "create_knowledge_document_index") +
      extract(indexing, "replace_knowledge_document_index") +
      extract(search, "knowledge_search_hybrid"),
  );
  const ids = new Map<string, string>();
  const chunks = (data: Awaited<ReturnType<typeof vectors>>) =>
    JSON.stringify(
      data.texts.map((content, index) => ({
        chunk_index: index,
        content,
        token_count: Math.ceil(content.length / 4),
        embedding: JSON.stringify(data.vectors[index]),
      })),
    );
  const create = (
    doc: any,
    data: Awaited<ReturnType<typeof vectors>>,
    visibility = "global",
    audience = "consultant_only",
    organization: string | null = null,
    shop: string | null = null,
  ) => {
    const row = json(
      `select row_to_json(d) from public.create_knowledge_document_index(${quote(organization)},${quote(shop)},${quote(doc.title)},${quote(doc.path)},'upload',${quote(visibility)},${quote(audience)},${quote(doc.content)},${quote(checksumDe(doc.content))},${quote(provider.model)},null,${quote(chunks(data))}::jsonb)d;`,
    );
    return row.id as string;
  };
  const replace = (
    id: string,
    version: number,
    content: string,
    data: Awaited<ReturnType<typeof vectors>>,
  ) =>
    json(
      `select to_jsonb(public.replace_knowledge_document_index('${id}',${version},${quote(content)},${quote(checksumDe(content))},${quote(provider.model)},${quote(chunks(data))}::jsonb));`,
    );
  for (const doc of release.documents) {
    let id: string;
    if (doc.base) {
      id = create(
        { ...doc, content: doc.base.content.trim() },
        before.get(doc.path)!,
      );
      assert.equal(replace(id, 1, doc.content, material.get(doc.path)!), true);
    } else id = create(doc, material.get(doc.path)!);
    ids.set(doc.path, id);
  }
  check(
    "nine targets have one active version each and the configured Voyage space",
    () => {
      const rows = json(
        "select jsonb_build_object('documents',count(*),'models',jsonb_agg(distinct embedding_model),'missing',(select count(*) from public.knowledge_chunks where embedding is null)) from public.knowledge_documents where status='active';",
      );
      assert.equal(rows.documents, 9);
      assert.deepEqual(rows.models, [provider.model]);
      assert.equal(rows.missing, 0);
    },
  );
  const retrieve = (
    embedding: number[],
    question: string,
    tenant = org,
    shop: string | null = store,
    audiences = ["client_visible", "consultant_only"],
  ) =>
    json(
      `select coalesce(jsonb_agg(t),'[]'::jsonb) from (select * from public.knowledge_search_hybrid('${tenant}',${quote(JSON.stringify(embedding))}::extensions.vector,${quote(question)},array[${audiences.map(quote).join(",")}],${quote(shop)},8))t;`,
    );
  for (const query of release.manifest.questions) {
    const hits = retrieve(queries.get(query.id)!, query.question);
    const expected = query.expected_paths.map((p: string) => ids.get(p));
    check(`retrieval ${query.id}`, () => {
      assert.ok(
        hits.some((h: any) => expected.includes(h.document_id)),
        `Expected document missing for ${query.id}`,
      );
      for (const hit of hits) {
        const doc = release.documents.find(
          (d: any) => ids.get(d.path) === hit.document_id,
        );
        assert.ok(
          doc &&
            hit.document_title === doc.title &&
            material.get(doc.path)!.texts[hit.chunk_index] === hit.content,
          "Citation must resolve to the exact current chunk",
        );
      }
    });
    retrievalEvidence.push({
      id: query.id,
      question: query.question,
      expected_paths: query.expected_paths,
      matched_rank:
        1 + hits.findIndex((h: any) => expected.includes(h.document_id)),
      citations_verified: true,
    });
  }
  const first = release.documents[0],
    firstId = ids.get(first.path)!;
  check(
    "stale replacement leaves the document and its chunks unchanged",
    () => {
      const old = json(
        `select row_to_json(d) from (select version,checksum,(select count(*) from public.knowledge_chunks c where c.document_id=d.id) as chunks from public.knowledge_documents d where id='${firstId}')d;`,
      );
      assert.equal(
        replace(
          firstId,
          999,
          "invalid stale version",
          material.get(first.path)!,
        ),
        false,
      );
      assert.deepEqual(
        json(
          `select row_to_json(d) from (select version,checksum,(select count(*) from public.knowledge_chunks c where c.document_id=d.id) as chunks from public.knowledge_documents d where id='${firstId}')d;`,
        ),
        old,
      );
    },
  );
  check(
    "an invalid vector rolls back the complete replacement transaction",
    () => {
      const query = `select row_to_json(d) from (select version,checksum,(select jsonb_agg(jsonb_build_array(c.id,c.content,c.embedding::text) order by c.chunk_index) from public.knowledge_chunks c where c.document_id=d.id) as chunks from public.knowledge_documents d where id='${firstId}')d;`;
      const old = json(query);
      const broken = JSON.stringify([
        {
          chunk_index: 0,
          content: "would replace",
          embedding: JSON.stringify(material.get(first.path)!.vectors[0]),
        },
        { chunk_index: 1, content: "invalid", embedding: "[1,2]" },
      ]);
      assert.throws(() =>
        sql(
          `select public.replace_knowledge_document_index('${firstId}',2,'invalid vector','invalid checksum',${quote(provider.model)},${quote(broken)}::jsonb);`,
        ),
      );
      assert.deepEqual(json(query), old);
    },
  );
  const q = release.manifest.questions[0],
    v = queries.get(q.id)!;
  const sample = material.get(first.path)!;
  const own = create(
    {
      path: "synthetic/own",
      title: "Synthetic client-visible",
      content: first.content,
    },
    sample,
    "organization",
    "client_visible",
    org,
    store,
  );
  const foreign = create(
    {
      path: "synthetic/foreign",
      title: "Synthetic foreign organization",
      content: first.content,
    },
    sample,
    "organization",
    "client_visible",
    otherOrg,
    store,
  );
  const other = create(
    {
      path: "synthetic/store",
      title: "Synthetic other store",
      content: first.content,
    },
    sample,
    "organization",
    "client_visible",
    org,
    otherStore,
  );
  const internal = create(
    {
      path: "synthetic/internal",
      title: "Synthetic internal",
      content: first.content,
    },
    sample,
    "organization",
    "consultant_only",
    org,
    store,
  );
  const system = create(
    {
      path: "synthetic/system",
      title: "Synthetic system",
      content: first.content,
    },
    sample,
    "global",
    "system_only",
  );
  check(
    "retrieval preserves organization, store and audience with an adversarial identical embedding",
    () => {
      const rows = retrieve(v, q.question, org, store, ["client_visible"]);
      assert.ok(rows.some((h: any) => h.document_id === own));
      for (const denied of [foreign, other, internal, system])
        assert.ok(!rows.some((h: any) => h.document_id === denied));
    },
  );
  check(
    "authenticated RLS cannot expand scope by passing another tenant to the RPC",
    () => {
      const rows =
        json(`begin; set local role authenticated; do $$ begin perform set_config('imp04.organization_id','${org}',true);
      perform set_config('imp04.store_id','${store}',true); end $$;
      select coalesce(jsonb_agg(t),'[]'::jsonb) from (select * from public.knowledge_search_hybrid('${otherOrg}',${quote(JSON.stringify(v))}::extensions.vector,${quote(q.question)},array['client_visible','consultant_only','system_only'],null,50))t; rollback;`);
      assert.ok(
        !rows.some((h: any) =>
          [foreign, internal, system].includes(h.document_id),
        ),
      );
    },
  );
  check(
    "retired, deleted and superseded sources never enter active retrieval",
    () => {
      for (const status of ["archived", "deleted", "superseded"]) {
        sql(
          `update public.knowledge_documents set status='${status}' where id='${own}';`,
        );
        assert.ok(
          !retrieve(v, q.question, org, store, ["client_visible"]).some(
            (h: any) => h.document_id === own,
          ),
        );
      }
    },
  );
  sql(
    `delete from public.knowledge_documents where id in ('${own}','${foreign}','${other}','${internal}','${system}');`,
  );
  check(
    "rollback restores the six previous contents and retires the three new documents",
    () => {
      for (const doc of release.documents) {
        const id = ids.get(doc.path)!;
        if (doc.base)
          assert.equal(
            replace(id, 2, doc.base.content.trim(), before.get(doc.path)!),
            true,
          );
        else
          sql(
            `update public.knowledge_documents set status='archived' where id='${id}';`,
          );
      }
      const state = json(
        "select jsonb_agg(jsonb_build_object('description',description,'version',version,'checksum',checksum,'status',status)) from public.knowledge_documents;",
      );
      for (const doc of release.documents) {
        const row = state.find((r: any) => r.description === doc.path);
        assert.equal(row.status, doc.base ? "active" : "archived");
        if (doc.base) {
          assert.equal(row.checksum, doc.base.checksum);
          assert.equal(row.version, 3);
        }
      }
    },
  );
  check("rollback also removes all new document IDs from retrieval", () => {
    const rows = retrieve(v, q.question);
    for (const doc of release.documents.filter((d: any) => !d.base))
      assert.ok(!rows.some((h: any) => h.document_id === ids.get(doc.path)));
  });
  await writeFile(
    `${output}/local-validation.json`,
    JSON.stringify(
      {
        status: "passed",
        release_digest: release.digest,
        profile: RAG_EMBEDDING_PROFILE,
        checks: results,
        retrieval: retrievalEvidence,
        voyage_requests_this_run: requests,
        cached_inputs: Object.keys(cache).length,
        corpus_chars: chars,
        scope:
          "isolated local PostgreSQL with real Voyage vectors; no remote database writes",
      },
      null,
      2,
    ) + "\n",
  );
} catch (error) {
  await writeFile(
    `${output}/local-validation.json`,
    JSON.stringify(
      {
        status: "failed",
        release_digest: release.digest,
        checks: results,
        error: (error as Error).message,
        voyage_requests_this_run: requests,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  if (created) {
    assert.match(database, /^enora_imp04_test_[a-f0-9]{12}$/);
    sql(`drop database "${database}";`, "postgres");
  }
}
