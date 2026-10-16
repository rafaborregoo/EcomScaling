"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import type { CopilotBalance } from "@/components/copilot-saldo";
import { ButtonLink, Card, LoadingBlock, ProgressBar, SettingRow, Switch, toast } from "@/components/ui";

/**
 * Copiloto IA: saldo del mes y qué análisis corren solos. Apagar un grupo hace
 * que el orquestador de la API no lo lance para esta organización; las
 * lecturas que ya hay se quedan.
 */

const GROUPS: Record<string, { label: string; hint: string }> = {
  lectura: { label: "Lectura de tus cifras", hint: "Qué ha cambiado y por qué, en Inicio y en el panel." },
  tareas: { label: "Propuesta de tareas", hint: "Lo que haría la IA con lo que ha visto. Llega como propuesta." },
  stock: { label: "Vigilancia de stock", hint: "Superventas que se van a agotar antes de reponer." },
  email: { label: "Analista de email", hint: "Asuntos, flows que faltan y entregabilidad de Klaviyo." },
  planes: { label: "Planes semanal y mensual", hint: "Y la revisión periódica del Camino." },
  canales: { label: "Operativa por canal", hint: "Shopify, Meta Ads, retención y adquisición." },
};

type AiSettings = { can_edit: boolean; groups: Array<{ group: string; enabled: boolean }> };

export function CopilotAiSection({ organizationId }: { organizationId: string }) {
  const path = `/v1/organizations/${organizationId}/ai-settings`;
  const settings = useCachedQuery<AiSettings>(path);
  const balance = useCachedQuery<CopilotBalance>(`/v1/organizations/${organizationId}/copilot/saldo`);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(group: string, enabled: boolean) {
    setBusy(group);
    try {
      const response = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, enabled }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      invalidateCachedQueries(path);
      settings.reload();
    } catch {
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setBusy(null);
    }
  }

  const saldo = balance.data;
  return (
    <div className="space-y-6">
      <Card title="Saldo del copiloto este mes">
        {!saldo ? (
          <LoadingBlock label="Leyendo saldo…" />
        ) : (
          <div className="grid gap-3">
            <p className="text-3xl font-semibold tabular-nums">
              {saldo.granted > 0 ? Math.round((saldo.remaining / saldo.granted) * 100) : 0} %
              <span className="ml-2 text-sm font-normal text-muted">
                {new Intl.NumberFormat("es-ES").format(saldo.remaining)} tokens
              </span>
            </p>
            <ProgressBar
              value={saldo.granted > 0 ? (saldo.remaining / saldo.granted) * 100 : 0}
              aria-label="Saldo restante del copiloto"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <p className="text-xs text-muted">
              Se renueva el{" "}
              {new Date(saldo.renews_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}.
            </p>
          </div>
        )}
      </Card>

      <Card
        title="Análisis que corren solos"
        description={
          settings.data?.can_edit === false
            ? "Los cambian el propietario, los gestores o el consultor."
            : "Solo leen y enseñan el resultado. Escribir algo en tu cuenta siempre pasa por una persona."
        }
      >
        {!settings.data ? (
          <LoadingBlock label="Cargando…" />
        ) : (
          settings.data.groups.map((item) => {
            const meta = GROUPS[item.group] ?? { label: item.group, hint: "" };
            return (
              <SettingRow key={item.group} label={meta.label} hint={meta.hint}>
                <Switch
                  aria-label={meta.label}
                  isSelected={item.enabled}
                  isDisabled={!settings.data?.can_edit || busy !== null}
                  onChange={(value: boolean) => void toggle(item.group, value)}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            );
          })
        )}
      </Card>

      <Card
        title="Lo que la IA sabe de tu tienda"
        actions={
          <ButtonLink href="/conocimiento" size="sm" variant="ghost">
            Abrir Conocimiento
          </ButtonLink>
        }
      >
        <p className="text-sm text-muted">Cuestionario, reglas y documentos. Cuanto más completo, mejores respuestas.</p>
      </Card>
    </div>
  );
}
