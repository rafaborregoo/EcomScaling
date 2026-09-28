"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useMarketingPortal } from "../marketing-portal-context";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Heading,
  Input,
  LoadingBlock,
  Textarea,
} from "@/components/ui";

type BrandProfile = {
  brand_name: string;
  logo_url: string;
  palette: string;
  available_fonts: string;
  tone_guidelines: string;
  preferred_vocabulary: string;
  avoided_vocabulary: string;
  required_texts: string;
  claim_restrictions: string;
  image_guidelines: string;
  legal_footer: string;
};

const emptyProfile: BrandProfile = {
  brand_name: "",
  logo_url: "",
  palette: "",
  available_fonts: "",
  tone_guidelines: "",
  preferred_vocabulary: "",
  avoided_vocabulary: "",
  required_texts: "",
  claim_restrictions: "",
  image_guidelines: "",
  legal_footer: "",
};

const textFields = [
  ["brand_name", "Nombre de marca", "Nombre público que debe aparecer en los emails."],
  ["logo_url", "URL del logo", "URL HTTPS del logo usado en las composiciones."],
  ["tone_guidelines", "Voz y tono", "Cómo debe sonar la marca: personalidad, formalidad y ritmo."],
  ["preferred_vocabulary", "Palabras y expresiones preferidas", "Una por línea."],
  ["avoided_vocabulary", "Palabras y expresiones a evitar", "Una por línea."],
  ["required_texts", "Textos obligatorios", "Firma, disclaimers u otros textos que deben conservarse; uno por línea."],
  ["claim_restrictions", "Restricciones de afirmaciones", "Promesas, comparativas o claims que no se pueden hacer; uno por línea."],
  ["image_guidelines", "Dirección de imagen", "Estilo, sujetos, recortes y usos de imagen preferidos."],
  ["legal_footer", "Pie legal", "Texto legal común que deba incorporarse al email."],
] as const;

