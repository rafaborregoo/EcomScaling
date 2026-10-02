"use client";

import { useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue, organizationStatusTone } from "@/lib/display-labels";
import {
  CLIENT_STATUS_OPTIONS,
  CreateClientForm,
  type Client,
} from "@/components/admin-client-detail";
import { VerComoButton } from "@/components/ver-como-button";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  Drawer,
  ErrorBlock,
  Metric,
  Select,
  Table,
  type TableColumnDef,
} from "@/components/ui";

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
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);

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
      render: (row) => (
        <Badge tone={organizationStatusTone(row.status)}>
          {displayValue(row.status)}
        </Badge>
      ),
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
          <VerComoButton organizationId={row.id} displayName={row.display_name} />
          <ButtonLink
            href={`/admin/clientes/${row.id}`}
            size="sm"
            variant="ghost"
            aria-label={`Abrir ficha de ${row.display_name}`}
          >
            Abrir ficha
          </ButtonLink>
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

  const counts = clients.reduce<Record<string, number>>((acc, client) => {
    acc[client.status] = (acc[client.status] ?? 0) + 1;
    return acc;
  }, {});
  const filteredClients = statusFilter
    ? clients.filter((client) => client.status === statusFilter)
    : clients;
  const withoutConsultant = clients.filter((client) => client.consultants.length === 0).length;

  return (
    <div className="admin-module-body">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="admin-data-summary">
        <Metric card label="Clientes en total" value={String(clients.length)} />
        <Metric card label="Activos" tone="default" value={String(counts.active ?? 0)} />
        <Metric card label="Onboarding" value={String(counts.onboarding ?? 0)} />
        <Metric card label="Sin consultor" value={String(withoutConsultant)} tone={withoutConsultant ? "warn" : "success"} />
        <Metric card label="Baja pendiente" value={String((counts.cancelled ?? 0) + (counts.pending_deletion ?? 0))} />
      </div>

      <Card
        kicker="Panel platform admin"
        title="Directorio de clientes"
        description={`${filteredClients.length} de ${clients.length} organizaciones · estado, consultoría y acceso en una sola vista.`}
        actions={
          <div className="admin-table-actions">
            <Select
              className="w-48"
              aria-label="Filtrar por estado"
              placeholder="Todos"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "", label: "Todos los estados" }, ...CLIENT_STATUS_OPTIONS]}
            />
            <Button onClick={() => setCreating((value) => !value)}>
              {creating ? "Cerrar alta" : "Nuevo cliente"}
            </Button>
          </div>
        }
      >
        <Table
          ariaLabel="Clientes"
          columns={columns}
          rows={filteredClients}
          emptyLabel="Ningún cliente coincide con el filtro."
        />
      </Card>

      <Drawer isOpen={creating} onOpenChange={setCreating}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right" className="w-full max-w-3xl">
            <Drawer.Dialog aria-label="Alta de cliente">
              <Drawer.Header className="admin-detail-header">
                <div className="min-w-0">
                  <Drawer.Heading>Nuevo cliente</Drawer.Heading>
                  <p className="mt-1 text-sm text-muted">Crea la organización y configura su acceso inicial</p>
                </div>
                <Drawer.CloseTrigger />
              </Drawer.Header>
              <Drawer.Body className="admin-detail-body">
                <CreateClientForm
                  onCreated={async (msg) => {
                    setNotice(msg);
                    setCreating(false);
                    reload();
                  }}
                />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

    </div>
  );
}

export default function AdminClientesPage() {
  return (
    <PlatformAdminShell title="Clientes">
      {() => <ClientsPanel />}
    </PlatformAdminShell>
  );
}
