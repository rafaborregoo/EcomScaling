"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { Badge, Button, ButtonLink, toast } from "@/components/ui";
import type { KWorkspace } from "./klaviyo-workspace";
import { fmtDate } from "./format";
import s from "./marketing-views.module.css";

type Tile = {
  key: string;
  name: string;
  nora: MarketingDraft | null;
  klaviyoId: string | null;
  usedIn: string[];
  updatedAt: string | null;
};

const DRAFT_STATUS: Record<MarketingDraft["status"], string> = {
  draft: "Borrador",
  pending_approval: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  published: "Publicada",
};

/** Marketing -> Plantillas: lo hecho en NORA y lo que hay en Klaviyo, sin duplicar. */
export function TemplatesView({
  organizationId,
  workspace,
  drafts,
  onOpenDraft,
  onCreate,
  onChanged,
}: {
  organizationId: string;
  workspace: KWorkspace | undefined;
  drafts: MarketingDraft[];
  onOpenDraft: (draftId: string) => void;
  onCreate: () => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const connected = Boolean(workspace?.connected);
  const klaviyo = workspace?.templates ?? [];
  const klaviyoById = new Map(klaviyo.map((template) => [template.id, template]));

  const emailDrafts = drafts.filter((draft) => (draft.request?.channel ?? "email_klaviyo").startsWith("email"));
  const linked = new Set<string>();
  const tiles: Tile[] = emailDrafts.map((draft) => {
    const klaviyoId = draft.request?.klaviyo_template_id ?? null;
    const remote = klaviyoId ? klaviyoById.get(klaviyoId) : undefined;
    if (klaviyoId) linked.add(klaviyoId);
    return {
      key: `nora:${draft.id}`,
      name: draft.template_name || draft.subject || "Sin nombre",
      nora: draft,
      klaviyoId,
      usedIn: remote?.used_in ?? [],
      updatedAt: draft.updated_at,
    };
  });
  if (connected) {
    for (const template of klaviyo) {
      if (linked.has(template.id)) continue;
      tiles.push({
        key: `klaviyo:${template.id}`,
        name: template.name,
        nora: null,
        klaviyoId: template.id,
        usedIn: template.used_in,
        updatedAt: template.updated_at,
      });
    }
  }

  const FILTERS: Array<{ key: string; label: string; match: (tile: Tile) => boolean }> = [
    { key: "all", label: "Todas", match: () => true },
    { key: "nora", label: "Hechas en NORA", match: (tile) => Boolean(tile.nora) },
    ...(connected
      ? [
          { key: "klaviyo", label: "Solo en Klaviyo", match: (tile: Tile) => !tile.nora },
          { key: "flow", label: "En flows", match: (tile: Tile) => tile.usedIn.some((use) => use.startsWith("Flow")) },
        ]
      : []),
    { key: "unused", label: "Sin usar", match: (tile) => tile.usedIn.length === 0 },
  ];
  const active = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0]!;

  async function run(key: string, path: string, body: Record<string, string>, success: string, openDraft = false) {
    setBusy(key);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { draft_id?: string };
      toast.success(success);
      onChanged();
      if (openDraft && payload.draft_id) onOpenDraft(payload.draft_id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.root}>
      <div className={s.head}>
        <div>
          <h1>Plantillas</h1>
          <p>Todo tu material de email, lo hayas hecho en NORA o en Klaviyo.</p>
        </div>
        <div className={s.acts}>
          <ButtonLink href="/marketing/plantillas" variant="secondary">
            Biblioteca de plantillas
          </ButtonLink>
          <Button onClick={onCreate}>Nueva plantilla</Button>
        </div>
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar plantillas">
        {FILTERS.map((entry) => (
          <button key={entry.key} type="button" className={s.chip} aria-pressed={filter === entry.key} onClick={() => setFilter(entry.key)}>
            {entry.label}
            <span className={s.chipCount}>{tiles.filter(entry.match).length}</span>
          </button>
        ))}
      </div>
      <div className={s.tgrid}>
        {tiles.filter(active.match).map((tile) => (
          <article key={tile.key} className={s.tcard}>
            <Thumb organizationId={organizationId} tile={tile} />
            <div className={s.tbody}>
              <b>{tile.name}</b>
              <span className={s.row}>
                {tile.nora ? (
                  <span className={s.src} data-src="nora">
                    NORA
                  </span>
                ) : null}
                {tile.klaviyoId && connected ? (
                  <span className={s.src} data-src="klaviyo">
                    KLAVIYO
                  </span>
                ) : null}
                {tile.nora ? <Badge tone={tile.nora.status === "approved" || tile.nora.status === "published" ? "success" : "neutral"}>{DRAFT_STATUS[tile.nora.status]}</Badge> : null}
              </span>
              <span className={s.muted}>
                {tile.usedIn.length ? tile.usedIn.slice(0, 2).join(" · ") + (tile.usedIn.length > 2 ? ` · +${tile.usedIn.length - 2}` : "") : "Sin usar"}
                {tile.updatedAt ? ` · ${fmtDate(tile.updatedAt)}` : ""}
              </span>
              <span className={s.acts}>
                {tile.nora ? (
                  <Button size="sm" variant="secondary" onClick={() => onOpenDraft(tile.nora!.id)}>
                    Abrir
                  </Button>
                ) : null}
                {tile.nora && connected && ["approved", "published"].includes(tile.nora.status) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === tile.key}
                    onClick={() =>
                      void run(tile.key, "/klaviyo/templates/push", { draftId: tile.nora!.id }, tile.klaviyoId ? "Plantilla actualizada en Klaviyo" : "Plantilla subida a Klaviyo")
                    }
                  >
                    {tile.klaviyoId ? "Actualizar en Klaviyo" : "Subir a Klaviyo"}
                  </Button>
                ) : null}
                {!tile.nora && tile.klaviyoId ? (
                  <Button
                    size="sm"
                    disabled={busy === tile.key}
                    onClick={() => void run(tile.key, "/klaviyo/templates/import", { templateId: tile.klaviyoId! }, "Plantilla traída a NORA", true)}
                  >
                    Traer a NORA
                  </Button>
                ) : null}
              </span>
            </div>
          </article>
        ))}
      </div>
      {tiles.filter(active.match).length === 0 ? <p className={s.muted}>Nada en este filtro.</p> : null}
    </div>
  );
}

/** Miniatura: la de NORA ya trae el HTML; la de Klaviyo se pide al verse. */
function Thumb({ organizationId, tile }: { organizationId: string; tile: Tile }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(tile.nora?.html || null);
  const [missing, setMissing] = useState(false);
  const needsFetch = !html && !missing && Boolean(tile.klaviyoId);

  useEffect(() => {
    if (!needsFetch || !ref.current) return;
    let alive = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/templates/${encodeURIComponent(tile.klaviyoId!)}/html`)
        .then(async (response) => {
          if (!alive) return;
          const payload = response.ok ? ((await response.json()) as { html: string | null }) : { html: null };
          if (payload.html) setHtml(payload.html);
          else setMissing(true);
        })
        .catch(() => alive && setMissing(true));
    });
    observer.observe(ref.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [needsFetch, organizationId, tile.klaviyoId]);

  return (
    <div ref={ref} className={s.thumb}>
      {html ? (
        <iframe title={`Miniatura de ${tile.name}`} sandbox="" srcDoc={html} loading="lazy" tabIndex={-1} aria-hidden />
      ) : (
        <div className={s.thumbEmpty}>{needsFetch ? "Cargando vista previa…" : "Sin vista previa"}</div>
      )}
    </div>
  );
}
