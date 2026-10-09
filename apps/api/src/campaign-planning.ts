import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { createTask } from "./operations.js";
import { hasAssignedConsultant } from "./client-autonomy.js";
import { enqueueMemoryIngestion } from "./memory-ingestion.js";
import {
  campaignPlanOutputSchema,
  currentCampaignPlanOutputSchema,
  flattenCampaignPlanActions,
  type CampaignPlanOutput,
} from "@e-nora/ai";
import { localCampaignDateTimeToUtc } from "./campaign-plan-window.js";
import { pickMilestoneForDate } from "./camino-campaign-link.js";
import { notifyCampaignEvent, reviewStatusAfterClientActivity, type ReviewStatus } from "./campaign-review.js";

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

function canSeeInternalCampaignPlanning(context: AuthContext) {
  return ["platform_admin", "consultant"].includes(
    context.profile.platform_role,
  );
}

/**
 * Quién puede crear, editar y archivar acciones de la agenda. Con consultor
 * asignado la agenda la lleva él: el cliente la ve y escribe sobre ella, pero
 * no la cambia (antes solo lo impedía la pantalla). Sin consultor, el cliente
 * se gobierna solo y la sigue llevando él.
 */
export function agendaWriteDecision(isStaff: boolean, clientHasConsultant: boolean) {
  return isStaff || !clientHasConsultant;
}

/**
 * Que puede hacer quien llama con la agenda de esta organizacion.
 *
 * - `writeAll`: staff, o cliente sin consultor. Escribe cualquier accion.
 * - Cliente CON consultor: no escribe la agenda ajena, pero SI crea y edita sus
 *   propias campañas (origen `client`), que entran en revision del consultor.
 */
async function agendaAccess(env: ApiEnv, context: AuthContext, organizationId: string) {
  const isStaff = canSeeInternalCampaignPlanning(context);
  const hasConsultant = isStaff
    ? true
    : await hasAssignedConsultant(createServiceClient(env), organizationId);
  return { isStaff, hasConsultant, writeAll: agendaWriteDecision(isStaff, hasConsultant) };
}

async function requireAgendaWriter(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const agenda = await agendaAccess(env, context, organizationId);
  return agenda.writeAll
    ? { ok: true as const }
    : {
        ok: false as const,
        statusCode: 403,
        error: "agenda_managed_by_consultant",
        message: "La agenda la gestiona tu consultor. Escríbele para proponer cambios.",
      };
}

/**
 * Calendario donde caen las campañas que crea un cliente con consultor: el
 * visible mas reciente de esa tienda (o de la organizacion si no hay tienda).
 * Si no existe ninguno se crea uno "Calendario {año}" visible: sin contenedor
 * el cliente no podria crear nada, y crearlo no aprueba ni publica acciones.
 */
