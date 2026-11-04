"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { PasswordInput } from "@/components/password-input";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { Banner, Button, ErrorBlock, Field, Input, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, LoadingBlock } from "@/components/ui";
import styles from "@/components/public-entry.module.css";

const REASON_MESSAGES: Record<string, string> = {
  session_expired: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
};

/**
 * Con la verificación en dos pasos activada, la contraseña solo da una sesión
 * aal1: hace falta el código de la app para subirla a aal2. Devuelve el factor
 * que hay que verificar, o null si la sesión ya está completa.
 */
async function pendingTotpFactor() {
  const supabase = getSupabaseClient();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!level || level.nextLevel !== "aal2" || level.currentLevel === "aal2") return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return factors?.totp[0]?.id ?? null;
}

/** Segundo paso del acceso: las 6 cifras de la app de autenticación. */
function TotpStep({ factorId, onDone, onCancel }: { factorId: string; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  async function verify(value: string) {
    if (value.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    const { error: verifyError } = await getSupabaseClient().auth.mfa.challengeAndVerify({ factorId, code: value });
    if (verifyError) {
      setIsVerifying(false);
      setCode("");
      setError("El código no es correcto o ya ha caducado. Escribe el que muestra ahora tu app.");
      return;
    }
    onDone();
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
      aria-busy={isVerifying}
    >
      <Field label="Código de tu app de autenticación" error={error ?? undefined}>
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={(value) => void verify(value)} disabled={isVerifying} autoFocus>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </Field>
      <Button className={styles.submit} type="submit" disabled={isVerifying || code.length !== 6}>{isVerifying ? "Comprobando…" : "Entrar"}</Button>
      <div className={styles.recovery}>
        <button type="button" className="underline" onClick={onCancel} disabled={isVerifying}>Entrar con otra cuenta</button>
      </div>
    </form>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionReason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  // Si ya hay sesión a medias (contraseña sí, código no), se pide el código
  // directamente: así llega quien viene del aviso de 2FA del portal.
  useEffect(() => {
    let cancelled = false;
    void pendingTotpFactor().then((factorId) => {
      if (!cancelled && factorId) setTotpFactorId(factorId);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    let signInError: { message: string } | null = null;
    try {
      const result = await getSupabaseClient().auth.signInWithPassword({ email, password });
      signInError = result.error;
    } catch (signInFailure) {
      setIsSubmitting(false);
      setError(signInFailure instanceof Error ? signInFailure.message : "No se pudo iniciar sesión.");
      return;
    }
    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }
    const factorId = await pendingTotpFactor();
    setIsSubmitting(false);
    if (factorId) setTotpFactorId(factorId);
    else router.push("/dashboard");
  }

  async function switchAccount() {
    await getSupabaseClient().auth.signOut();
    setTotpFactorId(null);
    setPassword("");
  }

  return (
    <PublicEntryShell active="login">
      <main id="public-content" className={styles.main}>
        <aside className={styles.story} aria-label="Tu espacio E-NORA">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estatico */}
          <img className={styles.storyLogo} src="/logos/e-nora-login.svg" alt="E-NORA" />
          <h2><span>Todo conectado</span><span>de la mejor forma</span></h2>
        </aside>
        <section className={styles.formPanel} aria-labelledby="login-title">
          <div className={styles.formInner}>
            {totpFactorId ? (
              <>
                <h1 id="login-title">Verificación en dos pasos.</h1>
                <p className={styles.intro}>Abre tu app de autenticación y escribe las 6 cifras que te muestra para {email || "tu cuenta"}.</p>
                <TotpStep factorId={totpFactorId} onDone={() => router.push("/dashboard")} onCancel={() => void switchAccount()} />
              </>
            ) : (
            <>
            <h1 id="login-title">Bienvenido a tu espacio.</h1>
            <p className={styles.intro}>Inicia sesión para continuar con tu negocio.</p>
            {sessionReason && REASON_MESSAGES[sessionReason] ? <Banner tone="warn" className="mb-6 text-sm">{REASON_MESSAGES[sessionReason]}</Banner> : null}
            <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <label htmlFor="login-email">
                <span>Correo electrónico</span>
                <Input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} />
              </label>
              <label htmlFor="login-password">
                <span>Contraseña</span>
                <PasswordInput id="login-password" name="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} />
              </label>
              <div className={styles.recovery}><Link href="/recuperar">¿Has olvidado tu contraseña?</Link></div>
              {error ? <div role="alert"><ErrorBlock>{error}</ErrorBlock></div> : null}
              <Button className={styles.submit} type="submit" disabled={isSubmitting}>{isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}</Button>
            </form>
            <p className={styles.invitation}>El acceso está disponible para cuentas invitadas. Si ya has recibido una invitación, utiliza el correo asociado a tu cuenta. ¿Aún no tienes cuenta? Las plazas son limitadas, pero puedes <Link href="/solicitar">solicitar acceso</Link>.</p>
            </>
            )}
          </div>
        </section>
      </main>
    </PublicEntryShell>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<LoadingBlock label="Cargando acceso…" />}><LoginPageContent /></Suspense>;
}
