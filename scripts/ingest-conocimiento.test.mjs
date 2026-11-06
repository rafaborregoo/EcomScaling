import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { capaPermitida, checksumDe, executePlan, normalizaRuta, planSync } from "./ingest-conocimiento.mjs";

const SCOPE = "conocimiento/fase-10/01-rag-produccion";
const ruta = (file, scope = SCOPE) => `${scope}/${file}`;
const winRuta = (file) => ruta(file).replaceAll("/", "\\");
const doc = (id, file, checksum, extra = {}) => ({
  id,
  title: `T ${file}`,
  description: winRuta(file),
  status: "active",
  checksum,
  ...extra,
});
const local = (file, checksum) => ({ path: ruta(file), title: `T ${file}`, checksum });

test("capas: solo 01-rag-produccion; 00-corpus-maestro exige --legacy-corpus", () => {
  assert.equal(capaPermitida(SCOPE).ok, true);
  assert.equal(capaPermitida(`${SCOPE}/`).ok, true);
  assert.equal(capaPermitida("conocimiento/fase-01/00-corpus-maestro").ok, false);
  assert.equal(capaPermitida("conocimiento/fase-01/00-corpus-maestro", { legacyCorpus: true }).ok, true);
  for (const capa of [
    "00-corpus-maestro",
    "02-contratos-IA",
    "03-runtime",
    "04-policies-guardrails",
    "05-experience-learning",
    "06-tenant-context",
    "99-auditoria",
    "contexto-RAG",
  ]) {
    assert.equal(capaPermitida(`conocimiento/fase-10/${capa}`).ok, false, capa);
  }
});

test("checksum igual al de la API (sha256 del contenido recortado)", () => {
  const api = createHash("sha256").update("hola").digest("hex");
  assert.equal(checksumDe("\nhola\n"), api);
  assert.equal(normalizaRuta(".\\a\\b\\"), "a/b");
  assert.equal(normalizaRuta("conocimiento\\\\fase-05\\\\01-rag-produccion\\\\a.md"), "conocimiento/fase-05/01-rag-produccion/a.md");
});

test("a selected release never prunes unrelated documents in its folder",()=>{
  const plan=planSync({scope:SCOPE,local:[local("a.md","next")],remote:[doc("a","a.md","old"),doc("untouched","b.md","other")],prune:false});
  assert.equal(plan.update[0].id,"a");assert.deepEqual(plan.archive,[]);
});
test("failed or limited imports never perform the final archive phase",async()=>{
  const plan=planSync({scope:SCOPE,local:[local("a.md","new"),local("b.md","new")],remote:[doc("old","old.md","old")]});
  const limited=fakeApi();await executePlan(plan,limited,{limit:1,log:()=>{}});
  assert.ok(limited.calls.every(([kind])=>kind!=="archive"));
  const failed=fakeApi();failed.create=async()=>{throw Error("provider unavailable");};
  await executePlan(plan,failed,{log:()=>{}});assert.deepEqual(failed.calls,[]);
});

test("plan: CREATE, UPDATE, UNCHANGED y ARCHIVE por ruta + checksum", () => {
  const plan = planSync({
    scope: SCOPE,
    local: [local("nuevo.md", "c1"), local("igual.md", "c2"), local("cambiado.md", "c3-nuevo")],
    remote: [doc("id-igual", "igual.md", "c2"), doc("id-cambiado", "cambiado.md", "c3-viejo"), doc("id-borrado", "borrado.md", "c4")],
  });
  assert.deepEqual(plan.create.map((e) => e.path), [ruta("nuevo.md")]);
  assert.deepEqual(plan.unchanged.map((e) => e.id), ["id-igual"]);
  assert.deepEqual(plan.update.map((e) => [e.id, e.from, e.to]), [["id-cambiado", "c3-viejo", "c3-nuevo"]]);
  assert.deepEqual(plan.archive.map((e) => e.id), ["id-borrado"]);
  assert.deepEqual(plan.error, []);
});

test("plan: nunca archiva fuera del scope, ni subcarpetas, ni documentos ya archivados", () => {
  const plan = planSync({
    scope: SCOPE,
    local: [local("a.md", "x")],
    remote: [
      doc("otra-fase", "b.md", "y", { description: "conocimiento\\fase-09\\01-rag-produccion\\b.md" }),
      doc("otra-capa", "c.md", "y", { description: "conocimiento\\fase-10\\00-corpus-maestro\\c.md" }),
      doc("subcarpeta", "d.md", "y", { description: `${SCOPE}/sub/d.md` }),
      doc("sin-ruta", "e.md", "y", { description: null }),
      doc("ya-archivado", "f.md", "y", { status: "archived" }),
    ],
  });
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.create.map((e) => e.path), [ruta("a.md")]);
});

