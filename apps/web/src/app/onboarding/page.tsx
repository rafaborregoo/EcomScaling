"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { AvatarPicker } from "@/components/avatar-picker";
import {
  Badge,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  LoadingBlock,
  cn,
} from "@/components/ui";

type Step = 1 | 2 | 3 | 4 | 5;

const TOTAL_STEPS = 5;

const PROVIDER_STEPS: Record<
  3 | 4 | 5,
  { name: string; blurb: string }
> = {
  3: {
    name: "Shopify",
    blurb:
      "Conecta la tienda para traer ventas, pedidos y productos. Es la base de todos los datos.",
  },
  4: {
    name: "Meta Ads",
    blurb:
      "Conecta la cuenta publicitaria para ver inversión y resultados de campañas junto a las ventas.",
  },
  5: {
    name: "Klaviyo",
    blurb:
      "Conecta Klaviyo para medir el rendimiento del email y los flujos automatizados.",
  },
};

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
    <main className="min-h-screen bg-white text-foreground">
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
                onDone={() => setStep(3)}
              />
            ) : null}

            {step === 3 || step === 4 || step === 5 ? (
              <ProviderStep
                info={PROVIDER_STEPS[step]}
                isLast={step === 5}
                onConnect={() => router.push("/integraciones")}
                onSkip={() =>
                  step === 5
                    ? router.replace("/dashboard")
                    : setStep((s) => (s + 1) as Step)
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
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      setName((current) => current || (data.full_name ?? ""));
      setAvatarUrl((current) => current ?? data.avatar_url ?? null);
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || null,
        avatar_url: avatarUrl,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setBusy(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    onDone();
  }

  return (
    <Card
      title="Tu perfil"
      description="Puedes cambiar el nombre que te asignaron y elegir un avatar."
    >
      <div className="mt-4 grid gap-5">
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
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Guardando..." : "Continuar"}
        </Button>
      </div>
    </Card>
  );
}

function ProviderStep({
  info,
  isLast,
  onConnect,
  onSkip,
}: {
  info: { name: string; blurb: string };
  isLast: boolean;
  onConnect: () => void;
  onSkip: () => void;
}) {
  return (
    <Card
      title={`Conecta ${info.name}`}
      description={info.blurb}
      actions={<Badge tone="neutral">Opcional</Badge>}
    >
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onConnect}>Conectar {info.name}</Button>
        <Button variant="ghost" onClick={onSkip}>
          {isLast ? "Finalizar" : "Omitir"}
        </Button>
      </div>
    </Card>
  );
}
