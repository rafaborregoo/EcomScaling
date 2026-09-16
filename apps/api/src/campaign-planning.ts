import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { createTask } from "./operations.js";
import {
  campaignPlanOutputSchema,
  type CampaignPlanOutput,
} from "@ecomscaling/ai";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireMembership(context: AuthContext, organizationId: string) {
  return requireOperationalOrganization(context, organizationId);
}

function taskStatusFromCampaignStatus(status: string) {
  return status === "in_progress"
    ? "in_progress"
    : status === "completed"
      ? "completed"
      : status === "cancelled"
        ? "cancelled"
        : "pending";
}

async function validateStore(
  env: ApiEnv,
  organizationId: string,
  storeId?: string | null,
) {
  if (!storeId) return { ok: true as const };
  const { data } = await createServiceClient(env)
    .from("shopify_stores")
    .select("id")
    .eq("id", storeId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data
    ? { ok: true as const }
    : { ok: false as const, statusCode: 400, error: "invalid_store_scope" };
}

export async function listCampaignPlanning(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  filters: { year?: number; storeId?: string | null },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const store = await validateStore(env, organizationId, filters.storeId);
  if (store.ok === false) return store;
  const supabase = createServiceClient(env);
  let calendarsQuery = supabase
    .from("campaign_calendars")
    .select(
      "id, organization_id, store_id, name, year, status, description, is_visible_to_client, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.year) calendarsQuery = calendarsQuery.eq("year", filters.year);
  if (filters.storeId)
    calendarsQuery = calendarsQuery.or(
      `store_id.is.null,store_id.eq.${filters.storeId}`,
    );
  const { data: calendars, error: calendarsError } =
    await calendarsQuery.limit(100);
  if (calendarsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendars_load_failed",
      detail: calendarsError.message,
    };
  const calendarIds = (calendars ?? []).map((row) => row.id as string);
  const { data: items, error: itemsError } = calendarIds.length
    ? await supabase
        .from("campaign_calendar_items")
        .select(
          "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, metadata, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .in("calendar_id", calendarIds)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true })
    : { data: [], error: null };
  if (itemsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_items_load_failed",
      detail: itemsError.message,
    };
  if (filters.storeId && items) {
    return {
      ok: true as const,
      data: {
        calendars: calendars ?? [],
        items: items.filter(
          (item) => !item.store_id || item.store_id === filters.storeId,
        ),
      },
    };
  }
  return {
    ok: true as const,
    data: { calendars: calendars ?? [], items: items ?? [] },
  };
}

export async function listCampaignPlanningResources(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const [drafts, metaCampaigns, klaviyoCampaigns, milestones] =
    await Promise.all([
      ["platform_admin", "consultant"].includes(context.profile.platform_role)
        ? supabase
            .from("marketing_content_drafts")
            .select("id, subject, template_name, status, content_type")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("meta_campaigns")
        .select("id, name, effective_status, starts_at, ends_at")
        .eq("organization_id", organizationId)
        .order("name")
        .limit(100),
      supabase
        .from("klaviyo_campaigns")
        .select("id, name, status, scheduled_at, send_time")
        .eq("organization_id", organizationId)
        .order("name")
        .limit(100),
      supabase
        .from("strategic_plan_milestones")
        .select("id, name, status, target_date")
        .eq("organization_id", organizationId)
        .order("target_date", { ascending: true, nullsFirst: false })
        .limit(100),
    ]);
  const failed = [drafts, metaCampaigns, klaviyoCampaigns, milestones].find(
    (result) => result.error,
  );
  if (failed?.error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_planning_resources_load_failed",
      detail: failed.error.message,
    };
  return {
    ok: true as const,
    data: {
      drafts: drafts.data ?? [],
      metaCampaigns: metaCampaigns.data ?? [],
      klaviyoCampaigns: klaviyoCampaigns.data ?? [],
      milestones: milestones.data ?? [],
    },
  };
}

export async function createCampaignCalendar(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    name?: string;
    year?: number;
    storeId?: string | null;
    description?: string | null;
    isVisibleToClient?: boolean;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const name = input.name?.trim();
  const year = Number(input.year);
  if (!name)
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_calendar_name",
    };
  if (!Number.isInteger(year) || year < 2000 || year > 2200)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_calendar_year",
    };
  const store = await validateStore(env, organizationId, input.storeId);
  if (store.ok === false) return store;
  const { data, error } = await createServiceClient(env)
    .from("campaign_calendars")
    .insert({
      organization_id: organizationId,
      store_id: input.storeId ?? null,
      name,
      year,
      description: input.description?.trim() || null,
      is_visible_to_client: input.isVisibleToClient ?? true,
      created_by: context.user.id,
    })
    .select(
      "id, organization_id, store_id, name, year, status, description, is_visible_to_client, created_at, updated_at",
    )
    .single();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_create_failed",
      detail: error.message,
    };
  return { ok: true as const, data };
}

