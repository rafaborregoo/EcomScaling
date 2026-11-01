"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, CheckCheckIcon, PlusIcon, SearchIcon, ShoppingBagIcon, SparklesIcon, StoreIcon } from "lucide-react";
import { apiFetch } from "@/lib/bootstrap";
import {
  toast,
  Button,
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui";
import type { PortalNavModule } from "@/components/portal-navigation";

// Paleta ⌘K / Ctrl+K: ir a cualquier sección, lanzar una acción, cambiar de
// cliente o de tienda, o preguntar al Consultor IA sin el ratón. Las secciones salen del mismo árbol que pinta
// la navegación (getPortalNavigation), así que cada rol ve solo lo suyo. Se
// monta una vez en el shell; los botones de la barra la abren con un evento.

const OPEN_EVENT = "command-palette:open";
/** Las campanas de avisos (hay dos montadas: móvil y escritorio) se recargan con él. */
export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed";

async function markAllNotificationsRead() {
  try {
    const response = await apiFetch("/v1/notifications/read-all", { method: "POST" });
    if (!response.ok) throw new Error();
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    toast.success("Notificaciones marcadas como leídas.");
  } catch {
    toast.danger("No se pudieron marcar todas como leídas.");
  }
}

export type PaletteClient = { value: string; label: string; section?: string };

/** Botón "Buscar… ⌘K" de la barra superior (en móvil, solo la lupa). */
export function CommandPaletteButton({ compact = false }: { compact?: boolean }) {
  const open = () => window.dispatchEvent(new Event(OPEN_EVENT));
  return compact ? (
    <Button variant="ghost" size="icon" aria-label="Buscar (Ctrl+K)" onClick={open}>
      <SearchIcon />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="w-52 justify-start font-normal text-muted" aria-keyshortcuts="Control+K Meta+K" onClick={open}>
      <SearchIcon />
      Buscar…
      <kbd className="ml-auto rounded border border-separator px-1.5 font-sans text-[0.7rem] tracking-widest">Ctrl K</kbd>
    </Button>
  );
}

export function CommandPalette({
  modules,
  clients,
  clientsHeading = "Cambiar de cliente",
  onSelectClient,
  stores,
  onSelectStore,
  onAsk,
}: {
  modules: PortalNavModule[];
  /** Cambiar el cliente (o el negocio, si es cliente con varios) activo. */
  clients?: PaletteClient[];
  clientsHeading?: string;
  onSelectClient?: (value: string) => void;
  /** Tiendas de Shopify del cliente activo; "" es «Todas las tiendas». */
  stores?: PaletteClient[];
  onSelectStore?: (value: string) => void;
  /** Abre el Consultor IA con la pregunta escrita. */
  onAsk?: (question: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const show = () => {
      setSearch("");
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      setOpen((current) => {
        if (!current) setSearch("");
        return !current;
      });
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  const question = search.trim();
  // Atajos a altas que ya existen, cada uno solo si el rol ve esa sección.
  // ?nueva=1 lo lee useNewFromUrl en la pantalla de destino.
  const sees = (href: string) => modules.some((module) => module.items.some((item) => item.href === href || item.href.startsWith(`${href}&`)));
  const actions = [
    ...(sees("/tareas") ? [{ label: "Crear tarea", keywords: ["nueva", "tarea", "pendiente"], icon: PlusIcon, run: () => router.push("/tareas?nueva=1") }] : []),
    ...(sees("/marketing?section=campanas") ? [{ label: "Nueva campaña", keywords: ["crear", "email", "envío"], icon: PlusIcon, run: () => router.push("/marketing?section=campanas&nueva=1") }] : []),
    ...(sees("/marketing?section=flows") ? [{ label: "Nuevo flow", keywords: ["crear", "automatización", "email", "klaviyo"], icon: PlusIcon, run: () => router.push("/marketing?section=flows&flow=new") }] : []),
    { label: "Ver todos los avisos", keywords: ["notificaciones", "alertas"], icon: BellIcon, run: () => router.push("/notificaciones") },
    { label: "Marcar todos los avisos como leídos", keywords: ["notificaciones", "alertas", "limpiar"], icon: CheckCheckIcon, run: () => void markAllNotificationsRead() },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Buscar en E-NORA" description="Ve a una sección, cambia de cliente o pregunta al Consultor IA">
      <Command>
        <CommandInput autoFocus placeholder="Busca una sección, un cliente o escribe una pregunta…" value={search} onValueChange={setSearch} />
        <CommandList>
          <CommandEmpty>Nada con ese nombre.</CommandEmpty>
          <CommandGroup heading="Acciones">
            {actions.map((action) => (
              <CommandItem key={action.label} value={action.label} keywords={action.keywords} onSelect={() => run(action.run)}>
                <action.icon aria-hidden />
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {modules.map((module) => (
            <CommandGroup key={module.id} heading={module.label}>
              {module.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  keywords={[module.label, item.group ?? ""]}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <module.icon aria-hidden />
                  {item.label}
                  {item.group ? <CommandShortcut className="tracking-normal">{item.group}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {clients?.length && onSelectClient ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={clientsHeading}>
                {clients.map((client) => (
                  <CommandItem
                    key={client.value}
                    value={client.label}
                    keywords={["cliente", "tienda", client.section ?? ""]}
                    onSelect={() => run(() => onSelectClient(client.value))}
                  >
                    <StoreIcon aria-hidden />
                    {client.label}
                    {client.section ? <CommandShortcut className="tracking-normal">{client.section}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
          {stores?.length && onSelectStore ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Cambiar de tienda">
                {stores.map((store) => (
                  <CommandItem
                    key={store.value}
                    value={store.label}
                    keywords={["tienda", "shopify"]}
                    onSelect={() => run(() => onSelectStore(store.value))}
                  >
                    <ShoppingBagIcon aria-hidden />
                    {store.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
          {onAsk && question ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Consultor IA">
                {/* Sin filtro: siempre está, sea cual sea la pregunta. */}
                <CommandItem value={question} keywords={[]} onSelect={() => run(() => onAsk(question))}>
                  <SparklesIcon aria-hidden />
                  <span className="truncate">Preguntar: «{question}»</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
