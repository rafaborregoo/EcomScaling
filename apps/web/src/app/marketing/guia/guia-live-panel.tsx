"use client";

// Panel derecho de la guía: vista previa del email con la guía aplicada,
// probador de textos (resalta en el navegador, sin IA) y "lo que lee A11"
// (la misma fusión org → tienda que usa get_brand_profile).

import { useState } from "react";
import { Badge, Table, Tabs, Textarea } from "@/components/ui";
import {
  analyzeText,
  FIELD_LABEL,
  hasValue,
  isHex,
  readableTextColor,
  type BrandProfileField,
  type MergedField,
} from "./guia-brand-profile";

type MergedProfile = Record<BrandProfileField, MergedField<unknown>>;

const MARK_CLASS: Record<"avoid" | "claim" | "preferred", string> = {
  avoid: "rounded bg-danger/15 px-0.5 text-danger line-through",
  claim: "rounded bg-warning/15 px-0.5 text-warning",
  preferred: "rounded bg-success/15 px-0.5 text-success",
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function list(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

export function GuiaLivePanel({
  merged,
  isStoreScope,
}: {
  merged: MergedProfile;
  isStoreScope: boolean;
}) {
  const [tab, setTab] = useState("preview");
  const [tester, setTester] = useState(
    "¡Corre! Vuelve nuestro mantel más exclusivo, antibacteriano y hecho en Portugal. Lino lavado a la piedra para tus sobremesas de septiembre.",
  );

  const brandName = str(merged.brand_name.value) || "Tu marca";
  const palette = (merged.palette.value as Record<string, string> | null) ?? {};
  const fonts = list(merged.available_fonts.value);
  const preferred = list(merged.preferred_vocabulary.value);
  const avoided = list(merged.avoided_vocabulary.value);
  const claimRestrictions = list(merged.claim_restrictions.value);
  const requiredTexts = list(merged.required_texts.value).filter(Boolean);
  const legalFooter = str(merged.legal_footer.value);
  const toneGuidelines = str(merged.tone_guidelines.value);

  const primary = isHex(palette.primary) ? palette.primary : "#333333";
  const button = isHex(palette.button) ? palette.button : primary;
  const background = isHex(palette.background) ? palette.background : "#ffffff";
  const text = isHex(palette.text) ? palette.text : "#222222";
  const card = isHex(palette.card) ? palette.card : "#f2f2f2";
  const headingFont = fonts[0] ? `'${fonts[0]}', serif` : "Georgia, serif";
  const bodyFont = fonts[1] ? `'${fonts[1]}', sans-serif` : fonts[0] ? `'${fonts[0]}', sans-serif` : "Arial, sans-serif";

  const missing = Object.entries(merged).filter(([, field]) => !hasValue(field.value)).length;
  const analysis = analyzeText(tester, { preferred, avoided, claimRestrictions, requiredTexts });
  const issues = analysis.hitAvoided.length + analysis.hitClaims.length + analysis.missingRequired.length;

  return (
    <Tabs
      value={tab}
      onChange={setTab}
      items={[
        { value: "preview", label: "Vista previa" },
        { value: "test", label: issues > 0 ? `Probador (${issues})` : "Probador" },
        { value: "reads", label: missing > 0 ? `A11 lee (${missing})` : "A11 lee" },
      ]}
      panels={{
        preview: (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-xs text-muted">
              Así aplica A11 tu guía a un email de ejemplo{isStoreScope ? " para la tienda activa" : ""}. El contenido real sale del brief.
            </p>
            <div className="flex justify-center rounded-md bg-edge/20 p-3">
              <div className="w-full max-w-[360px] shadow-sm" style={{ background, color: text }}>
                <div className="px-5 py-4 text-center">
                  <span className="text-xl font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: primary }}>
                    {brandName}
                  </span>
                </div>
                <div className="px-5 py-6" style={{ background: primary, color: readableTextColor(primary) }}>
                  <h3 className="text-2xl font-bold leading-tight" style={{ fontFamily: headingFont }}>
                    El lino que aguanta el verano
                  </h3>
                  <p className="mt-2 text-sm opacity-90" style={{ fontFamily: bodyFont }}>
                    Nueva colección, {preferred[0] ?? "hecha con calma"}.
                  </p>
                </div>
                <div className="flex flex-col gap-3.5 px-5 py-5 text-sm" style={{ fontFamily: bodyFont }}>
                  <p>
                    Hola Marta, este año hemos vuelto al {preferred[0] ?? "tejido de siempre"}: llega suave desde el primer día y mejora con cada lavado.
                  </p>
                  <div className="px-3.5 py-3 text-[13px]" style={{ background: card }}>
                    {preferred[1] ? preferred[1][0].toUpperCase() + preferred[1].slice(1) : "Hecho con cuidado"} · {preferred[2] ?? "piezas para durar"}
                  </div>
                  <span
                    className="self-center px-5 py-3 text-sm font-semibold"
                    style={{ background: button, color: readableTextColor(button) }}
                  >
                    Ver la colección
                  </span>
                  {requiredTexts.map((req) => (
                    <div key={req} className="border-t pt-3 text-center text-[12.5px]" style={{ borderColor: `${text}26` }}>
                      {req}
                    </div>
                  ))}
                </div>
                <div className={`px-5 py-4 text-center text-xs leading-relaxed ${legalFooter ? "opacity-65" : ""}`} style={!legalFooter ? { color: "#b3361f" } : undefined}>
                  {legalFooter || "Falta el pie legal: A11 no se lo inventa y el email saldrá sin él."}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted">Chuleta de voz</span>
              <p className="text-sm text-foreground">
                {toneGuidelines || "Sin indicaciones de tono: A11 escribirá neutro y profesional."}
              </p>
              <div className="flex flex-wrap gap-2">
                {preferred.map((w) => (
                  <span key={w} className="rounded-full bg-success/10 px-3 py-1 text-xs text-success">{w}</span>
                ))}
                {avoided.map((w) => (
                  <span key={w} className="rounded-full bg-danger/10 px-3 py-1 text-xs text-danger">{w}</span>
                ))}
              </div>
            </div>
          </div>
        ),
        test: (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-xs text-muted">
              Pega un asunto, un párrafo o un email entero. Se comprueba con tu guía al momento, sin gastar IA.
            </p>
            <Textarea
              aria-label="Texto a comprobar"
              rows={5}
              value={tester}
              onChange={(event) => setTester(event.target.value)}
            />
            <div className="whitespace-pre-wrap rounded-md border border-edge bg-edge/10 px-3 py-3 text-sm leading-7" aria-live="polite">
              {renderHighlighted(tester, analysis.matches)}
            </div>
            <div className="flex flex-col gap-2">
              {analysis.hitAvoided.map((word) => (
                <Check key={`avoid-${word}`} tone="bad" title={`Usa «${word}»`} detail="Está en las palabras que evitamos." />
              ))}
              {analysis.hitClaims.map(({ phrase, rule }) => (
                <Check key={`claim-${phrase}`} tone="bad" title={`Afirma «${phrase}»`} detail={rule} />
              ))}
              {analysis.missingRequired.map((req) => (
                <Check key={`req-${req}`} tone="warn" title="Falta un texto obligatorio" detail={req} />
              ))}
              {issues === 0 ? (
                <Check tone="ok" title="Encaja con la guía" detail="Sin palabras vetadas ni afirmaciones prohibidas." />
              ) : null}
              <Check
                tone={analysis.hitPreferred.length ? "ok" : "warn"}
                title={`${analysis.hitPreferred.length} de ${preferred.length} palabras de la marca`}
                detail={analysis.hitPreferred.length ? analysis.hitPreferred.join(" · ") : "No suena todavía a la marca."}
              />
            </div>
          </div>
        ),
        reads: (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-xs text-muted">
              Esto es exactamente lo que recibe A11 al pedir la guía{isStoreScope ? " para esta tienda: primero lo propio de la tienda y, si no hay, lo de la marca general" : ""}.
              Lo que pongas aquí son datos, no órdenes: A11 ignora cualquier instrucción escrita dentro de la guía.
            </p>
            <Table
              ariaLabel="Lo que lee A11"
              columns={[
                { key: "field", label: "Campo", render: (row) => <span className="text-sm font-medium">{FIELD_LABEL[row.field as BrandProfileField]}</span> },
                {
                  key: "source",
                  label: "Origen",
                  render: (row) => (
                    <Badge tone={row.source === "none" ? "danger" : row.source === "inherited" ? "brand" : "success"}>
                      {row.source === "none" ? "Vacío" : row.source === "inherited" ? "Marca general" : isStoreScope ? "Esta tienda" : "Marca general"}
                    </Badge>
                  ),
                },
                { key: "value", label: "Valor", render: (row) => <span className="line-clamp-2 text-sm">{row.value}</span> },
              ]}
              rows={(Object.keys(FIELD_LABEL) as BrandProfileField[]).map((field) => {
                const entry = merged[field];
                const source = !hasValue(entry.value) ? "none" : entry.inherited ? "inherited" : "own";
                const value = !hasValue(entry.value)
                  ? "A11 no tiene este dato."
                  : Array.isArray(entry.value)
                    ? (entry.value as string[]).join(" · ")
                    : typeof entry.value === "object"
                      ? Object.entries(entry.value as Record<string, string>).map(([k, v]) => `${k} ${v}`).join(" · ")
                      : String(entry.value);
                return { id: field, field, source, value };
              })}
            />
          </div>
        ),
      }}
    />
  );
}

function renderHighlighted(text: string, matches: ReturnType<typeof analyzeText>["matches"]) {
  if (matches.length === 0) return text;
  const parts: Array<{ text: string; kind?: "avoid" | "claim" | "preferred" }> = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) });
    parts.push({ text: text.slice(match.start, match.end), kind: match.kind });
    cursor = match.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.map((part, i) =>
    part.kind ? (
      <mark key={i} className={MARK_CLASS[part.kind]}>{part.text}</mark>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

function Check({ tone, title, detail }: { tone: "ok" | "warn" | "bad"; title: string; detail: string }) {
  const toneClass =
    tone === "bad" ? "border-danger/30 bg-danger/5" : tone === "warn" ? "border-warning/30 bg-warning/5" : "border-edge";
  const dot = tone === "bad" ? "bg-danger" : tone === "warn" ? "bg-warning" : "bg-success";
  return (
    <div className={`flex gap-3 rounded-md border px-3 py-3 text-sm ${toneClass}`}>
      <span className={`mt-1 size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}
