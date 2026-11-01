import type { KlaviyoClient } from "./klaviyo-client.js";

export const KLAVIYO_VARIATION_BETA_REVISION = "2026-07-15.pre";
// Same normalized resource shape, now generally available; beta remains an explicit adapter.
export const KLAVIYO_VARIATION_CONTENT_REVISION = "2026-10-15";
export const KLAVIYO_VARIATION_CONTENT_MAX_MESSAGES = 12;

export type KlaviyoCampaignVariationContentRef = {
  account_id: string;
  message_id: string;
  variation_id: string;
  variation_name: string | null;
  channel: string;
  template_id: string | null;
  subject: string | null;
  preview_text: string | null;
  provider_updated_at: string | null;
};

export type KlaviyoCampaignVariationMessageRef = {
  account_id: string;
  message_id: string | null;
};

export function indexKlaviyoVariationConnections(
  accounts: readonly { id: string; connection_id: string | null }[],
) {
  return new Map(
    accounts.flatMap((account) =>
      account.id && account.connection_id
        ? [[account.id, account.connection_id] as const]
        : [],
    ),
  );
}

type JsonApiLink = { id?: unknown; type?: unknown };
type BetaVariationResource = {
  id?: unknown;
  type?: unknown;
  attributes?: {
    updated?: unknown;
    definition?: {
      name?: unknown;
      details?: Record<string, unknown> | null;
    } | null;
  };
};
type BetaMessageResponse = {
  data?: {
    id?: unknown;
    relationships?: {
      [key: string]: { data?: JsonApiLink[] } | undefined;
    };
  };
  included?: BetaVariationResource[];
};

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildKlaviyoCampaignMessageVariationPath(messageId: string) {
  const query = new URLSearchParams();
  query.set("include", "campaign-variations");
  query.set("fields[campaign-variation]", "definition");
  return `/campaign-messages/${encodeURIComponent(messageId)}?${query.toString()}`;
}

export function normalizeKlaviyoCampaignMessageVariations(
  accountId: string,
  requestedMessageId: string,
  response: BetaMessageResponse,
): KlaviyoCampaignVariationContentRef[] {
  if (response.data?.id !== requestedMessageId) return [];
  const relationships = response.data.relationships?.["campaign-variations"]?.data ?? [];
  const allowedIds = new Set(
    relationships
      .filter((link) => link.type === "campaign-variation" && typeof link.id === "string")
      .map((link) => link.id as string),
  );
  return (response.included ?? []).flatMap((resource) => {
    if (resource.type !== "campaign-variation" || typeof resource.id !== "string" || !allowedIds.has(resource.id)) {
      return [];
    }
    const details = resource.attributes?.definition?.details;
    if (!details || details.channel !== "email") return [];
    return [{
      account_id: accountId,
      message_id: requestedMessageId,
      variation_id: resource.id,
      variation_name: optionalString(resource.attributes?.definition?.name),
      channel: "email",
      template_id: optionalString(details.template_id),
      subject: optionalString(details.subject),
      preview_text: optionalString(details.preview_text),
      provider_updated_at: optionalString(resource.attributes?.updated),
    }];
  });
}

/** Beta-only fetch, explicitly bounded and scoped to IDs already obtained from
 * the authenticated account's own campaign-message inventory. */
export async function fetchKlaviyoCampaignVariations(
  messages: readonly KlaviyoCampaignVariationMessageRef[],
  getClient: (accountId: string) => Promise<KlaviyoClient>,
  maxMessages = KLAVIYO_VARIATION_CONTENT_MAX_MESSAGES,
) {
  const unique = new Map<string, KlaviyoCampaignVariationMessageRef>();
  for (const message of messages) {
    if (!message.message_id) continue;
    unique.set(`${message.account_id}\u0000${message.message_id}`, message);
  }
  const eligible = [...unique.values()];
  const limit = Math.max(0, Math.floor(maxMessages));
  const selected = eligible.slice(0, limit);
  const rows: KlaviyoCampaignVariationContentRef[] = [];
  let failedMessages = 0;

  for (const message of selected) {
    try {
      const client = await getClient(message.account_id);
      const response = await client.request<BetaMessageResponse>(
        buildKlaviyoCampaignMessageVariationPath(message.message_id!),
      );
      rows.push(...normalizeKlaviyoCampaignMessageVariations(
        message.account_id,
        message.message_id!,
        response,
      ));
    } catch {
      // Do not pass provider response bodies, which can contain account data,
      // into prompts or logs. The caller receives only coverage counts.
      failedMessages++;
    }
  }

  return {
    rows,
    eligibleMessages: eligible.length,
    requestedMessages: selected.length,
    omittedMessages: Math.max(0, eligible.length - selected.length),
    failedMessages,
  };
}

export function klaviyoVariationBodyProvenance(input: {
  templateId: string | null;
  bodyAvailable: boolean;
  providerUpdatedAt: string | null;
  sendTime: string | null;
  historicalSource: string | null;
}) {
  if (!input.templateId) return "la_variacion_no_declara_template_id; contenido_especifico_no_disponible";
  if (!input.bodyAvailable) return "template_id_de_variacion_conocido; cuerpo_no_encontrado_en_sync";
  if (input.historicalSource) {
    return {
      fuente: "klaviyo_template_snapshot",
      coincidencia: input.historicalSource,
      template_id: input.templateId,
      variacion_actualizada_en: input.providerUpdatedAt,
      envio_de_campana: input.sendTime,
      certeza: "version de plantilla observada; no garantiza personalizacion ni entrega por destinatario",
    };
  }
  return {
    fuente: "klaviyo_template_sync_current",
    template_id: input.templateId,
    variacion_actualizada_en: input.providerUpdatedAt,
    envio_de_campana: input.sendTime,
    certeza: "cuerpo actual sincronizado; no se encontro snapshot que confirme la version usada en el envio",
  };
}
