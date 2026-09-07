"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { META_OBJECTIVE_OPTIONS } from "@/lib/meta-objectives";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import {
  Banner,
  Button,
  ErrorBlock,
  EYEBROW,
  Field,
  Form,
  Input,
  Select,
  toast,
} from "@/components/ui";
import {
  buildMetaPlanRequest,
  getMetaDestinationUrl,
  metaPlanNamesFromDraft,
  type MetaAdAccountOption,
  type MetaAdPlan,
} from "./meta-ad-plan";

/**
 * El plan de Meta cuelga del BORRADOR, no del formulario de generacion.
 *
 * Antes vivia junto al selector de canal de "Crear": se preparaba una
 * jerarquia de anuncios a partir del brief -- texto que nadie habia aprobado
 * todavia -- y sin relacion con la pieza que acabaria publicandose. Aqui el
 * creativo es exactamente el borrador aprobado que se esta mirando, y lo unico
 * que queda por decidir es donde y con cuanto dinero.
 */
export function MetaAdPlanBlock({
  organizationId,
  draft,
}: {
  organizationId: string;
  draft: MarketingDraft;
}) {
  const [adAccounts, setAdAccounts] = useState<MetaAdAccountOption[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [adAccountId, setAdAccountId] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("OUTCOME_SALES");
  const [dailyBudgetEuros, setDailyBudgetEuros] = useState("10");
  const [plan, setPlan] = useState<MetaAdPlan | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAdAccounts() {
      setIsLoadingAccounts(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/meta/assets`,
        );
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          ad_accounts?: MetaAdAccountOption[];
        };
        const accounts = (payload.ad_accounts ?? []).filter(
          (account) => account.is_active,
        );
        setAdAccounts(accounts);
        const selected = accounts.find((account) => account.is_selected);
        if (selected) setAdAccountId(selected.external_id);
      } catch {
        if (!cancelled) setAdAccounts([]);
      } finally {
        if (!cancelled) setIsLoadingAccounts(false);
      }
    }
    void loadAdAccounts();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const names = metaPlanNamesFromDraft(draft);
  const destination = getMetaDestinationUrl(draft);
  const isApproved = draft.status === "approved";

  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = buildMetaPlanRequest(draft, {
      adAccountId,
      campaignObjective,
      dailyBudgetEuros,
    });
    if (!request.ok) {
      setError(request.message);
      return;
    }
    setIsPreparing(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/meta/ad-creation-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request.body),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setPlan((await response.json()) as MetaAdPlan);
      toast.success("Plan Meta preparado para revisión");
    } catch {
      setError("No se pudo preparar el plan Meta por un error de red. Reintenta.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <p className={EYEBROW}>Meta Ads · plan pausado</p>
      <p className="mt-1 text-sm text-muted">
        Monta la jerarquía que Meta espera con el creativo de este borrador. Se
        valida localmente y queda en pausa: todavía no crea nada en Meta.
      </p>

      {!isApproved ? (
        <Banner tone="warn" className="mt-3 text-sm">
          Este borrador está en «{draft.status === "rejected" ? "rechazado" : "revisión"}
          ». El plan se prepara con el creativo aprobado, así que primero hay que
          aprobarlo.
        </Banner>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Campaña</dt>
          <dd className="min-w-0 truncate">{names.campaignName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Titular</dt>
          <dd className="min-w-0 truncate">{draft.subject}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Destino</dt>
          <dd className="min-w-0 truncate">
            {destination ?? "sin enlace en el creativo"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Conjunto y anuncio</dt>
          <dd className="min-w-0 truncate">{names.adSetName}</dd>
        </div>
      </dl>
      {!destination ? (
        <p className="mt-1 text-xs text-warning">
          El creativo no lleva enlace de destino: añádelo en el borrador antes
          de publicar.
        </p>
      ) : null}

      <Form
        aria-label="Preparar plan de Meta Ads"
        className="mt-4 space-y-4"
        onSubmit={prepare}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cuenta publicitaria">
            {adAccounts.length > 0 ? (
              <Select
                aria-label="Cuenta publicitaria Meta"
                className="mt-1"
                value={adAccountId}
                onChange={setAdAccountId}
                options={adAccounts.map((account) => ({
                  value: account.external_id,
                  label: `${account.name} · ${account.external_id}`,
                }))}
                disabled={isLoadingAccounts}
              />
            ) : (
              <Input
                aria-label="ID de cuenta publicitaria Meta"
                className="mt-1"
                placeholder="act_123456789"
                value={adAccountId}
                onChange={(event) => setAdAccountId(event.target.value)}
              />
            )}
            <p className="mt-1 text-xs text-muted">
              {isLoadingAccounts
                ? "Buscando cuentas conectadas…"
                : adAccounts.length > 0
                  ? "Desde los activos sincronizados"
                  : "Conecta Meta para elegirla de una lista"}
            </p>
          </Field>
          <Field label="Objetivo de Meta">
            <Select
              aria-label="Objetivo nativo de Meta"
              className="mt-1"
              value={campaignObjective}
              onChange={setCampaignObjective}
              options={[...META_OBJECTIVE_OPTIONS]}
            />
          </Field>
          <Field label="Presupuesto diario (€)">
            <Input
              aria-label="Presupuesto diario en euros"
              className="mt-1"
              inputMode="decimal"
              value={dailyBudgetEuros}
              onChange={(event) => setDailyBudgetEuros(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPreparing || !isApproved}>
            {isPreparing ? "Validando…" : "Preparar plan pausado"}
          </Button>
          <span className="text-xs text-muted">
            Requiere aprobación y credenciales Meta para ejecutarse
          </span>
        </div>
      </Form>

      {plan ? (
        <Banner tone="success" className="mt-4 text-sm">
          <p className="font-medium">Plan validado · listo para revisión</p>
          <p className="mt-1">
            Cuenta {plan.plan.adAccountId} · estado {plan.plan.status} · objetivo{" "}
            {displayValue(plan.plan.input.campaignObjective)} · pasos{" "}
            {plan.plan.steps.join(" → ")}
          </p>
          <p className="mt-1 text-xs">No se ha creado ningún objeto externo.</p>
        </Banner>
      ) : null}
    </div>
  );
}