function lines(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function profileFromApi(value: unknown): BrandProfile {
  if (!value || typeof value !== "object") return emptyProfile;
  const row = value as Record<string, unknown>;
  return {
    brand_name: typeof row.brand_name === "string" ? row.brand_name : "",
    logo_url: typeof row.logo_url === "string" ? row.logo_url : "",
    palette: row.palette && typeof row.palette === "object" ? JSON.stringify(row.palette, null, 2) : "",
    available_fonts: lines(row.available_fonts),
    tone_guidelines: typeof row.tone_guidelines === "string" ? row.tone_guidelines : "",
    preferred_vocabulary: lines(row.preferred_vocabulary),
    avoided_vocabulary: lines(row.avoided_vocabulary),
    required_texts: lines(row.required_texts),
    claim_restrictions: lines(row.claim_restrictions),
    image_guidelines: typeof row.image_guidelines === "string" ? row.image_guidelines : "",
    legal_footer: typeof row.legal_footer === "string" ? row.legal_footer : "",
  };
}

export default function MarketingBrandGuidePage() {
  const { bootstrap } = useMarketingPortal();
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const membership = bootstrap.memberships.find((item) => item.organization_id === organizationId);
  const canEdit =
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ||
    ["owner", "manager"].includes(membership?.role ?? "");
  const [scope, setScope] = useState<"organization" | "store">("organization");
  const [profile, setProfile] = useState<BrandProfile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || (scope === "store" && !connectionId)) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const storeQuery = scope === "store" ? `?store_connection_id=${encodeURIComponent(connectionId)}` : "";
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/brand-profile${storeQuery}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      const body = await response.json() as { profile?: unknown };
      setProfile(profileFromApi(body.profile));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la guía de marca.");
    } finally {
      setLoading(false);
    }
  }, [connectionId, organizationId, scope]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || (scope === "store" && !connectionId)) return;
    let palette: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(profile.palette || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      palette = parsed as Record<string, string>;
    } catch {
      setError("La paleta debe ser un objeto JSON con colores HEX, por ejemplo {\"primary\":\"#173D35\"}.");
      return;
    }
    const list = (text: string) => text.split("\n").map((part) => part.trim()).filter(Boolean);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/brand-profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_connection_id: scope === "store" ? connectionId : null,
            brand_name: profile.brand_name.trim() || null,
            logo_url: profile.logo_url.trim() || null,
            palette: profile.palette.trim() ? palette : null,
            available_fonts: profile.available_fonts.trim() ? list(profile.available_fonts) : null,
            tone_guidelines: profile.tone_guidelines.trim() || null,
            preferred_vocabulary: profile.preferred_vocabulary.trim() ? list(profile.preferred_vocabulary) : null,
            avoided_vocabulary: profile.avoided_vocabulary.trim() ? list(profile.avoided_vocabulary) : null,
            required_texts: profile.required_texts.trim() ? list(profile.required_texts) : null,
            claim_restrictions: profile.claim_restrictions.trim() ? list(profile.claim_restrictions) : null,
            image_guidelines: profile.image_guidelines.trim() || null,
            legal_footer: profile.legal_footer.trim() || null,
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la guía de marca.");
    } finally {
      setSaving(false);
    }
  }

  if (!organizationId) return <main className="portal-page"><EmptyState title="Selecciona una tienda" hint="La guía de marca se guarda por organización y puede tener ajustes específicos por tienda." /></main>;
  if (!canEdit) return <main className="portal-page"><EmptyState title="Sin acceso a la guía de marca" hint="Necesitas ser propietario, manager, consultor asignado o administrador de plataforma." /></main>;

  return (
    <main className="portal-page marketing-workspace space-y-6">
      <header className="mkt-page-header">
        <div className="min-w-0">
          <p className="mkt-eyebrow">MARKETING / IDENTIDAD</p>
          <Heading size="lg" className="mkt-page-title">Guía de marca</Heading>
          <p className="mkt-page-description">Define una vez cómo debe verse y sonar el email. A11 combina esta guía con el brief y la tienda activa.</p>
        </div>
        <div className="flex gap-2" aria-label="Ámbito de la guía">
          <Button variant={scope === "organization" ? "primary" : "secondary"} aria-pressed={scope === "organization"} onClick={() => setScope("organization")}>Marca general</Button>
          <Button variant={scope === "store" ? "primary" : "secondary"} aria-pressed={scope === "store"} disabled={!connectionId} onClick={() => setScope("store")}>Tienda activa</Button>
        </div>
      </header>

      {scope === "store" && !connectionId ? <Banner tone="warn">Selecciona una conexión de Shopify desde el selector superior para editar una guía específica de tienda.</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {saved ? <Banner tone="success">Guía guardada. A11 la consultará en la próxima generación de emails.</Banner> : null}
      {loading ? <LoadingBlock label="Cargando guía de marca…" /> : (
        <form onSubmit={save} className="space-y-5">
          <Card title="Identidad" description="La marca general actúa como base; los campos de la tienda activa la sustituyen cuando tienen un valor propio.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre de marca"><Input value={profile.brand_name} onChange={(event) => setProfile({ ...profile, brand_name: event.target.value })} maxLength={120} /></Field>
              <Field label="URL del logo"><Input type="url" value={profile.logo_url} onChange={(event) => setProfile({ ...profile, logo_url: event.target.value })} maxLength={1000} placeholder="https://…" /></Field>
              <Field label={<>Paleta (JSON de rol → HEX)<span className="mt-1 block text-xs font-normal text-muted">Deja vacío para heredar; ej. {"{\"primary\":\"#173D35\"}"}</span></>}><Textarea rows={4} value={profile.palette} onChange={(event) => setProfile({ ...profile, palette: event.target.value })} spellCheck={false} /></Field>
              <Field label="Fuentes permitidas (una por línea)"><Textarea rows={4} value={profile.available_fonts} onChange={(event) => setProfile({ ...profile, available_fonts: event.target.value })} /></Field>
            </div>
          </Card>

          <Card title="Voz, contenido y límites" description="Estos datos orientan al agente; no sustituyen la revisión del email ni autorizan claims sin evidencia.">
            <div className="grid gap-4 md:grid-cols-2">
              {textFields.slice(2).map(([key, label, hint]) => (
                <Field key={key} label={<>{label}<span className="mt-1 block text-xs font-normal text-muted">{hint}</span></>}>
                  <Textarea rows={key === "tone_guidelines" || key === "image_guidelines" || key === "legal_footer" ? 4 : 3} value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} />
                </Field>
              ))}
            </div>
          </Card>

          <div className="flex justify-end"><Button type="submit" disabled={saving || loading}>{saving ? "Guardando…" : "Guardar guía"}</Button></div>
        </form>
      )}
    </main>
  );
}
