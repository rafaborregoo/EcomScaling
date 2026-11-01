import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { weeklyMailingPlanOutputSchema } from "@e-nora/ai";
import {
  buildWeeklyMailingEmailBrief,
  mailingRetryFeedback,
} from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";
import { requireMailingAccess } from "./marketing-mailing-access.js";
import { localCampaignDateTimeToUtc } from "./campaign-plan-window.js";
import { weeklyMailingRequestFingerprint } from "./marketing-mailing-sequence.js";

export type MailingImageResource = {
  id: string;
  content_revision: number;
  checksum: string;
  storage_bucket: string;
  storage_path: string;
  object_fingerprint: string;
};

export function mailingCaminoReference(snapshot: unknown) {
  const plan = (
    snapshot as {
      camino?: {
        plan?: {
          id: string;
          name: string;
          version: number;
          goal?: unknown;
        } | null;
      };
    } | null
  )?.camino?.plan;
  return plan
    ? {
        id: plan.id,
        name: plan.name,
        version: plan.version,
        goal: plan.goal ?? null,
      }
    : null;
}

/** Resolve selected IDs in this store, never accept a browser-supplied signed URL. */
export async function loadMailingImageResources(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string,
  ids: string[],
) {
  if (!ids.length)
    return { ok: true as const, resources: [] as MailingImageResource[] };
  const [images, sources] = await Promise.all([
    supabase
      .from("instagram_image_bank")
      .select(
        "id, store_id, status, content_revision, checksum, storage_bucket, storage_path",
      )
      .eq("organization_id", organizationId)
      .in("id", ids),
    supabase
      .from("marketing_visual_asset_sources")
      .select("image_id")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .in("image_id", ids),
  ]);
  if (images.error || sources.error)
    return {
      ok: false as const,
      statusCode: 503,
      error: "weekly_mailing_images_unavailable",
    };
  if (
    images.data?.length !== ids.length ||
    images.data.some(
      (image) =>
        image.status !== "analyzed" ||
        (image.store_id !== storeId &&
          !sources.data?.some((source) => source.image_id === image.id)) ||
        !["marketing-assets", "marketing-source-assets"].includes(
          image.storage_bucket,
        ) ||
        !image.storage_path?.startsWith(`${organizationId}/`) ||
        image.storage_path
          .split("/")
          .some((part: string) => !part || part === "." || part === ".."),
    )
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "weekly_mailing_image_not_available_in_store",
    };
  }
  const resources: MailingImageResource[] = [];
  for (const id of ids) {
    const image = images.data.find((row) => row.id === id)!;
    const object = await supabase.storage
      .from(image.storage_bucket)
      .info(image.storage_path);
    if (object.error || !object.data)
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_image_file_unavailable",
      };
    if (
      !object.data.size ||
      object.data.size > 20 * 1024 * 1024 ||
      !object.data.contentType?.startsWith("image/")
    ) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_image_file_invalid",
      };
    }
    resources.push({
      id,
      content_revision: image.content_revision,
      checksum: image.checksum,
      storage_bucket: image.storage_bucket,
      storage_path: image.storage_path,
      object_fingerprint: weeklyMailingRequestFingerprint(object.data),
    });
  }
  return { ok: true as const, resources };
}

