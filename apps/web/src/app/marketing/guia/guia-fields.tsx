"use client";

// Editores de cada tipo de campo de la guía de marca: paleta de colores,
// orden de tipografías, listas de palabras (chips) y listas de texto libre
// (textos obligatorios, restricciones). Cada uno recibe el valor ya resuelto
// (tras fusionar org + tienda) y notifica con el array/objeto completo; el
// padre decide cómo convertirlo en el payload del PUT.

import { useId, useState } from "react";
import { Button, ColorField, Input } from "@/components/ui";
import { CloseIcon, IconChevronDown, IconChevronUp, PlusIcon } from "@/components/ui/icons";
import {
  contrastGrade,
  contrastRatio,
  isEmailSafeFont,
  isHex,
  PALETTE_MAX_ROLES,
  PALETTE_ROLE_LABEL,
  readableTextColor,
} from "./guia-brand-profile";

const GRADE_LABEL: Record<string, string> = { ok: "Se lee bien", warn: "Solo para títulos", bad: "No se lee" };
const GRADE_CLASS: Record<string, string> = {
  ok: "bg-success/10 text-success",
  warn: "bg-warning/10 text-warning",
  bad: "bg-danger/10 text-danger",
};

export function PaletteEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const roles = Object.keys(value);
  const freeRoles = Object.keys(PALETTE_ROLE_LABEL).filter((role) => !roles.includes(role));

  function rename(from: string, to: string) {
    if (!to || value[to]) return;
    const next: Record<string, string> = {};
    for (const [role, hex] of Object.entries(value)) next[role === from ? to : role] = hex;
    onChange(next);
  }
  function remove(role: string) {
    const next = { ...value };
    delete next[role];
    onChange(next);
  }
  function add() {
    const role = freeRoles[0] ?? `color_${roles.length + 1}`;
    onChange({ ...value, [role]: "#CCCCCC" });
  }

  const background = isHex(value.background) ? value.background : "#ffffff";
  const contrastPairs: Array<{ label: string; fg: string; bg: string }> = [];
  if (isHex(value.text)) contrastPairs.push({ label: "Texto sobre fondo", fg: value.text, bg: background });
  if (isHex(value.primary)) contrastPairs.push({ label: "Principal sobre fondo", fg: value.primary, bg: background });
  if (isHex(value.button)) {
    const fg = isHex(value.button_text) ? value.button_text : readableTextColor(value.button);
    contrastPairs.push({ label: "Botón", fg, bg: value.button });
  }
  if (isHex(value.accent)) contrastPairs.push({ label: "Acento sobre fondo", fg: value.accent, bg: background });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {roles.map((role) => (
          <div key={role} className="flex w-40 flex-col gap-2 rounded-md border border-edge p-2">
            <ColorField label={PALETTE_ROLE_LABEL[role] ?? role} value={value[role]} onChange={(hex) => onChange({ ...value, [role]: hex })} />
            <div className="flex items-center gap-1">
              <select
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-xs hover:border-edge"
                value={roles.includes(role) ? role : ""}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "__custom") {
                    const custom = window.prompt("Nombre del papel (p. ej. destacado)");
                    if (custom) rename(role, custom.trim().toLowerCase().replace(/\s+/g, "_"));
                    return;
                  }
                  rename(role, next);
                }}
              >
                <option value={role}>{PALETTE_ROLE_LABEL[role] ?? role}</option>
                {freeRoles.map((free) => (
                  <option key={free} value={free}>{PALETTE_ROLE_LABEL[free]}</option>
                ))}
                <option value="__custom">Otro nombre…</option>
              </select>
              <Button variant="ghost" size="sm" className="min-w-0 px-1.5" aria-label={`Quitar ${PALETTE_ROLE_LABEL[role] ?? role}`} onClick={() => remove(role)}>
                <CloseIcon className="size-3.5" />
              </Button>
            </div>
            <span className="text-xs tabular-nums text-muted">{value[role]}</span>
          </div>
        ))}
        {roles.length < PALETTE_MAX_ROLES ? (
          <button
            type="button"
            onClick={add}
            className="flex w-40 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-edge-strong text-sm text-muted hover:border-accent hover:text-foreground"
          >
            <PlusIcon className="size-4" />
            Añadir color
          </button>
        ) : null}
      </div>
      {contrastPairs.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">Lectura en email</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {contrastPairs.map((pair) => {
              const ratio = contrastRatio(pair.fg, pair.bg);
              const grade = contrastGrade(ratio);
              return (
                <div key={pair.label} className="flex items-center gap-2 rounded-md border border-edge p-2 text-xs">
                  <div className="grid size-8 shrink-0 place-items-center rounded font-bold" style={{ background: pair.bg, color: pair.fg }}>Aa</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{pair.label}</p>
                    <p className="tabular-nums text-muted">{ratio.toFixed(1)}:1</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 font-medium ${GRADE_CLASS[grade]}`}>{GRADE_LABEL[grade]}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FONT_SUGGESTIONS = ["Georgia", "Arial", "Helvetica", "Verdana", "Trebuchet MS", "Lora", "DM Sans", "IBM Plex Sans"];

export function FontListEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const hasSafeFallback = value.some(isEmailSafeFont);

  function add(name: string) {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  }
  function move(index: number, by: 1 | -1) {
    const next = [...value];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((font, i) => {
        const safe = isEmailSafeFont(font);
        return (
          <div key={`${font}-${i}`} className="flex items-center gap-3 rounded-md border border-edge px-3 py-2">
            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl" style={{ fontFamily: `'${font}', ${i === 0 ? "serif" : "sans-serif"}` }}>
                El lino que aguanta el verano
              </p>
              <span className="text-xs text-muted">{font}{i === 0 ? " · títulos" : ""}</span>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${safe ? "bg-success/10 text-success" : "bg-edge/40 text-muted"}`}>
              {safe ? "Funciona en todo correo" : "Fuente web"}
            </span>
            <div className="flex shrink-0 gap-0.5">
              <Button variant="ghost" size="sm" className="min-w-0 px-1.5" disabled={i === 0} aria-label="Subir" onClick={() => move(i, -1)}>
                <IconChevronUp className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="min-w-0 px-1.5" disabled={i === value.length - 1} aria-label="Bajar" onClick={() => move(i, 1)}>
                <IconChevronDown className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="min-w-0 px-1.5" aria-label={`Quitar ${font}`} onClick={() => remove(i)}>
                <CloseIcon className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
      {value.length > 0 && !hasSafeFallback ? (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          Outlook y Gmail no cargan fuentes web. Añade al final una que funcione en todo correo (Georgia o Arial) o el email saldrá en Times.
        </p>
      ) : null}
      {value.length < 12 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            list="guia-font-suggestions"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }}
            placeholder="Añadir tipografía"
            className="max-w-64"
          />
          <datalist id="guia-font-suggestions">
            {FONT_SUGGESTIONS.filter((f) => !value.includes(f)).map((f) => <option key={f} value={f} />)}
          </datalist>
          <Button variant="secondary" size="sm" onClick={() => add(draft)}>
            <PlusIcon className="size-4" /> Añadir
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const CHIP_TONE: Record<"preferred" | "avoided", string> = {
  preferred: "bg-success/10 text-success",
  avoided: "bg-danger/10 text-danger",
};

