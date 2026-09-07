import type { MarketingDraft } from "@/hooks/use-marketing-drafts";

export type MetaAdPlan = {
  mode: "dry_run";
  executionReady: false;
  plan: {
    adAccountId: string;
    status: "PAUSED";
    approvalRequired: true;
    idempotencyKey: string;
    steps: string[];
    input: { campaignObjective: string };
  };
};

export type MetaAdAccountOption = {
  external_id: string;
  name: string;
  is_selected: boolean;
  is_active: boolean;
};

export function isMetaDraft(draft: MarketingDraft) {
  return draft.request?.channel === "meta_ads";
}

export function isInstagramDraft(draft: MarketingDraft) {
  return draft.request?.channel === "instagram_organic";
}

// "Social" = Meta o Instagram: no es email, así que comparte todo el
// comportamiento no-email (sin remitente/reply-to, sin pestaña HTML, sin editor
// visual, copiar texto en vez de HTML).
export function isSocialDraft(draft: MarketingDraft) {
  return isMetaDraft(draft) || isInstagramDraft(draft);
}

export function getMetaCallToAction(draft: MarketingDraft) {
  const buttonBlock = draft.blocks.find(
    (block): block is { type?: string; content?: unknown } =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "button",
  );
  return typeof buttonBlock?.content === "string" && buttonBlock.content.trim()
    ? buttonBlock.content
    : "Más información";
}

export function getMetaDestinationUrl(draft: MarketingDraft) {
  const buttonBlock = draft.blocks.find(
    (block): block is { type?: string; href?: unknown } =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "button",
  );
  const href = buttonBlock?.href;
  if (typeof href !== "string" || !href.trim()) return null;
  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export type MetaPlanFormValues = {
  adAccountId: string;
  campaignObjective: string;
  /** Lo que escribe una persona: euros. Meta cobra en unidades menores. */
  dailyBudgetEuros: string;
};

/**
 * La jerarquia que pide Meta (campaña > conjunto > creativo > anuncio) sale
 * del nombre del borrador. Nadie quiere teclear cuatro nombres que solo se
 * diferencian en el sufijo, y si se teclean a mano acaban sin relacion visible
 * con la pieza que representan.
 */
export function metaPlanNamesFromDraft(draft: MarketingDraft) {
  const base =
    (draft.template_name || draft.subject || "Campaña").trim().slice(0, 60) ||
    "Campaña";
  return {
    campaignName: base,
    adSetName: `${base} · conjunto`,
    creativeName: `${base} · creativo`,
    adName: `${base} · anuncio`,
  };
}

/**
 * Una clave por borrador y version, no por instante. Con `Date.now()` cada
 * pulsacion generaba una clave nueva: preparar dos veces el mismo anuncio
 * habria creado dos campañas el dia que esto deje de ser dry-run.
 */
export function metaPlanIdempotencyKey(draft: MarketingDraft) {
  return `meta-plan-${draft.id}-v${draft.version}`;
}

export function eurosToMinorUnits(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  const minor = Math.round(Number(normalized) * 100);
  return minor > 0 ? minor : Number.NaN;
}

export type MetaPlanRequest =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string };

/**
 * El creativo del plan sale del borrador APROBADO, no del formulario que se
 * uso para generarlo. Antes se enviaba el `cta`/`brief` del generador: texto
 * que nadie habia revisado y que podia no parecerse a la pieza aprobada.
 */
export function buildMetaPlanRequest(
  draft: MarketingDraft,
  values: MetaPlanFormValues,
): MetaPlanRequest {
  if (draft.status !== "approved") {
    return {
      ok: false,
      message: "Aprueba el borrador antes de preparar el plan de Meta.",
    };
  }
  if (!values.adAccountId.trim()) {
    return { ok: false, message: "Indica la cuenta publicitaria de Meta." };
  }
  const dailyBudgetMinor = eurosToMinorUnits(values.dailyBudgetEuros);
  if (Number.isNaN(dailyBudgetMinor)) {
    return {
      ok: false,
      message:
        "El presupuesto diario tiene que ser un importe en euros mayor que cero.",
    };
  }
  const destination = getMetaDestinationUrl(draft);
  return {
    ok: true,
    body: {
      ...metaPlanNamesFromDraft(draft),
      adAccountId: values.adAccountId.trim(),
      campaignObjective: values.campaignObjective,
      dailyBudgetMinor,
      creativeSpec: {
        headline: draft.subject.trim(),
        body: draft.plain_text.trim(),
        callToAction: getMetaCallToAction(draft),
        ...(destination ? { link: destination } : {}),
      },
      idempotencyKey: metaPlanIdempotencyKey(draft),
    },
  };
}
