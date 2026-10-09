"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useMarketingPortal } from "../marketing-portal-context";
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Textarea,
} from "@/components/ui";
import {
  BRAND_PROFILE_FIELDS,
  emptyBrandProfile,
  FIELD_LABEL,
  hasValue,
  mergeBrandProfile,
  missingFields,
  profileFromApi,
  quotedPhrases,
  toApiPayload,
  validateBrandProfile,
  type BrandProfile,
  type BrandProfileField,
  type FieldErrors,
} from "./guia-brand-profile";
import { FontListEditor, PaletteEditor, TextListEditor, VocabularyChips } from "./guia-fields";
import { GuiaLivePanel } from "./guia-live-panel";
import styles from "./guia.module.css";

type Scope = "org" | "store";

type SectionDef = { id: string; title: string; description: string; fields: BrandProfileField[] };
const SECTIONS: SectionDef[] = [
  { id: "identidad", title: "Identidad", description: "Cómo se presenta la marca en la cabecera de cada email.", fields: ["brand_name", "logo_url"] },
  { id: "colores", title: "Colores", description: "Cada color tiene un papel. A11 los aplica por papel, no por orden.", fields: ["palette"] },
  { id: "tipografia", title: "Tipografía", description: "En orden de preferencia. Si un cliente de correo no tiene la primera, usa la siguiente.", fields: ["available_fonts"] },
  { id: "voz", title: "Voz y tono", description: "Cómo habla la marca cuando escribe un email.", fields: ["tone_guidelines"] },
  { id: "palabras", title: "Palabras", description: "Escribe y pulsa Enter. Pega una lista y se separa sola.", fields: ["preferred_vocabulary", "avoided_vocabulary"] },
  { id: "limites", title: "Límites", description: "Lo que A11 nunca puede afirmar y lo que siempre tiene que aparecer.", fields: ["claim_restrictions", "required_texts"] },
  { id: "imagen", title: "Imagen", description: "Qué fotos encajan con la marca.", fields: ["image_guidelines"] },
  { id: "legal", title: "Pie legal", description: "Va al final de cada email, tal cual.", fields: ["legal_footer"] },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
}

async function fetchBrandProfile(
  organizationId: string,
  storeConnectionId: string | null,
): Promise<{ profile: BrandProfile; updatedAt: string | null }> {
  const query = storeConnectionId ? `?store_connection_id=${encodeURIComponent(storeConnectionId)}` : "";
  const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/brand-profile${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readApiError(response));
  const body = (await response.json()) as { profile?: unknown; updated_at?: string | null };
  return { profile: profileFromApi(body.profile ?? null), updatedAt: body.updated_at ?? null };
}

async function putBrandProfile(organizationId: string, storeConnectionId: string | null, profile: BrandProfile) {
  const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/brand-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_connection_id: storeConnectionId, ...toApiPayload(profile, { isStoreScope: storeConnectionId !== null }) }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

