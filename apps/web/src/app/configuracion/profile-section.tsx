"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { AvatarPicker } from "@/components/avatar-picker";
import { getSupabaseClient } from "@/lib/supabase";
import { displayValue } from "@/lib/display-labels";
import type { BootstrapResponse } from "@/lib/bootstrap";
import {
  Avatar,
  Button,
  Card,
  ErrorBlock,
  Input,
  SettingRow,
  toast,
} from "@/components/ui";

/**
 * Consentimiento de contacto dado en /registro con un codigo de referido. Se
 * retira aqui: el API borra los datos de contacto del lead y el metadata deja
 * de marcarlo para que la tarjeta desaparezca.
 */
function ReferralConsentCard() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setConsent(data.user?.user_metadata?.referral_contact_consent === true);
    });
  }, [supabase]);

  if (!consent) return null;

  async function revoke() {
    setBusy(true);
    const response = await apiFetch("/v1/mi-organizacion/referido-consentimiento", {
      method: "DELETE",
    });
    if (!response.ok) {
      setBusy(false);
      toast.danger(await readApiError(response));
      return;
    }
    await supabase.auth.updateUser({ data: { referral_contact_consent: false } });
    setBusy(false);
    setConsent(false);
    toast.success("Tu consultor ya no verá tus datos de contacto.");
  }

  return (
    <Card title="Contacto de tu consultor">
      <SettingRow
        label="Permiso de contacto"
        hint="Al registrarte aceptaste que el consultor de tu código pudiera contactarte para ofrecerte sus servicios."
      >
        <Button variant="secondary" disabled={busy} onClick={() => void revoke()}>
          {busy ? "Retirando..." : "Retirar permiso"}
        </Button>
      </SettingRow>
    </Card>
  );
}

/**
 * Datos personales. Vive dentro de Configuración (sección «Perfil») para que el
 * menú no saque al usuario del módulo; /perfil sigue sirviendo lo mismo para
 * los enlaces antiguos y el panel de administración.
 */
export function ProfileSection({ bootstrap }: { bootstrap: BootstrapResponse }) {
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
    <div className="space-y-4">
      <Card title="Tú" description="Cómo te ven tu consultor, tu equipo y tus clientes.">
        <SettingRow label="Foto" hint="Sale junto a tus mensajes y tareas.">
          <Avatar
            name={name || bootstrap.user.email || "?"}
            src={avatarUrl ?? undefined}
            size="lg"
            color="accent"
          />
          <AvatarPicker name={name} value={avatarUrl} onChange={setAvatarUrl} userId={userId} />
        </SettingRow>
        <SettingRow label="Nombre" htmlFor="profile-name">
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
        </SettingRow>
        <SettingRow label="Correo" hint="Es tu usuario para entrar; no se cambia desde aquí.">
          <span className="text-sm">{bootstrap.user.email ?? "Sin correo"}</span>
        </SettingRow>
        <SettingRow label="Tipo de cuenta">
          <span className="text-sm">{displayValue(bootstrap.profile.platform_role)}</span>
        </SettingRow>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="border-t border-separator pt-4">
          <Button disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </Card>

      <ReferralConsentCard />
    </div>
  );
}