export async function createCampaignCalendarItem(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    calendarId?: string;
    title?: string;
    description?: string | null;
    channel?: string;
    itemType?: string;
    startsAt?: string;
    endsAt?: string | null;
    storeId?: string | null;
    status?: string;
    isVisibleToClient?: boolean;
    createTask?: boolean;
    milestoneId?: string | null;
    marketingDraftId?: string | null;
    metaCampaignId?: string | null;
    klaviyoCampaignId?: string | null;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const title = input.title?.trim();
  if (!input.calendarId || !title || !input.startsAt || !input.channel?.trim())
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_calendar_item",
    };
  const startsAt = Date.parse(input.startsAt);
  const endsAt = input.endsAt ? Date.parse(input.endsAt) : null;
  if (
    !Number.isFinite(startsAt) ||
    (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < startsAt))
  )
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_calendar_dates",
    };
  const supabase = createServiceClient(env);
  const { data: calendar } = await supabase
    .from("campaign_calendars")
    .select("id")
    .eq("id", input.calendarId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!calendar)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_calendar",
    };
  const store = await validateStore(env, organizationId, input.storeId);
  if (store.ok === false) return store;
  const linkChecks = await Promise.all([
    input.marketingDraftId
      ? supabase
          .from("marketing_content_drafts")
          .select("id")
          .eq("id", input.marketingDraftId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.metaCampaignId
      ? supabase
          .from("meta_campaigns")
          .select("id")
          .eq("id", input.metaCampaignId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.klaviyoCampaignId
      ? supabase
          .from("klaviyo_campaigns")
          .select("id")
          .eq("id", input.klaviyoCampaignId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (input.marketingDraftId && !linkChecks[0].data)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_marketing_draft_scope",
    };
  if (input.metaCampaignId && !linkChecks[1].data)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_meta_campaign_scope",
    };
  if (input.klaviyoCampaignId && !linkChecks[2].data)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_klaviyo_campaign_scope",
    };
  const { data, error } = await supabase
    .from("campaign_calendar_items")
    .insert({
      organization_id: organizationId,
      calendar_id: input.calendarId,
      store_id: input.storeId ?? null,
      title,
      description: input.description?.trim() || null,
      channel: input.channel.trim(),
      item_type: input.itemType?.trim() || "campaign",
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt === null ? null : new Date(endsAt).toISOString(),
      status: input.status ?? "planned",
      is_visible_to_client: input.isVisibleToClient ?? true,
      marketing_draft_id: input.marketingDraftId ?? null,
      meta_campaign_id: input.metaCampaignId ?? null,
      klaviyo_campaign_id: input.klaviyoCampaignId ?? null,
      created_by: context.user.id,
    })
    .select(
      "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, metadata, created_at, updated_at",
    )
    .single();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_item_create_failed",
      detail: error.message,
    };
  if (input.createTask) {
    const task = await createTask(env, context, organizationId, {
      title,
      description: input.description ?? null,
      category:
        input.channel === "Meta"
          ? "meta"
          : input.channel === "Email"
            ? "klaviyo"
            : "general",
      dueAt: input.endsAt ?? input.startsAt,
      isVisibleToClient: input.isVisibleToClient ?? true,
      milestoneId: input.milestoneId ?? null,
    });
    if (task.ok === false)
      return {
        ok: false as const,
        statusCode: 500,
        error: "campaign_calendar_task_create_failed",
        detail: task.error,
      };
    const linked = await supabase
      .from("campaign_calendar_items")
      .update({
        task_id: task.data.id,
        milestone_id: input.milestoneId ?? null,
      })
      .eq("id", data.id)
      .eq("organization_id", organizationId)
      .select(
        "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, metadata, created_at, updated_at",
      )
      .single();
    if (linked.error)
      return {
        ok: false as const,
        statusCode: 500,
        error: "campaign_calendar_task_link_failed",
        detail: linked.error.message,
      };
    return { ok: true as const, data: linked.data };
  }
  return { ok: true as const, data };
}

