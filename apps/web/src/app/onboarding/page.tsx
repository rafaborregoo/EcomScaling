"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { AvatarPicker } from "@/components/avatar-picker";
import { PasswordRequirements } from "@/components/password-requirements";
import { PasswordInput } from "@/components/password-input";
import {
  getPasswordErrorMessage,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
  passwordConfirmationState,
} from "@/lib/password-policy";
import {
  BrandLogo,
  Button,
  Card,
  cn,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  LoadingBlock,
} from "@/components/ui";

// El onboarding solo cubre contraseña y perfil. Las integraciones se conectan
// desde /integraciones: OAuth saca al usuario de la pagina hacia el proveedor y
// el callback vuelve siempre a /integraciones, asi que meterlas aqui rompia el
// recorrido a mitad (se abandonaba en el paso 3 y nunca se veian el 4 y el 5).
//
// Hay dos maneras de llegar y no piden lo mismo:
//
//  - **Invitado.** Su cuenta la creo otra persona y entra por un enlace, sin
//    contraseña. El paso 1 es ponersela.
//  - **Registrado por su cuenta** (`/registro`). Ya eligio contraseña y nombre
//    al registrarse; repetirselo aqui es preguntarle lo que acaba de escribir.
//    Se salta el paso 1 y al terminar va a elegir plan, no al panel: todavia
//    no tiene ninguno.
//
// La marca la pone `/registro` en el metadata del usuario. Preferido a
// adivinarlo por si tiene contraseña, que Supabase no expone de forma fiable.
type Step = 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [checkingSession, setCheckingSession] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selfSignup, setSelfSignup] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const totalSteps = selfSignup ? 1 : 2;
  const stepShown = selfSignup ? 1 : step;

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
      const propio = session?.user.user_metadata?.self_signup === true;
      setUserId(session?.user.id ?? null);
      setSelfSignup(propio);
      if (propio) setStep(2);
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
        <BrandLogo />
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
        {!userId ? (
          <Card
            title="Enlace no válido"
            description="Tu enlace ha caducado o ya se usó. Pide uno nuevo o inicia sesión."
          >
            <Button className="mt-4" onClick={() => router.push("/login")}>
              Ir a iniciar sesión
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    n <= stepShown ? "bg-accent" : "bg-separator",
                  )}
                />
              ))}
            </div>
            <p className={EYEBROW}>
              Paso {stepShown} de {totalSteps}
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
                    // Quien se registro solo no tiene plan todavia: llevarle al
                    // panel seria enseñarle una tienda que no puede conectar.
                    selfSignup
                      ? "/planes"
                      : role === "consultant"
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

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const mismatch = passwordConfirmationState(password, confirm) === "mismatch";
  const canSubmit =
    isPasswordValid(password) &&
    passwordConfirmationState(password, confirm) === "match" &&
    !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(getPasswordErrorMessage(updateError, password));
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
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
        <PasswordRequirements password={password} />
        {tooShort ? (
          <p className="text-xs text-danger">Mínimo 8 caracteres.</p>
        ) : null}
        <Field label="Repite la contraseña">
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            aria-invalid={mismatch}
            aria-describedby={
              confirm.length > 0 ? "password-confirmation-status" : undefined
            }
            required
          />
        </Field>
        {mismatch ? (
          <p id="password-confirmation-status" className="text-xs text-danger" role="alert">Las contraseñas no coinciden.</p>
        ) : null}
        {confirm.length > 0 && !mismatch ? (
          <p id="password-confirmation-status" className="text-xs text-success" role="status">
            Las contraseñas coinciden.
          </p>
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
    if (profileError) {
      setBusy(false);
      setError(profileError.message);
      return;
    }
    if (
      !savedProfile?.onboarding_completed_at ||
      savedProfile.full_name !== fullName ||
      savedProfile.avatar_url !== avatarUrl ||
      (isConsultant && savedProfile.business_name !== agencyName)
    ) {
      setBusy(false);
      setError(
        "No se pudieron verificar todos los datos guardados. Inténtalo de nuevo.",
      );
      return;
    }

    // Token nuevo ANTES de salir de aqui, o el onboarding se repite.
    //
    // La API cachea el contexto de autenticacion 30 s con el token como clave
    // (`AUTH_CONTEXT_TTL_MS`), y el perfil va dentro. Este `update` lo ha
    // escrito el navegador contra Postgres, asi que la API no se entera: al
    // llegar al portal, `/v1/bootstrap` devuelve el contexto de hace un
    // momento -- con `onboarding_completed_at` todavia nulo -- y el gate de
    // `portal-shell` rebota al usuario a /onboarding justo despues de
    // terminarlo. Con un token nuevo la clave de cache cambia y el contexto
    // se resuelve otra vez contra la base de datos.
    await supabase.auth.refreshSession();
    setBusy(false);
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