export async function verifyMailingApprovalContext(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string,
  request: Record<string, unknown>,
  snapshot: unknown,
) {
  const context = snapshot as {
    camino?: { plan?: { id: string; version: number } | null };
    calendar_fingerprint?: string;
    brand_sources?: Array<{
      id: string;
      store_id: string | null;
      updated_at: string;
    }> | null;
  } | null;
  if (!context?.calendar_fingerprint)
    return {
      ok: false as const,
      statusCode: 409,
      error: "weekly_mailing_context_requires_review",
      message:
        "Esta estrategia anterior requiere una nueva comprobación del calendario. Descártala y genera una nueva.",
    };
  const dates = request.scheduled_dates as string[];
  const timezone = request.timezone as string;
  const [plan, calendar, store, brand] = await Promise.all([
    supabase
      .from("strategic_plans")
      .select("id, version")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .eq("status", "active")
      .not("approved_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("campaign_calendar_items")
      .select("id, title, channel, status, starts_at, ends_at, updated_at", {
        count: "exact",
      })
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .lte(
        "starts_at",
        localCampaignDateTimeToUtc(
          dates.at(-1)!,
          timezone,
          23,
          59,
        ).toISOString(),
      )
      .or(
        `ends_at.is.null,ends_at.gte.${localCampaignDateTimeToUtc(dates[0]!, timezone, 0, 0).toISOString()}`,
      )
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(30),
    supabase
      .from("shopify_stores")
      .select("connection_id, timezone")
      .eq("organization_id", organizationId)
      .eq("id", storeId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("marketing_brand_profiles")
      .select("id, store_id, updated_at")
      .eq("organization_id", organizationId)
      .or(`store_id.is.null,store_id.eq.${storeId}`)
      .order("id", { ascending: true }),
  ]);
  if (
    plan.error ||
    calendar.error ||
    store.error ||
    brand.error
  )
    return {
      ok: false as const,
      statusCode: 503,
      error: "weekly_mailing_context_unavailable",
    };
  if (!context.brand_sources) return { ok: false as const, statusCode: 409, error: "weekly_mailing_context_requires_review",
    message: "La estrategia no conserva una guía de marca comprobable. Descártala y prepara una nueva." };
  if (
    !store.data ||
    store.data.connection_id !== request.store_connection_id ||
    store.data.timezone !== timezone
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "weekly_mailing_store_changed",
      message:
        "La tienda o su zona horaria ha cambiado. Prepara una estrategia nueva.",
    };
  }
  if (
    (plan.data?.id ?? null) !== (context.camino?.plan?.id ?? null) ||
    (plan.data?.version ?? null) !== (context.camino?.plan?.version ?? null) ||
    weeklyMailingRequestFingerprint({
      rows: calendar.data ?? [],
      total: calendar.count,
    }) !== context.calendar_fingerprint ||
    weeklyMailingRequestFingerprint(brand.data ?? []) !==
      weeklyMailingRequestFingerprint(
        [...context.brand_sources].sort((a, b) => a.id.localeCompare(b.id)),
      )
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "weekly_mailing_context_changed",
      message:
        "Han cambiado el calendario o Mi Camino. Revisa una estrategia nueva antes de crear más borradores.",
    };
  }
  return { ok: true as const };
}

export async function verifyMailingResources(
  supabase: SupabaseClient,
  organizationId: string,
  request: Record<string, unknown>,
  storeId?: string,
) {
  const resources = request.resources as
    Array<{ id: string; updated_at: string }> | undefined;
  if (resources?.length) {
    const { data, error } = await supabase
      .from("marketing_content_drafts")
      .select("id, updated_at, request")
      .eq("organization_id", organizationId)
      .in(
        "id",
        resources.map((item) => item.id),
      );
    if (error)
      return {
        ok: false as const,
        statusCode: 503,
        error: "weekly_mailing_resources_unavailable",
      };
    if (
      data?.length !== resources.length ||
      resources.some(
        (saved) =>
          !data.some(
            (row) => row.id === saved.id && row.updated_at === saved.updated_at,
          ),
      )
    ) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_resources_changed",
        message:
          "Una plantilla ha cambiado o ya no está disponible. Revisa las referencias y prepara una estrategia nueva.",
      };
    }
  }
  const production = request.production as
    | {
        image_ids?: string[];
        image_urls?: string[];
        image_rights_confirmed?: boolean;
      }
    | undefined;
  if (production?.image_urls?.length)
    return {
      ok: false as const,
      statusCode: 409,
      error: "weekly_mailing_images_require_reselection",
    };
  if (production?.image_ids?.length) {
    if (!storeId || production.image_rights_confirmed !== true)
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_image_rights_required",
      };
    const current = await loadMailingImageResources(
      supabase,
      organizationId,
      storeId,
      production.image_ids,
    );
    if (!current.ok) return current;
    if (
      weeklyMailingRequestFingerprint(current.resources) !==
      weeklyMailingRequestFingerprint(request.image_resources)
    ) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_images_changed",
      };
    }
  }
  return { ok: true as const };
}