export default function MarketingBrandGuidePage() {
  const { bootstrap } = useMarketingPortal();
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const membership = bootstrap.memberships.find((item) => item.organization_id === organizationId);
  const canEdit =
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ||
    ["owner", "manager"].includes(membership?.role ?? "");

  const [scope, setScope] = useState<Scope>("org");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [orgSaved, setOrgSaved] = useState<BrandProfile>(emptyBrandProfile());
  const [orgDraft, setOrgDraft] = useState<BrandProfile>(emptyBrandProfile());
  const [orgUpdatedAt, setOrgUpdatedAt] = useState<string | null>(null);

  const [storeSaved, setStoreSaved] = useState<BrandProfile>(emptyBrandProfile());
  const [storeDraft, setStoreDraft] = useState<BrandProfile>(emptyBrandProfile());
  const [storeUpdatedAt, setStoreUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const org = await fetchBrandProfile(organizationId, null);
      setOrgSaved(org.profile);
      setOrgDraft(org.profile);
      setOrgUpdatedAt(org.updatedAt);
      if (connectionId) {
        const store = await fetchBrandProfile(organizationId, connectionId);
        setStoreSaved(store.profile);
        setStoreDraft(store.profile);
        setStoreUpdatedAt(store.updatedAt);
      } else {
        setStoreSaved(emptyBrandProfile());
        setStoreDraft(emptyBrandProfile());
        setStoreUpdatedAt(null);
        setScope("org");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la guía de marca.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, connectionId]);

  useEffect(() => { void load(); }, [load]);

  const isStoreScope = scope === "store";
  const draft = isStoreScope ? storeDraft : orgDraft;
  const setDraft = isStoreScope ? setStoreDraft : setOrgDraft;
  const orgDirty = useMemo(() => JSON.stringify(orgDraft) !== JSON.stringify(orgSaved), [orgDraft, orgSaved]);
  const storeDirty = useMemo(
    () => Boolean(connectionId) && JSON.stringify(storeDraft) !== JSON.stringify(storeSaved),
    [storeDraft, storeSaved, connectionId],
  );
  const dirty = isStoreScope ? storeDirty : orgDirty;
  const anyDirty = orgDirty || storeDirty;

  const merged = useMemo(() => mergeBrandProfile(orgDraft, isStoreScope ? storeDraft : null), [orgDraft, storeDraft, isStoreScope]);
  const missing = useMemo(() => missingFields(orgDraft, isStoreScope ? storeDraft : null), [orgDraft, storeDraft, isStoreScope]);
  const errors: FieldErrors = useMemo(() => validateBrandProfile(draft), [draft]);
  const storeOwnFieldCount = useMemo(
    () => BRAND_PROFILE_FIELDS.filter((field) => storeDraft[field] !== null).length,
    [storeDraft],
  );

  function setField(field: BrandProfileField, value: BrandProfile[BrandProfileField]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function inheritField(field: BrandProfileField) {
    setStoreDraft((current) => ({ ...current, [field]: null }));
    setNotice(`${FIELD_LABEL[field]} vuelve a tomarse de la marca general.`);
  }
  function ownField(field: BrandProfileField, fallback: BrandProfile[BrandProfileField]) {
    setStoreDraft((current) => ({ ...current, [field]: fallback }));
  }

  async function save() {
    if (!organizationId || !anyDirty) return;
    const orgErrors = validateBrandProfile(orgDraft);
    const storeErrors = storeDirty ? validateBrandProfile(storeDraft) : {};
    if (Object.keys(orgErrors).length > 0) {
      setScope("org");
      setError(`No se ha guardado: revisa ${FIELD_LABEL[Object.keys(orgErrors)[0] as BrandProfileField].toLowerCase()}.`);
      return;
    }
    if (Object.keys(storeErrors).length > 0) {
      setScope("store");
      setError(`No se ha guardado: revisa ${FIELD_LABEL[Object.keys(storeErrors)[0] as BrandProfileField].toLowerCase()}.`);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (orgDirty) {
        await putBrandProfile(organizationId, null, orgDraft);
        setOrgSaved(orgDraft);
        setOrgUpdatedAt(new Date().toISOString());
      }
      if (storeDirty && connectionId) {
        await putBrandProfile(organizationId, connectionId, storeDraft);
        setStoreSaved(storeDraft);
        setStoreUpdatedAt(new Date().toISOString());
      }
      setNotice("Guía guardada. A11 la usa desde el próximo email que genere.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la guía de marca.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!anyDirty) return;
    setOrgDraft(orgSaved);
    setStoreDraft(storeSaved);
    setNotice(null);
    setError(null);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgDraft, storeDraft, orgDirty, storeDirty, anyDirty, organizationId, connectionId]);

  if (!organizationId) {
    return <main className="portal-page"><EmptyState title="Selecciona una tienda" hint="La guía de marca se guarda por organización y puede tener ajustes específicos por tienda." /></main>;
  }
  if (!canEdit) {
    return <main className="portal-page"><EmptyState title="Sin acceso a la guía de marca" hint="Necesitas ser propietario, manager, consultor asignado o administrador de plataforma." /></main>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className="min-w-0">
          <p className={styles.crumb}>Marketing / Identidad</p>
          <p className={styles.title}>Guía de marca</p>
        </div>
        <div className={styles.scopeGroup} role="group" aria-label="Qué guía editas">
          <button type="button" className={styles.scopeBtn} aria-pressed={scope === "org"} onClick={() => setScope("org")}>
            Marca general
          </button>
          <button
            type="button"
            className={styles.scopeBtn}
            aria-pressed={scope === "store"}
            disabled={!connectionId}
            onClick={() => setScope("store")}
            title={connectionId ? undefined : "Selecciona una tienda en el selector superior"}
          >
            Tienda activa
            <small>{connectionId ? `${storeOwnFieldCount} ajustes propios` : "sin tienda"}</small>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={styles.state}>
            {dirty ? "Cambios sin guardar" : orgUpdatedAt || storeUpdatedAt ? `Guardado ${timeAgo(isStoreScope ? storeUpdatedAt : orgUpdatedAt)}` : ""}
          </span>
          <ConfirmDialog
            trigger={
              <Button variant="secondary" size="sm" disabled={!anyDirty || saving}>
                Descartar
              </Button>
            }
            title="Descartar los cambios"
            description="Se pierden las ediciones sin guardar de la guía de marca."
            confirmLabel="Descartar"
            cancelLabel="Seguir editando"
            onConfirm={discard}
          />
          <Button size="sm" disabled={!anyDirty || saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar"}</Button>
        </div>
      </header>

      <div className={styles.banners}>
        {scope === "store" && !connectionId ? <Banner tone="warn">Selecciona una conexión de Shopify desde el selector superior para editar una guía específica de tienda.</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}
      </div>

      {loading ? (
        <div className="p-6"><LoadingBlock label="Cargando guía de marca…" /></div>
      ) : (
        <main className={styles.work}>
          <nav className={styles.nav} aria-label="Secciones de la guía">
            <div>
              <p className="text-sm font-medium">Lo que A11 sabe</p>
              <p className="mt-1 text-xs text-muted">
                {BRAND_PROFILE_FIELDS.length - missing.length}/{BRAND_PROFILE_FIELDS.length} campos
                {missing.length > 0 ? ". Donde falte algo, A11 escribe en tono neutro y lo avisa." : ": la guía está completa."}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-edge/50">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${Math.round(((BRAND_PROFILE_FIELDS.length - missing.length) / BRAND_PROFILE_FIELDS.length) * 100)}%` }}
                />
              </div>
            </div>
            <ul className={styles.toc}>
              {SECTIONS.map((section) => {
                const sectionStatus = sectionDotStatus(section, merged, errors);
                return (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className={styles.tocLink}>
                      <i className={styles.dot} data-s={sectionStatus} />
                      {section.title}
                    </a>
                  </li>
                );
              })}
            </ul>
            {isStoreScope ? (
              <div className="flex flex-col gap-2 px-1 text-xs text-muted">
                <span className="flex items-center gap-2"><i className={styles.dot} data-s="inherit" /> Heredado de la marca general</span>
                <span className="flex items-center gap-2"><i className={styles.dot} data-s="ok" /> Ajustado para esta tienda</span>
              </div>
            ) : null}
          </nav>

          <div className={styles.editCol}>
          <div className={styles.edit}>
            {isStoreScope ? (
              <Banner tone="success">Editas la tienda activa. Lo que no personalices se toma de la marca general; si cambias la marca general, esta tienda lo hereda.</Banner>
            ) : null}
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className={styles.sec}>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                  <p className="mt-1 text-[13px] text-muted">{section.description}</p>
                </div>
                {section.fields.map((field) => (
                  <FieldBlock
                    key={field}
                    field={field}
                    showLabel={section.fields.length > 1}
                    scope={scope}
                    orgValue={orgDraft[field]}
                    storeValue={storeDraft[field]}
                    error={errors[field]}
                    dirty={isStoreScope ? JSON.stringify(storeDraft[field]) !== JSON.stringify(storeSaved[field]) : JSON.stringify(orgDraft[field]) !== JSON.stringify(orgSaved[field])}
                    onChange={(value) => setField(field, value)}
                    onInherit={() => inheritField(field)}
                    onOwn={(fallback) => ownField(field, fallback)}
                    otherVocabulary={field === "preferred_vocabulary" ? merged.avoided_vocabulary.value as string[] | null : field === "avoided_vocabulary" ? merged.preferred_vocabulary.value as string[] | null : null}
                    onMoveVocabulary={
                      field === "preferred_vocabulary" || field === "avoided_vocabulary"
                        ? (word: string) => {
                            const other = field === "preferred_vocabulary" ? "avoided_vocabulary" : "preferred_vocabulary";
                            const current = (isStoreScope ? storeDraft[other] : orgDraft[other]) as string[] | null;
                            const base = current ?? ((merged[other].value as string[] | null) ?? []);
                            setDraft((prev) => ({ ...prev, [other]: [...base.filter((w) => w.toLowerCase() !== word.toLowerCase()), word] }));
                          }
                        : null
                    }
                  />
                ))}
              </section>
            ))}
          </div>
          </div>

          <aside className={styles.live} aria-label="Vista viva">
            <GuiaLivePanel merged={merged} isStoreScope={isStoreScope} />
          </aside>
        </main>
      )}
    </div>
  );
}

