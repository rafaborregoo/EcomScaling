"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Banner,
  Button,
  ErrorBlock,
  Field,
  LoadingBlock,
  SearchableSelect,
  toast,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

type Delivery = {
  revision: string;
  approved: boolean;
  drafts_truncated: boolean;
  timezone: string;
  emails: Array<{
    sequence_number: number;
    title: string;
    draft_id: string | null;
    draft_version: number | null;
    draft_status: string | null;
    receipts: Array<{
      id: string;
      draft_id: string | null;
      draft_version: number;
      provider_send_time: string;
      observation?: { status: string; eligible_at: string | null };
    }>;
  }>;
};
type Candidate = {
  id: string;
  subject: string | null;
  campaign_name: string;
  sent_at: string | null;
};

export function MailingDeliveryPanel({
  organizationId,
  sequenceId,
}: {
  organizationId: string;
  sequenceId: string;
}) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState<number | null>(null);
  const [messageId, setMessageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = `${organizationId}:${sequenceId}`;
  const scopeRef = useRef(scope);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const base = `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceId}`;

  const load = useCallback(async () => {
    const captured = scope;
    try {
      const response = await apiFetch(`${base}/delivery`);
      if (!response.ok) throw new Error(await readApiError(response));
      const value = (await response.json()) as Delivery;
      if (scopeRef.current === captured) {
        setDelivery(value);
        setError(null);
      }
    } catch (reason) {
      if (scopeRef.current === captured)
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo recuperar el seguimiento.",
        );
    }
  }, [base, scope]);

  useEffect(() => {
    scopeRef.current = scope;
    setDelivery(null);
    setCandidates([]);
    setCursor(null);
    setActiveEmail(null);
    setMessageId("");
    setBusy(false);
    setError(null);
    void load();
    return () => {
      scopeRef.current = "";
    };
  }, [load, scope]);

  async function loadCandidates(number: number, after: string | null = null) {
    const captured = scope;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${base}/delivery-candidates${after ? `?after_id=${encodeURIComponent(after)}` : ""}`,
      );
      if (!response.ok) throw new Error(await readApiError(response));
      const page = (await response.json()) as {
        candidates: Candidate[];
        next_cursor: string | null;
      };
      if (scopeRef.current !== captured) return;
      setCandidates((current) =>
        after ? [...current, ...page.candidates] : page.candidates,
      );
      setCursor(page.next_cursor);
      setActiveEmail(number);
      if (!after) setMessageId("");
    } catch (reason) {
      if (scopeRef.current === captured)
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudieron consultar los envíos.",
        );
    } finally {
      if (scopeRef.current === captured) setBusy(false);
    }
  }

  async function link() {
    const captured = scope;
    const email = delivery?.emails.find(
      (item) => item.sequence_number === activeEmail,
    );
    if (!email?.draft_id || !messageId || !delivery) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${base}/emails/${email.sequence_number}/delivery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: delivery.revision,
            draft_id: email.draft_id,
            draft_version: email.draft_version,
            message_id: messageId,
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      if (scopeRef.current !== captured) return;
      setActiveEmail(null);
      setMessageId("");
      toast.success("Envío relacionado con esta versión del borrador.");
      await load();
    } catch (reason) {
      if (scopeRef.current === captured)
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo relacionar el envío.",
        );
    } finally {
      if (scopeRef.current === captured) setBusy(false);
    }
  }

  if (!delivery)
    return error ? (
      <ErrorBlock>{error}</ErrorBlock>
    ) : (
      <LoadingBlock label="Recuperando seguimiento del mailing…" />
    );
  if (!delivery.approved) return null;
  const date = (value: string) =>
    new Date(value).toLocaleString("es-ES", { timeZone: delivery.timezone });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguimiento de envíos</CardTitle>
        <CardDescription>Relaciona cada borrador con el mensaje enviado en Klaviyo para que los análisis puedan identificarlo.</CardDescription>
        <CardAction><Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Actualizar
        </Button></CardAction>
      </CardHeader>
      <CardContent>
        <Banner tone="warn">
          Solo aparecen envíos importados de esta tienda posteriores a la
          aprobación. Confirmar el vínculo no demuestra que el contenido enviado
          sea idéntico al borrador ni que haya generado ventas incrementales.
        </Banner>
        {delivery.drafts_truncated ? (
          <Banner tone="warn">
            La lista de versiones está recortada. Comprueba la versión del
            borrador antes de relacionarla.
          </Banner>
        ) : null}
        {delivery.emails.map((email) => {
          const linked = email.receipts.some(
            (receipt) =>
              receipt.draft_id === email.draft_id &&
              receipt.draft_version === email.draft_version,
          );
          return (
            <Card key={email.sequence_number}>
              <CardHeader>
                <CardTitle>{`${email.sequence_number}. ${email.title}`}</CardTitle>
              </CardHeader>
              <CardContent>
                {email.receipts.map((receipt) => (
                  <p key={receipt.id}>
                    Envío relacionado: {date(receipt.provider_send_time)} · versión{" "}
                    {receipt.draft_version}.
                    {receipt.observation?.status === "immature" && receipt.observation.eligible_at
                      ? ` Ventana de observación pendiente hasta ${date(receipt.observation.eligible_at)}.`
                      : receipt.observation?.status === "awaiting_metrics_and_sample_check"
                        ? " Ventana cumplida: falta comprobar muestra y métricas con A12."
                        : " Sin criterio experimental verificable; consulta los resultados como observaciones."}
                  </p>
                ))}
                {!email.draft_id ||
                !["approved", "published"].includes(email.draft_status ?? "") ? (
                  <p>
                    El borrador debe estar aprobado antes de relacionar un envío.
                  </p>
                ) : !linked ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void loadCandidates(email.sequence_number)}
                  >
                    Relacionar envío de Klaviyo
                  </Button>
                ) : null}
                {activeEmail === email.sequence_number ? (
                  <>
                    <Field label="Mensaje enviado">
                      <SearchableSelect
                        aria-label="Mensaje enviado"
                        placeholder="Busca un envío"
                        emptyText="No hay ningún envío con ese nombre."
                        value={messageId}
                        onChange={setMessageId}
                        options={candidates.map((item) => ({
                          value: item.id,
                          label: `${item.campaign_name} · ${item.subject ?? "Sin asunto"}${item.sent_at ? ` · ${date(item.sent_at)}` : ""}`,
                        }))}
                      />
                    </Field>
                    {!candidates.length ? (
                      <p>
                        No hay mensajes enviados disponibles. Actualiza la
                        sincronización de Klaviyo y vuelve a consultar.
                      </p>
                    ) : null}
                    {cursor ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void loadCandidates(email.sequence_number, cursor)
                        }
                      >
                        Ver más envíos
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={busy || !messageId}
                      onClick={() => void link()}
                    >
                      Confirmar vínculo con este envío
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      </CardContent>
    </Card>
  );
}
