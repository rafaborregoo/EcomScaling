"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { PasswordRequirements } from "@/components/password-requirements";
import { getSupabaseClient } from "@/lib/supabase";
import {
  getPasswordErrorMessage,
  isPasswordValid,
  passwordConfirmationState,
} from "@/lib/password-policy";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { Badge, Banner, Button, Card, ErrorBlock, Field, Input, toast } from "@/components/ui";

/**
 * Seguridad de la cuenta con Supabase Auth, sin API propia: contraseña, segundo
 * factor TOTP y cierre de las demás sesiones. Antes cambiar la contraseña
 * obligaba a cerrar sesión y pasar por "recuperar".
 *
 * Supabase no deja listar las sesiones abiertas desde el cliente, así que solo
 * se puede cerrarlas todas menos esta; no se simula una lista.
 */

function PasswordCard({ email }: { email: string | null }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = passwordConfirmationState(next, confirm) === "mismatch";
  const canSubmit =
    Boolean(email) &&
    current.length > 0 &&
    isPasswordValid(next) &&
    passwordConfirmationState(next, confirm) === "match" &&
    !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      // Pedir la actual evita que una sesión abierta y desatendida baste para
      // quedarse con la cuenta.
      const check = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (check.error) {
        setError("La contraseña actual no es correcta.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateError) {
        setError(getPasswordErrorMessage(updateError, next));
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Contraseña cambiada");
    } catch {
      setError("No se pudo cambiar la contraseña por un error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Contraseña">
      <form className="grid max-w-md gap-4" onSubmit={submit}>
        <Field label="Actual">
          <PasswordInput
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="Nueva">
          <PasswordInput
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <PasswordRequirements password={next} />
        <Field label="Repite la nueva">
          <PasswordInput
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            required
          />
        </Field>
        {mismatch ? (
          <p className="text-xs text-danger" role="alert">
            Las contraseñas no coinciden.
          </p>
        ) : null}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div>
          <Button type="submit" disabled={!canSubmit}>
            {busy ? "Cambiando..." : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type Enrollment = { factorId: string; qr: string; secret: string };

function TwoFactorCard({ isConsultant }: { isConsultant: boolean }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (!listError) setVerifiedFactorId(data.totp[0]?.id ?? null);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    // Carga inicial desde Supabase Auth; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "No se pudo iniciar la activación.");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("El código no es correcto. Prueba con el que muestra ahora tu app.");
      return;
    }
    setEnrollment(null);
    setCode("");
    toast.success("Verificación en dos pasos activada");
    await load();
  }

  async function cancel() {
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  async function disable() {
    if (!verifiedFactorId) return;
    setBusy(true);
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId,
    });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    toast.success("Verificación en dos pasos desactivada");
    await load();
  }

  return (
    <Card
      title="Verificación en dos pasos"
      actions={
        loaded ? (
          <Badge tone={verifiedFactorId ? "success" : "warn"}>
            {verifiedFactorId ? "Activada" : "Desactivada"}
          </Badge>
        ) : null
      }
    >
      {enrollment ? (
        <form className="grid max-w-md gap-4" onSubmit={verify}>
          <p className="text-sm">
            Escanea el código con tu app de autenticación y escribe el número de
            6 cifras que te muestre.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qr}
            alt="Código QR para la app de autenticación"
            className="size-40 rounded-lg border border-edge bg-white p-2"
          />
          <p className="text-xs text-muted">
            ¿No puedes escanearlo? Introduce esta clave a mano:{" "}
            <span className="select-all font-mono">{enrollment.secret}</span>
          </p>
          <Field label="Código de 6 cifras">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="max-w-40 font-mono"
              required
            />
          </Field>
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || code.trim().length !== 6}>
              {busy ? "Comprobando..." : "Activar"}
            </Button>
            <Button variant="ghost" onClick={() => void cancel()} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm">
            Pide un código de tu app de autenticación al entrar. Aunque alguien
            tenga tu contraseña, no podrá acceder sin él.
          </p>
          {/* El consultor entra en todas las tiendas de su cartera: su cuenta
              es la más valiosa de robar. */}
          {isConsultant && loaded && !verifiedFactorId ? (
            <Banner tone="warn">
              Con tu cuenta se entra en las tiendas de todos tus clientes. Actívala
              antes de seguir.
            </Banner>
          ) : null}
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          <div>
            {verifiedFactorId ? (
              <Button variant="secondary" onClick={() => void disable()} disabled={busy}>
                Desactivar
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => void start()}
                disabled={busy || !loaded}
              >
                Activar
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function SessionsCard() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [busy, setBusy] = useState(false);

  async function closeOthers() {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (error) {
      toast.danger("No se pudieron cerrar las otras sesiones.");
      return;
    }
    toast.success("Sesiones cerradas", {
      description: "Solo queda abierta la de este dispositivo.",
    });
  }

  return (
    <Card title="Sesiones abiertas">
      <p className="text-sm">
        Cierra tu cuenta en el resto de dispositivos si has entrado desde un
        ordenador ajeno o sospechas de un acceso que no reconoces.
      </p>
      <div className="mt-4">
        <Button variant="secondary" onClick={() => void closeOthers()} disabled={busy}>
          {busy ? "Cerrando..." : "Cerrar las demás sesiones"}
        </Button>
      </div>
    </Card>
  );
}

export function SecuritySection({ bootstrap }: { bootstrap: BootstrapResponse }) {
  return (
    <div className="space-y-4">
      <PasswordCard email={bootstrap.user.email ?? null} />
      <TwoFactorCard
        isConsultant={["consultant", "platform_admin"].includes(bootstrap.profile.platform_role)}
      />
      <SessionsCard />
    </div>
  );
}