export async function archiveCampaignCalendarItem(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  if (!itemId)
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_campaign_calendar_item",
    };
  const { data, error } = await createServiceClient(env)
    .from("campaign_calendar_items")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: context.user.id,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select("id, deleted_at")
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_item_archive_failed",
      detail: error.message,
    };
  if (!data)
    return {
      ok: false as const,
      statusCode: 404,
      error: "campaign_calendar_item_not_found",
    };
  return { ok: true as const, data };
}

export async function updateCampaignCalendarItem(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  input: {
    title?: string;
    channel?: string;
    startsAt?: string;
    endsAt?: string | null;
    status?: string;
    /**
     * Pieza de Marketing que sirve a esta campaña. `null` la desenlaza.
     *
     * ponytail: 1 campaña = 1 pieza, que es lo que ya permitia la columna
     * `marketing_draft_id` (con su indice y su trigger de scope) desde la
     * fase 3. Un flujo de 3 emails para una misma campaña necesitaria la
     * relacion inversa (`campaign_item_id` en el borrador); se migra el dia
     * que haga falta de verdad, no antes.
     */
    marketingDraftId?: string | null;
    /**
     * Campaña real del proveedor. Es lo que cierra el hilo: sin ella una
     * campaña del calendario no puede decir que atribuyo, solo que se planifico.
     */
    metaCampaignId?: string | null;
    klaviyoCampaignId?: string | null;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined && input.title.trim())
    payload.title = input.title.trim();
  if (input.channel !== undefined && input.channel.trim())
    payload.channel = input.channel.trim();
  if (input.startsAt !== undefined) {
    const parsed = Date.parse(input.startsAt);
    if (!Number.isFinite(parsed))
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_campaign_item_date",
      };
    payload.starts_at = new Date(parsed).toISOString();
  }
  if (input.endsAt !== undefined) {
    if (input.endsAt === null || input.endsAt === "") payload.ends_at = null;
    else {
      const parsed = Date.parse(input.endsAt);
      if (!Number.isFinite(parsed))
        return {
          ok: false as const,
          statusCode: 400,
          error: "invalid_campaign_item_date",
        };
      payload.ends_at = new Date(parsed).toISOString();
    }
  }
  if (input.status !== undefined) {
    if (
      ![
        "planned",
        "in_progress",
        "published",
        "completed",
        "cancelled",
      ].includes(input.status)
    )
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_campaign_execution_status",
      };
    payload.status = input.status;
  }
  if (input.marketingDraftId !== undefined) {
    if (!input.marketingDraftId) {
      payload.marketing_draft_id = null;
    } else {
      // El trigger de la base tambien lo impide, pero lanzando una excepcion:
      // saldria un 500 donde lo correcto es decir que ese borrador no es de
      // esta organizacion.
      const { data: draft } = await supabase
        .from("marketing_content_drafts")
        .select("id")
        .eq("id", input.marketingDraftId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!draft)
        return {
          ok: false as const,
          statusCode: 400,
          error: "invalid_marketing_draft_scope",
        };
      payload.marketing_draft_id = input.marketingDraftId;
    }
  }
  for (const link of [
    {
      value: input.metaCampaignId,
      table: "meta_campaigns" as const,
      column: "meta_campaign_id",
      error: "invalid_meta_campaign_scope",
    },
    {
      value: input.klaviyoCampaignId,
      table: "klaviyo_campaigns" as const,
      column: "klaviyo_campaign_id",
      error: "invalid_klaviyo_campaign_scope",
    },
  ]) {
    if (link.value === undefined) continue;
    if (!link.value) {
      payload[link.column] = null;
      continue;
    }
    const { data: row } = await supabase
      .from(link.table)
      .select("id")
      .eq("id", link.value)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!row)
      return { ok: false as const, statusCode: 400, error: link.error };
    payload[link.column] = link.value;
  }
  if (!Object.keys(payload).length)
    return {
      ok: false as const,
      statusCode: 400,
      error: "empty_campaign_item_update",
    };
  const { data, error } = await supabase
    .from("campaign_calendar_items")
    .update(payload)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select(
      "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, metadata, created_at, updated_at",
    )
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_item_update_failed",
      detail: error.message,
    };
  if (!data)
    return {
      ok: false as const,
      statusCode: 404,
      error: "campaign_calendar_item_not_found",
    };
  if (data.task_id) {
    const taskPayload: Record<string, unknown> = {};
    if (input.title !== undefined && input.title.trim())
      taskPayload.title = input.title.trim().slice(0, 255);
    if (input.endsAt !== undefined || input.startsAt !== undefined) {
      const dueAt = input.endsAt || input.startsAt;
      taskPayload.due_at = dueAt ? new Date(Date.parse(dueAt)).toISOString() : null;
    }
    if (Object.keys(taskPayload).length > 0) {
      await supabase
        .from("tasks")
        .update(taskPayload)
        .eq("id", data.task_id)
        .eq("organization_id", organizationId);
    }
  }
  if (data.task_id && input.status) {
    const taskStatus = taskStatusFromCampaignStatus(input.status);
    await supabase
      .from("tasks")
      .update({
        status: taskStatus,
        ...(taskStatus === "completed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.task_id)
      .eq("organization_id", organizationId);
  }
  return { ok: true as const, data };
}

export async function updateCampaignCalendarExecution(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  input: {
    status?: string;
    ownerUserId?: string | null;
    executionNotes?: string | null;
    blockedReason?: string | null;
    resultData?: Record<string, unknown>;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const allowedStatuses = [
    "planned",
    "in_progress",
    "published",
    "completed",
    "cancelled",
  ];
  if (input.status && !allowedStatuses.includes(input.status))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_execution_status",
    };
  const payload: Record<string, unknown> = {};
  if (input.status) payload.status = input.status;
  if (input.ownerUserId !== undefined)
    payload.owner_user_id = input.ownerUserId;
  if (input.executionNotes !== undefined)
    payload.execution_notes = input.executionNotes?.trim() || null;
  if (input.blockedReason !== undefined)
    payload.blocked_reason = input.blockedReason?.trim() || null;
  if (input.resultData !== undefined) payload.result_data = input.resultData;
  if (input.status === "completed") {
    payload.executed_at = new Date().toISOString();
    payload.executed_by = context.user.id;
  }
  if (input.status && input.status !== "completed") {
    payload.executed_at = null;
    payload.executed_by = null;
  }
  if (!Object.keys(payload).length)
    return {
      ok: false as const,
      statusCode: 400,
      error: "empty_campaign_execution_update",
    };
  const { data, error } = await createServiceClient(env)
    .from("campaign_calendar_items")
    .update(payload)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select(
      "id, task_id, status, owner_user_id, executed_at, executed_by, execution_notes, blocked_reason, result_data, updated_at",
    )
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_execution_update_failed",
      detail: error.message,
    };
  if (!data)
    return {
      ok: false as const,
      statusCode: 404,
      error: "campaign_calendar_item_not_found",
    };
  if (data.task_id && input.status) {
    const taskStatus = taskStatusFromCampaignStatus(input.status);
    await createServiceClient(env)
      .from("tasks")
      .update({
        status: taskStatus,
        ...(taskStatus === "completed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.task_id)
      .eq("organization_id", organizationId);
  }
  return { ok: true as const, data };
}

export async function upsertKpiSnapshot(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    storeId?: string | null;
    period?: string;
    periodStart?: string;
    periodEnd?: string;
    netSales?: number | null;
    ordersCount?: number | null;
    aov?: number | null;
    adSpend?: number | null;
    roas?: number | null;
    cac?: number | null;
    netProfit?: number | null;
    notes?: string | null;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  if (
    !input.periodStart ||
    !input.periodEnd ||
    input.periodEnd < input.periodStart
  )
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_kpi_snapshot_period",
    };
  const store = await validateStore(env, organizationId, input.storeId);
  if (store.ok === false) return store;
  const supabase = createServiceClient(env);
  let query = supabase
    .from("kpi_snapshots")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("period", input.period ?? "weekly")
    .eq("period_start", input.periodStart)
    .eq("period_end", input.periodEnd);
  query = input.storeId
    ? query.eq("store_id", input.storeId)
    : query.is("store_id", null);
  const { data: existing } = await query.maybeSingle();
  const payload = {
    organization_id: organizationId,
    store_id: input.storeId ?? null,
    period: input.period ?? "weekly",
    period_start: input.periodStart,
    period_end: input.periodEnd,
    net_sales: input.netSales ?? null,
    orders_count: input.ordersCount ?? null,
    aov: input.aov ?? null,
    ad_spend: input.adSpend ?? null,
    roas: input.roas ?? null,
    cac: input.cac ?? null,
    net_profit: input.netProfit ?? null,
    notes: input.notes?.trim() || null,
    captured_by: context.user.id,
  };
  const result = existing
    ? await supabase
        .from("kpi_snapshots")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase.from("kpi_snapshots").insert(payload).select("*").single();
  if (result.error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "kpi_snapshot_save_failed",
      detail: result.error.message,
    };
  return { ok: true as const, data: result.data };
}

export async function listKpiSnapshots(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  filters: { storeId?: string | null; period?: string; limit?: number },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const store = await validateStore(env, organizationId, filters.storeId);
  if (store.ok === false) return store;
  let query = createServiceClient(env)
    .from("kpi_snapshots")
    .select(
      "id, organization_id, store_id, period, period_start, period_end, net_sales, orders_count, aov, ad_spend, roas, cac, net_profit, notes, captured_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("period_start", { ascending: false })
    .limit(Math.min(Math.max(filters.limit ?? 52, 1), 200));
  query = filters.storeId
    ? query.eq("store_id", filters.storeId)
    : query.is("store_id", null);
  if (filters.period) query = query.eq("period", filters.period);
  const { data, error } = await query;
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "kpi_snapshots_load_failed",
      detail: error.message,
    };
  return { ok: true as const, data: { snapshots: data ?? [] } };
}

export async function listCampaignPlanningAttention(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  storeId?: string | null,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const store = await validateStore(env, organizationId, storeId);
  if (store.ok === false) return store;
  let query = createServiceClient(env)
    .from("campaign_calendar_items")
    .select(
      "id, title, channel, starts_at, status, store_id, blocked_reason, execution_notes",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["planned", "in_progress", "published"])
    .order("starts_at", { ascending: true })
    .limit(100);
  // Without an explicit store, return the consultant's organization-wide queue.
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query;
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_planning_attention_load_failed",
      detail: error.message,
    };
  const now = Date.now();
  const overdue = (data ?? []).filter(
    (item) => Date.parse(item.starts_at as string) < now,
  );
  const blocked = (data ?? []).filter(
    (item) => item.status === "in_progress" && item.blocked_reason,
  );
  const attentionIds = new Set([...overdue, ...blocked].map((item) => item.id));
  return {
    ok: true as const,
    data: { overdue, blocked, total: attentionIds.size },
  };
}

// --- A05: convertir la propuesta de campanas en items del calendario -------

/**
 * Fechas reales de cada campana propuesta.
 *
 * A05 devuelve DESPLAZAMIENTOS en dias, no fechas: el modelo no tiene reloj
 * fiable, y el ancla correcta es el momento de APROBAR, no el de generar. Un
 * plan propuesto el lunes y aprobado el viernes no puede nacer con la primera
 * campana empezada hace cuatro dias.
 *
 * Puro y exportado a proposito: es la unica aritmetica del flujo y un error
 * aqui no falla, solo coloca las campanas en fechas equivocadas.
 */
export function campaignPlanToCalendarItems(
  plan: CampaignPlanOutput,
  acceptedAtMs: number,
  selectedIndexes?: number[],
) {
  const dayMs = 24 * 60 * 60 * 1000;
  const chosen = Array.isArray(selectedIndexes)
    ? [...new Set(selectedIndexes)].filter(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < plan.campaigns.length,
      )
    : plan.campaigns.map((_, index) => index);

  return chosen.map((index) => {
    const campaign = plan.campaigns[index] as CampaignPlanOutput["campaigns"][number];
    const startsAt = new Date(
      acceptedAtMs + campaign.start_offset_days * dayMs,
    );
    const endsAt = new Date(
      startsAt.getTime() + campaign.duration_days * dayMs,
    );
    return {
      index,
      title: campaign.title,
      channel: campaign.channel,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      // La hipotesis y el criterio de exito viajan a la descripcion: sin
      // ellos, dentro de tres semanas el item es un titulo sin porque.
      // Texto que se lee en el calendario, asi que va acentuado (a diferencia
      // de los comentarios y los identificadores de este fichero).
      description: [
        campaign.objective,
        `Audiencia: ${campaign.audience}`,
        `Hipótesis: ${campaign.hypothesis}`,
        `Se cumple cuando: ${campaign.success_metric}`,
      ].join("\n\n"),
    };
  });
}

/**
 * Aprueba (total o parcialmente) un plan de campanas de A05 y lo materializa
 * como items del calendario. Unica via por la que este agente escribe dominio.
 */
export async function createCampaignItemsFromProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    outputId?: string | undefined;
    calendarId?: string | undefined;
    selectedIndexes?: number[] | undefined;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;

  if (!input.outputId || !input.calendarId) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_plan_proposal_input",
    };
  }

  const supabase = createServiceClient(env);

  // Acotado a la organizacion: un id de otra cuenta no resuelve, no "resuelve
  // y luego se comprueba".
  const { data: output, error: outputError } = await supabase
    .from("agent_outputs")
    .select(
      "id, status, output, agent_runs!inner(agent_versions!inner(agent_definitions!inner(code)))",
    )
    .eq("id", input.outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (outputError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_plan_proposal_load_failed",
      detail: outputError.message,
    };
  }
  if (!output) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "campaign_plan_proposal_not_found",
    };
  }

  const runs = output.agent_runs as
    | { agent_versions?: { agent_definitions?: { code?: string } } }
    | Array<{ agent_versions?: { agent_definitions?: { code?: string } } }>
    | null;
  const run = Array.isArray(runs) ? runs[0] : runs;
  const versions = run?.agent_versions;
  const version = Array.isArray(versions) ? versions[0] : versions;
  const definitions = version?.agent_definitions;
  const definition = Array.isArray(definitions) ? definitions[0] : definitions;

  if (definition?.code !== "a05_estrategia_campanas") {
    return {
      ok: false as const,
      statusCode: 400,
      error: "campaign_plan_proposal_wrong_agent",
      message: "Esa salida de IA no es una propuesta de plan de campanas.",
    };
  }
  if (output.status === "published") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "campaign_plan_proposal_already_applied",
      message: "Este plan ya se llevo al calendario.",
    };
  }

  const parsed = campaignPlanOutputSchema.safeParse(output.output);
  if (!parsed.success) {
    return {
      ok: false as const,
      statusCode: 422,
      error: "campaign_plan_proposal_invalid",
      detail: parsed.error.message,
    };
  }

  const items = campaignPlanToCalendarItems(
    parsed.data,
    Date.now(),
    input.selectedIndexes,
  );

  const created: string[] = [];
  const failed: Array<{ title: string; error: string }> = [];
  for (const item of items) {
    const result = await createCampaignCalendarItem(env, context, organizationId, {
      calendarId: input.calendarId,
      title: item.title,
      description: item.description,
      channel: item.channel,
      itemType: "campaign",
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: "planned",
      // Nace como plan interno del consultor: la campana se comparte con el
      // cliente cuando el consultor decide, no por haberla aprobado.
      isVisibleToClient: false,
      createTask: false,
    });
    if (result.ok === false) {
      failed.push({ title: item.title, error: result.error });
      continue;
    }
    created.push((result.data as { id: string }).id);
  }

  // Solo se marca aplicada si algo se creo: si fallaron todas, la propuesta
  // sigue disponible para reintentar en vez de quedar consumida.
  if (created.length > 0) {
    await supabase
      .from("agent_outputs")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", input.outputId);

    await supabase.from("agent_approvals").insert({
      output_id: input.outputId,
      organization_id: organizationId,
      decision: "approved",
      decided_by: context.user.id,
      reason: `${created.length} campana(s) creadas en el calendario`,
    });
  }

  return {
    ok: true as const,
    data: { created: created.length, item_ids: created, failed },
  };
}
