"use client";

import { useState, type FormEvent } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Field, MessageSquareIcon, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";

export function PortalFeedback({ organizationId }: { organizationId: string }) {
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
    // Formulario corto con enviar: Dialog (no un panel flotante hecho a mano).
    <Dialog open={open} onOpenChange={setOpen} busy={busy} dirty={Boolean(message.trim())}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Enviar feedback"
            title="Enviar feedback"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
          />
        }
      >
        <MessageSquareIcon className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Feedback</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>Cuéntanos si algo falla o va lento.</DialogDescription>
        </DialogHeader>
        <form id="portal-feedback-form" onSubmit={submit} className="space-y-4">
          <Field label="Tipo">
            <Select
              value={category}
              onChange={setCategory}
              options={[
                { value: "bug", label: "Algo no funciona" },
                { value: "slow", label: "La plataforma va lenta" },
                { value: "sync", label: "Problema de sincronización" },
                { value: "other", label: "Sugerencia u otro" },
              ]}
            />
          </Field>
          <Field label="¿Cómo valorarías la experiencia? (opcional)">
            <Select
              value={satisfaction}
              onChange={setSatisfaction}
              placeholder="Sin valoración"
              options={[
                { value: "1", label: "1 · Muy mala" },
                { value: "2", label: "2 · Mala" },
                { value: "3", label: "3 · Normal" },
                { value: "4", label: "4 · Buena" },
                { value: "5", label: "5 · Muy buena" },
              ]}
            />
          </Field>
          <Field label="Detalles">
            <Textarea
              required
              minLength={8}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="resize-y"
              placeholder="¿Qué ocurrió y qué esperabas que pasara?"
            />
          </Field>
          {notice ? (
            <p role="status" className="text-sm text-muted">
              {notice}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="portal-feedback-form" disabled={busy || message.trim().length < 8}>
            {busy ? "Enviando…" : "Enviar informe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