export function VocabularyChips({
  tone,
  value,
  onChange,
  otherValue,
  otherLabel,
  onMoveToOther,
  placeholder,
}: {
  tone: "preferred" | "avoided";
  value: string[];
  onChange: (next: string[]) => void;
  otherValue: string[] | null;
  otherLabel: string;
  onMoveToOther: ((word: string) => void) | null;
  placeholder: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const otherLower = new Set((otherValue ?? []).map((w) => w.toLowerCase()));

  function addMany(raw: string) {
    const parts = raw
      .split(/[\n,;]/)
      .map((part) => part.trim().slice(0, 120))
      .filter(Boolean)
      .filter((part) => !value.some((existing) => existing.toLowerCase() === part.toLowerCase()));
    if (parts.length === 0) return;
    onChange([...value, ...parts]);
    setDraft("");
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div
      className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-edge bg-surface p-2 focus-within:border-accent"
      onClick={() => document.getElementById(id)?.focus()}
    >
      {value.map((word, i) => {
        const conflict = otherLower.has(word.toLowerCase());
        return (
          <span
            key={`${word}-${i}`}
            title={conflict ? `También está en ${otherLabel.toLowerCase()}` : undefined}
            className={`flex max-w-full items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-xs ${CHIP_TONE[tone]} ${conflict ? "outline outline-2 outline-warning" : ""}`}
          >
            <span className="truncate">{word}</span>
            {onMoveToOther ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(i); onMoveToOther(word); }}
                title={`Pasar a ${otherLabel.toLowerCase()}`}
                className="grid size-4 place-items-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100"
              >
                <IconChevronDown className="size-3" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              aria-label={`Quitar ${word}`}
              className="grid size-4 place-items-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100"
            >
              <CloseIcon className="size-3" />
            </button>
          </span>
        );
      })}
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === ",") && draft.trim()) { event.preventDefault(); addMany(draft); }
          else if (event.key === "Backspace" && !draft && value.length) remove(value.length - 1);
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (/[\n,;]/.test(text)) { event.preventDefault(); addMany(text); }
        }}
        onBlur={() => { if (draft.trim()) addMany(draft); }}
        placeholder={placeholder}
        className="min-w-28 flex-1 border-0 bg-transparent p-1 text-sm outline-none"
      />
    </div>
  );
}

export function TextListEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  highlight,
  addLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  maxLength: number;
  /** Para restricciones: muestra qué frases «entre comillas» detectará el probador. */
  highlight?: (text: string) => string[];
  addLabel: string;
}) {
  function update(index: number, text: string) {
    const next = [...value];
    next[index] = text;
    onChange(next);
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function commitBlur() {
    if (value.some((item) => !item.trim())) onChange(value.filter((item) => item.trim()));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((text, i) => {
        const quoted = highlight?.(text) ?? [];
        return (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <textarea
                value={text}
                onChange={(event) => update(i, event.target.value)}
                onBlur={commitBlur}
                placeholder={placeholder}
                rows={1}
                maxLength={maxLength}
                className="w-full resize-y rounded-md border border-edge bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              {quoted.length > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  El probador detecta:{" "}
                  {quoted.map((q) => (
                    <mark key={q} className="rounded bg-warning/10 px-1 text-warning">{q}</mark>
                  ))}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1 pt-2">
              <Button variant="ghost" size="sm" className="min-w-0 px-1.5" aria-label="Quitar" onClick={() => remove(i)}>
                <CloseIcon className="size-4" />
              </Button>
              {text.length > maxLength * 0.8 ? (
                <span className={`text-xs ${text.length > maxLength ? "text-danger" : "text-muted"}`}>
                  {text.length}/{maxLength}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <Button variant="secondary" size="sm" className="self-start" onClick={() => onChange([...value, ""])}>
        <PlusIcon className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}
