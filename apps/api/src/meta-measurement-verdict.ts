export const META_MEASUREMENT_VERDICT_VERSION = "a24-measurement-v1";

export type MetaMeasurementSource = {
  available: boolean;
  rows: Array<Record<string, unknown>>;
};

export type MetaMeasurementEvidence = {
  pixels: MetaMeasurementSource;
  learning: MetaMeasurementSource;
  issues: MetaMeasurementSource;
  eventMapping: MetaMeasurementSource;
};

export type MetaMeasurementVerdict = {
  status: "usable_with_attribution_limits" | "restricted" | "not_assessable" | "unknown";
  reason_codes: string[];
  evidence_counts: {
    pixel_rows: number;
    ad_set_rows: number;
    eligible_ad_set_rows: number;
    observed_event_rows: number;
    fresh_rejected_issue_rows: number;
  };
  limitations: string[];
};

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Conservative, deterministic gate. Missing/stale evidence must never look healthy. */
export function buildMetaMeasurementVerdict(
  evidence: MetaMeasurementEvidence,
): MetaMeasurementVerdict {
  const sources = Object.values(evidence);
  const allSourcesAvailable = sources.every((source) => source.available);
  const mappingRows = evidence.eventMapping.rows;
  const eligibleRows = mappingRows.filter((row) => asNumber(row.eligible_ad_set_count ?? 1) > 0);
  const spendRows = eligibleRows.filter((row) => asNumber(row.spend_in_period) > 0);
  const observedRows = spendRows.filter((row) => row.mapping_status === "mapped_event_observed");
  const rejectedRows = evidence.issues.rows.filter(
    (row) => row.review_category === "rejected" && row.freshness === "fresh",
  );
  const activityStates = evidence.learning.rows.map((row) => row.activity_sync_state);
  const hasUnknownFreshness = activityStates.some((state) =>
    state !== undefined && state !== "fresh",
  );
  const criticalRowsMissing = evidence.pixels.rows.length === 0 || evidence.learning.rows.length === 0;
  const unavailablePixel = evidence.pixels.rows.some((row) => row.is_unavailable === true);
  const hasMappingGap = spendRows.some((row) =>
    row.mapping_status !== "mapped_event_observed",
  );
  const reasons: string[] = [];

  if (!allSourcesAvailable || hasUnknownFreshness || criticalRowsMissing) reasons.push("source_missing_or_stale");
  if (unavailablePixel) reasons.push("meta_reports_pixel_unavailable");
  if (hasMappingGap) reasons.push("promoted_event_not_observed_or_unresolved");
  if (rejectedRows.length) reasons.push("fresh_rejected_ads_present");
  if (!spendRows.length) reasons.push("no_eligible_spend_observed");

  let status: MetaMeasurementVerdict["status"];
  if (!allSourcesAvailable || hasUnknownFreshness || criticalRowsMissing) status = "unknown";
  else if (!spendRows.length) status = "not_assessable";
  else if (unavailablePixel || hasMappingGap || rejectedRows.length) status = "restricted";
  else if (observedRows.length === spendRows.length) status = "usable_with_attribution_limits";
  else status = "unknown";

  return {
    status,
    reason_codes: reasons,
    evidence_counts: {
      pixel_rows: evidence.pixels.rows.length,
      ad_set_rows: mappingRows.length,
      eligible_ad_set_rows: eligibleRows.length,
      observed_event_rows: observedRows.length,
      fresh_rejected_issue_rows: rejectedRows.length,
    },
    limitations: [
      "La observación de un evento no demuestra atribución completa ni causalidad de ventas.",
      "Las incidencias revisadas proceden de una muestra limitada; no verlas no prueba que no existan.",
      "El veredicto solo cubre el periodo, tienda y fuentes sincronizadas indicados.",
    ],
  };
}

export function unknownMetaMeasurementVerdict(reason = "fresh_verdict_unavailable"): MetaMeasurementVerdict {
  return {
    status: "unknown",
    reason_codes: [reason],
    evidence_counts: {
      pixel_rows: 0,
      ad_set_rows: 0,
      eligible_ad_set_rows: 0,
      observed_event_rows: 0,
      fresh_rejected_issue_rows: 0,
    },
    limitations: ["No se encontró un veredicto A24 vigente para esta tienda y periodo; no asumir medición sana."],
  };
}
