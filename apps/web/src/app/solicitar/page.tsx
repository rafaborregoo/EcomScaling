"use client";

import { type FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { apiUrl } from "@/lib/bootstrap";
import {
  PLATAFORMAS,
  PREGUNTAS_CLIENTE,
  PREGUNTAS_CONSULTOR,
  type Pregunta,
} from "@/lib/solicitud-preguntas";
import {
  Banner,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ErrorBlock,
  Field,
  Heading,
  Input,
  LoadingBlock,
  RadioCard,
  RadioGroup,
  Select,
  Textarea,
} from "@/components/ui";

/**
 * Pedir acceso. El registro libre está cerrado: esto no crea cuenta, deja una
 * solicitud que la dirección revisa en /admin/solicitudes. Las cuentas se
 * abren desde E-NORA y llega un correo para hacer el onboarding.
 */

type Kind = "client" | "consultant";
type Answers = Record<string, string | string[]>;
type DeclaredClient = { name: string; email: string; store_url: string };

const MAX_CLIENTS = 20;
const EMPTY_CLIENT: DeclaredClient = { name: "", email: "", store_url: "" };

function faltaRespuesta(preguntas: Pregunta[], answers: Answers) {
  return preguntas.some((pregunta) => {
    if (!pregunta.required) return false;
    const value = answers[pregunta.key];
    return Array.isArray(value) ? value.length === 0 : !value?.trim();
  });
}

function Preguntas({
  preguntas,
  answers,
  onChange,
}: {
  preguntas: Pregunta[];
  answers: Answers;
  onChange: (key: string, value: string | string[]) => void;
}) {
  return (
    <>
      {preguntas.map((pregunta) => {
        const label = pregunta.required ? pregunta.label : `${pregunta.label} (opcional)`;
        if (pregunta.type === "select") {
          return (
            <Field key={pregunta.key} label={label}>
              <Select
                value={(answers[pregunta.key] as string | undefined) ?? ""}
                onChange={(value) => onChange(pregunta.key, value)}
                options={pregunta.options ?? []}
                placeholder="Elige una opción"
              />
            </Field>
          );
        }
        if (pregunta.type === "multi") {
          const selected = (answers[pregunta.key] as string[] | undefined) ?? [];
          return (
            <Field key={pregunta.key} label={label}>
              <div className="grid gap-2 sm:grid-cols-2">
                {(pregunta.options ?? []).map((option) => (
                  <Checkbox
                    key={option.value}
                    checked={selected.includes(option.value)}
                    onCheckedChange={(checked) =>
                      onChange(
                        pregunta.key,
                        checked ? [...selected, option.value] : selected.filter((item) => item !== option.value),
                      )
                    }
                  >
                    {option.label}
                  </Checkbox>
                ))}
              </div>
            </Field>
          );
        }
        return (
          <Field key={pregunta.key} label={label}>
            <Textarea
              rows={3}
              maxLength={1000}
              value={(answers[pregunta.key] as string | undefined) ?? ""}
              onChange={(event) => onChange(pregunta.key, event.target.value)}
            />
          </Field>
        );
      })}
    </>
  );
}

function SolicitarContent() {
  const params = useSearchParams();
  const [kind, setKind] = useState<Kind>(params.get("rol") === "consultor" ? "consultant" : "client");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [platform, setPlatform] = useState("shopify");
  const [answers, setAnswers] = useState<Answers>({});
  const [clients, setClients] = useState<DeclaredClient[]>([{ ...EMPTY_CLIENT }]);
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const preguntas = kind === "client" ? PREGUNTAS_CLIENTE : PREGUNTAS_CONSULTOR;
  const declared = clients.filter((client) => client.name.trim() || client.email.trim() || client.store_url.trim());
  const needsStore = kind === "client" && platform !== "sin_tienda";
  const canSubmit =
    !busy &&
    privacy &&
    fullName.trim() !== "" &&
    email.trim() !== "" &&
    businessName.trim() !== "" &&
    (!needsStore || storeUrl.trim() !== "") &&
    !faltaRespuesta(preguntas, answers) &&
    declared.every((client) => client.name.trim() && client.email.trim() && client.store_url.trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/v1/solicitudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          full_name: fullName,
          email,
          business_name: businessName,
          store_url: storeUrl || null,
          platform: kind === "client" ? platform : null,
          answers,
          clients: kind === "consultant" ? declared : [],
          privacy_accepted: privacy,
          website,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo enviar la solicitud. Inténtalo de nuevo en un momento.");
        return;
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Error de red. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Solicitud recibida</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Banner tone="success">
              Gracias, {fullName.trim().split(" ")[0]}. La revisamos a mano y te escribimos a {email.trim()} cuando tu
              cuenta esté lista para hacer el onboarding.
            </Banner>
            <p className="text-sm text-muted">
              Si ya enviaste una antes con este correo, nos quedamos con aquella: no hace falta repetirla.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-12">
      <div className="grid gap-3">
        <Heading level={1}>Pide acceso a E-NORA</Heading>
        <p className="text-base text-muted">
          Las plazas son limitadas, pero cualquiera puede solicitar acceso. Revisamos cada solicitud y, cuando tu cuenta
          esté lista, te llega un correo para empezar.
        </p>
      </div>

      <form className="grid gap-6" onSubmit={submit}>
        <RadioGroup<Kind> value={kind} onValueChange={setKind} className="grid gap-3 sm:grid-cols-2">
          <RadioCard value="client" title="Tengo una tienda" />
          <RadioCard value="consultant" title="Soy consultor" />
        </RadioGroup>

        <Card>
          <CardHeader>
            <CardTitle>Tus datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tu nombre">
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={200} />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={320} />
              </Field>
            </div>
            <Field label={kind === "client" ? "Nombre de la tienda" : "Nombre de tu agencia o marca"}>
              <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" required maxLength={200} />
            </Field>
            {kind === "client" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plataforma de la tienda">
                  <Select value={platform} onChange={setPlatform} options={PLATAFORMAS} />
                </Field>
                {needsStore ? (
                  <Field label="Web de la tienda">
                    <Input value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} placeholder="mitienda.com" inputMode="url" required maxLength={500} />
                  </Field>
                ) : null}
              </div>
            ) : (
              <Field label="Tu web (opcional)">
                <Input value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} placeholder="miagencia.com" inputMode="url" maxLength={500} />
              </Field>
            )}
            {kind === "client" && platform !== "shopify" ? (
              <Banner tone="warn">
                De momento E-NORA solo funciona con tiendas Shopify. Puedes enviarla igual: queda en lista de espera
                para cuando lleguemos a tu plataforma.
              </Banner>
            ) : null}
            {/* Campo trampa para bots: invisible y fuera del tabulador. */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{kind === "client" ? "Tu tienda" : "Tu trabajo"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Preguntas
              preguntas={preguntas}
              answers={answers}
              onChange={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
            />
          </CardContent>
        </Card>

        {kind === "consultant" ? (
          <Card>
            <CardHeader>
              <CardTitle>Tus clientes</CardTitle>
              <CardDescription>
                Las tiendas Shopify con las que trabajas. Las usamos para verificar tu cartera; no les escribimos hasta
                que tu cuenta esté aprobada.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {clients.map((client, index) => (
                <div key={index} className="grid gap-3 border-b border-separator pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <Field label="Tienda">
                    <Input
                      value={client.name}
                      maxLength={200}
                      onChange={(event) =>
                        setClients((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                      }
                    />
                  </Field>
                  <Field label="Email del cliente">
                    <Input
                      type="email"
                      value={client.email}
                      maxLength={320}
                      onChange={(event) =>
                        setClients((current) => current.map((item, i) => (i === index ? { ...item, email: event.target.value } : item)))
                      }
                    />
                  </Field>
                  <Field label="Web">
                    <Input
                      value={client.store_url}
                      placeholder="sutienda.com"
                      inputMode="url"
                      maxLength={500}
                      onChange={(event) =>
                        setClients((current) => current.map((item, i) => (i === index ? { ...item, store_url: event.target.value } : item)))
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={clients.length === 1}
                    onClick={() => setClients((current) => current.filter((_, i) => i !== index))}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={clients.length >= MAX_CLIENTS}
                  onClick={() => setClients((current) => [...current, { ...EMPTY_CLIENT }])}
                >
                  Añadir cliente
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Checkbox checked={privacy} onCheckedChange={setPrivacy}>
          He leído la{" "}
          <Link className="underline" href="/politica-privacidad" target="_blank">
            política de privacidad
          </Link>{" "}
          y acepto que E-NORA use estos datos para revisar mi solicitud.
        </Checkbox>

        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        <div>
          <Button type="submit" disabled={!canSubmit}>
            {busy ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </div>

        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link className="underline" href="/login">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SolicitarPage() {
  return (
    <PublicEntryShell active="request">
      <main id="public-content" className="flex-1">
        <Suspense fallback={<LoadingBlock label="Cargando..." />}>
          <SolicitarContent />
        </Suspense>
      </main>
    </PublicEntryShell>
  );
}
