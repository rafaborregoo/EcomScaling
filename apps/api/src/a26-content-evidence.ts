import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtmlToText } from "./email-body-text.js";
import { selectKlaviyoTemplateBody } from "./klaviyo-template-history.js";

export const A26_EVIDENCE_LABEL = "Evidencia editorial A26 por mensaje y version";
export const A26_EVIDENCE_VERSION = "a26-content-v1";

export async function a26ActivityDigest(client: SupabaseClient, organizationId: string, storeId: string) {
  const result = await client.rpc("a26_content_activity_digest", { p_organization_id: organizationId, p_store_id: storeId });
  if (result.error || typeof result.data !== "string") return null;
  const status = await client.rpc("a26_content_sampling_status", { p_organization_id: organizationId, p_store_id: storeId, p_fingerprint: result.data });
  if (status.error) return null;
  return `${result.data}:${status.data.pending ? `${status.data.sample_count}:${status.data.cursor ?? "start"}` : "complete"}`;
}

/** The hash describes an observed bundle, never a recipient-specific send. */
export function a26ContentIdentity(row: Record<string, unknown>, body: string | null, provenance: unknown) {
  const bundle = {
    account_id: row.account_id, message_id: row.message_id,
    external_message_id: row.external_message_id, parent_id: row.parent_id,
    template_id: row.external_template_id, subject: row.subject ?? null,
    preheader: row.preview_text ?? null, body, provenance,
    message_state: row.message_status ?? null, send_time: row.send_time ?? null,
  };
  return {
    account_id: String(row.account_id), message_id: String(row.message_id),
    external_message_id: row.external_message_id ?? null, parent_id: row.parent_id ?? null,
    template_id: row.external_template_id ?? null,
    content_hash: createHash("sha256").update(JSON.stringify(bundle)).digest("hex"),
    subject_provenance: "current_sync_observation_not_verified_at_send",
    bundle_version: A26_EVIDENCE_VERSION,
  };
}

export async function loadA26Inventory(client: SupabaseClient, organizationId: string, storeId: string, after: string | null = null) {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let cursor: string | null = after;
  let total = 0;
  for (let page = 0; page < 50; page++) {
    const result = await client.rpc("a26_email_inventory_page", {
      p_organization_id: organizationId, p_store_id: storeId, p_after: cursor, p_limit: 100,
    });
    if (result.error) throw new Error("a26_inventory_unavailable");
    const data = result.data as { rows: Record<string, unknown>[]; total_count: number; next_cursor: string | null };
    if (!data || !Array.isArray(data.rows) || !Number.isInteger(data.total_count) || data.total_count < 0) throw new Error("a26_inventory_invalid");
    total = data.total_count;
    for (const row of data.rows) {
      if (typeof row.message_id !== "string" || seen.has(row.message_id)) throw new Error("a26_inventory_duplicate_or_invalid_identity");
      seen.add(row.message_id);
    }
    rows.push(...data.rows);
    if (!data.next_cursor) return { rows, total, complete: rows.length === total, next_cursor: null };
    if (cursor === data.next_cursor) throw new Error("a26_inventory_cursor_stalled");
    cursor = data.next_cursor;
  }
  return { rows, total, complete: false, next_cursor: cursor };
}

export async function loadA26Message(client: SupabaseClient, organizationId: string, storeId: string, messageId: string) {
  const result = await client.rpc("a26_email_inventory_item", { p_organization_id: organizationId, p_store_id: storeId, p_message_id: messageId });
  if (result.error || !Array.isArray(result.data?.rows)) throw new Error("a26_message_lookup_unavailable");
  return result.data.rows.find((row: Record<string, unknown>) => row.message_id === messageId) as Record<string, unknown> | undefined;
}