function sectionDotStatus(section: SectionDef, merged: ReturnType<typeof mergeBrandProfile>, errors: FieldErrors): "ok" | "inherit" | "empty" | "err" {
  if (section.fields.some((field) => errors[field])) return "err";
  const entries = section.fields.map((field) => merged[field]);
  if (!entries.some((entry) => hasValue(entry.value))) return "empty";
  if (entries.every((entry) => entry.inherited)) return "inherit";
  return "ok";
}

function FieldBlock({
  field,
  showLabel,
  scope,
  orgValue,
  storeValue,
  error,
  dirty,
  onChange,
  onInherit,
  onOwn,
  otherVocabulary,
  onMoveVocabulary,
}: {
  field: BrandProfileField;
  showLabel: boolean;
  scope: Scope;
  orgValue: BrandProfile[BrandProfileField];
  storeValue: BrandProfile[BrandProfileField];
  error?: string;
  dirty: boolean;
  onChange: (value: BrandProfile[BrandProfileField]) => void;
  onInherit: () => void;
  onOwn: (fallback: BrandProfile[BrandProfileField]) => void;
  otherVocabulary: string[] | null;
  onMoveVocabulary: ((word: string) => void) | null;
}) {
  const isStoreScope = scope === "store";
  const inherited = isStoreScope && storeValue === null;
  const value = inherited ? orgValue : isStoreScope ? storeValue : orgValue;

  return (
    <div id={`sec-${field}`} className={`rounded-md border bg-white p-4 ${error ? "border-danger" : "border-edge"} ${inherited ? "border-dashed" : ""}`}>
      {showLabel || isStoreScope || dirty ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {showLabel ? <span className="text-sm font-medium">{FIELD_LABEL[field]}</span> : null}
          {isStoreScope ? (
            inherited ? (
              <span className="rounded-full bg-accent-soft px-2 py-1 text-xs text-accent-soft-foreground">Heredado de la marca general</span>
            ) : (
              <span className="rounded-full bg-success/10 px-2 py-1 text-xs text-success">Propio de esta tienda</span>
            )
          ) : null}
          {dirty ? <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">Sin guardar</span> : null}
          <span className="flex-1" />
          {isStoreScope ? (
            inherited ? (
              <Button variant="secondary" size="sm" onClick={() => onOwn(emptyOverride(field, orgValue))}>Personalizar aquí</Button>
            ) : (
              <button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-foreground" onClick={onInherit}>
                Volver a heredar
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {inherited ? (
        <ReadonlyValue field={field} value={orgValue} />
      ) : (
        <FieldEditor
          field={field}
          value={value}
          onChange={onChange}
          otherVocabulary={otherVocabulary}
          onMoveVocabulary={onMoveVocabulary}
        />
      )}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/** Valor de partida al personalizar un campo heredado: mismo tipo vacío que espera el editor. */
function emptyOverride(field: BrandProfileField, orgValue: BrandProfile[BrandProfileField]): BrandProfile[BrandProfileField] {
  if (field === "palette") return { ...((orgValue as Record<string, string> | null) ?? {}) };
  if (Array.isArray(orgValue) || ["available_fonts", "preferred_vocabulary", "avoided_vocabulary", "required_texts", "claim_restrictions"].includes(field)) {
    return [...((orgValue as string[] | null) ?? [])];
  }
  return orgValue ?? "";
}

function ReadonlyValue({ field, value }: { field: BrandProfileField; value: BrandProfile[BrandProfileField] }) {
  if (!hasValue(value)) return <p className="text-sm italic text-muted">La marca general tampoco lo tiene.</p>;
  if (field === "palette") {
    const palette = value as Record<string, string>;
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(palette).map(([role, hex]) => (
          <span key={role} className="inline-flex items-center gap-2 text-xs text-muted">
            <i className="size-4 rounded border border-edge" style={{ background: hex }} />
            {role} <code>{hex}</code>
          </span>
        ))}
      </div>
    );
  }
  if (field === "available_fonts") {
    return <p className="text-sm">{(value as string[]).join(" → ")}</p>;
  }
  if (field === "preferred_vocabulary" || field === "avoided_vocabulary") {
    const tone = field === "preferred_vocabulary" ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
    return (
      <div className="flex flex-wrap gap-2">
        {(value as string[]).map((word) => (
          <span key={word} className={`rounded-full px-3 py-1 text-xs ${tone}`}>{word}</span>
        ))}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {value.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  return <p className="whitespace-pre-wrap text-sm">{String(value)}</p>;
}

function FieldEditor({
  field,
  value,
  onChange,
  otherVocabulary,
  onMoveVocabulary,
}: {
  field: BrandProfileField;
  value: BrandProfile[BrandProfileField];
  onChange: (value: BrandProfile[BrandProfileField]) => void;
  otherVocabulary: string[] | null;
  onMoveVocabulary: ((word: string) => void) | null;
}) {
  switch (field) {
    case "brand_name":
      return (
        <Field label="Nombre que firma los emails">
          <Input value={(value as string) ?? ""} maxLength={120} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "logo_url":
      return (
        <Field label="URL del logo">
          <Input type="url" value={(value as string) ?? ""} maxLength={1000} placeholder="https://cdn.shopify.com/…/logo.png" onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "palette":
      return <PaletteEditor value={(value as Record<string, string>) ?? {}} onChange={onChange} />;
    case "available_fonts":
      return <FontListEditor value={(value as string[]) ?? []} onChange={onChange} />;
    case "tone_guidelines":
      return <Textarea rows={4} placeholder="Cómo suena la marca: con quién habla, cuánto de formal, qué ritmo." value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "preferred_vocabulary":
      return (
        <VocabularyChips
          tone="preferred"
          value={(value as string[]) ?? []}
          onChange={onChange}
          otherValue={otherVocabulary}
          otherLabel={FIELD_LABEL.avoided_vocabulary}
          onMoveToOther={onMoveVocabulary}
          placeholder="sobremesa, hecho a mano…"
        />
      );
    case "avoided_vocabulary":
      return (
        <VocabularyChips
          tone="avoided"
          value={(value as string[]) ?? []}
          onChange={onChange}
          otherValue={otherVocabulary}
          otherLabel={FIELD_LABEL.preferred_vocabulary}
          onMoveToOther={onMoveVocabulary}
          placeholder="chollo, ¡corre!…"
        />
      );
    case "required_texts":
      return (
        <TextListEditor
          value={(value as string[]) ?? []}
          onChange={onChange}
          placeholder="Ej.: Envío gratis desde 50 € en península."
          maxLength={2000}
          addLabel="Añadir texto obligatorio"
        />
      );
    case "claim_restrictions":
      return (
        <TextListEditor
          value={(value as string[]) ?? []}
          onChange={onChange}
          placeholder='Ej.: No decir «100 % orgánico»: no tenemos el certificado.'
          maxLength={500}
          highlight={quotedPhrases}
          addLabel="Añadir límite"
        />
      );
    case "image_guidelines":
      return <Textarea rows={4} placeholder="Luz, escenarios, personas, encuadres. Qué sí y qué no." value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "legal_footer":
      return <Textarea rows={3} placeholder="Razón social · dirección · por qué recibe este email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    default:
      return null;
  }
}
