"use client";

import { type FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { PasswordInput } from "@/components/password-input";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { Banner, Button, ErrorBlock, Input, LoadingBlock } from "@/components/ui";
import styles from "@/components/public-entry.module.css";

const REASON_MESSAGES: Record<string, string> = {
  session_expired: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionReason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    router.push("/dashboard");
    setIsSubmitting(false);
  }

  return (
    <PublicEntryShell active="login">
      <main id="public-content" className={styles.main}>
        <aside className={styles.story} aria-label="Tu espacio E-NORA">
          <h2>De los datos a la siguiente decisión.</h2>
          <p>El espacio donde tu tienda, tu equipo y tu consultor trabajan con la misma perspectiva.</p>
          <dl className={styles.steps}>
            <div><dt>Entender</dt><dd>Las cifras, con su contexto.</dd></div>
            <div><dt>Priorizar</dt><dd>Lo que necesita tu atención.</dd></div>
            <div><dt>Actuar</dt><dd>El siguiente paso, en equipo.</dd></div>
          </dl>
        </aside>
        <section className={styles.formPanel} aria-labelledby="login-title">
          <div className={styles.formInner}>
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
            <p className={styles.invitation}>El acceso está disponible para cuentas invitadas. Si ya has recibido una invitación, utiliza el correo asociado a tu cuenta.</p>
          </div>
        </section>
      </main>
    </PublicEntryShell>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<LoadingBlock label="Cargando acceso…" />}><LoginPageContent /></Suspense>;
}
