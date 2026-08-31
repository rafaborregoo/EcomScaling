"use client";

import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { AvatarPicker } from "@/components/avatar-picker";
import { getSupabaseClient } from "@/lib/supabase";
import { displayValue } from "@/lib/display-labels";
import type { BootstrapResponse } from "@/lib/bootstrap";
import {
  Avatar,
  Button,
  Card,
  ErrorBlock,
  Field,
  Input,
  Link,
  toast,
} from "@/components/ui";

function ProfileContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const userId = bootstrap.user.id;

  const [name, setName] = useState(bootstrap.profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    bootstrap.profile.avatar_url,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== (bootstrap.profile.full_name ?? "") ||
    (avatarUrl ?? null) !== bootstrap.profile.avatar_url;

  async function save() {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null, avatar_url: avatarUrl })
      .eq("id", userId);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Perfil actualizado. Recarga para verlo en toda la app.");
  }

  return (
    <div className="portal-page mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <Card
        title="Tu perfil"
        description="Datos personales de tu cuenta. Para la configuración del negocio, ve a Configuración."
      >
        <div className="grid gap-5">
          <div className="flex items-center gap-4">
            <Avatar
              name={name || bootstrap.user.email || "?"}
              src={avatarUrl ?? undefined}
              size="lg"
              color="accent"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {name || "Sin nombre"}
              </p>
              <p className="truncate text-xs text-muted">
                {bootstrap.user.email}
              </p>
            </div>
          </div>

          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <AvatarPicker
            name={name}
            value={avatarUrl}
            onChange={setAvatarUrl}
            userId={userId}
          />

          {error ? <ErrorBlock>{error}</ErrorBlock> : null}

          <div>
            <Button disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Cuenta" description="Estos datos no se pueden cambiar aquí.">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="text-right">{bootstrap.user.email ?? "Sin email"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Rol</dt>
            <dd className="text-right font-mono">
              {displayValue(bootstrap.profile.platform_role)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          Costes, gastos fijos e integraciones del negocio están en{" "}
          <Link href="/configuracion">Configuración</Link>.
        </p>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PortalShell title="Perfil">
      {(bootstrap) => <ProfileContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