/** A11 composes exactly the approved packet. Client text never replaces its restrictions. */
export async function loadApprovedMailingPacket(
  supabase: SupabaseClient,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
  materializeImages = true,
) {
  if (
    typeof payload.mailing_sequence_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.mailing_sequence_id)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "mailing_sequence_reference_invalid",
    };
  }
  const { data: sequence, error } = await supabase
    .from("marketing_mailing_sequences")
    .select(
      "id, store_id, status, revision, approved_at, request, plan, agent_output_id, cancelled_at, orchestrator, context_snapshot",
    )
    .eq("organization_id", organizationId)
    .eq("id", String(payload.mailing_sequence_id))
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 503,
      error: "mailing_sequence_reference_unavailable",
    };
  if (!sequence)
    return {
      ok: false as const,
      statusCode: 404,
      error: "mailing_sequence_reference_not_available",
    };
  const access = requireMailingAccess(
    context,
    organizationId,
    sequence.store_id,
  );
  if (!access.ok) return access;
  if (
    sequence.status !== "in_progress" ||
    !sequence.approved_at ||
    sequence.cancelled_at ||
    sequence.revision !== payload.mailing_revision
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "mailing_sequence_not_approved_or_current",
    };
  }
  if (sequence.orchestrator === "graph") {
    if (typeof payload.mailing_lease_token !== "string")
      return {
        ok: false as const,
        statusCode: 409,
        error: "mailing_graph_lease_required",
      };
    const { data: owned, error: leaseError } = await supabase.rpc(
      "mutate_mailing_graph",
      {
        p_sequence_id: sequence.id,
        p_token: payload.mailing_lease_token,
        p_operation: "assert",
        p_payload: {},
      },
    );
    if (leaseError || owned !== true)
      return {
        ok: false as const,
        statusCode: 409,
        error: "mailing_graph_lease_lost_or_cancelled",
      };
  }
  const parsed = weeklyMailingPlanOutputSchema.safeParse(sequence.plan);
  const emailNumber = Number(payload.mailing_email_number);
  const email = parsed.success
    ? parsed.data.emails.find((item) => item.sequence_number === emailNumber)
    : null;
  const request = sequence.request as Record<string, any>;
  const instant = request.scheduled_for?.[emailNumber - 1];
  const expectedKey = `${sequence.id}:${emailNumber}`;
  const key = String(payload.idempotency_key ?? "");
  if (
    !parsed.success ||
    parsed.data.decision !== "ready" ||
    !email ||
    !Number.isSafeInteger(emailNumber) ||
    typeof instant !== "string" ||
    !Number.isFinite(Date.parse(instant)) ||
    Date.parse(instant) <= Date.now() ||
    (key !== expectedKey &&
      ![1, 2, 3, 4].some((attempt) => key === `${expectedKey}:r${attempt}`))
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "mailing_production_packet_invalid",
    };
  }
  const resources = await verifyMailingResources(
    supabase,
    organizationId,
    request,
    sequence.store_id,
  );
  if (!resources.ok) return resources;
  const currentContext = await verifyMailingApprovalContext(
    supabase,
    organizationId,
    sequence.store_id,
    request,
    sequence.context_snapshot,
  );
  if (!currentContext.ok) return currentContext;
  let feedback = "";
  if (key !== expectedKey) {
    const { data: current, error: currentError } = await supabase
      .from("marketing_mailing_campaign_emails")
      .select("attempt, rejections")
      .eq("organization_id", organizationId)
      .eq("sequence_id", sequence.id)
      .eq("sequence_number", emailNumber)
      .maybeSingle();
    if (
      currentError ||
      !current ||
      key !== `${expectedKey}:r${current.attempt}`
    ) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "mailing_retry_not_current",
      };
    }
    const reasons =
      (current.rejections as Array<{ reasons: string[] }> | null)?.at(-1)
        ?.reasons ?? [];
    feedback = `\n${mailingRetryFeedback(reasons)}`;
  }
  const production = request.production ?? {};
  const images = (request.image_resources ?? []) as MailingImageResource[];
  let image: string | null = null;
  if (images.length && materializeImages) {
    const selected = images[(emailNumber - 1) % images.length]!;
    // Email HTML needs a durable URL. Publish only this explicitly selected,
    // rights-confirmed asset; never embed a temporary URL from the private bank.
    const original = await supabase.storage
      .from(selected.storage_bucket)
      .download(selected.storage_path);
    if (
      original.error ||
      !original.data ||
      original.data.size > 20 * 1024 * 1024
    ) {
      return {
        ok: false as const,
        statusCode: 503,
        error: "weekly_mailing_image_file_unavailable",
      };
    }
    const bytes = Buffer.from(await original.data.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
    if (checksum !== selected.checksum)
      return {
        ok: false as const,
        statusCode: 409,
        error: "weekly_mailing_images_changed",
      };
    const extension =
      selected.storage_path
        .match(/\.(png|jpe?g|gif|webp)$/i)?.[1]
        ?.toLowerCase() ?? "png";
    const destination = `${organizationId}/mailing/${sequence.id}/${sequence.revision}/${selected.id}-${checksum}.${extension}`;
    const bucket = supabase.storage.from("marketing-assets");
    const uploaded = await bucket.upload(destination, bytes, {
      contentType: original.data.type || "image/png",
      upsert: false,
    });
    if (uploaded.error) {
      const existing = await bucket.download(destination);
      if (
        existing.error ||
        !existing.data ||
        existing.data.size !== bytes.length ||
        crypto
          .createHash("sha256")
          .update(Buffer.from(await existing.data.arrayBuffer()))
          .digest("hex") !== checksum
      ) {
        return {
          ok: false as const,
          statusCode: 503,
          error: "weekly_mailing_image_publish_failed",
        };
      }
    }
    image = bucket.getPublicUrl(destination).data.publicUrl;
  }
  return {
    ok: true as const,
    storeId: sequence.store_id as string,
    receipt: {
      sequence_id: sequence.id as string,
      email_number: emailNumber,
      revision: sequence.revision as string,
      scheduled_for: instant,
      strategy_output_id: sequence.agent_output_id as string | null,
    },
    imageFingerprint: images.length
      ? weeklyMailingRequestFingerprint(
          images[(emailNumber - 1) % images.length],
        )
      : null,
    payload: {
      mailing_sequence_id: sequence.id,
      mailing_email_number: emailNumber,
      mailing_revision: sequence.revision,
      ...(sequence.orchestrator === "graph"
        ? { mailing_lease_token: payload.mailing_lease_token }
        : {}),
      idempotency_key: key,
      channel: "email_klaviyo",
      content_type: "campaign",
      store_id: request.store_connection_id,
      brief:
        buildWeeklyMailingEmailBrief({
          objective: request.objective,
          audience: request.audience,
          offer: request.offer,
          instructions: request.instructions,
          campaignName: request.campaign_name,
          plan: parsed.data,
          email,
          index: emailNumber - 1,
          total: parsed.data.emails.length,
          scheduledDate: request.scheduled_dates[emailNumber - 1],
          timezone: request.timezone,
          revision: sequence.revision,
        }) +
        `\nReferencia de Mi Camino: ${JSON.stringify(mailingCaminoReference(sequence.context_snapshot))}. ` +
        `Contribución prevista: ${parsed.data.objective_rationale}. Sin referencia, esta secuencia es independiente de un plan aprobado y no crea tareas ni elige hitos por semejanza.` +
        feedback,
      template_ids: production.template_ids ?? [],
      base_design_template_id: production.base_design_template_id ?? null,
      content_image_urls: image ? [image] : [],
      verbatim_texts: production.verbatim_texts ?? [],
    } as Record<string, unknown>,
  };
}
