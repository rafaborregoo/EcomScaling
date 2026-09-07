"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { readApiError } from "@/lib/api-error";
import { toChannel } from "@/components/marketing-channel";
import {
  patchCampaignItem,
  type CampaignItem,
  type CampaignResources,
} from "@/hooks/use-campaign-items";
import type {
  KlaviyoAttribution,
  MetaAttribution,
} from "@/hooks/use-attribution-report";
import { Badge, Button, Select, toast } from "@/components/ui";
import { campaignResults, canMeasureCampaign } from "./campaign-result";

/**
 * El final del hilo, en la fila de la campaña: qué atribuyó.
 *
 * Enlazar la campaña del calendario con la real del proveedor es un gesto
 * manual a propósito. Emparejarlas por nombre parecería más cómodo y sería la
 * peor opción posible aquí: un emparejamiento equivocado no da error, atribuye
 * el resultado de otra campaña y nadie lo nota.
 */
export function CampaignResultCell({
  organizationId,
  item,
  klaviyo,
  meta,
  resources,
  onChanged,
}: {
  organizationId: string;
  item: CampaignItem;
  klaviyo: KlaviyoAttribution | null;
  meta: MetaAttribution | null;
  resources: CampaignResources;
  onChanged: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  const results = campaignResults(item, klaviyo, meta);
  if (results.length > 0) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {results.map((result) => (
          <Badge
            key={result.source}
            tone={
              result.roas == null
                ? "neutral"
                : result.roas >= 1
                  ? "success"
                  : "danger"
            }
            title={result.detail ?? undefined}
          >
            {formatMoney(result.revenue, "EUR")} por {result.source}
            {result.roas == null ? "" : ` · ${result.roas.toFixed(2)}x`}
          </Badge>
        ))}
      </span>
    );
  }

  if (!canMeasureCampaign(item)) return null;

  const isMeta = toChannel(item.channel) === "meta_ads";
  const options = isMeta ? resources.metaCampaigns : resources.klaviyoCampaigns;
  const linked = isMeta ? item.meta_campaign_id : item.klaviyo_campaign_id;

  if (linked) {
    // Enlazada pero sin cifras: el informe del periodo no la cubre.
    return <span className="text-xs text-muted">Sin datos del periodo</span>;
  }

  if (!linking) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setLinking(true)}>
        Medir
      </Button>
    );
  }

  if (options.length === 0) {
    return (
      <span className="text-xs text-muted">
        Sin campañas sincronizadas de {isMeta ? "Meta" : "Klaviyo"}
      </span>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const response = await patchCampaignItem(organizationId, item.id, {
        [isMeta ? "metaCampaignId" : "klaviyoCampaignId"]: selectedId,
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Campaña enlazada: ya se puede medir");
      setLinking(false);
      onChanged();
    } catch {
      toast.danger("No se pudo enlazar por un error de red. Reintenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Select
        className="w-52"
        aria-label={`Campaña de ${isMeta ? "Meta" : "Klaviyo"} que corresponde`}
        value={selectedId}
        onChange={setSelectedId}
        options={[
          { value: "", label: "Elige la campaña real" },
          ...options.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={busy || !selectedId}
        onClick={() => void save()}
      >
        Enlazar
      </Button>
    </span>
  );
}
