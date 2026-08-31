"use client";

import { useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorBlock,
  Field,
  Input,
  Select,
  Table,
  type TableColumnDef,
} from "@/components/ui";

type AssignedConsultant = {
  user_id: string;
  full_name: string | null;
  is_primary: boolean;
};

type Client = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  created_at: string;
  member_count: number;
  consultants: AssignedConsultant[];
};

const STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Activo" },
  { value: "suspended", label: "Suspendido" },
  { value: "cancelled", label: "Cancelado" },
];

function ClientsPanel() {
  const {
    data,
    error: loadError,
    isLoading,
    reload,
  } = useCachedQuery<{ clients: Client[] }>("/v1/admin/clients");
  const clients = data?.clients ?? null;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function deleteClient(id: string) {
    setNotice(null);
    setError(null);
    const response = await apiFetch(
      `/v1/consultant/organizations/${id}/hard-delete`,
      { method: "POST" },
    );
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setNotice("Cliente eliminado definitivamente.");
    reload();
  }

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando clientes..." />;
  }
  if (loadError && !clients) {
    return <ErrorBlock>{loadError}</ErrorBlock>;
  }
  if (!clients) {
    return null;
  }

  const columns: TableColumnDef<Client>[] = [
    {
      key: "display_name",
      label: "Cliente",
      render: (row) => (
        <span className="font-medium">
          {row.display_name}
          {row.status === "pending_deletion" ? (
            <Badge tone="danger" className="ml-2">
              borrado pendiente
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => <Badge tone="neutral">{row.status}</Badge>,
    },
    {
      key: "consultants",
      label: "Consultor",
      render: (row) =>
        row.consultants.length === 0 ? (
          <Badge tone="warn">sin consultor</Badge>
        ) : (
          <span className="text-xs text-muted">
            {row.consultants
              .map((c) => c.full_name ?? c.user_id)
              .join(", ")}
          </span>
        ),
    },
    {
      key: "member_count",
      label: "Miembros",
      render: (row) => String(row.member_count),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setEditingId((current) => (current === row.id ? null : row.id))
            }
          >
            {editingId === row.id ? "Cerrar" : "Editar"}
          </Button>
          {row.status === "pending_deletion" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void apiFetch(
                  `/v1/consultant/organizations/${row.id}/restore`,
                  { method: "POST" },
                ).then(async (r) => {
                  if (!r.ok) setError(await readApiError(r));
                  else reload();
                });
              }}
            >
              Restaurar
            </Button>
          ) : null}
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                {row.status === "pending_deletion" ? "Eliminar ya" : "Borrar"}
              </Button>
            }
            title={`Eliminar ${row.display_name}`}
            description="Borra TODO al instante: datos de Shopify/Meta/Klaviyo, tareas, planes, agentes, miembros y suscripción. No hay vuelta atrás."
            confirmLabel="Eliminar definitivamente"
            onConfirm={() => void deleteClient(row.id)}
          />
        </div>
      ),
    },
  ];

  const editing = clients.find((client) => client.id === editingId) ?? null;

  return (
    <div className="grid gap-6">
      <CreateClientForm
        onCreated={async (msg) => {
          setNotice(msg);
          reload();
        }}
      />

      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Card
        kicker="Panel platform admin"
        title="Clientes"
        description="Todas las organizaciones cliente, tengan o no consultor asignado."
      >
        <Table
          ariaLabel="Clientes"
          columns={columns}
          rows={clients}
          emptyLabel="No hay clientes todavía."
        />
      </Card>

      {editing ? (
        <EditClientForm
          client={editing}
          onSaved={async (msg) => {
            setNotice(msg);
            setEditingId(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateClientForm({
  onCreated,
}: {
  onCreated: (message: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          owner_email: ownerEmail,
          owner_full_name: ownerFullName || undefined,
          currency_code: currencyCode,
          timezone,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDisplayName("");
      setOwnerEmail("");
      setOwnerFullName("");
      await onCreated(
        `Cliente creado. Se ha enviado una invitación por email a ${ownerEmail}.`,
      );
    } catch {
      setError("No se pudo crear el cliente. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    displayName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail);

  return (
    <Card
      kicker="Alta"
      title="Nuevo cliente"
      description="Crea la organización e invita a su usuario owner por email. La suscripción se paga al entrar."
    >
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Acme Store"
            />
          </Field>
          <Field label="Email del owner">
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@acme.com"
            />
          </Field>
          <Field label="Nombre del owner (opcional)">
            <Input
              value={ownerFullName}
              onChange={(e) => setOwnerFullName(e.target.value)}
              placeholder="Nombre Apellido"
            />
          </Field>
          <Field label="Moneda">
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="EUR"
            />
          </Field>
          <Field label="Zona horaria">
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Madrid"
            />
          </Field>
        </div>
        <div>
          <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "Creando..." : "Crear cliente"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EditClientForm({
  client,
  onSaved,
}: {
  client: Client;
  onSaved: (message: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(client.display_name);
  const [status, setStatus] = useState(client.status);
  const [currencyCode, setCurrencyCode] = useState(client.currency_code);
  const [timezone, setTimezone] = useState(client.timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${client.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            status,
            currency_code: currencyCode,
            timezone,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await onSaved("Cliente actualizado.");
    } catch {
      setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card kicker="Editar" title={client.display_name}>
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <Select
              aria-label="Estado"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </Field>
          <Field label="Moneda">
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Zona horaria">
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </Field>
        </div>
        <div>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminClientesPage() {
  return (
    <PlatformAdminShell title="Clientes">
      {() => <ClientsPanel />}
    </PlatformAdminShell>
  );
}
