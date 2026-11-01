"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { getSupabaseClient } from "@/lib/supabase";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
  SettingRow,
  Switch,
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UploadButton,
  toast,
  type Tone,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

/**
 * La consultora como equipo: sus consultores, los códigos de vinculación que
 * ocupan plaza, su marca y los ajustes con los que arranca cada cliente nuevo.
 * Sustituye a «Socios»: compartir cartera es estar en la misma consultora.
 */

const ROLE_LABEL: Record<string, string> = { owner: "Propietario", manager: "Gestor", member: "Consultor" };

type Team = {
  role: string;
  can_manage: boolean;
  members: Array<{ user_id: string; role: string; is_active: boolean; joined_at: string | null; full_name: string | null; client_count: number }>;
  pending_invites: Array<{ id: string; email: string; expires_at: string }>;
};

async function send(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json().catch(() => null);
}

export function ConsultoraTeamSection({ currentUserId }: { currentUserId: string }) {
  const path = "/v1/consultant/consultora/team";
  const team = useCachedQuery<Team>(path);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    invalidateCachedQueries(path);
    team.reload();
  };

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await send("/v1/consultant/consultora/team/invite", "POST", { email: email.trim(), role });
      toast.success("Invitación enviada");
      setEmail("");
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo invitar.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(userId: string, body: { role?: string; is_active?: boolean }) {
    try {
      await send(`/v1/consultant/consultora/team/${userId}`, "PATCH", body);
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  if (team.error) return <ErrorBlock>No se pudo cargar el equipo de la consultora.</ErrorBlock>;
  if (!team.data) return <LoadingBlock label="Cargando el equipo…" />;
  const data = team.data;
  const options = Object.entries(ROLE_LABEL)
    .filter(([value]) => data.role === "owner" || value !== "owner")
    .map(([value, label]) => ({ value, label }));
  type Row = Team["members"][number] & { id: string };
  const rows: Row[] = data.members.map((member) => ({ ...member, id: member.user_id }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultores</CardTitle>
        <CardDescription>Los consultores de tu plan; los extra se facturan aparte. Al aceptar la invitación pasan a tener cartera.</CardDescription>
        <CardAction><Badge tone="brand">{data.members.filter((member) => member.is_active).length} activos</Badge></CardAction>
      </CardHeader>
      <CardContent>
        <DataTable<Row>
          ariaLabel="Consultores de la consultora"
          rows={rows}
          columns={[
            {
              key: "name",
              label: "Persona",
              render: (member) => (
                <div>
                  <p className="text-sm font-medium">
                    {member.full_name ?? "Sin nombre"}
                    {member.user_id === currentUserId ? <span className="text-muted"> (tú)</span> : null}
                  </p>
                  <p className="text-xs text-muted">{member.is_active ? "con acceso" : member.joined_at ? "sin acceso" : "invitación pendiente"}</p>
                </div>
              ),
            },
            {
              key: "role",
              label: "Rol",
              render: (member) =>
                data.can_manage && member.user_id !== currentUserId && (data.role === "owner" || member.role !== "owner") ? (
                  <Select
                    className="w-36"
                    aria-label={`Rol de ${member.full_name ?? "la persona"}`}
                    value={member.role}
                    onChange={(next) => void patch(member.user_id, { role: next })}
                    options={options}
                  />
                ) : (
                  <Badge tone={member.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[member.role] ?? member.role}</Badge>
                ),
            },
            { key: "clients", label: "Clientes", render: (member) => <span className="tabular-nums">{member.client_count}</span> },
            {
              key: "actions",
              label: "",
              render: (member) =>
                data.can_manage && member.user_id !== currentUserId && (data.role === "owner" || member.role !== "owner") ? (
                  <Button size="sm" variant="ghost" onClick={() => void patch(member.user_id, { is_active: !member.is_active })}>
                    {member.is_active ? "Quitar acceso" : "Devolver acceso"}
                  </Button>
                ) : null,
            },
          ]}
        />
        {data.pending_invites.length > 0 ? (
          <p className="mt-4 text-xs text-muted">
            Pendientes: {data.pending_invites.map((invite) => invite.email).join(" · ")}
          </p>
        ) : null}
        {data.can_manage ? (
          <form className="mt-6 grid gap-4 border-t border-separator pt-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end" onSubmit={invite}>
            <Field label="Correo del consultor">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@tuconsultora.com" />
            </Field>
            <Field label="Rol">
              <Select aria-label="Rol del consultor invitado" value={role} onChange={setRole} options={options.filter((option) => option.value !== "owner")} />
            </Field>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? "Invitando…" : "Invitar"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

const ROLE_MATRIX: Array<[string, [boolean, boolean, boolean]]> = [
  ["Trabajar con sus clientes asignados", [true, true, true]],
  ["Generar códigos de vinculación", [true, true, true]],
  ["Ver y revocar los códigos de toda la consultora", [true, true, false]],
  ["Invitar consultores y cambiar roles", [true, true, false]],
  ["Plan, plazas, facturas y marca", [true, false, false]],
];

export function ConsultoraRolesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles en la consultora</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="min-w-[28rem]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Acción</span>
              </TableHead>
              {["Propietario", "Gestor", "Consultor"].map((role) => (
                <TableHead key={role} className="text-center">
                  {role}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLE_MATRIX.map(([action, allowed]) => (
              <TableRow key={action}>
                <TableCell>{action}</TableCell>
                {allowed.map((value, index) => (
                  <TableCell key={index} className={`text-center ${value ? "font-semibold text-success" : "text-muted"}`} aria-label={value ? "Puede" : "No puede"}>
                    {value ? "✓" : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type InviteCode = {
  id: string;
  email: string | null;
  state: string;
  expires_at: string;
  created_at: string;
  created_by: string | null;
  mine: boolean;
  organization_name: string | null;
};

const CODE_STATE: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "warn" },
  redeemed: { label: "Usado", tone: "success" },
  revoked: { label: "Revocado", tone: "neutral" },
  expired: { label: "Caducado", tone: "neutral" },
};

export function InviteCodesSection() {
  const path = "/v1/consultant/invite-codes";
  const codes = useCachedQuery<{ can_manage: boolean; codes: InviteCode[] }>(path);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const refresh = () => {
    invalidateCachedQueries(path);
    codes.reload();
  };

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = (await send("/v1/consultant/clients", "POST", email.trim() ? { email: email.trim() } : {})) as {
        invite?: { access_url: string; delivery: string };
      } | null;
      setLastLink(result?.invite?.delivery === "email" ? null : (result?.invite?.access_url ?? null));
      toast.success(result?.invite?.delivery === "email" ? "Código enviado por correo" : "Código creado");
      setEmail("");
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo crear el código.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await send(`${path}/${id}`, "DELETE");
      toast.success("Código revocado: la plaza queda libre");
      refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo revocar.");
    }
  }

  if (codes.error) return <ErrorBlock>No se pudieron cargar los códigos.</ErrorBlock>;
  if (!codes.data) return <LoadingBlock label="Cargando códigos…" />;
  type Row = InviteCode;
  return (
    <Card id="codigos">
      <CardHeader>
        <CardTitle>Códigos de vinculación</CardTitle>
        <CardDescription>Un código por cliente nuevo, de un solo uso. Mientras está pendiente ocupa una plaza de cartera.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={generate}>
          <Field label="Correo del cliente (opcional)">
            <Input className="w-72" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@sutienda.com" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Creando…" : "Generar código"}
          </Button>
        </form>
        {lastLink ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4">
            <p className="min-w-0 flex-1 break-all text-sm">{lastLink}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void navigator.clipboard
                  .writeText(lastLink)
                  .then(() => toast.success("Enlace copiado"))
                  .catch(() => toast.danger("No se pudo copiar."))
              }
            >
              Copiar enlace
            </Button>
          </div>
        ) : null}
        {codes.data.codes.length === 0 ? (
          <EmptyState title="Sin códigos todavía" hint="Genera uno y compártelo con el cliente." />
        ) : (
          <DataTable<Row>
            ariaLabel="Códigos de vinculación"
            rows={codes.data.codes}
            columns={[
              {
                key: "for",
                label: "Para",
                render: (code) => (
                  <div>
                    <p className="text-sm font-medium">{code.organization_name ?? code.email ?? "Enlace suelto"}</p>
                    <p className="text-xs text-muted">
                      {code.created_by ?? "—"} · {new Date(code.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                ),
              },
              {
                key: "state",
                label: "Estado",
                render: (code) => {
                  const state = CODE_STATE[code.state] ?? { label: code.state, tone: "neutral" as Tone };
                  return (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={state.tone}>{state.label}</Badge>
                      {code.state === "pending" ? (
                        <span className="text-xs text-muted">caduca el {new Date(code.expires_at).toLocaleDateString("es-ES")}</span>
                      ) : null}
                    </span>
                  );
                },
              },
              {
                key: "actions",
                label: "",
                render: (code) =>
                  code.state === "pending" && (code.mine || codes.data?.can_manage) ? (
                    <Button size="sm" variant="ghost" onClick={() => void revoke(code.id)}>
                      Revocar
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

type Brand = {
  can_edit: boolean;
  display_name: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_reply_to: string | null;
  brand_accent_color: string | null;
  client_defaults: {
    payment_fee_pct?: number;
    payment_fee_fixed?: number;
    default_shipping_cost?: number;
    consultant_permissions?: { marketing_publish?: boolean };
  } | null;
};

export function ConsultoraBrandSection({ currentUserId }: { currentUserId: string }) {
  const path = "/v1/consultant/consultora/brand";
  const brand = useCachedQuery<Brand>(path);
  if (brand.error) return <ErrorBlock>No se pudo cargar la marca de la consultora.</ErrorBlock>;
  if (!brand.data) return <LoadingBlock label="Cargando la marca…" />;
  // `key` remonta los formularios cuando llega el dato guardado.
  return (
    <div className="space-y-6">
      <BrandCard key={`b-${brand.data.brand_name}-${brand.data.brand_logo_url}-${brand.data.brand_reply_to}-${brand.data.brand_accent_color}`} brand={brand.data} userId={currentUserId} onSaved={() => { invalidateCachedQueries(path); brand.reload(); }} />
      <ClientDefaultsCard key={`d-${JSON.stringify(brand.data.client_defaults)}`} brand={brand.data} onSaved={() => { invalidateCachedQueries(path); brand.reload(); }} />
    </div>
  );
}

function BrandCard({ brand, userId, onSaved }: { brand: Brand; userId: string; onSaved: () => void }) {
  const [name, setName] = useState(brand.brand_name ?? "");
  const [replyTo, setReplyTo] = useState(brand.brand_reply_to ?? "");
  const [logo, setLogo] = useState(brand.brand_logo_url);
  const [accent, setAccent] = useState(brand.brand_accent_color ?? "#1D4ED8");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.danger("Elige un logo PNG o JPG de hasta 2 MB para los informes."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width <= 4096 && bitmap.height <= 4096;
      bitmap.close();
      if (!valid) { toast.danger("El logo debe medir como máximo 4096 píxeles por lado."); return; }
    } catch { toast.danger("No se pudo leer el logo. Elige otra imagen PNG o JPG."); return; }
    const supabase = getSupabaseClient();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const filePath = `${userId}/marca-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.danger("No se pudo subir el logo.");
      return;
    }
    setLogo(supabase.storage.from("avatars").getPublicUrl(filePath).data.publicUrl);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await send("/v1/consultant/consultora/brand", "PUT", { brand_name: name, brand_reply_to: replyTo, brand_logo_url: logo, brand_accent_color: accent });
      toast.success("Marca guardada");
      onSaved();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !brand.can_edit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca de la consultora</CardTitle>
        <CardDescription>{disabled ? "La cambia el propietario de la consultora." : "Firma los informes PDF y sale en «Tu consultor» de cada cliente."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save}>
          <SettingRow label="Logo" hint="PNG o JPG de hasta 2 MB y 4096 píxeles por lado. Se incluye en los nuevos informes PDF.">
            {logo ? <img src={logo} alt="Logo de la consultora" className="h-10 w-auto max-w-40 object-contain" /> : <span className="text-sm text-muted">Sin logo</span>}
            {!disabled ? (
              <UploadButton accept="image/png,image/jpeg" onFile={upload}>
                {logo ? "Cambiar" : "Subir logo"}
              </UploadButton>
            ) : null}
          </SettingRow>
          <SettingRow label="Color de los informes" hint="Elige un tono oscuro para que los títulos y gráficos se lean sobre blanco." htmlFor="brand-accent">
            <Input id="brand-accent" className="max-w-40" value={accent} disabled={disabled} pattern="#[0-9a-fA-F]{6}" maxLength={7} required onChange={(event) => setAccent(event.target.value)} />
          </SettingRow>
          <SettingRow label="Nombre comercial" hint={`Si lo dejas vacío se usa «${brand.display_name ?? "el nombre de la consultora"}».`} htmlFor="brand-name">
            <Input id="brand-name" className="max-w-sm" value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} />
          </SettingRow>
          <SettingRow label="Correo de respuesta" hint="Si un cliente responde a un informe, le llega aquí." htmlFor="brand-reply">
            <Input id="brand-reply" type="email" className="max-w-sm" value={replyTo} disabled={disabled} onChange={(event) => setReplyTo(event.target.value)} />
          </SettingRow>
          {!disabled ? (
            <div className="border-t border-separator pt-4">
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function ClientDefaultsCard({ brand, onSaved }: { brand: Brand; onSaved: () => void }) {
  const defaults = brand.client_defaults ?? {};
  const [pct, setPct] = useState(defaults.payment_fee_pct?.toString() ?? "");
  const [fixed, setFixed] = useState(defaults.payment_fee_fixed?.toString() ?? "");
  const [shipping, setShipping] = useState(defaults.default_shipping_cost?.toString() ?? "");
  const [publish, setPublish] = useState(Boolean(defaults.consultant_permissions?.marketing_publish));
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await send("/v1/consultant/consultora/brand", "PUT", {
        client_defaults: {
          payment_fee_pct: pct,
          payment_fee_fixed: fixed,
          default_shipping_cost: shipping,
          consultant_permissions: { marketing_publish: publish },
        },
      });
      toast.success("Ajustes de partida guardados");
      onSaved();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !brand.can_edit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajustes de partida para clientes nuevos</CardTitle>
        <CardDescription>Se copian cuando un cliente se da de alta con un código. Luego cada uno los ajusta: no se sincronizan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save}>
          <SettingRow label="Comisión de la pasarela">
            <Input className="w-24" type="number" step="0.01" min="0" max="100" aria-label="Comisión en porcentaje" value={pct} disabled={disabled} onChange={(event) => setPct(event.target.value)} />
            <span className="text-sm text-muted">% +</span>
            <Input id="consultora-fee-fixed" className="w-24" type="number" step="0.01" min="0" aria-label="Comisión fija" value={fixed} disabled={disabled} onChange={(event) => setFixed(event.target.value)} />
            <span className="text-sm text-muted">fijo</span>
          </SettingRow>
          <SettingRow label="Envío medio">
            <Input className="w-24" type="number" step="0.01" min="0" aria-label="Envío medio" value={shipping} disabled={disabled} onChange={(event) => setShipping(event.target.value)} />
          </SettingRow>
          <SettingRow label="Pedir permiso para programar campañas" hint="Si lo activas, el cliente nuevo arranca dejándote programar campañas en Klaviyo.">
            <Switch aria-label="Programar campañas desde el alta" isSelected={publish} isDisabled={disabled} onChange={setPublish}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </SettingRow>
          {!disabled ? (
            <div className="border-t border-separator pt-4">
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
