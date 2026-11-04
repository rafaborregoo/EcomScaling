"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import {
  PREGUNTAS_CLIENTE,
  PREGUNTAS_CONSULTOR,
  plataformaLegible,
  respuestaLegible,
} from "@/lib/solicitud-preguntas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AsyncState,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  ErrorBlock,
  Field,
  Input,
  Metric,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  toast,
  type Tone,
} from "@/components/ui";

/**
 * Solicitudes de acceso (apps/api/src/solicitudes.ts). Aprobar reserva la
 * plaza; invitar crea la cuenta y manda el correo del onboarding. Van
 * separados para aprobar durante la lista de espera e invitar a todos el día
 * que se abre.
 */

type Kind = "client" | "consultant" | "consultant_client";
type Status = "pending" | "approved" | "waitlisted" | "rejected" | "invited";
type ShopifyCheck = {
  checked_at: string;
  is_shopify: boolean | null;
  myshopify_domain: string | null;
  shop_name: string | null;
  error?: string;
};
type Solicitud = {
  id: string;
  kind: Kind;
  status: Status;
  email: string;
  full_name: string | null;
  business_name: string | null;
  store_url: string | null;
  store_domain: string | null;
  platform: string | null;
  answers: Record<string, string | string[]>;
  checks: { shopify?: ShopifyCheck };
  client_slots: number | null;
  parent_request_id: string | null;
  consulting_organization_id: string | null;
  admin_note: string | null;
  invited_at: string | null;
  created_at: string;
  email_check: "match" | "generic" | "mismatch" | "unknown";
  duplicate_ids: string[];
  consultant_name: string | null;
  onboarding_completed: boolean;
};
type Plazas = Record<"client" | "consultant", { limit: number; occupied: number; available: number }>;
type Payload = { plazas: Plazas | null; requests: Solicitud[] };
type InviteResult = { id: string; ok: boolean; message?: string; delivery?: string; invite_url?: string | null };

const KEY = "/v1/admin/solicitudes";

const KIND_LABEL: Record<Kind, string> = {
  client: "Cliente",
  consultant: "Consultor",
  consultant_client: "Cliente de consultor",
};

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "warn" },
  approved: { label: "Aprobada", tone: "brand" },
  invited: { label: "Invitada", tone: "success" },
  waitlisted: { label: "Lista de espera", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "danger" },
};

const CHECK_ERROR: Record<string, string> = {
  dominio_no_valido: "dirección no válida",
  dominio_no_publico: "no apunta a una web pública",
  sin_respuesta: "la web no responde",
  redirige_sin_https: "redirige a una web sin https",
  demasiadas_redirecciones: "demasiadas redirecciones",
  no_se_pudo_comprobar: "no se pudo comprobar",
};

