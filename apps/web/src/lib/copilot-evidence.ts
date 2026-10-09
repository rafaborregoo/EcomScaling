import type { CopilotEvidenceReference } from "@e-nora/contracts";
import type { CopilotAskTarget } from "@/components/copilot-ask";

function sourceForRoute(route: string): CopilotEvidenceReference["source"] {
  if (route.startsWith("/meta")) return "meta";
  if (route.startsWith("/shopify")) return "shopify";
  if (route.startsWith("/klaviyo")) return "klaviyo";
  if (route.startsWith("/marketing")) return "marketing";
  if (route.startsWith("/consultor") || route.startsWith("/panel")) return "portfolio";
  if (route.startsWith("/dashboard")) return "operations";
  return "other";
}

function sourceForSection(section: string | undefined, route: string): CopilotEvidenceReference["source"] {
  if (route.startsWith("/dashboard")) {
    if (/meta/i.test(section ?? "")) return "meta";
    if (/klaviyo|email/i.test(section ?? "")) return "klaviyo";
    if (/shopify|tienda|stock/i.test(section ?? "")) return "shopify";
  }
  return sourceForRoute(route);
}

function entityForRoute(route: string): CopilotEvidenceReference["entity"] {
  const patterns: Array<[RegExp, string]> = [
    [/^\/meta\/campanas\/([^/]+)$/, "meta_campaign"],
    [/^\/shopify\/productos\/([^/]+)$/, "shopify_product"],
    [/^\/shopify\/promociones\/([^/]+)$/, "shopify_discount"],
    [/^\/klaviyo\/emails\/([^/]+)$/, "klaviyo_email"],
  ];
  for (const [pattern, type] of patterns) {
    const id = pattern.exec(route)?.[1];
    if (id) return { type, id: decodeURIComponent(id) };
  }
  return null;
}

export function buildCopilotEvidenceReference(input: {
  route: string;
  title: string;
  focusLabel?: string;
  connectionId?: string;
  periodLabel?: string;
  searchParams: URLSearchParams;
  target?: CopilotAskTarget;
}): CopilotEvidenceReference {
  const filters: Record<string, string> = {};
  for (const key of ["days", "periodDays", "tab", "channel", "connectionId"]) {
    const value = input.searchParams.get(key);
    if (value) filters[key] = value.slice(0, 120);
  }
  Object.assign(filters, input.target?.filters ?? {});
  const entity = input.target?.entity ?? entityForRoute(input.route);
  return {
    kind: input.target?.kind ?? (entity ? "entity" : "section"),
    source: sourceForSection(input.focusLabel, input.route),
    route: input.route,
    section: input.focusLabel || input.title,
    connection_id: input.connectionId || null,
    entity,
    metric: input.target?.metric ?? null,
    period: input.target?.period ?? null,
    period_label: input.target?.period_label ?? input.periodLabel ?? null,
    filters,
  };
}
