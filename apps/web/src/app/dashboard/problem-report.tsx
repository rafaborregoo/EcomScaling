"use client";

import { useState, type FormEvent } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch } from "@/lib/bootstrap";

export function ProblemReport() {
  const { organizationId } = useActiveOrganization();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("other");
  const [satisfaction, setSatisfaction] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  if (!organizationId) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await apiFetch(
        `/v1/organizations/${encodeURIComponent(organizationId)}/platform-feedback`,
        {
          method: "POST",
          cache: "no-store",
          body: JSON.stringify({
            category,
            satisfaction: satisfaction ? Number(satisfaction) : null,
            message,
            pagePath: window.location.pathname,
          }),
        },
      );
      if (!response.ok) throw new Error("No se pudo enviar el informe.");
      setMessage("");
      setSatisfaction("");
      setNotice("Gracias. Hemos recibido tu informe.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el informe.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <section
          aria-labelledby="problem-report-title"
          className="mb-3 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-separator bg-surface p-4 shadow-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="problem-report-title" className="font-semibold">
                Enviar feedback
              </h2>
              <p className="mt-1 text-sm text-muted">
                Cuéntanos si algo falla o va lento.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar formulario"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              Tipo
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 w-full rounded-md border border-separator bg-transparent px-3 py-2"
              >
                <option value="bug">Algo no funciona</option>
                <option value="slow">La plataforma va lenta</option>
                <option value="sync">Problema de sincronización</option>
                <option value="other">Sugerencia u otro</option>
              </select>
            </label>
            <label className="block text-sm">
              ¿Cómo valorarías la experiencia? (opcional)
              <select
                value={satisfaction}
                onChange={(event) => setSatisfaction(event.target.value)}
                className="mt-1 w-full rounded-md border border-separator bg-transparent px-3 py-2"
              >
                <option value="">Sin valoración</option>
                <option value="1">1 · Muy mala</option>
                <option value="2">2 · Mala</option>
                <option value="3">3 · Normal</option>
                <option value="4">4 · Buena</option>
                <option value="5">5 · Muy buena</option>
              </select>
            </label>
            <label className="block text-sm">
              Detalles
              <textarea
                required
                minLength={8}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="mt-1 w-full resize-y rounded-md border border-separator bg-transparent px-3 py-2"
                placeholder="¿Qué ocurrió y qué esperabas que pasara?"
              />
            </label>
            {notice ? (
              <p role="status" className="text-sm text-muted">
                {notice}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || message.trim().length < 8}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Enviar informe"}
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-separator bg-surface px-4 py-3 text-sm font-medium shadow-lg"
      >
        Feedback / informar problema
      </button>
    </div>
  );
}