async function ensureClientCalendar(
  env: ApiEnv,
  organizationId: string,
  storeId: string | null,
  year: number,
  userId: string,
) {
  const supabase = createServiceClient(env);
  let query = supabase
    .from("campaign_calendars")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_visible_to_client", true)
    .neq("status", "archived")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  query = storeId ? query.eq("store_id", storeId) : query.is("store_id", null);
  const { data, error } = await query;
  if (error) return { ok: false as const, statusCode: 503, error: "campaign_calendar_lookup_failed" };
  if (data?.[0]) return { ok: true as const, calendarId: data[0].id as string };
  const { data: created, error: createError } = await supabase
    .from("campaign_calendars")
    .insert({
      organization_id: organizationId,
      store_id: storeId,
      name: `Calendario ${year}`,
      year,
      is_visible_to_client: true,
      created_by: userId,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return { ok: false as const, statusCode: 503, error: "campaign_calendar_create_failed" };
  }
  return { ok: true as const, calendarId: created.id as string };
}

const CLIENT_ITEM_COLUMNS = "id, origin, created_by, review_status, title";

/**
 * Un cliente con consultor solo toca lo que creó él. Devuelve la fila si es suya
 * y si no, el 403 de siempre: lo ajeno lo lleva el consultor.
 */
async function requireOwnClientItem(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
) {
  const { data } = await createServiceClient(env)
    .from("campaign_calendar_items")
    .select(CLIENT_ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("is_visible_to_client", true)
    .maybeSingle();
  const item = data as {
    id: string;
    origin: string;
    created_by: string | null;
    review_status: ReviewStatus | null;
    title: string;
  } | null;
  if (!item || item.origin !== "client" || item.created_by !== context.user.id) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "agenda_managed_by_consultant",
      message: "La agenda la gestiona tu consultor. Solo puedes cambiar las campañas que has creado tú.",
    };
  }
  return { ok: true as const, item };
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

export function parseCampaignOutcomeVerdict(input: { verdict?: unknown; reason?: unknown }) {
  const verdict = input.verdict;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (typeof verdict !== "string" || !["worked", "did_not_work", "mixed"].includes(verdict)) {
    return { ok: false as const, error: "invalid_campaign_verdict" };
  }
  if (reason.length < 8 || reason.length > 2000) {
    return { ok: false as const, error: "campaign_verdict_reason_required" };
  }
  return { ok: true as const, verdict: verdict as "worked" | "did_not_work" | "mixed", reason };
}

export function nextCampaignOutcomeSourceVersion(nowMs: number, previousVersion: number | null | undefined) {
  return Math.max(Math.floor(nowMs / 1000), (previousVersion ?? 0) + 1);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resuelve la tienda del alcance. La web manda el id de la conexión Shopify
 * que tiene activa en el header (integration_connections.id), no el de
 * shopify_stores; antes solo se aceptaba el segundo y la Agenda fallaba con
 * invalid_store_scope en cuanto había una tienda elegida. Se aceptan los dos y
 * se devuelve siempre el id de shopify_stores, que es lo que guardan las tablas.
 */
export async function validateStore(
  env: ApiEnv,
  organizationId: string,
  storeId?: string | null,
): Promise<
  | { ok: true; storeId: string | null }
  | { ok: false; statusCode: number; error: string }
> {
  if (!storeId) return { ok: true, storeId: null };
  if (!UUID_RE.test(storeId))
    return { ok: false, statusCode: 400, error: "invalid_store_scope" };
  const { data } = await createServiceClient(env)
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId)
    .or(`id.eq.${storeId},connection_id.eq.${storeId}`)
    .limit(1)
    .maybeSingle();
  return data
    ? { ok: true, storeId: data.id as string }
    : { ok: false, statusCode: 400, error: "invalid_store_scope" };
}

export async function listCampaignPlanning(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  filters: { year?: number; storeId?: string | null; connectionId?: string | null },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const canSeeInternal = canSeeInternalCampaignPlanning(context);
  let requestedStoreId = filters.storeId;
  if (filters.connectionId) {
    const supabase = createServiceClient(env);
    const { data: selectedStore, error: selectedStoreError } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", filters.connectionId)
      .eq("is_active", true)
      .maybeSingle();
    if (selectedStoreError)
      return { ok: false as const, statusCode: 503, error: "campaign_store_lookup_failed" };
    if (!selectedStore)
      return { ok: false as const, statusCode: 404, error: "campaign_store_not_found" };
    requestedStoreId = selectedStore.id as string;
  }
  const store = await validateStore(env, organizationId, requestedStoreId);
  if (store.ok === false) return store;
  const supabase = createServiceClient(env);
  const agenda = await agendaAccess(env, context, organizationId);
  // La pantalla cambia segun el cliente tenga consultor (revisa lo que el crea) o se gobierne solo.
  const agendaInfo = { has_consultant: agenda.hasConsultant, is_staff: agenda.isStaff };
  let calendarsQuery = supabase
    .from("campaign_calendars")
    .select(
      "id, organization_id, store_id, name, year, status, description, is_visible_to_client, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  if (!canSeeInternal)
    calendarsQuery = calendarsQuery.eq("is_visible_to_client", true);
  if (filters.year) calendarsQuery = calendarsQuery.eq("year", filters.year);
  if (store.storeId && filters.connectionId)
    calendarsQuery = calendarsQuery.eq("store_id", store.storeId);
  else if (store.storeId)
    calendarsQuery = calendarsQuery.or(
      `store_id.is.null,store_id.eq.${store.storeId}`,
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
  let itemsQuery = supabase
    .from("campaign_calendar_items")
    .select(
      "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, origin, review_status, review_requested_at, reviewed_at, created_by, outcome_verdict, outcome_reason, outcome_decided_at, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .in("calendar_id", calendarIds)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });
  if (!canSeeInternal)
    itemsQuery = itemsQuery.eq("is_visible_to_client", true);
  const { data: items, error: itemsError } = calendarIds.length
    ? await itemsQuery
    : { data: [], error: null };
  if (itemsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "campaign_calendar_items_load_failed",
      detail: itemsError.message,
    };
  if (store.storeId && items) {
    return {
      ok: true as const,
      data: {
        calendars: calendars ?? [],
        agenda: agendaInfo,
        items: items.filter(
          (item) => !item.store_id || item.store_id === store.storeId,
        ),
      },
    };
  }
  return {
    ok: true as const,
    data: { calendars: calendars ?? [], agenda: agendaInfo, items: items ?? [] },
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
  const writer = await requireAgendaWriter(env, context, organizationId);
  if (writer.ok === false) return writer;
  const canSeeInternal = canSeeInternalCampaignPlanning(context);
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
      store_id: store.storeId,
      name,
      year,
      description: input.description?.trim() || null,
      is_visible_to_client: canSeeInternal
        ? (input.isVisibleToClient ?? true)
        : true,
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
    a05ProposalSource?: {
      outputId: string;
      campaignIndex: number;
      initiative: string;
      hierarchy?: Record<string, unknown>;
    };
    /**
     * «Sugerir una acción»: cualquier miembro puede proponer una acción; entra
     * marcada como propuesta hasta que quien lleva la agenda la acepta o la
     * archiva. Es la única escritura que el cliente con consultor puede hacer.
     */
    clientSuggestion?: boolean;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const suggestion = input.clientSuggestion === true;
  // Un cliente con consultor no escribe la agenda ajena, pero SÍ crea su
  // propia campaña: entra como origen `client` y en revisión del consultor.
  let clientOwn = false;
  let ownCalendar = false;
  if (!suggestion) {
    const agenda = await agendaAccess(env, context, organizationId);
    clientOwn = !agenda.writeAll;
    // Un cliente sin consultor tampoco conoce el id de su calendario: se resuelve igual.
    ownCalendar = !agenda.isStaff;
  }
  if (
    (suggestion || clientOwn) &&
    (input.createTask ||
      input.milestoneId ||
      input.metaCampaignId ||
      input.klaviyoCampaignId ||
      (suggestion && input.marketingDraftId))
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_suggestion",
    };
  }
  const fromClient = suggestion || clientOwn;
  const canSeeInternal = canSeeInternalCampaignPlanning(context);
  const title = input.title?.trim();
  let calendarId = input.calendarId;
  if (ownCalendar && !calendarId && title && input.startsAt) {
    const startDate = new Date(input.startsAt);
    if (Number.isNaN(startDate.getTime()))
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_campaign_calendar_dates",
      };
    const ownStore = await validateStore(env, organizationId, input.storeId);
    if (ownStore.ok === false) return ownStore;
    const resolved = await ensureClientCalendar(
      env,
      organizationId,
      ownStore.storeId,
      startDate.getUTCFullYear(),
      context.user.id,
    );
    if (resolved.ok === false) return resolved;
    calendarId = resolved.calendarId;
  }
  if (!calendarId || !title || !input.startsAt || !input.channel?.trim())
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
    .select("id, store_id, is_visible_to_client")
    .eq("id", calendarId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!calendar || (!canSeeInternal && !calendar.is_visible_to_client))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_calendar",
    };
  const store = await validateStore(env, organizationId, input.storeId);
  if (store.ok === false) return store;
  if (calendar.store_id !== store.storeId)
    return {
      ok: false as const,
      statusCode: 400,
      error: "campaign_calendar_store_mismatch",
    };
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
      calendar_id: calendarId,
      store_id: store.storeId,
      title,
      description: input.description?.trim() || null,
      channel: input.channel.trim(),
      item_type: input.itemType?.trim() || "campaign",
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt === null ? null : new Date(endsAt).toISOString(),
      status: fromClient ? "planned" : (input.status ?? "planned"),
      is_visible_to_client:
        canSeeInternal && !fromClient ? (input.isVisibleToClient ?? true) : true,
      origin: fromClient ? "client" : input.a05ProposalSource ? "ai" : "staff",
      ...(fromClient
        ? { review_status: "pending", review_requested_at: new Date().toISOString() }
        : {}),
      ...(suggestion || input.a05ProposalSource
        ? {
            metadata: {
              ...(input.a05ProposalSource
                ? {
                    a05_proposal: {
                      output_id: input.a05ProposalSource.outputId,
                      campaign_index: input.a05ProposalSource.campaignIndex,
                      action_index: input.a05ProposalSource.campaignIndex,
                      initiative: input.a05ProposalSource.initiative,
                      hierarchy: input.a05ProposalSource.hierarchy ?? null,
                    },
                  }
                : {}),
              ...(suggestion ? {
              client_suggestion: {
                pending: true,
                suggested_by: context.user.id,
                suggested_at: new Date().toISOString(),
              },
              } : {}),
            },
          }
        : {}),
      marketing_draft_id: input.marketingDraftId ?? null,
      meta_campaign_id: input.metaCampaignId ?? null,
      klaviyo_campaign_id: input.klaviyoCampaignId ?? null,
      created_by: context.user.id,
    })
    .select(
      "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, origin, review_status, created_by, metadata, created_at, updated_at",
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
      isVisibleToClient: canSeeInternal
        ? (input.isVisibleToClient ?? true)
        : true,
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
        "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, origin, review_status, created_by, metadata, created_at, updated_at",
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
  if (fromClient) {
    // El consultor se entera de lo que crea su cliente y la tiene en su cola de
    // revision. Best-effort: el aviso no puede tumbar la creacion.
    await supabase.from("campaign_item_notes").insert({
      organization_id: organizationId,
      item_id: data.id,
      author_user_id: context.user.id,
      author_kind: "system",
      kind: "system",
      body: suggestion
        ? "El cliente ha sugerido esta acción. Queda pendiente de tu revisión."
        : "El cliente ha creado esta campaña. Queda pendiente de tu revisión.",
      visible_to_client: true,
    });
    await notifyCampaignEvent(supabase, {
      event: "client_created",
      organizationId,
      itemId: data.id as string,
      itemTitle: title,
      actorUserId: context.user.id,
    });
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
  const agenda = await agendaAccess(env, context, organizationId);
  if (!agenda.writeAll) {
    const own = await requireOwnClientItem(env, context, organizationId, itemId);
    if (own.ok === false) return own;
  }
  if (!itemId)
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_campaign_calendar_item",
    };
  const supabase = createServiceClient(env);
  let archiveQuery = supabase
    .from("campaign_calendar_items")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: context.user.id,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (!canSeeInternalCampaignPlanning(context))
    archiveQuery = archiveQuery.eq("is_visible_to_client", true);
  const { data, error } = await archiveQuery
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
    /** Acepta una acción que propuso el cliente: deja de estar pendiente. */
    acceptSuggestion?: boolean;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const agenda = await agendaAccess(env, context, organizationId);
  // Cliente con consultor: solo lo suyo, y sin tocar estado ni enlaces del
  // proveedor (eso es del consultor). Editar lo suyo la devuelve a revision.
  let ownClientItem: Awaited<ReturnType<typeof requireOwnClientItem>> | null = null;
  if (!agenda.writeAll) {
    ownClientItem = await requireOwnClientItem(env, context, organizationId, itemId);
    if (ownClientItem.ok === false) return ownClientItem;
    if (
      input.status !== undefined ||
      input.metaCampaignId !== undefined ||
      input.klaviyoCampaignId !== undefined ||
      input.acceptSuggestion
    ) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "agenda_managed_by_consultant",
        message: "El estado y las campañas del proveedor los lleva tu consultor.",
      };
    }
  }
  const supabase = createServiceClient(env);
  const payload: Record<string, unknown> = {};
  if (input.acceptSuggestion) {
    const { data: current } = await supabase
      .from("campaign_calendar_items")
      .select("metadata")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const metadata = (current?.metadata ?? {}) as Record<string, unknown>;
    const suggestionMeta = metadata.client_suggestion as
      | Record<string, unknown>
      | undefined;
    if (suggestionMeta) {
      payload.metadata = {
        ...metadata,
        client_suggestion: {
          ...suggestionMeta,
          pending: false,
          accepted_by: context.user.id,
          accepted_at: new Date().toISOString(),
        },
      };
      // Aceptar la sugerencia es revisarla: sale de la cola de revision.
      payload.review_status = "reviewed";
      payload.reviewed_by = context.user.id;
      payload.reviewed_at = new Date().toISOString();
    }
  }
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
  const ownItem = ownClientItem && ownClientItem.ok ? ownClientItem.item : null;
  const nextReview = ownItem
    ? reviewStatusAfterClientActivity(ownItem.review_status, "edit")
    : null;
  const reopened = ownItem !== null && ownItem.review_status !== nextReview;
  if (ownItem && nextReview) {
    payload.review_status = nextReview;
    if (reopened) payload.review_requested_at = new Date().toISOString();
  }
  let updateQuery = supabase
    .from("campaign_calendar_items")
    .update(payload)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (!canSeeInternalCampaignPlanning(context))
    updateQuery = updateQuery.eq("is_visible_to_client", true);
  const { data, error } = await updateQuery.select(
    "id, organization_id, calendar_id, store_id, title, description, channel, item_type, starts_at, ends_at, status, is_visible_to_client, task_id, milestone_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, origin, review_status, created_by, metadata, created_at, updated_at",
  ).maybeSingle();
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
  if (ownItem && reopened) {
    await supabase.from("campaign_item_notes").insert({
      organization_id: organizationId,
      item_id: itemId,
      author_user_id: context.user.id,
      author_kind: "system",
      kind: "system",
      body: "El cliente ha editado la campaña: vuelve a estar pendiente de tu revisión.",
      visible_to_client: true,
    });
    await notifyCampaignEvent(supabase, {
      event: "client_edited",
      organizationId,
      itemId,
      itemTitle: ownItem.title,
      actorUserId: context.user.id,
    });
  }
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
  query = store.storeId
    ? query.eq("store_id", store.storeId)
    : query.is("store_id", null);
  const { data: existing } = await query.maybeSingle();
  const payload = {
    organization_id: organizationId,
    store_id: store.storeId,
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
  query = store.storeId
    ? query.eq("store_id", store.storeId)
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
  storeId = store.storeId;
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

/** Veredicto explícito del consultor: se pide motivo y solo aplica a una acción ya publicada/ejecutada. */
export async function recordCampaignOutcomeVerdict(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  input: { verdict?: string; reason?: string },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  if (!canSeeInternalCampaignPlanning(context)) {
    return { ok: false as const, statusCode: 403, error: "consultant_verdict_required" };
  }
  const parsed = parseCampaignOutcomeVerdict(input);
  if (parsed.ok === false) return { ok: false as const, statusCode: 400, error: parsed.error };
  const { verdict, reason } = parsed;
  const supabase = createServiceClient(env);
  const { data: item, error: loadError } = await supabase.from("campaign_calendar_items")
    .select("id, status, store_id, title, channel, starts_at, outcome_verdict, outcome_reason, outcome_decided_by, outcome_decided_at").eq("id", itemId).eq("organization_id", organizationId)
    .is("deleted_at", null).maybeSingle();
  if (loadError) return { ok: false as const, statusCode: 500, error: "campaign_verdict_item_load_failed", detail: loadError.message };
  if (!item) return { ok: false as const, statusCode: 404, error: "campaign_item_not_found" };
  if (!["published", "completed"].includes(item.status)) {
    return { ok: false as const, statusCode: 409, error: "campaign_not_executed_yet" };
  }
  const { data: previousMemory, error: memoryVersionError } = await supabase.from("memory_ingestion_queue")
    .select("source_version").eq("organization_id", organizationId)
    .eq("source_type", "campaign_outcome_verdict").eq("source_entity_id", itemId)
    .order("source_version", { ascending: false }).limit(1).maybeSingle();
  if (memoryVersionError) return { ok: false as const, statusCode: 503, error: "campaign_memory_version_load_failed", detail: memoryVersionError.message };
  const unchanged = item.outcome_verdict === verdict && item.outcome_reason === reason;
  // Retry the outbox if a previous enqueue was unavailable; if it already
  // exists, a repeated HTTP request is idempotent and adds no duplicate memory.
  if (unchanged && previousMemory) {
    return { ok: true as const, data: {
      id: item.id, outcome_verdict: item.outcome_verdict, outcome_reason: item.outcome_reason,
      outcome_decided_by: item.outcome_decided_by, outcome_decided_at: item.outcome_decided_at,
    } };
  }
  const decidedAt = unchanged && item.outcome_decided_at
    ? item.outcome_decided_at
    : new Date().toISOString();
  const { data, error } = unchanged
    ? { data: {
        id: item.id, outcome_verdict: item.outcome_verdict, outcome_reason: item.outcome_reason,
        outcome_decided_by: item.outcome_decided_by, outcome_decided_at: item.outcome_decided_at,
      }, error: null }
    : await supabase.from("campaign_calendar_items").update({
        outcome_verdict: verdict, outcome_reason: reason.slice(0, 2000),
        outcome_decided_by: context.user.id, outcome_decided_at: decidedAt,
      }).eq("id", itemId).eq("organization_id", organizationId)
        .select("id, outcome_verdict, outcome_reason, outcome_decided_by, outcome_decided_at").single();
  if (error) return { ok: false as const, statusCode: 500, error: "campaign_verdict_save_failed", detail: error.message };
  await enqueueMemoryIngestion(env, {
    organizationId,
    storeId: item.store_id ?? null,
    sourceType: "campaign_outcome_verdict",
    sourceEntityType: "campaign_calendar_item",
    sourceEntityId: itemId,
    sourceVersion: nextCampaignOutcomeSourceVersion(Date.parse(decidedAt), previousMemory?.source_version),
    sourceActorId: context.user.id,
    audience: "consultant_only",
    origin: "human_decision",
    authority: "operational",
    title: `Resultado de campaña: ${item.title}`,
    content: `El consultor registró el resultado «${verdict}» para la acción de campaña «${item.title}» (${item.channel}), programada para ${item.starts_at}. Motivo indicado por el consultor: ${reason.slice(0, 2000)}`,
  });
  return { ok: true as const, data };
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
  timezone = plan.planning_window?.timezone || "UTC",
) {
  const all = flattenCampaignPlanActions(plan, acceptedAtMs);
  const chosen = Array.isArray(selectedIndexes)
    ? [...new Set(selectedIndexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < all.length)
    : all.map((_, index) => index);
  const dayMs = 24 * 60 * 60 * 1000;
  return chosen.map((index) => {
    const action = all[index]!;
    const [hour, minute] = action.scheduled_time?.split(":").map(Number) ?? [9, 0];
    const startsAt = localCampaignDateTimeToUtc(action.scheduled_date, timezone, hour, minute);
    return {
      index,
      title: action.title,
      initiative: action.initiative,
      channel: action.channel,
      hierarchy: action.hierarchy,
      startsAt: startsAt.toISOString(),
      endsAt: localCampaignDateTimeToUtc(
        new Date(Date.parse(action.scheduled_date + "T00:00:00.000Z") + dayMs).toISOString().slice(0, 10),
        timezone,
        hour,
        minute,
      ).toISOString(),
      description: action.description,
    };
  });
}
/**
 * Calendario de la tienda donde caen las campanas de un plan: el no archivado
 * mas reciente de este año o, si no hay ninguno, uno nuevo "Calendario <año>".
 * Asi llevar un plan al calendario no exige elegir uno antes.
 */
async function ensureStoreCalendar(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  storeId: string,
  forClientSuggestion = false,
) {
  const supabase = createServiceClient(env);
  let calendarsQuery = supabase
    .from("campaign_calendars")
    .select("id, year, status, is_visible_to_client")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .neq("status", "archived")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (forClientSuggestion) {
    calendarsQuery = calendarsQuery.eq("is_visible_to_client", true);
  }
  const { data, error } = await calendarsQuery;
  if (error) {
    return { ok: false as const, statusCode: 503, error: "campaign_plan_calendar_lookup_failed" };
  }
  const existing = data?.[0];
  if (existing) return { ok: true as const, calendarId: existing.id as string };
  const year = new Date().getUTCFullYear();
  if (forClientSuggestion) {
    // Hace falta un contenedor visible para que el consultor pueda revisar las
    // sugerencias A05. Crear este calendario no aprueba ni publica acciones.
    const { data: created, error: createError } = await supabase
      .from("campaign_calendars")
      .insert({
        organization_id: organizationId,
        store_id: storeId,
        name: `Calendario ${year}`,
        year,
        is_visible_to_client: true,
        created_by: context.user.id,
      })
      .select("id")
      .single();
    if (createError || !created) {
      return {
        ok: false as const,
        statusCode: 503,
        error: "campaign_plan_calendar_create_failed",
      };
    }
    return { ok: true as const, calendarId: created.id as string };
  }
  const created = await createCampaignCalendar(env, context, organizationId, {
    name: `Calendario ${year}`,
    year,
    storeId,
    isVisibleToClient: true,
  });
  if (created.ok === false) return created;
  return { ok: true as const, calendarId: (created.data as { id: string }).id };
}

/** Rechaza una propuesta A05 y retira sus acciones planificadas del calendario. */
export async function rejectCampaignPlanProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  outputId: string,
  connectionId?: string | null,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  if (!UUID_RE.test(outputId))
    return { ok: false as const, statusCode: 400, error: "invalid_campaign_plan_output" };

  const supabase = createServiceClient(env);
  const { data: output, error: outputError } = await supabase
    .from("agent_outputs")
    .select("id, status, agent_runs!inner(store_id, actor_user_id, agent_versions!inner(agent_definitions!inner(code)))")
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (outputError) return { ok: false as const, statusCode: 503, error: "campaign_plan_proposal_load_failed" };
  if (!output) return { ok: false as const, statusCode: 404, error: "campaign_plan_proposal_not_found" };

  const runValue = output.agent_runs as unknown as {
    store_id: string | null;
    actor_user_id: string | null;
    agent_versions: { agent_definitions: { code: string } | Array<{ code: string }> } | Array<{ agent_definitions: { code: string } | Array<{ code: string }> }>;
  } | Array<{
    store_id: string | null;
    actor_user_id: string | null;
    agent_versions: { agent_definitions: { code: string } | Array<{ code: string }> } | Array<{ agent_definitions: { code: string } | Array<{ code: string }> }>;
  }> | null;
  const run = Array.isArray(runValue) ? runValue[0] : runValue;
  const version = Array.isArray(run?.agent_versions) ? run.agent_versions[0] : run?.agent_versions;
  const definition = Array.isArray(version?.agent_definitions) ? version.agent_definitions[0] : version?.agent_definitions;
  if (definition?.code !== "a05_estrategia_campanas")
    return { ok: false as const, statusCode: 400, error: "campaign_plan_proposal_wrong_agent" };
  if (!run?.store_id)
    return { ok: false as const, statusCode: 409, error: "campaign_plan_store_missing" };
  if (connectionId) {
    const store = await validateStore(env, organizationId, connectionId);
    if (store.ok === false) return store;
    if (store.storeId !== run.store_id)
      return { ok: false as const, statusCode: 409, error: "campaign_plan_store_mismatch", message: "La propuesta pertenece a otra tienda." };
  }
  const canManage = canSeeInternalCampaignPlanning(context) || ["owner", "manager"].includes(access.membership.role);
  if (!canManage && run.actor_user_id !== context.user.id)
    return { ok: false as const, statusCode: 403, error: "campaign_plan_reject_forbidden", message: "Solo quien pidió esta propuesta o quien gestiona la tienda puede rechazarla." };
  if (output.status === "rejected") return { ok: true as const, data: { removed: 0 } };

  // Se incluyen las filas ya archivadas para que un reintento pueda limpiar
  // tareas si una escritura anterior falló a mitad del proceso.
  const { data: items, error: itemsError } = await supabase
    .from("campaign_calendar_items")
    .select("id, status, deleted_at, task_id, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id")
    .eq("organization_id", organizationId)
    .eq("store_id", run.store_id)
    .contains("metadata", { a05_proposal: { output_id: outputId } });
  if (itemsError) return { ok: false as const, statusCode: 503, error: "campaign_plan_items_load_failed" };
  const activeItems = (items ?? []).filter((item) => !item.deleted_at);
  if (activeItems.some((item) => item.status !== "planned" || item.marketing_draft_id || item.meta_campaign_id || item.klaviyo_campaign_id))
    return { ok: false as const, statusCode: 409, error: "campaign_plan_items_in_progress", message: "Hay campañas en ejecución o con contenido vinculado. Revísalas por separado antes de rechazar el plan." };

  const taskIds = [...new Set((items ?? []).map((item) => item.task_id).filter((id): id is string => Boolean(id)))];
  if (taskIds.length) {
    const [{ data: tasks, error: tasksError }, { data: shared, error: sharedError }] = await Promise.all([
      supabase.from("tasks").select("id, status").eq("organization_id", organizationId).in("id", taskIds),
      supabase.from("campaign_calendar_items").select("id, task_id").eq("organization_id", organizationId).in("task_id", taskIds).is("deleted_at", null),
    ]);
    if (tasksError || sharedError)
      return { ok: false as const, statusCode: 503, error: "campaign_plan_tasks_load_failed" };
    if ((tasks ?? []).some((task) => task.status !== "pending") || (shared ?? []).some((item) => !activeItems.some((own) => own.id === item.id)))
      return { ok: false as const, statusCode: 409, error: "campaign_plan_tasks_in_progress", message: "Una tarea de estas campañas ya empezó o está compartida. Revísala antes de rechazar el plan." };
  }

  if (activeItems.length) {
    const { data: archived, error: archiveError } = await supabase
      .from("campaign_calendar_items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.user.id })
      .eq("organization_id", organizationId)
      .eq("store_id", run.store_id)
      .in("id", activeItems.map((item) => item.id))
      .eq("status", "planned")
      .is("deleted_at", null)
      .select("id");
    if (archiveError) return { ok: false as const, statusCode: 503, error: "campaign_plan_items_archive_failed" };
    if (archived?.length !== activeItems.length)
      return { ok: false as const, statusCode: 409, error: "campaign_plan_items_changed", message: "Las campañas cambiaron mientras se rechazaba el plan. Revisa el calendario y vuelve a intentarlo." };
  }
  if (taskIds.length) {
    const { error: deleteError } = await supabase.from("tasks")
      .delete().eq("organization_id", organizationId).in("id", taskIds).eq("status", "pending");
    if (deleteError) return { ok: false as const, statusCode: 503, error: "campaign_plan_tasks_delete_failed", detail: deleteError.message };
  }
  const { data: remaining, error: remainingError } = await supabase.from("campaign_calendar_items")
    .select("id").eq("organization_id", organizationId).eq("store_id", run.store_id)
    .contains("metadata", { a05_proposal: { output_id: outputId } }).is("deleted_at", null).limit(1);
  if (remainingError || remaining?.length)
    return { ok: false as const, statusCode: 409, error: "campaign_plan_items_changed", message: "Quedan campañas activas de esta propuesta. Revisa el calendario y vuelve a intentarlo." };
  const { error: rejectError } = await supabase.from("agent_outputs")
    .update({ status: "rejected" })
    .eq("id", outputId).eq("organization_id", organizationId);
  if (rejectError) return { ok: false as const, statusCode: 503, error: "campaign_plan_reject_failed" };
  await supabase.from("agent_approvals").insert({
    output_id: outputId,
    organization_id: organizationId,
    decision: "rejected",
    decided_by: context.user.id,
    reason: "Propuesta A05 rechazada; acciones planificadas retiradas del calendario",
  });
  return { ok: true as const, data: { removed: activeItems.length } };
}

/** Materializa (total o parcialmente) una propuesta A05 en el calendario. */
export async function createCampaignItemsFromProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    outputId?: string | undefined;
    /** Sin calendario se usa el de la tienda y el año de la campaña, y se crea si no existe. */
    calendarId?: string | undefined;
    /** Tienda del Camino al que se unen las campañas: la propuesta A05 debe ser de la misma. */
    expectedStoreId?: string | null | undefined;
    selectedIndexes?: number[] | undefined;
    /** La generación automática solo materializa iniciativas internas; no aprueba la salida A05. */
    mode?: "approve" | "draft" | undefined;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;

  if (!input.outputId) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_campaign_plan_proposal_input",
    };
  }

  const supabase = createServiceClient(env);
  const mode = input.mode ?? "approve";
  const isClientSuggestion = mode === "draft" &&
    !canSeeInternalCampaignPlanning(context) &&
    await hasAssignedConsultant(supabase, organizationId);

  // Acotado a la organizacion: un id de otra cuenta no resuelve, no "resuelve
  // y luego se comprueba".
  const { data: output, error: outputError } = await supabase
    .from("agent_outputs")
    .select(
      "id, status, output, agent_runs!inner(id, store_id, agent_versions!inner(agent_definitions!inner(code)))",
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
    | { store_id?: string | null; agent_versions?: { agent_definitions?: { code?: string } } }
    | Array<{ store_id?: string | null; agent_versions?: { agent_definitions?: { code?: string } } }>
    | null;
  const run = Array.isArray(runs) ? runs[0] : runs;
  const runStoreId = run?.store_id ?? null;
  if (input.expectedStoreId !== undefined && runStoreId !== input.expectedStoreId) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "campaign_plan_store_mismatch",
      message: "Las campañas elegidas son de otra tienda que este Camino.",
    };
  }
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

  let calendarId = input.calendarId;
  if (!calendarId && runStoreId) {
    const resolved = await ensureStoreCalendar(
      env,
      context,
      organizationId,
      runStoreId,
      isClientSuggestion,
    );
    if (resolved.ok === false) return resolved;
    calendarId = resolved.calendarId;
  }
  if (!calendarId) {
    return { ok: false as const, statusCode: 400, error: "invalid_campaign_plan_proposal_input" };
  }
  const { data: calendar, error: calendarError } = await supabase
    .from("campaign_calendars")
    .select("id, store_id")
    .eq("id", calendarId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (calendarError)
    return {
      ok: false as const,
      statusCode: 503,
      error: "campaign_plan_calendar_lookup_failed",
    };
  if (!calendar)
    return {
      ok: false as const,
      statusCode: 404,
      error: "campaign_plan_calendar_not_found",
    };
  if (!runStoreId || calendar.store_id !== runStoreId)
    return {
      ok: false as const,
      statusCode: 409,
      error: "campaign_plan_store_calendar_mismatch",
      message: "La propuesta y el calendario deben pertenecer a la misma tienda. Genera otra propuesta para esa tienda.",
    };

  const { data: store, error: storeError } = await supabase
    .from("shopify_stores")
    .select("timezone")
    .eq("id", runStoreId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (storeError || !store)
    return {
      ok: false as const,
      statusCode: 503,
      error: "campaign_plan_store_unavailable",
    };
  if (output.status === "rejected") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "campaign_plan_proposal_rejected",
      message: "Esta propuesta se rechazó. Genera una nueva planificación.",
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

  const currentParsed = currentCampaignPlanOutputSchema.safeParse(output.output);
  const legacyParsed = !currentParsed.success &&
    !(output.output && typeof output.output === "object" && "initiatives" in output.output)
    ? campaignPlanOutputSchema.safeParse(output.output)
    : null;
  const parsed = currentParsed.success ? currentParsed : legacyParsed;
  if (parsed === null || !parsed.success) {
    return {
      ok: false as const,
      statusCode: 422,
      error: "campaign_plan_proposal_invalid",
      detail: parsed === null ? "campaign_plan_output_format_not_supported" : parsed.error.message,
    };
  }
  const allItems = campaignPlanToCalendarItems(parsed.data, Date.now(), undefined, store.timezone || parsed.data.planning_window?.timezone || "UTC");
  const selectedIndexes = input.selectedIndexes === undefined
    ? allItems.map((item) => item.index)
    : [...new Set(input.selectedIndexes)];
  if (
    (mode !== "draft" && selectedIndexes.length === 0) ||
    selectedIndexes.some((index) =>
      !Number.isInteger(index) || index < 0 || index >= allItems.length,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "campaign_plan_selection_invalid",
      message: "La selección contiene campañas no válidas.",
    };
  }

  if (parsed.data.planning_window) {
    const { timezone, start_date: startDate, end_date: endDate } = parsed.data.planning_window;
    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const today = todayParts.find((part) => part.type === "year")?.value + "-" +
      todayParts.find((part) => part.type === "month")?.value + "-" +
      todayParts.find((part) => part.type === "day")?.value;
    const localDate = (value: string) => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
      return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
    };
    const invalidDate = selectedIndexes.some((index) => {
      const date = allItems[index] ? localDate(allItems[index]!.startsAt) : "";
      return !date || date < startDate || date > endDate || allItems[index]!.startsAt < new Date().toISOString();
    });
    if (invalidDate)
      return {
        ok: false as const,
        statusCode: 409,
        error: "campaign_plan_date_outside_window_or_past",
        message: "Una fecha propuesta ya pasó o queda fuera del intervalo. Genera de nuevo el calendario.",
      };
  }
  const timezone = store.timezone || parsed.data.planning_window?.timezone || "UTC";

  const items = campaignPlanToCalendarItems(parsed.data, Date.now(), selectedIndexes, timezone);
  if (items.length === 0)
    return mode === "draft"
      ? { ok: true as const, data: { created: 0, already_created: 0, item_ids: [], failed: [], linked_to_plan: 0, complete: true, status: "planned" } }
      : {
          ok: false as const,
          statusCode: 400,
          error: "campaign_plan_selection_empty",
          message: "Selecciona al menos una iniciativa para llevar al calendario.",
        };

  // Con un Camino abierto en esta tienda, cada campaña pasa a ser tambien una
  // tarea de su hito: se completa desde el mapa y desde el calendario.
  const { data: openPlan } = mode === "approve"
    ? await supabase
        .from("strategic_plans")
        .select("id, strategic_plan_phases(strategic_plan_milestones(id, target_date, position))")
        .eq("organization_id", organizationId)
        .eq("store_id", runStoreId)
        .in("status", ["draft", "active"])
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const planMilestones = mode === "approve"
    ? ((openPlan as { strategic_plan_phases?: Array<{ strategic_plan_milestones?: Array<{ id: string; target_date: string | null; position: number | null }> }> } | null)
        ?.strategic_plan_phases ?? []).flatMap((phase) => phase.strategic_plan_milestones ?? [])
    : [];

  const created: string[] = [];
  const alreadyCreated: string[] = [];
  const failed: Array<{ title: string; error: string }> = [];
  let linkedToPlan = 0;
  for (const item of items) {
    const { data: existingItem, error: existingItemError } = await supabase
      .from("campaign_calendar_items")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("store_id", runStoreId)
      .contains("metadata", {
        a05_proposal: {
          output_id: input.outputId,
          campaign_index: item.index,
        },
      })
      .maybeSingle();
    if (existingItemError) {
      failed.push({ title: item.title, error: "campaign_plan_existing_item_lookup_failed" });
      continue;
    }
    if (existingItem) {
      alreadyCreated.push((existingItem as { id: string }).id);
      continue;
    }
    const milestoneId = planMilestones.length ? pickMilestoneForDate(planMilestones, item.startsAt) : null;
    const result = await createCampaignCalendarItem(env, context, organizationId, {
      calendarId,
      title: item.title,
      description: item.description,
      channel: item.channel,
      itemType: "campaign",
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      storeId: runStoreId,
      status: "planned",
      // Nace como plan interno del consultor: la campana se comparte con el
      // cliente cuando el consultor decide, no por haberla aprobado.
      // Si forma parte de un Camino acordado, el equipo la ve y la completa ahi.
      isVisibleToClient: milestoneId !== null,
      createTask: milestoneId !== null,
      milestoneId,
      a05ProposalSource: {
        outputId: input.outputId,
        campaignIndex: item.index,
        initiative: item.initiative,
        hierarchy: item.hierarchy,
      },
      clientSuggestion: isClientSuggestion,
    });
    if (result.ok === false) {
      failed.push({ title: item.title, error: result.error });
      continue;
    }
    if (milestoneId) linkedToPlan += 1;
    created.push((result.data as { id: string }).id);
  }

  // Solo se marca aplicada si algo se creo: si fallaron todas, la propuesta
  // sigue disponible para reintentar en vez de quedar consumida.
  const { data: allAppliedItems, error: allAppliedError } = await supabase
    .from("campaign_calendar_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("store_id", runStoreId)
    .is("deleted_at", null)
    .contains("metadata", { a05_proposal: { output_id: input.outputId } });
  if (allAppliedError)
    failed.push({ title: "Verificar progreso del plan", error: "campaign_plan_completion_lookup_failed" });
  const allCampaignsApplied = !allAppliedError &&
    (allAppliedItems?.length ?? 0) >= allItems.length;
  if (mode === "approve" && allCampaignsApplied && failed.length === 0) {
    await supabase
      .from("agent_outputs")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", input.outputId);

    await supabase.from("agent_approvals").insert({
      output_id: input.outputId,
      organization_id: organizationId,
      decision: "approved",
      decided_by: context.user.id,
      reason: `${allAppliedItems?.length ?? 0} campana(s) creadas en el calendario`,
    });
  }

  return {
    ok: true as const,
    data: {
      created: created.length,
      already_created: alreadyCreated.length,
      item_ids: [...alreadyCreated, ...created],
      failed,
      linked_to_plan: linkedToPlan,
      complete: allCampaignsApplied && failed.length === 0,
      status: mode === "draft" ? "planned" : "approved",
    },
  };
}
