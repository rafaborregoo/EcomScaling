export type KlaviyoTemplateVersionRequest = {
  account_id: string;
  external_template_id: string;
  send_time: string;
};

export type KlaviyoTemplateVersionRequestBatch = {
  requests: KlaviyoTemplateVersionRequest[];
  eligibleCount: number;
  skippedWithoutSendTime: number;
  capped: boolean;
};

export type KlaviyoTemplateVersionMatch = {
  html_content: string | null;
  version_source: string | null;
  version_observed_at: string | null;
  version_superseded_at: string | null;
};

export type KlaviyoEmailAuditSelection = {
  rows: Record<string, unknown>[];
  eligibleCount: number;
  excludedCount: number;
  omittedEligibleCount: number;
  selectedFlowCount: number;
  selectedCampaignCount: number;
  truncatedFlowIds: string[];
};

export function selectKlaviyoEmailsForContentAudit(
  rows: readonly Record<string, unknown>[],
  maxMessages = 30,
): KlaviyoEmailAuditSelection {
  const limit = Math.max(0, Math.floor(maxMessages));
  const flows = new Map<string, Record<string, unknown>[]>();
  const campaigns: Record<string, unknown>[] = [];
  let eligibleCount = 0;
  let excludedCount = 0;

  for (const row of rows) {
    const source = String(row.source ?? "").toLowerCase();
    const status = String(row.parent_status ?? "").toLowerCase();
    if (source === "flow" && ["live", "active", "manual"].includes(status)) {
      eligibleCount++;
      const key = String(row.account_id ?? "") + "|" + String(row.parent_id ?? "");
      const group = flows.get(key) ?? [];
      group.push(row);
      flows.set(key, group);
    } else if (source === "campaign" && ["sent", "scheduled", "sending"].includes(status)) {
      eligibleCount++;
      campaigns.push(row);
    } else {
      excludedCount++;
    }
  }

  const flowGroups = [...flows.entries()]
    .map(([key, group]) => ({
      key,
      rows: group.sort((a, b) => Number(a.position_in_parent ?? 0) - Number(b.position_in_parent ?? 0)),
      status: String(group[0]?.parent_status ?? "").toLowerCase(),
    }))
    .sort((a, b) =>
      Number(b.status === "live") - Number(a.status === "live") ||
      a.key.localeCompare(b.key),
    );
  const campaignRows = campaigns.sort((a, b) => {
    const timeA = typeof a.send_time === "string" ? Date.parse(a.send_time) : Number.NaN;
    const timeB = typeof b.send_time === "string" ? Date.parse(b.send_time) : Number.NaN;
    return (Number.isFinite(timeB) ? timeB : -Infinity) - (Number.isFinite(timeA) ? timeA : -Infinity);
  });

  const rowsOut: Record<string, unknown>[] = [];
  const selectedFlowGroups = new Set<string>();
  const truncatedFlowIds: string[] = [];
  const campaignTarget = Math.min(campaignRows.length, Math.ceil(limit * 0.4));
  const flowTarget = Math.max(0, limit - campaignTarget);
  let flowSlots = flowTarget;
  for (const group of flowGroups) {
    if (flowSlots <= 0) break;
    if (group.rows.length <= flowSlots) {
      rowsOut.push(...group.rows);
      selectedFlowGroups.add(group.key);
      flowSlots -= group.rows.length;
      continue;
    }
    if (selectedFlowGroups.size === 0) {
      rowsOut.push(...group.rows.slice(0, flowSlots));
      selectedFlowGroups.add(group.key);
      truncatedFlowIds.push(String(group.rows[0]?.parent_id ?? group.key));
      flowSlots = 0;
    }
  }

  const selectedCampaigns = campaignRows.slice(0, campaignTarget);
  rowsOut.push(...selectedCampaigns);
  let spare = limit - rowsOut.length;
  if (spare > 0) {
    for (const group of flowGroups) {
      if (spare <= 0) break;
      if (selectedFlowGroups.has(group.key) || group.rows.length > spare) continue;
      rowsOut.unshift(...group.rows);
      selectedFlowGroups.add(group.key);
      spare -= group.rows.length;
    }
  }
  if (spare > 0) rowsOut.push(...campaignRows.slice(campaignTarget, campaignTarget + spare));

  return {
    rows: rowsOut,
    eligibleCount,
    excludedCount,
    omittedEligibleCount: eligibleCount - rowsOut.length,
    selectedFlowCount: rowsOut.filter((row) => String(row.source).toLowerCase() === "flow").length,
    selectedCampaignCount: rowsOut.filter((row) => String(row.source).toLowerCase() === "campaign").length,
    truncatedFlowIds,
  };
}

export function selectKlaviyoTemplateBody(
  currentHtml: string | null,
  historical: KlaviyoTemplateVersionMatch | undefined,
  sendTime: string | null,
): { html: string | null; provenance: string | Record<string, string | null> } {
  if (historical?.html_content !== null && historical?.html_content !== undefined && historical.version_source) {
    return {
      html: historical.html_content,
      provenance: {
        tipo: historical.version_source,
        observado_en: historical.version_observed_at,
        sustituido_en: historical.version_superseded_at,
        exactitud: "version observada por sincronizacion; no verifica el HTML personalizado recibido por cada destinatario",
      },
    };
  }
  if (currentHtml === null) return { html: null, provenance: "sin_html_disponible" };
  if (historical) {
    return {
      html: currentHtml,
      provenance: "la_version_observada_no_tenia_html; se usa la plantilla actual, no verificada como enviada",
    };
  }
  return {
    html: currentHtml,
    provenance: sendTime
      ? "plantilla_actual_no_coincide_con_version_historica_observada"
      : "plantilla_actual_de_flow_sin_fecha_de_envio_por_destinatario",
  };
}

export function collectKlaviyoTemplateVersionRequests(
  rows: readonly Record<string, unknown>[],
  maxRequests = 300,
): KlaviyoTemplateVersionRequestBatch {
  const validRows = rows.filter((row) =>
    typeof row.account_id === "string" &&
    typeof row.external_template_id === "string" &&
    typeof row.send_time === "string" &&
    Number.isFinite(Date.parse(row.send_time)),
  );
  const unique = new Map<string, KlaviyoTemplateVersionRequest>();
  for (const row of validRows) {
    const request = {
      account_id: String(row.account_id),
      external_template_id: String(row.external_template_id),
      send_time: String(row.send_time),
    };
    const key = request.account_id + "|" + request.external_template_id + "|" + Date.parse(request.send_time);
    if (!unique.has(key)) unique.set(key, request);
  }
  const all = [...unique.values()].sort(
    (a, b) => Date.parse(b.send_time) - Date.parse(a.send_time),
  );
  return {
    requests: all.slice(0, Math.max(0, maxRequests)),
    eligibleCount: all.length,
    skippedWithoutSendTime: rows.length - validRows.length,
    capped: all.length > maxRequests,
  };
}

export function klaviyoTemplateVersionKey(
  accountId: string,
  externalTemplateId: string,
  sendTime: string,
): string {
  return accountId + ":" + externalTemplateId + ":" + Date.parse(sendTime);
}
