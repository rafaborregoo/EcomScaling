"use client";


import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue, organizationStatusTone } from "@/lib/display-labels";
import { scheduledDeletionLabel } from "@/lib/scheduled-deletion";
import {
  CLIENT_STATUS_OPTIONS,
  CreateClientSheet,
  type Client,
} from "@/components/admin-client-detail";
import { VerComoButton } from "@/components/ver-como-button";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  ErrorBlock,
  Metric,
  Select,
  DataTable,
  type DataTableColumn,
  AvatarGroup,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroupCount,
  avatarInitials,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
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

  const columns: DataTableColumn<Client>[] = [
    {
      key: "display_name",
      label: "Cliente",
      render: (row) => (
        <span className="font-medium">
          {row.display_name}
          {row.status === "pending_deletion" ? (
            <Badge tone="danger" className="ml-2">
              {scheduledDeletionLabel(row.scheduled_purge_at)}
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
          <span className="flex items-center gap-2">
            {/* Tres caras como mucho; el resto, en el contador. */}
            <AvatarGroup>
              {row.consultants.slice(0, 3).map((c) => (
                <Avatar key={c.user_id} size="sm" title={c.full_name ?? c.user_id}>
                  <AvatarImage src={c.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{avatarInitials(c.full_name)}</AvatarFallback>
                </Avatar>
              ))}
              {row.consultants.length > 3 ? (
                <AvatarGroupCount className="size-6 text-[0.625rem]">+{row.consultants.length - 3}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>
            <span className="text-xs text-muted">
              {row.consultants
                .map((c) => c.full_name ?? c.user_id)
                .join(", ")}
            </span>
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
        <div role="group" aria-label="Acciones del cliente" className="flex flex-wrap items-center gap-2 ml-auto">
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
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button size="sm" variant="ghost">
                  {row.status === "pending_deletion" ? "Eliminar ya" : "Borrar"}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-danger/10 text-danger">
                  <Trash2Icon />
                </AlertDialogMedia>
                <AlertDialogTitle>¿Eliminar {row.display_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Borra todo al instante: datos de Shopify, Meta y Klaviyo, tareas, planes, agentes, miembros, suscripción y los usuarios que no tengan otra tienda. No hay vuelta atrás.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogConfirmPhrase phrase={row.display_name} />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => deleteClient(row.id)}>
                  Eliminar definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

      <Card>
        <CardHeader>
          <CardKicker>Panel platform admin</CardKicker>
          <CardTitle>Directorio de clientes</CardTitle>
          <CardDescription>{`${filteredClients.length} de ${clients.length} organizaciones · estado, consultoría y acceso en una sola vista.`}</CardDescription>
          <CardAction><div className="admin-table-actions">
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
          </div></CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Clientes"
            columns={columns}
            rows={filteredClients}
            emptyLabel="Ningún cliente coincide con el filtro."
          />
        </CardContent>
      </Card>

      <CreateClientSheet
        isOpen={creating}
        onOpenChange={setCreating}
        onCreated={async (msg) => {
          setNotice(msg);
          setCreating(false);
          reload();
        }}
      />

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