export async function readA26EmailContent(client: SupabaseClient, organizationId: string, storeId: string, input: Record<string, unknown>) {
  const item = input.message_id ? await client.rpc("a26_email_inventory_item", { p_organization_id: organizationId, p_store_id: storeId, p_message_id: input.message_id }) : null;
  if (item?.error) throw new Error("a26_message_lookup_unavailable");
  const inventory = item ? { rows: (item.data?.rows ?? []) as Record<string, unknown>[], total: Number(item.data?.total_count ?? 0), complete: true, next_cursor: null }
    : await loadA26Inventory(client, organizationId, storeId, typeof input.after_message_id === "string" ? input.after_message_id : null);
  const selected = inventory.rows.filter((row) => (!input.message_id || row.message_id === input.message_id) && (!input.account_id || row.account_id === input.account_id)).slice(0, input.message_id ? 1 : 12);
  const rows = [];
  for (const row of selected) {
    const template = await client.from("klaviyo_templates").select("html_content,text_content")
      .eq("organization_id", organizationId).eq("account_id", row.account_id)
      .eq("external_template_id", row.external_template_id).maybeSingle();
    if (template.error) throw new Error("a26_template_lookup_unavailable");
    const historical = row.send_time && row.external_template_id ? await client.rpc("klaviyo_template_body_at_send", {
      target_organization_id: organizationId, target_store_id: storeId,
      template_requests: [{ account_id: row.account_id, external_template_id: row.external_template_id, send_time: row.send_time }],
    }) : { data: [], error: null };
    if (historical.error) throw new Error("a26_history_lookup_unavailable");
    const version = historical.data?.[0];
    const selectedBody = selectKlaviyoTemplateBody(template.data?.html_content ?? null, version, typeof row.send_time === "string" ? row.send_time : null, template.data?.text_content);
    const text = selectedBody.html ? emailHtmlToText(selectedBody.html.slice(0, 150_000), 100_000).text : selectedBody.text ?? "";
    const offset = typeof input.offset === "number" ? input.offset : 0;
    rows.push({ ...a26ContentIdentity(row, selectedBody.html ?? selectedBody.text ?? null, selectedBody.provenance),
      source_revision: row.source_revision, subject: row.subject, preheader: row.preview_text,
      text: text.slice(offset, offset + 4000), offset, next_offset: text.length > offset + 4000 ? offset + 4000 : null,
      provenance: selectedBody.provenance });
  }
  return { rows, inventory_complete: inventory.complete, omitted: inventory.total - selected.length, next_cursor: inventory.next_cursor };
}

/** Relationships are graph edges. Provider creation dates are not sequence order. */
export function a26FlowGraph(actions: readonly Record<string, unknown>[]) {
  const ids = new Set(actions.map((row) => `${row.flow_id}|${row.external_action_id}`));
  const nodes = actions.slice(0, 300).map((row) => {
    const raw = row.raw_data as Record<string, any> | null;
    const definition = raw?.definition ?? raw?.attributes?.definition ?? {};
    const relationships = raw?.relationships ?? {};
    const edges = Object.entries(relationships).flatMap(([relation, value]) => {
      if (!/next|yes|no|true|false|branch/i.test(relation)) return [];
      const data = (value as { data?: unknown })?.data;
      const targets = Array.isArray(data) ? data : data ? [data] : [];
      return targets.flatMap((target) => {
        const id = (target as { id?: unknown })?.id;
        return typeof id === "string" ? [{ relation, to: id, resolved: ids.has(`${row.flow_id}|${id}`) }] : [];
      });
    });
    for (const relation of ["next", "next_if_true", "next_if_false", "yes", "no"]) {
      const id = definition.links?.[relation];
      if (typeof id === "string") edges.push({ relation, to: id, resolved: ids.has(`${row.flow_id}|${id}`) });
    }
    return { id: row.external_action_id, flow_id: row.flow_id, type: row.action_type,
      status: row.status, settings: { delay_value: definition.data?.value ?? null, delay_unit: definition.data?.unit ?? null,
        branch_count: Array.isArray(definition.data?.branches) ? definition.data.branches.length : null }, edges };
  });
  return { nodes, truncated: actions.length > 300,
    sequence_status: nodes.some((node) => node.edges.length) ? "provider_edges_partial" : "order_unverified",
    limitation: "No inferir adyacencia ni repeticion en la misma rama por fecha de creacion o posicion numerica." };
}
