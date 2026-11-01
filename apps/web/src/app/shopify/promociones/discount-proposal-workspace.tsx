"use client";

import { buttonVariants } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button, Checkbox, DateTimePicker, Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, ErrorBlock } from "@/components/ui";
import { cx } from "../../dashboard/client-pulse";
import pulse from "../../dashboard/client-pulse.module.css";
import styles from "./promociones.module.css";

type Proposal = {
  id: string;
  store_id: string;
  request: {
    code: string;
    title: string;
    discount_type: "percentage" | "fixed_amount";
    value: number;
    starts_at?: string;
    ends_at?: string;
    usage_limit?: number | null;
    once_per_customer: boolean;
  };
  status: "draft" | "applying" | "applied" | "failed" | "conflict" | "expired";
  expires_at: string;
  shopify_result: { id?: string; code?: string } | null;
  failure_code: string | null;
  created_at: string;
};

type Props = {
  organizationId: string;
  connectionId: string;
  canManage: boolean;
  currencyCode?: string | null;
  /** El botón «Nuevo código» vive en la barra de la página; aquí solo el panel. */
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
};

const statusLabel: Record<Proposal["status"], string> = {
  draft: "Borrador",
  applying: "Aplicando / verificando",
  applied: "Aplicado en Shopify",
  failed: "No aplicado",
  conflict: "Código en conflicto",
  expired: "Caducado",
};

function route(organizationId: string, connectionId: string) {
  return `/v1/organizations/${encodeURIComponent(organizationId)}/shopify/discount-proposals?connectionId=${encodeURIComponent(connectionId)}`;
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) {
    if (payload.error === "shopify_discount_scopes_missing") {
      throw new Error("Para crear códigos, vuelve a conectar Shopify aceptando los permisos de descuentos.");
    }
    if (payload.error === "shopify_discount_proposal_apply_in_progress") {
      throw new Error("Shopify todavía no ha confirmado el resultado. Comprueba de nuevo antes de crear otro código.");
    }
    if (payload.error === "shopify_discount_code_already_exists") {
      throw new Error("Ese código ya existe en Shopify y no coincide con este borrador.");
    }
    if (payload.error === "shopify_discount_write_access_denied") throw new Error("No tienes permiso para gestionar códigos de esta tienda.");
    throw new Error(typeof payload.message === "string" ? payload.message : "No se ha podido completar. Inténtalo de nuevo en unos segundos.");
  }
  return payload;
}

