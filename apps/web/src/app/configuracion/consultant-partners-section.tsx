"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";

/**
 * Con quién compartes cartera.
 *
 * `consultant_assignments` siempre admitió varios consultores por tienda, así
 * que esto no inventa una capacidad: la hace sostenible. Sin nada persistente,
 * dos socios que llevan toda la cartera entre los dos tendrían que acordarse de
 * añadir al otro en cada alta de cliente — y el día que se olvide, el socio
 * deja de ver una tienda sin que nada lo avise.
 */

type Partner = {
  user_id: string;
  full_name: string | null;
  is_active: boolean;
  client_count: number;
};

export function ConsultantPartnersSection() {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/v1/consultant/partners");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { partners: Partner[] };
      setPartners(payload.partners);
      setError(null);
    } catch {
      setError("No se pudo cargar con quién compartes cartera.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) return;
    setAdding(true);
    try {
      const response = await apiFetch("/v1/consultant/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        partner: { full_name: string | null };
        shared_assignments: number;
        invited_new_account?: boolean;
        invite_url?: string;
      };
      const invitado = targetEmail;
      setEmail("");
      const reparto =
        payload.shared_assignments > 0
          ? `${payload.shared_assignments} asignaciones repartidas entre los dos.`
          : "Las tiendas nuevas se asignarán a los dos.";
      if (payload.invited_new_account) {
        // Cuenta recién creada: el nombre todavía no existe (lo pone la persona
        // al entrar), así que el aviso va por el correo, que es lo que el
        // consultor acaba de escribir y reconoce.
        toast.success(`Invitación enviada a ${invitado}`, {
          description: payload.invite_url
            ? `No se pudo enviar el correo. Pásale este enlace: ${payload.invite_url}`
            : `Tiene que abrir el correo y crear su contraseña. ${reparto}`,
        });
      } else {
        toast.success(
          `Ahora compartes cartera con ${payload.partner.full_name ?? "tu socio"}`,
          { description: reparto },
        );
      }
      await load();
    } catch {
      toast.danger("No se pudo emparejar por un error de red.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(partner: Partner) {
    try {
      const response = await apiFetch(
        `/v1/consultant/partners/${partner.user_id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Ya no compartís cartera", {
        description: "Las tiendas que ya lleva siguen siendo suyas.",
      });
      await load();
    } catch {
      toast.danger("No se pudo deshacer por un error de red.");
    }
  }

  return (
    <Card
      title="Con quién compartes cartera"
      description="Un consultor con el que trabajas: veis y lleváis las mismas tiendas."
      actions={
        partners && partners.length > 0 ? (
          <Badge tone="success">{partners.length}</Badge>
        ) : undefined
      }
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
        <Field label="Correo del consultor">
          <Input
            className="mt-1 w-72"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="socio@tuagencia.com"
          />
        </Field>
        <Button type="submit" disabled={adding || !email.trim()}>
          {adding ? "Emparejando…" : "Compartir cartera"}
        </Button>
      </form>

      <p className="mt-2 text-xs text-muted">
        Si no tiene cuenta, se la creamos y le llega una invitación por correo.
        Al emparejaros, cada uno pasa a llevar las tiendas del otro, y las
        nuevas se asignan a los dos.
      </p>

      <div className="mt-6">
        {partners === null && !error ? (
          <LoadingBlock label="Cargando…" />
        ) : partners && partners.length === 0 ? (
          <EmptyState
            title="Trabajas solo"
            hint="Si otro consultor lleva tus tiendas contigo, añádelo arriba y os repartís la cartera."
          />
        ) : partners ? (
          <List as="ul">
            {partners.map((partner) => (
              <List.Item
                as="li"
                key={partner.user_id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {partner.full_name ?? "Sin nombre"}
                  </span>
                  <span className="block text-xs text-muted">
                    {partner.client_count} cliente
                    {partner.client_count === 1 ? "" : "s"} en común
                  </span>
                </span>
                {partner.is_active ? null : <Badge tone="warn">inactivo</Badge>}
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost">
                      Dejar de compartir
                    </Button>
                  }
                  title="¿Dejar de compartir cartera?"
                  description="Las tiendas nuevas dejarán de asignarse a los dos. Las que ya lleva siguen siendo suyas: para quitarle el acceso a una tienda concreta, hazlo desde esa tienda."
                  confirmLabel="Dejar de compartir"
                  onConfirm={() => void remove(partner)}
                />
              </List.Item>
            ))}
          </List>
        ) : null}
      </div>

      {partners && partners.length > 0 ? (
        <Banner tone="success" className="mt-4 text-sm">
          Las tiendas que des de alta a partir de ahora se asignarán a los dos
          automáticamente.
        </Banner>
      ) : null}
    </Card>
  );
}
