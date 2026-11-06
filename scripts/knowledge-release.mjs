import { readFile, realpath, writeFile, mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { RAG_EMBEDDING_PROFILE } from "@e-nora/ai";
import { checksumDe, normalizaRuta, planSync } from "./ingest-conocimiento.mjs";

export const releaseText = (text) => text.replace(/\r\n?/g, "\n").trim();
export const releaseDigest = (value) => checksumDe(JSON.stringify(value));
const digest = releaseDigest;
export const DEFAULT_RELEASE =
  "conocimiento/meta-ads/99-auditoria/release-v1.json";

async function fileInside(root, relative) {
  if (
    typeof relative !== "string" ||
    path.isAbsolute(relative) ||
    /^[a-z]:/i.test(relative) ||
    normalizaRuta(relative).split("/").includes("..")
  )
    throw Error("release_path_outside_workspace");
  const resolved = await realpath(path.resolve(root, relative));
  const from = path.relative(await realpath(root), resolved);
  if (from.startsWith("..") || path.isAbsolute(from))
    throw Error("release_symlink_outside_workspace");
  return readFile(resolved, "utf8");
}

export async function loadKnowledgeRelease(
  root,
  manifestPath = DEFAULT_RELEASE,
) {
  const manifest = JSON.parse(await fileInside(root, manifestPath));
  if (
    manifest.schema_version !== 1 ||
    manifest.visibility !== "global" ||
    manifest.audience !== "consultant_only" ||
    manifest.authority !== "operational" ||
    manifest.profile.model !== RAG_EMBEDDING_PROFILE.model ||
    manifest.profile.dimensions !== RAG_EMBEDDING_PROFILE.dimensions ||
    manifest.profile.chunking !== RAG_EMBEDDING_PROFILE.version
  )
    throw Error("release_contract_or_profile_mismatch");
  if (
    manifest.sources.length !== 30 ||
    new Set(manifest.sources.map((s) => s.id)).size !== 30 ||
    new Set(manifest.targets.map((t) => t.path)).size !==
      manifest.targets.length
  )
    throw Error("release_inventory_invalid");
  for (const source of manifest.sources) {
    if (
      checksumDe(releaseText(await fileInside(root, source.path))) !==
      source.checksum
    )
      throw Error(`release_source_changed:${source.id}`);
    if (
      !["extend", "merge", "reuse", "exclude", "defer"].includes(
        source.decision,
      ) ||
      !source.reason ||
      !Array.isArray(source.targets)
    )
      throw Error("release_source_decision_missing");
    for (const target of source.targets) await fileInside(root, target);
    if (["exclude", "defer"].includes(source.decision) && source.targets.length)
      throw Error("excluded_source_has_index_target");
  }
  const bases = JSON.parse(await fileInside(root, manifest.bases_file));
  if (digest(bases) !== manifest.bases_checksum)
    throw Error("release_rollback_base_changed");
  const documents = [];
  for (const target of manifest.targets) {
    if (
      !normalizaRuta(target.path).startsWith("conocimiento/") ||
      path.posix.basename(path.posix.dirname(target.path)) !==
        "01-rag-produccion" ||
      !target.path.endsWith(".md")
    )
      throw Error("release_target_not_indexable");
    const content = releaseText(await fileInside(root, target.path));
    const title = content
      .split("\n")
      .find((line) => /^# /.test(line))
      ?.slice(2)
      .trim();
    if (
      !title ||
      title !== target.title ||
      checksumDe(content) !== target.checksum
    )
      throw Error(`release_target_changed:${target.path}`);
    const base = target.base_id ? bases[target.path] : null;
    if (
      target.base_id &&
      (!base ||
        base.id !== target.base_id ||
        checksumDe(base.content.trim()) !== base.checksum)
    )
      throw Error("release_rollback_base_invalid");
    if (!manifest.sources.some((s) => s.targets.includes(target.path)))
      throw Error("release_target_without_provenance");
    documents.push({ ...target, content, base });
  }
  return { manifest, documents, digest: digest(manifest) };
}

export function planKnowledgeRelease(release, remote) {
  if (
    remote.some((d) => d.visibility !== "global" || d.organization_id !== null)
  )
    throw Error("release_inventory_contains_tenant_data");
  const errors = [];
  if (
    remote.some(
      (d) =>
        d.status === "active" &&
        d.embedding_model !== release.manifest.profile.model,
    )
  )
    errors.push("active_embedding_space_mismatch");
  const plan = {
    create: [],
    update: [],
    unchanged: [],
    archive: [],
    error: errors,
  };
  const scopes = [
    ...new Set(release.documents.map((d) => path.posix.dirname(d.path))),
  ];
  for (const scope of scopes) {
    const local = release.documents.filter(
      (d) => path.posix.dirname(d.path) === scope,
    );
    const part = planSync({ scope, local, remote, prune: false });
    for (const key of ["create", "update", "unchanged", "error"])
      plan[key].push(...part[key]);
  }
  for (const doc of release.documents) {
    const current = remote.find(
      (d) => normalizaRuta(d.description) === doc.path && d.status === "active",
    );
    if (
      current &&
      (current.audience !== release.manifest.audience ||
        current.store_id !== null ||
        current.authority !== "operational")
    )
      errors.push(`release_audience_authority_or_scope_changed:${doc.path}`);
    if (current && !doc.base && current.checksum !== doc.checksum)
      errors.push(`release_new_target_already_exists:${doc.path}`);
    if (
      doc.base &&
      (!current ||
        current.id !== doc.base.id ||
        (current.checksum !== doc.checksum &&
          (current.version !== doc.base.version ||
            current.checksum !== doc.base.checksum)))
    )
      errors.push(`release_base_revision_changed:${doc.path}`);
  }
  return {
    ...plan,
    release_id: release.manifest.release_id,
    release_digest: release.digest,
  };
}

/** Every acknowledged index write is checkpointed before proceeding to the next document. */
export async function applyKnowledgeRelease(
  release,
  remote,
  api,
  checkpoint = async () => {},
  previous = null,
) {
  const plan = planKnowledgeRelease(release, remote);
  if (plan.error.length)
    throw Error(`release_plan_blocked:${JSON.stringify(plan.error)}`);
  const actor = await api.authorize();
  if (
    previous &&
    (previous.release_digest !== release.digest ||
      previous.project_ref !== release.manifest.project_ref ||
      !Array.isArray(previous.changes))
  )
    throw Error("resume_receipt_mismatch");
  const receipt = previous
    ? structuredClone(previous)
    : {
        schema_version: 1,
        release_id: release.manifest.release_id,
        release_digest: release.digest,
        project_ref: release.manifest.project_ref,
        profile: release.manifest.profile,
        actor_id: actor,
        started_at: new Date().toISOString(),
        status: "applying",
        changes: [],
        unchanged: plan.unchanged.map((d) => d.id),
        errors: [],
      };
  receipt.attempts = [
    ...(receipt.attempts ?? []),
    {
      actor_id: actor,
      at: new Date().toISOString(),
      previous_errors: receipt.errors,
    },
  ];
  receipt.errors = [];
  receipt.status = "applying";
  await checkpoint(receipt);
  const entries = [
    ...receipt.changes.map((c) => ({ path: c.path, id: c.id, kind: c.kind })),
    ...plan.update.map((e) => ({ ...e, kind: "update" })),
    ...plan.create.map((e) => ({ ...e, kind: "create" })),
  ];
  const handled = new Set();
  for (const entry of entries) {
    if (handled.has(entry.path)) continue;
    handled.add(entry.path);
    const doc = release.documents.find((d) => d.path === entry.path);
    try {
      if (!doc) throw Error("resume_target_not_in_release");
      let change = receipt.changes.find((c) => c.path === doc.path);
      if (!change) {
        const before =
          entry.kind === "update" ? await api.describe(entry.id) : null;
        if (
          before &&
          (before.checksum !== doc.base?.checksum ||
            before.version !== doc.base?.version ||
            before.audience !== "consultant_only" ||
            before.organization_id !== null ||
            before.store_id !== null ||
            before.status !== "active")
        )
          throw Error("release_changed_since_plan");
        change = {
          kind: entry.kind,
          id: entry.id ?? null,
          path: doc.path,
          checksum: doc.checksum,
          version: before ? before.version + 1 : 1,
          before: before
            ? { ...before, content: before.content ?? doc.base.content }
            : null,
          status: "prepared",
        };
        receipt.changes.push(change);
        await checkpoint(receipt);
      }
      const found = remote.find(
        (d) =>
          normalizaRuta(d.description) === doc.path && d.status === "active",
      );
      let actual = change.id
        ? await api.describe(change.id)
        : found
          ? await api.describe(found.id)
          : null;
      if (change.checksum !== doc.checksum)
        throw Error("resume_target_checksum_mismatch");
      if (
        actual &&
        (actual.visibility !== "global" ||
          actual.organization_id !== null ||
          actual.store_id !== null ||
          actual.audience !== "consultant_only" ||
          actual.status !== "active")
      )
        throw Error("release_scope_changed_since_checkpoint");
      if (!actual || actual.checksum !== change.checksum) {
        if (change.status !== "prepared")
          throw Error("release_changed_since_checkpoint");
        const body =
          change.kind === "update"
            ? await api.update(change.id, doc.content, {
                version: change.before.version,
                checksum: change.before.checksum,
              })
            : await api.create(doc);
        change.id = change.id ?? body.document_id;
        actual = await api.describe(change.id);
      } else change.id = actual.id;
      if (
        !actual ||
        actual.checksum !== change.checksum ||
        actual.version !== change.version ||
        actual.status !== "active" ||
        actual.organization_id !== null ||
        actual.store_id !== null ||
        actual.visibility !== "global" ||
        actual.audience !== "consultant_only"
      )
        throw Error("release_postcondition_failed");
      change.status = "indexed";
      await checkpoint(receipt);
      await api.markReviewed(change, actor);
      actual = await api.describe(change.id);
      if (
        actual.checksum !== change.checksum ||
        actual.version !== change.version ||
        actual.status !== "active" ||
        actual.audience !== "consultant_only" ||
        actual.embedding_model !== release.manifest.profile.model ||
        actual.authority !== "operational" ||
        actual.origin !== "human_approved_ai" ||
        actual.source_actor_id !== actor ||
        actual.ingested_by !== "human"
      )
        throw Error("release_postcondition_failed");
      change.status = "verified";
      await checkpoint(receipt);
    } catch (error) {
      receipt.errors.push({ path: entry.path, error: String(error.message) });
      receipt.status = "partial";
      await checkpoint(receipt);
      return receipt;
    }
  }
  receipt.status = "verified";
  receipt.finished_at = new Date().toISOString();
  await checkpoint(receipt);
  return receipt;
}

export async function rollbackKnowledgeRelease(
  receipt,
  api,
  checkpoint = async () => {},
) {
  if (receipt.schema_version !== 1 || !Array.isArray(receipt.changes))
    throw Error("invalid_release_receipt");
  await api.authorize();
  const report = {
    release_id: receipt.release_id,
    release_digest: receipt.release_digest,
    status: "rolling_back",
    restored: [],
    errors: [],
  };
  for (const change of [...receipt.changes].reverse()) {
    try {
      const current = await api.describe(change.id);
      if (
        current.organization_id !== null ||
        current.store_id !== null ||
        current.visibility !== "global" ||
        current.audience !== "consultant_only"
      )
        throw Error("rollback_scope_changed");
      if (change.kind === "create") {
        if (
          current.checksum !== change.checksum ||
          current.version !== change.version
        )
          throw Error("rollback_revision_changed");
        if (current.status !== "archived")
          await api.archive(change.id, current);
      } else {
        if (
          !change.before?.content ||
          checksumDe(change.before.content.trim()) !== change.before.checksum
        )
          throw Error("rollback_before_image_invalid");
        if (
          change.status === "prepared" &&
          current.checksum === change.before.checksum &&
          current.version === change.before.version
        ) {
          report.restored.push(change.id);
          await checkpoint(report);
          continue;
        }
        if (current.status !== "active")
          throw Error("rollback_revision_changed");
        if (current.checksum !== change.before.checksum) {
          if (
            current.checksum !== change.checksum ||
            current.version !== change.version
          )
            throw Error("rollback_revision_changed");
          await api.update(change.id, change.before.content, {
            version: current.version,
            checksum: current.checksum,
          });
        } else if (current.version !== change.version + 1)
          throw Error("rollback_revision_changed");
        const restored = await api.describe(change.id);
        if (
          restored.checksum !== change.before.checksum ||
          restored.version !== change.version + 1
        )
          throw Error("rollback_postcondition_failed");
        await api.restoreMetadata(change.id, change.before, restored);
      }
      const actual = await api.describe(change.id);
      if (
        change.kind === "create"
          ? actual.status !== "archived"
          : actual.checksum !== change.before.checksum ||
            actual.status !== "active"
      )
        throw Error("rollback_postcondition_failed");
      report.restored.push(change.id);
      await checkpoint(report);
    } catch (error) {
      report.errors.push({ id: change.id, error: String(error.message) });
      report.status = "partial";
      await checkpoint(report);
      return report;
    }
  }
  report.status = "restored";
  await checkpoint(report);
  return report;
}

async function loadGlobalInventory(service) {
  const docs = [];
  let total = null;
  for (let offset = 0; total === null || offset < total; offset += 500) {
    const result = await service
      .from("knowledge_documents")
      .select(
        "id,title,description,status,version,checksum,embedding_model,visibility,organization_id,store_id,audience,authority,origin,source_actor_id,ingested_by",
        { count: "exact" },
      )
      .eq("visibility", "global")
      .is("organization_id", null)
      .order("id")
      .range(offset, offset + 499);
    if (
      result.error ||
      result.count === null ||
      (result.count !== total && total !== null)
    )
      throw Error("global_inventory_incomplete_or_changed");
    total = result.count;
    docs.push(...result.data);
  }
  if (new Set(docs.map((d) => d.id)).size !== total)
    throw Error("global_inventory_truncated");
  return docs;
}

async function onlineApi(env, release) {
  const apiUrl = env.API_URL ?? `http://localhost:${env.API_PORT ?? 4000}`;
  if (
    new URL(env.SUPABASE_URL).hostname.split(".")[0] !==
    release.manifest.project_ref
  )
    throw Error("release_project_mismatch");
  const service = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const token = env.KNOWLEDGE_ADMIN_TOKEN;
  const request = async (route, body, method = "POST") => {
    if (!token) throw Error("KNOWLEDGE_ADMIN_TOKEN_required_for_apply");
    const response = await fetch(
      `${apiUrl}/v1/organizations/global/knowledge/documents${route}`,
      {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw Error(
        `knowledge_api_${response.status}:${result.error ?? "failed"}`,
      );
    return result;
  };
  const metadata = async (id, values, revision) => {
    const result = await service
      .from("knowledge_documents")
      .update(values)
      .eq("id", id)
      .eq("version", revision.version)
      .eq("checksum", revision.checksum)
      .eq("visibility", "global")
      .eq("audience", "consultant_only")
      .is("store_id", null)
      .is("organization_id", null)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      throw Error("knowledge_metadata_revision_conflict");
  };
  return {
    inventory: () => loadGlobalInventory(service),
    authorize: async () => {
      await request("", null, "GET");
      const { data, error } = await service.auth.getUser(token);
      if (error || !data.user) throw Error("release_actor_unverified");
      return data.user.id;
    },
    describe: async (id) => {
      const r = await service
        .from("knowledge_documents")
        .select("*")
        .eq("id", id)
        .eq("visibility", "global")
        .is("organization_id", null)
        .single();
      if (r.error) throw Error("release_document_unavailable");
      return r.data;
    },
    create: (doc) =>
      request("", {
        title: doc.title,
        description: doc.path,
        content: doc.content,
        source_type: "upload",
        audience: "consultant_only",
      }),
    update: (id, content, revision) =>
      request(
        `/${id}`,
        {
          content,
          expected_version: revision.version,
          expected_checksum: revision.checksum,
        },
        "PATCH",
      ),
    markReviewed: (change, actor) =>
      metadata(
        change.id,
        {
          authority: "operational",
          origin: "human_approved_ai",
          source_actor_id: actor,
          ingested_by: "human",
        },
        change,
      ),
    restoreMetadata: (id, before, revision) =>
      metadata(
        id,
        {
          authority: before.authority,
          origin: before.origin,
          source_actor_id: before.source_actor_id,
          ingested_by: before.ingested_by,
        },
        revision,
      ),
    archive: (id, current) => metadata(id, { status: "archived" }, current),
  };
}

async function main() {
  const value = (name) =>
    process.argv
      .slice(2)
      .find((a) => a.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const root = process.cwd();
  const apply = value("apply"),
    rollback = value("rollback"),
    inventory = value("inventory"),
    resume = value("resume");
  if (rollback && resume) throw Error("rollback_and_resume_are_exclusive");
  const saved =
    rollback || resume
      ? JSON.parse(await fileInside(root, rollback ?? resume))
      : null;
  if (rollback && !apply) {
    console.log(
      JSON.stringify(
        {
          action: "rollback_preview",
          release_id: saved.release_id,
          receipt_digest: digest(saved),
          changes: saved.changes.map((c) => ({
            id: c.id,
            path: c.path,
            kind: c.kind,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  const release = rollback
    ? { manifest: { project_ref: saved.project_ref } }
    : await loadKnowledgeRelease(root, value("manifest") ?? DEFAULT_RELEASE);
  if (apply && apply !== (rollback ? digest(saved) : release.digest))
    throw Error("apply_requires_the_exact_reviewed_digest");
  if (inventory) {
    if (apply || rollback) throw Error("offline_inventory_is_read_only");
    const snapshot = JSON.parse(await fileInside(root, inventory));
    console.log(
      JSON.stringify(
        planKnowledgeRelease(release, snapshot.documents),
        null,
        2,
      ),
    );
    return;
  }
  const { parse } = await import("dotenv");
  const env = {
    ...parse(await readFile(path.resolve(root, ".env.local"), "utf8")),
    ...process.env,
  };
  const api = await onlineApi(env, release);
  if (!apply) {
    console.log(
      JSON.stringify(
        planKnowledgeRelease(release, await api.inventory()),
        null,
        2,
      ),
    );
    return;
  }
  const output =
    value("receipt") ??
    resume ??
    `tmp/imp04-2026-11-03/${rollback ? "rollback" : "release"}-${randomUUID()}.json`;
  if (
    path.isAbsolute(output) ||
    normalizaRuta(output).split("/").includes("..") ||
    !normalizaRuta(output).startsWith("tmp/")
  )
    throw Error("receipt_must_stay_in_workspace_tmp");
  const checkpoint = async (receipt) => {
    await mkdir(path.dirname(output), { recursive: true });
    const parent = path.relative(
      await realpath(root),
      await realpath(path.dirname(output)),
    );
    if (parent.startsWith("..") || path.isAbsolute(parent))
      throw Error("receipt_symlink_outside_workspace");
    const temporary = `${output}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
    });
    await rename(temporary, output);
  };
  const result = rollback
    ? await rollbackKnowledgeRelease(saved, api, checkpoint)
    : await applyKnowledgeRelease(
        release,
        await api.inventory(),
        api,
        checkpoint,
        saved,
      );
  console.log(
    JSON.stringify(
      { status: result.status, receipt: output, errors: result.errors },
      null,
      2,
    ),
  );
  if (!["verified", "restored"].includes(result.status)) process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