test("plan: checksum remoto desconocido -> UPDATE, nunca un segundo documento", () => {
  const plan = planSync({ scope: SCOPE, local: [local("a.md", "x")], remote: [doc("id-a", "a.md", null)] });
  assert.equal(plan.create.length, 0);
  assert.deepEqual(plan.update.map((e) => e.id), ["id-a"]);
});

test("plan: titulo cogido por otra ruta -> ERROR; renombrado dentro del scope -> CREATE que archiva el viejo", () => {
  const colision = planSync({
    scope: SCOPE,
    local: [{ path: ruta("a.md"), title: "Compartido", checksum: "x" }],
    remote: [doc("ajeno", "z.md", "y", { title: "Compartido", description: "conocimiento/fase-09/01-rag-produccion/z.md" })],
  });
  assert.equal(colision.create.length, 0);
  assert.match(colision.error[0].motivo, /ya usado por conocimiento\/fase-09/);

  const renombrado = planSync({
    scope: SCOPE,
    local: [{ path: ruta("nuevo-nombre.md"), title: "Mismo", checksum: "x" }],
    remote: [doc("viejo", "viejo-nombre.md", "x", { title: "Mismo" })],
  });
  assert.deepEqual(renombrado.archive.map((e) => e.id), ["viejo"]);
  assert.equal(renombrado.create[0].replaces, "viejo");
});

test("plan: dos documentos activos con la misma ruta -> ERROR, no se toca ninguno", () => {
  const plan = planSync({
    scope: SCOPE,
    local: [local("a.md", "x")],
    remote: [doc("d1", "a.md", "x"), doc("d2", "a.md", "y", { title: "otro" })],
  });
  assert.equal(plan.error.length, 1);
  assert.equal(plan.update.length + plan.unchanged.length + plan.create.length, 0);
});

function fakeApi() {
  const calls = [];
  return {
    calls,
    create: async (entry) => (calls.push(["create", entry.path]), { document_id: `new:${entry.path}`, chunk_count: 2 }),
    update: async (id) => (calls.push(["update", id]), { version: 2, chunk_count: 3 }),
    archive: async (id) => (calls.push(["archive", id]), { status: "archived" }),
  };
}

test("ejecucion: UPDATE por PATCH del mismo id, UNCHANGED sin llamadas, ARCHIVE al final", async () => {
  const plan = planSync({
    scope: SCOPE,
    local: [local("nuevo.md", "c1"), local("igual.md", "c2"), local("cambiado.md", "c3")],
    remote: [doc("id-igual", "igual.md", "c2"), doc("id-cambiado", "cambiado.md", "viejo"), doc("id-borrado", "borrado.md", "c4")],
  });
  const api = fakeApi();
  const manifest = await executePlan(plan, api, { log: () => {} });
  assert.deepEqual(api.calls, [
    ["update", "id-cambiado"],
    ["create", ruta("nuevo.md")],
    ["archive", "id-borrado"],
  ]);
  assert.deepEqual(manifest.updated, [{ id: "id-cambiado", path: ruta("cambiado.md"), version: 2, chunks: 3 }]);
  assert.equal(manifest.unchanged[0].id, "id-igual");
  assert.equal(manifest.created[0].id, `new:${ruta("nuevo.md")}`);
  assert.equal(manifest.archived[0].id, "id-borrado");
});

test("ejecucion: el renombrado archiva antes de crear (libera el titulo unico)", async () => {
  const plan = planSync({
    scope: SCOPE,
    local: [{ path: ruta("nuevo.md"), title: "Mismo", checksum: "x" }],
    remote: [doc("viejo", "viejo.md", "x", { title: "Mismo" })],
  });
  const api = fakeApi();
  await executePlan(plan, api, { log: () => {} });
  assert.deepEqual(api.calls, [["archive", "viejo"], ["create", ruta("nuevo.md")]]);
});

test("ejecucion: --limit corta los embeddings y un fallo no para el resto", async () => {
  const plan = planSync({ scope: SCOPE, local: [local("a.md", "1"), local("b.md", "2"), local("c.md", "3")], remote: [] });
  const limited = fakeApi();
  await executePlan(plan, limited, { limit: 1, log: () => {} });
  assert.deepEqual(limited.calls, [["create", ruta("a.md")]]);

  const failing = fakeApi();
  failing.create = async (entry) => {
    failing.calls.push(["create", entry.path]);
    if (entry.path.endsWith("a.md")) throw new Error("503");
    return { document_id: "ok", chunk_count: 1 };
  };
  const manifest = await executePlan(plan, failing, { log: () => {} });
  assert.equal(manifest.created.length, 2);
  assert.deepEqual(manifest.errors, [{ path: ruta("a.md"), motivo: "503" }]);
});