export function DiscountProposalWorkspace({ organizationId, connectionId, canManage, currencyCode, isFormOpen, onFormOpenChange }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const endpoint = useMemo(() => route(organizationId, connectionId), [organizationId, connectionId]);

  const refresh = useCallback(async () => {
    // Listar los borradores exige permiso de escritura: sin él la API responde 403, no hay nada que mostrar.
    if (!canManage) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(endpoint, { cache: "no-store" });
      const payload = await readResponse<{ proposals: Proposal[] }>(response);
      setProposals(payload.proposals ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los borradores.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, canManage]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      connection_id: connectionId,
      idempotency_key: idempotencyKey.current,
      code: String(form.get("code") ?? "").trim().toUpperCase(),
      title: String(form.get("title") ?? "").trim(),
      discount_type: form.get("discount_type"),
      value: Number(form.get("value")),
      ...(form.get("starts_at") ? { starts_at: new Date(String(form.get("starts_at"))).toISOString() } : {}),
      ...(form.get("ends_at") ? { ends_at: new Date(String(form.get("ends_at"))).toISOString() } : {}),
      usage_limit: form.get("usage_limit") ? Number(form.get("usage_limit")) : null,
      once_per_customer: form.get("once_per_customer") === "on",
    };
    setSaving(true);
    setError(null);
    try {
      await readResponse(await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      idempotencyKey.current = crypto.randomUUID();
      formElement.reset();
      onFormOpenChange(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el borrador.");
    } finally {
      setSaving(false);
    }
  }

  async function applyProposal(proposalId: string) {
    if (!canManage) return;
    setActiveId(proposalId);
    setError(null);
    try {
      const path = `/v1/organizations/${encodeURIComponent(organizationId)}/shopify/discount-proposals/${encodeURIComponent(proposalId)}/apply`;
      await readResponse(await apiFetch(path, { method: "POST" }));
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo aplicar el descuento.");
      await refresh();
    } finally {
      setActiveId(null);
    }
  }

  if (!canManage) return null;
  // Solo lo que espera una decisión; lo aplicado ya sale en la lista de promociones.
  const pending = proposals.filter((proposal) => proposal.status !== "applied");
  const benefit = (proposal: Proposal) =>
    proposal.request.discount_type === "percentage" ? `−${proposal.request.value} %` : `−${proposal.request.value} ${currencyCode ?? ""}`;

  return (
    <>
      <Dialog open={isFormOpen} onOpenChange={onFormOpenChange} busy={saving}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo código</DialogTitle>
        </DialogHeader>
        <form id="discount-proposal-form" className={styles.sheetForm} onSubmit={createDraft}>
          {error && isFormOpen ? <ErrorBlock>{error}</ErrorBlock> : null}
          <label>Código<input name="code" required minLength={3} maxLength={64} pattern="[A-Za-z0-9_-]+" placeholder="BIENVENIDA10" /></label>
          <label>Nombre interno<input name="title" required maxLength={255} placeholder="Bienvenida 10 %" /></label>
          <label>Tipo<Select name="discount_type" defaultValue="percentage" items={[{ value: "percentage", label: "Porcentaje" }, { value: "fixed_amount", label: `Importe fijo (${currencyCode ?? "moneda de tienda"})` }]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Porcentaje</SelectItem><SelectItem value="fixed_amount">Importe fijo ({currencyCode ?? "moneda de tienda"})</SelectItem></SelectContent></Select></label>
          <label>Valor<input name="value" type="number" required min="0.01" max="100000" step="0.01" defaultValue="10" /></label>
          <div className={styles.sheetField}><span>Empieza</span><DateTimePicker name="starts_at" aria-label="Empieza" /></div>
          <div className={styles.sheetField}><span>Termina</span><DateTimePicker name="ends_at" aria-label="Termina" /></div>
          <label>Límite de usos<input name="usage_limit" type="number" min="1" max="1000000" step="1" placeholder="Sin límite" /></label>
          <Checkbox name="once_per_customer" defaultChecked className={styles.checkField}>Una vez por cliente</Checkbox>
          <p className={styles.sheetHint}>Se guarda como borrador: no se crea en Shopify hasta que lo apruebes. Vale para todos los productos.</p>
        </form>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="discount-proposal-form" disabled={saving}>
            {saving ? "Guardando…" : "Guardar borrador"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !isFormOpen ? <p role="alert" className={pulse.error}>{error}</p> : null}
      {!loading && pending.length ? (
        <section className={styles.drafts} aria-labelledby="discount-proposals-title">
          <h2 id="discount-proposals-title">Borradores por aprobar <span>{pending.length}</span></h2>
          {pending.map((proposal) => (
            <article className={styles.draftRow} key={proposal.id}>
              <span className={cx(styles.benefit, styles.draftBenefit)}>{benefit(proposal)}</span>
              <span className={styles.draftText}>
                <b className={styles.code}>{proposal.request.code}</b>
                <span>{proposal.request.title} · caduca el {new Date(proposal.expires_at).toLocaleDateString("es-ES")}</span>
                {proposal.status !== "draft" ? (
                  <span className={proposal.status === "applying" ? styles.draftWarn : styles.draftBad}>
                    {statusLabel[proposal.status]}
                    {proposal.failure_code === "shopify_discount_apply_unverified" ? ": reintenta la lectura antes de crear otro" : ""}
                  </span>
                ) : null}
              </span>
              {proposal.status === "draft" || proposal.status === "applying" ? (
                <button type="button" className={buttonVariants({ variant: proposal.status === "draft" ? "default" : "secondary", size: "sm" })} disabled={activeId !== null} onClick={() => void applyProposal(proposal.id)}>
                  {activeId === proposal.id ? "Comprobando…" : proposal.status === "draft" ? "Aprobar y crear en Shopify" : "Verificar en Shopify"}
                </button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