function fecha(value: string) {
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

async function send(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json().catch(() => null);
}

function refresh() {
  invalidateCachedQueries(KEY);
}

function ShopifyBadge({ row }: { row: Solicitud }) {
  const check = row.checks.shopify;
  if (!row.store_domain) return null;
  if (!check) return <Badge tone="neutral">Comprobando…</Badge>;
  if (check.is_shopify === true) return <Badge tone="success">Shopify</Badge>;
  if (check.is_shopify === false) return <Badge tone="danger">No es Shopify</Badge>;
  return <Badge tone="neutral">Sin comprobar</Badge>;
}

function EmailBadge({ row }: { row: Solicitud }) {
  if (row.email_check === "match") return <Badge tone="success">Correo de la tienda</Badge>;
  if (row.email_check === "mismatch") return <Badge tone="warn">Correo de otro dominio</Badge>;
  return null;
}

function SeatsCard({ plazas }: { plazas: Plazas | null }) {
  const [client, setClient] = useState(String(plazas?.client.limit ?? ""));
  const [consultant, setConsultant] = useState(String(plazas?.consultant.limit ?? ""));
  const [busy, setBusy] = useState(false);
  const dirty = String(plazas?.client.limit ?? "") !== client || String(plazas?.consultant.limit ?? "") !== consultant;

  async function save() {
    setBusy(true);
    try {
      await send(`${KEY}/plazas`, "PUT", { client: Number(client), consultant: Number(consultant) });
      toast.success("Plazas actualizadas");
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudieron guardar las plazas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plazas</CardTitle>
        <CardDescription>
          Cuentan las aprobadas y las invitadas. Un cliente directo que se asocia a un consultor deja su plaza libre:
          pasa a gastar plaza de la cartera de ese consultor.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric
            card
            label="Clientes"
            value={plazas ? `${plazas.client.occupied} / ${plazas.client.limit}` : "—"}
            hint={plazas ? `${plazas.client.available} libres` : undefined}
          />
          <Metric
            card
            label="Consultores"
            value={plazas ? `${plazas.consultant.occupied} / ${plazas.consultant.limit}` : "—"}
            hint={plazas ? `${plazas.consultant.available} libres` : undefined}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Plazas de cliente">
            <Input className="w-32" inputMode="numeric" value={client} onChange={(event) => setClient(event.target.value)} />
          </Field>
          <Field label="Plazas de consultor">
            <Input className="w-32" inputMode="numeric" value={consultant} onChange={(event) => setConsultant(event.target.value)} />
          </Field>
          <Button variant="secondary" disabled={!dirty || busy || !/^\d+$/.test(client) || !/^\d+$/.test(consultant)} onClick={() => void save()}>
            {busy ? "Guardando..." : "Guardar plazas"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteAllCard({ approved }: { approved: number }) {
  const [results, setResults] = useState<InviteResult[] | null>(null);

  async function inviteAll() {
    try {
      const data = (await send(`${KEY}/invitar-aprobadas`, "POST")) as { invited: number; failed: number; results: InviteResult[] };
      setResults(data.results);
      toast.success(`${data.invited} invitadas${data.failed ? `, ${data.failed} con error` : ""}`);
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudieron enviar las invitaciones.");
      return false;
    }
  }

  const failed = results?.filter((item) => !item.ok) ?? [];
  const manual = results?.filter((item) => item.ok && item.delivery === "manual_link" && item.invite_url) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir el acceso</CardTitle>
        <CardDescription>
          Crea la cuenta de cada solicitud aprobada y le manda el correo para hacer el onboarding. Primero los
          consultores, después sus clientes y los clientes directos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <AlertDialog>
            <AlertDialogTrigger render={<Button disabled={approved === 0}>{`Enviar invitaciones (${approved})`}</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Invitar a las {approved} solicitudes aprobadas?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se crean sus cuentas con el plan de acceso anticipado y a cada una le llega el correo de E-NORA. No se
                  puede deshacer: después solo se pueden desactivar desde su ficha.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={inviteAll} busyLabel="Invitando...">
                  Enviar invitaciones
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {failed.length > 0 ? (
          <ErrorBlock>
            {failed.map((item) => (
              <span key={item.id} className="block">
                {item.message}
              </span>
            ))}
          </ErrorBlock>
        ) : null}
        {manual.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">El correo no está configurado: manda tú estos enlaces.</p>
            {manual.map((item) => (
              <code key={item.id} className="block break-all text-xs">
                {item.invite_url}
              </code>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Detail({
  row,
  all,
  onOpen,
}: {
  row: Solicitud;
  all: Solicitud[];
  onOpen: (id: string) => void;
}) {
  const [note, setNote] = useState(row.admin_note ?? "");
  const [slots, setSlots] = useState(String(row.client_slots ?? 2));
  const [busy, setBusy] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const preguntas = row.kind === "consultant" ? PREGUNTAS_CONSULTOR : row.kind === "client" ? PREGUNTAS_CLIENTE : [];
  const children = all.filter((item) => item.parent_request_id === row.id);
  const parent = row.parent_request_id ? all.find((item) => item.id === row.parent_request_id) : null;
  const duplicates = all.filter((item) => row.duplicate_ids.includes(item.id));
  const check = row.checks.shopify;

  async function act(label: string, path: string, method: string, body?: unknown, done?: string) {
    setBusy(label);
    try {
      const result = (await send(path, method, body)) as { delivery?: string; invite_url?: string | null } | null;
      if (result?.delivery === "manual_link" && result.invite_url) setManualLink(result.invite_url);
      if (done) toast.success(done);
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo hacer.");
    } finally {
      setBusy(null);
    }
  }

  const setStatus = (status: Status, done: string) => act(status, `${KEY}/${row.id}`, "PATCH", { status }, done);

  return (
    <div className="grid gap-6 px-4 pb-4">
      <section className="grid gap-2 text-sm">
        <p>
          <span className="text-muted">Contacto: </span>
          {row.full_name ?? "—"} · <a className="underline" href={`mailto:${row.email}`}>{row.email}</a>
        </p>
        {row.store_url ? (
          <p>
            <span className="text-muted">Web: </span>
            <a className="underline" href={/^https?:\/\//.test(row.store_url) ? row.store_url : `https://${row.store_url}`} target="_blank" rel="noreferrer noopener">
              {row.store_domain ?? row.store_url}
            </a>
          </p>
        ) : null}
        {row.kind === "client" ? (
          <p>
            <span className="text-muted">Plataforma: </span>
            {plataformaLegible(row.platform)}
          </p>
        ) : null}
        {row.kind === "consultant_client" ? (
          <p>
            <span className="text-muted">Lo declara: </span>
            {parent ? (
              <button type="button" className="underline" onClick={() => onOpen(parent.id)}>
                {parent.business_name ?? parent.email}
              </button>
            ) : (
              (row.consultant_name ?? "un consultor")
            )}
          </p>
        ) : null}
        <p>
          <span className="text-muted">Recibida: </span>
          {fecha(row.created_at)}
          {row.invited_at ? ` · invitada el ${fecha(row.invited_at)} · ${row.onboarding_completed ? "onboarding hecho" : "onboarding pendiente"}` : ""}
        </p>
      </section>

      {row.store_domain ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Comprobaciones</h3>
          <div className="flex flex-wrap items-center gap-2">
            <ShopifyBadge row={row} />
            <EmailBadge row={row} />
            {check?.myshopify_domain ? <span className="text-xs text-muted">{check.myshopify_domain}</span> : null}
            {check?.error ? <span className="text-xs text-muted">{CHECK_ERROR[check.error] ?? check.error}</span> : null}
          </div>
          <div>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act("check", `${KEY}/${row.id}/comprobar`, "POST", undefined, "Tienda comprobada")}>
              {busy === "check" ? "Comprobando..." : "Volver a comprobar"}
            </Button>
          </div>
        </section>
      ) : null}

      {duplicates.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">El mismo correo o tienda aparece en</h3>
          <ul className="grid gap-1 text-sm">
            {duplicates.map((item) => (
              <li key={item.id}>
                <button type="button" className="underline" onClick={() => onOpen(item.id)}>
                  {item.business_name ?? item.email}
                </button>{" "}
                <span className="text-muted">· {KIND_LABEL[item.kind]} · {STATUS[item.status].label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preguntas.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Respuestas</h3>
          <dl className="grid gap-3 text-sm">
            {preguntas.map((pregunta) => (
              <div key={pregunta.key}>
                <dt className="text-muted">{pregunta.label}</dt>
                <dd className="whitespace-pre-wrap">{respuestaLegible(pregunta, row.answers[pregunta.key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {row.kind === "consultant" ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Clientes declarados ({children.length})</h3>
          {children.length === 0 ? (
            <p className="text-sm text-muted">No ha declarado ninguno.</p>
          ) : (
            <ul className="grid gap-2">
              {children.map((child) => (
                <li key={child.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" className="underline" onClick={() => onOpen(child.id)}>
                    {child.business_name ?? child.email}
                  </button>
                  <span className="text-muted">{child.store_domain}</span>
                  <ShopifyBadge row={child} />
                  <EmailBadge row={child} />
                  <Badge tone={STATUS[child.status].tone}>{STATUS[child.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Field label="Clientes en cartera" hint="Cuántos de sus clientes puede llevar en E-NORA con su plan.">
            <div className="flex flex-wrap items-center gap-3">
              <Input className="w-24" inputMode="numeric" value={slots} onChange={(event) => setSlots(event.target.value)} disabled={row.status === "invited"} />
              {row.status !== "invited" && String(row.client_slots ?? 2) !== slots ? (
                <Button size="sm" variant="secondary" disabled={busy !== null || !/^\d+$/.test(slots)} onClick={() => void act("slots", `${KEY}/${row.id}`, "PATCH", { client_slots: Number(slots) }, "Plazas de cartera guardadas")}>
                  Guardar
                </Button>
              ) : null}
            </div>
          </Field>
        </section>
      ) : null}

      <section className="grid gap-2">
        <Field label="Nota interna">
          <Textarea rows={3} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {note !== (row.admin_note ?? "") ? (
          <div>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void act("note", `${KEY}/${row.id}`, "PATCH", { admin_note: note }, "Nota guardada")}>
              Guardar nota
            </Button>
          </div>
        ) : null}
      </section>

      {manualLink ? (
        <section className="grid gap-2">
          <p className="text-sm font-medium">El correo no está configurado: manda tú este enlace.</p>
          <code className="block break-all text-xs">{manualLink}</code>
        </section>
      ) : null}

      {row.status !== "invited" ? (
        <section className="flex flex-wrap gap-2">
          {row.status === "approved" ? (
            <Button disabled={busy !== null} onClick={() => void act("invite", `${KEY}/${row.id}/invitar`, "POST", undefined, "Cuenta creada e invitación enviada")}>
              {busy === "invite" ? "Invitando..." : "Invitar ahora"}
            </Button>
          ) : (
            <Button
              disabled={busy !== null}
              onClick={() =>
                void act("approve", `${KEY}/${row.id}/aprobar`, "POST", row.kind === "consultant" && /^\d+$/.test(slots) ? { client_slots: Number(slots) } : {}, "Aprobada: tiene la plaza reservada")
              }
            >
              {busy === "approve" ? "Aprobando..." : "Aprobar"}
            </Button>
          )}
          {row.status !== "waitlisted" ? (
            <Button variant="secondary" disabled={busy !== null} onClick={() => void setStatus("waitlisted", "En lista de espera")}>
              Lista de espera
            </Button>
          ) : null}
          {row.status !== "rejected" ? (
            <Button variant="ghost" disabled={busy !== null} onClick={() => void setStatus("rejected", "Rechazada")}>
              Rechazar
            </Button>
          ) : null}
          {row.status !== "pending" ? (
            <Button variant="ghost" disabled={busy !== null} onClick={() => void setStatus("pending", "Vuelve a pendiente")}>
              Volver a pendiente
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SolicitudesPanel() {
  const query = useCachedQuery<Payload>(KEY);
  const focus = useSearchParams().get("focus");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status | "all">("pending");
  // Llegando desde el aviso (?focus=<id>) la ficha nace abierta, aunque la
  // fila quede en otra página o fuera del filtro.
  const [openId, setOpenId] = useState<string | null>(focus);

  const rows = useMemo(
    () =>
      (query.data?.requests ?? []).filter(
        (row) => (kind === "all" || row.kind === kind) && (status === "all" || row.status === status),
      ),
    [query.data, kind, status],
  );

  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) return <AsyncState status="loading" loadingLabel="Cargando solicitudes..." />;

  const all = query.data.requests;
  const open = openId ? all.find((row) => row.id === openId) ?? null : null;
  const approved = all.filter((row) => row.status === "approved").length;
  const count = (value: Status) => all.filter((row) => (kind === "all" || row.kind === kind) && row.status === value).length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SeatsCard key={`${query.data.plazas?.client.limit}-${query.data.plazas?.consultant.limit}`} plazas={query.data.plazas} />
        <InviteAllCard approved={approved} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-3">
            <ToggleGroup<Kind | "all"> value={kind} onValueChange={setKind} spacing={1}>
              <ToggleGroupItem value="all">Todas</ToggleGroupItem>
              <ToggleGroupItem value="client">Clientes</ToggleGroupItem>
              <ToggleGroupItem value="consultant">Consultores</ToggleGroupItem>
              <ToggleGroupItem value="consultant_client">De consultores</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup<Status | "all"> value={status} onValueChange={setStatus} spacing={1}>
              <ToggleGroupItem value="pending">{`Pendientes (${count("pending")})`}</ToggleGroupItem>
              <ToggleGroupItem value="approved">{`Aprobadas (${count("approved")})`}</ToggleGroupItem>
              <ToggleGroupItem value="invited">{`Invitadas (${count("invited")})`}</ToggleGroupItem>
              <ToggleGroupItem value="waitlisted">{`Espera (${count("waitlisted")})`}</ToggleGroupItem>
              <ToggleGroupItem value="rejected">{`Rechazadas (${count("rejected")})`}</ToggleGroupItem>
              <ToggleGroupItem value="all">Todas</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <DataTable<Solicitud>
            ariaLabel="Solicitudes de acceso"
            emptyLabel="No hay solicitudes con este filtro."
            searchPlaceholder="Buscar por nombre, correo o web"
            rows={rows}
            columns={[
              {
                key: "business_name",
                label: "Solicitud",
                value: (row) => `${row.business_name ?? ""} ${row.full_name ?? ""} ${row.email}`,
                render: (row) => (
                  <div data-focus-id={row.id}>
                    <p className="text-sm font-medium">{row.business_name ?? row.email}</p>
                    <p className="text-xs text-muted">{row.full_name ? `${row.full_name} · ${row.email}` : row.email}</p>
                  </div>
                ),
              },
              {
                key: "kind",
                label: "Clase",
                value: (row) => KIND_LABEL[row.kind],
                render: (row) => (
                  <div>
                    <p className="text-sm">{KIND_LABEL[row.kind]}</p>
                    {row.kind === "consultant" ? (
                      <p className="text-xs text-muted">{`${all.filter((item) => item.parent_request_id === row.id).length} clientes declarados`}</p>
                    ) : row.kind === "consultant_client" ? (
                      <p className="text-xs text-muted">
                        {all.find((item) => item.id === row.parent_request_id)?.business_name ?? row.consultant_name ?? ""}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "store_domain",
                label: "Tienda",
                value: (row) => row.store_domain ?? "",
                render: (row) => (
                  <div className="grid gap-1">
                    <span className="text-sm">{row.store_domain ?? (row.kind === "client" ? plataformaLegible(row.platform) : "—")}</span>
                    <span className="flex flex-wrap gap-1">
                      <ShopifyBadge row={row} />
                      <EmailBadge row={row} />
                      {row.duplicate_ids.length > 0 ? <Badge tone="warn">Repetida</Badge> : null}
                    </span>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Estado",
                value: (row) => STATUS[row.status].label,
                render: (row) => <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>,
              },
              { key: "created_at", label: "Recibida", value: (row) => row.created_at, render: (row) => fecha(row.created_at) },
              {
                key: "actions",
                label: "",
                render: (row) => (
                  <Button size="sm" variant="secondary" onClick={() => setOpenId(row.id)}>
                    Revisar
                  </Button>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Drawer open={open !== null} onOpenChange={(value) => !value && setOpenId(null)} swipeDirection="right">
        <DrawerContent className="sm:max-w-[36rem]">
          <DrawerHeader>
            <DrawerTitle>{open?.business_name ?? open?.email ?? ""}</DrawerTitle>
            <DrawerDescription>
              {open ? (
                <span className="flex flex-wrap items-center gap-2">
                  {KIND_LABEL[open.kind]}
                  <Badge tone={STATUS[open.status].tone}>{STATUS[open.status].label}</Badge>
                </span>
              ) : null}
            </DrawerDescription>
          </DrawerHeader>
          {open ? <Detail key={`${open.id}-${open.status}-${open.admin_note}-${open.client_slots}`} row={open} all={all} onOpen={setOpenId} /> : null}
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default function AdminSolicitudesPage() {
  return (
    <PlatformAdminShell title="Solicitudes">
      {() => (
        <div className="portal-page mx-auto max-w-6xl">
          <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando solicitudes..." />}>
            <SolicitudesPanel />
          </Suspense>
        </div>
      )}
    </PlatformAdminShell>
  );
}
