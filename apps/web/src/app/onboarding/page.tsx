"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { AvatarPicker } from "@/components/avatar-picker";
import {
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  LoadingBlock,
  cn,
} from "@/components/ui";

// El onboarding solo cubre contraseña y perfil. Las integraciones se conectan
// desde /integraciones: OAuth saca al usuario de la pagina hacia el proveedor y
// el callback vuelve siempre a /integraciones, asi que meterlas aqui rompia el
// recorrido a mitad (se abandonaba en el paso 3 y nunca se veian el 4 y el 5).
type Step = 1 | 2;

const TOTAL_STEPS = 2;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [checkingSession, setCheckingSession] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);

  useEffect(() => {
    document.title = "EcomScaling";
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setUserId(session?.user.id ?? null);
      setCheckingSession(false);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (checkingSession) {
    return <LoadingBlock label="Cargando..." />;
  }

  return (
    <main className="min-h-dvh bg-white text-foreground">
      <header className="border-b border-separator px-6 py-4">
        <p className={cn(EYEBROW, "text-accent")}>EcomScaling</p>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
        {!userId ? (
          <Card
            title="Enlace no válido"
            description="Tu invitación ha caducado o ya se usó. Pide una nueva o inicia sesión."
          >
            <Button className="mt-4" onClick={() => router.push("/login")}>
              Ir a iniciar sesión
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    n <= step ? "bg-accent" : "bg-separator",
                  )}
                />
              ))}
            </div>
            <p className={EYEBROW}>
              Paso {step} de {TOTAL_STEPS}
            </p>

            {step === 1 ? (
              <PasswordStep supabase={supabase} onDone={() => setStep(2)} />
            ) : null}

            {step === 2 ? (
              <ProfileStep
                supabase={supabase}
                userId={userId}
                onDone={(role) =>
                  router.replace(
                    role === "consultant"
                      ? "/consultor?welcome=1"
                      : "/dashboard",
                  )
                }
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function PasswordStep({
  supabase,
  onDone,
}: {
  supabase: ReturnType<typeof getSupabaseClient>;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  }

  return (
    <Card
      title="Crea tu contraseña"
      description="Es lo primero. La usarás para entrar a partir de ahora."
    >
      <div className="mt-4 grid gap-4">
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {tooShort ? (
          <p className="text-xs text-danger">Mínimo 8 caracteres.</p>
        ) : null}
        <Field label="Repite la contraseña">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {mismatch ? (
          <p className="text-xs text-danger">Las contraseñas no coinciden.</p>
        ) : null}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <Button disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? "Guardando..." : "Continuar"}
        </Button>
      </div>
    </Card>
  );
}

function ProfileStep({
  supabase,
  userId,
  onDone,
}: {
  supabase: ReturnType<typeof getSupabaseClient>;
  userId: string;
  onDone: (role: string) => void;
}) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [isConsultant, setIsConsultant] = useState(false);
  const [platformRole, setPlatformRole] = useState("client");
  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, business_name, platform_role")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setProfileLoading(false);
      if (!data) return;
      setName((current) => current || (data.full_name ?? ""));
      setAvatarUrl((current) => current ?? data.avatar_url ?? null);
      setBusinessName((current) => current || (data.business_name ?? ""));
      setIsConsultant(data.platform_role === "consultant");
      setPlatformRole(data.platform_role);
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  async function submit() {
    setBusy(true);
    setError(null);
    const fullName = name.trim();
    const agencyName = isConsultant ? businessName.trim() : "";
    const { data: savedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        business_name: agencyName || null,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("full_name, avatar_url, business_name, onboarding_completed_at")
      .single();
    setBusy(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    if (
      !savedProfile?.onboarding_completed_at ||
      savedProfile.full_name !== fullName ||
      savedProfile.avatar_url !== avatarUrl ||
      (isConsultant && savedProfile.business_name !== agencyName)
    ) {
      setError(
        "No se pudieron verificar todos los datos guardados. Inténtalo de nuevo.",
      );
      return;
    }
    onDone(platformRole);
  }

  return (
    <Card
      title="Tu perfil"
      description="Puedes cambiar el nombre que te asignaron y elegir un avatar."
    >
      <div className="mt-4 grid gap-5">
        <Field label="Nombre personal">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        {isConsultant ? (
          <Field label="Nombre de tu negocio o agencia">
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Mi agencia"
              required
            />
          </Field>
        ) : null}

        <AvatarPicker
          name={name}
          value={avatarUrl}
          onChange={setAvatarUrl}
          userId={userId}
          onUploadingChange={setAvatarUploading}
        />

        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <Button
          disabled={
            busy ||
            profileLoading ||
            avatarUploading ||
            !name.trim() ||
            (isConsultant && !businessName.trim())
          }
          onClick={() => void submit()}
        >
          {busy ? "Guardando..." : "Finalizar"}
        </Button>
      </div>
    </Card>
  );
}
