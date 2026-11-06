"use client";

import { useEffect, useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  LoadingBlock,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { useCachedQuery } from "@/lib/use-cached-query";

// Calendario de vídeos de Instagram. Los datos salen de `video/contenido/` (solo en local):
// calendario.json (180 huecos), catalogo.json (vídeos hechos), ideas.json (banco por módulo)
// y semana1.json (voz y texto de publicación de la primera semana).

type Estado = "listo" | "guion" | "por-crear";
type Slot = {
  franja: string;
  pilar: string;
  modulo?: string;
  tema: string;
  version: number;
  plantilla: string;
  estilo?: string;
  diseno?: string;
  video: string | null;
  estado: Estado;
  caption?: string;
  comentario?: string;
};
type Dia = { fecha: string; dia: number; semana: number; slots: Slot[] };
type Calendario = {
  pilares: Record<string, string>;
  semanas: { n: number; nombre: string; foco: string }[];
  dias: Dia[];
};
type Video = { id: string; categoria: string; archivo: string; duracion: number; cierre?: string };
type Idea = { id: string; seccion: string; titulo: string; gancho: string; diseno: string; video: string | null; estado: string };
type Ideas = { disenos: Record<string, string>; modulos: Record<string, { nombre: string; rutas: string; ideas: Idea[] }> };
type Plan = { id: string; voz: string[]; caption: string; comentario: string; hook: string };
type Payload =
  | { available: false }
  | { available: true; calendario: Calendario | null; catalogo: { videos: Video[] } | null; ideas: Ideas | null; plan: Plan[] | null };

const ESTADO: Record<Estado, { label: string; tone: "success" | "warn" | "neutral" }> = {
  listo: { label: "Listo", tone: "success" },
  guion: { label: "Con guion", tone: "warn" },
  "por-crear": { label: "Por crear", tone: "neutral" },
};

// Producción de cada diseño: qué hay construido hoy (contenido/DISENOS.md)
const DISENO_ESTADO: Record<string, string> = {
  P: "Hecho (Remotion)",
  O: "Hecho (Remotion)",
  C: "Por construir (Remotion)",
  T: "Por construir (Remotion)",
  H: "Por construir (Remotion)",
  F: "Por construir (Remotion)",
  E: "Por construir (Remotion)",
  S: "Stageshow",
  N: "Skill anuncio-animado",
  L: "Hecho en el repo antiguo (3D)",
  M: "Hecho en el repo antiguo (3D)",
};

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));

function useAsset(path: string | null) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setUrl("");
    setFailed(false);
    if (!path) return;
    let disposed = false;
    let objectUrl = "";
    void apiFetch(`/v1/admin/video-calendar/asset?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("no encontrado");
        objectUrl = URL.createObjectURL(await response.blob());
        if (disposed) URL.revokeObjectURL(objectUrl);
        else setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return { url, failed };
}

function copy(text: string, what: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copiado`))
    .catch(() => toast.danger("No se pudo copiar"));
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={() => copy(text, title)}>
          Copiar
        </Button>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-foreground/5 p-3 text-sm leading-relaxed">{text}</pre>
    </div>
  );
}

function SlotDetail({ slot, dia, video, plan, label }: { slot: Slot; dia: Dia; video?: Video; plan?: Plan; label: string }) {
  const [playing, setPlaying] = useState(false);
  const cover = useAsset(slot.video ? `portadas/${slot.video}.png` : null);
  const media = useAsset(playing && video ? video.archivo : null);
  const caption = slot.caption ?? plan?.caption;
  const comentario = slot.comentario ?? plan?.comentario;
  return (
    <ScrollArea className="flex-1 p-4 sm:px-6">
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone={ESTADO[slot.estado].tone}>{ESTADO[slot.estado].label}</Badge>
          <Badge tone="brand">{label}</Badge>
          <Badge tone="neutral">{`Versión ${slot.version} · ${slot.estilo ?? ""}`.trim()}</Badge>
          {video ? <Badge tone="neutral">{`${video.id} · ${Math.round(video.duracion)} s`}</Badge> : null}
          {video?.cierre === "falta-lema" ? <Badge tone="warn">Falta el lema</Badge> : null}
        </div>
        <p className="text-sm text-muted">{`${fechaLarga(dia.fecha)} · ${slot.franja} · Plantilla ${slot.plantilla}`}</p>

        {video ? (
          <div className="grid gap-3">
            {playing ? (
              media.url ? (
                <video src={media.url} controls autoPlay className="mx-auto aspect-[9/16] max-h-[60vh] rounded-lg bg-black" />
              ) : media.failed ? (
                <Banner tone="warn">No se pudo cargar el vídeo.</Banner>
              ) : (
                <LoadingBlock label="Cargando vídeo…" />
              )
            ) : cover.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="Portada" className="mx-auto aspect-[9/16] max-h-[60vh] rounded-lg object-cover" />
            ) : null}
            {!playing ? (
              <Button onClick={() => setPlaying(true)} className="mx-auto">
                Ver el vídeo
              </Button>
            ) : null}
          </div>
        ) : (
          <Banner tone="info">Este hueco todavía no tiene vídeo.</Banner>
        )}

        {plan ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Gancho</h3>
            <p className="text-sm">{plan.hook}</p>
          </div>
        ) : null}
        {caption ? <CopyBlock title="Texto de la publicación" text={caption} /> : null}
        {comentario ? <CopyBlock title="Primer comentario" text={comentario} /> : null}
        {plan?.voz?.length ? <CopyBlock title="Locución" text={plan.voz.join("\n")} /> : null}
      </div>
    </ScrollArea>
  );
}

function CalendarTab({ cal, videos, plan }: { cal: Calendario; videos: Map<string, Video>; plan: Map<string, Plan> }) {
  const [semana, setSemana] = useState(1);
  const [open, setOpen] = useState<{ dia: Dia; slot: Slot } | null>(null);
  const dias = cal.dias.filter((d) => d.semana === semana);
  const info = cal.semanas.find((s) => s.n === semana);
  const label = (s: Slot) => s.modulo ?? cal.pilares[s.pilar] ?? s.pilar;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup value={semana} onValueChange={setSemana}>
          {cal.semanas.map((s) => (
            <ToggleGroupItem key={s.n} value={s.n}>{`S${s.n}`}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        {info ? <p className="text-sm text-muted">{`${info.nombre} · ${info.foco}`}</p> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dias.map((dia) => {
          const listos = dia.slots.filter((s) => s.estado === "listo").length;
          return (
            <Card key={dia.fecha} size="sm">
              <CardHeader>
                <CardTitle className="capitalize">{fechaLarga(dia.fecha)}</CardTitle>
                <CardAction>
                  <Badge tone={listos === dia.slots.length ? "success" : "neutral"}>{`${listos}/${dia.slots.length}`}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-1">
                {dia.slots.map((slot) => (
                  <button
                    key={slot.franja}
                    type="button"
                    onClick={() => setOpen({ dia, slot })}
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
                  >
                    <span className="tabular-nums text-muted">{slot.franja}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{slot.tema.replace(/-/g, " ")}</span>
                      <span className="block truncate text-xs text-muted">{`${label(slot)}${slot.video ? ` · ${slot.video}` : ""}`}</span>
                    </span>
                    <Badge tone={ESTADO[slot.estado].tone}>{ESTADO[slot.estado].label}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Drawer open={open !== null} onOpenChange={(v) => !v && setOpen(null)} swipeDirection="right">
        <DrawerContent className="sm:max-w-[34rem]">
          <DrawerHeader>
            <DrawerTitle className="capitalize">{open ? open.slot.tema.replace(/-/g, " ") : ""}</DrawerTitle>
            <DrawerDescription>{open ? `${fechaLarga(open.dia.fecha)} · ${open.slot.franja}` : ""}</DrawerDescription>
          </DrawerHeader>
          {open ? (
            <SlotDetail
              slot={open.slot}
              dia={open.dia}
              video={open.slot.video ? videos.get(open.slot.video) : undefined}
              plan={open.slot.video ? plan.get(open.slot.video) : undefined}
              label={label(open.slot)}
            />
          ) : null}
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function IdeasTab({ ideas }: { ideas: Ideas }) {
  const [modulo, setModulo] = useState("todos");
  const filas = useMemo(
    () =>
      Object.entries(ideas.modulos)
        .filter(([id]) => modulo === "todos" || id === modulo)
        .flatMap(([id, m]) => m.ideas.map((i) => ({ ...i, modulo: m.nombre, moduloId: id }))),
    [ideas, modulo],
  );
  const conteo = (id: string) => (id === "todos" ? Object.values(ideas.modulos).reduce((a, m) => a + m.ideas.length, 0) : ideas.modulos[id]?.ideas.length ?? 0);
  return (
    <div className="grid gap-4">
      <ToggleGroup value={modulo} onValueChange={setModulo} spacing={2}>
        <ToggleGroupItem value="todos">{`Todos · ${conteo("todos")}`}</ToggleGroupItem>
        {Object.entries(ideas.modulos).map(([id, m]) => (
          <ToggleGroupItem key={id} value={id}>{`${m.nombre} · ${conteo(id)}`}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      {modulo !== "todos" ? <p className="text-sm text-muted">{ideas.modulos[modulo]?.rutas}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Idea</TableHead>
            <TableHead>Sección</TableHead>
            <TableHead>Gancho</TableHead>
            <TableHead>Diseño</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">
                {i.titulo}
                {modulo === "todos" ? <span className="block text-xs text-muted">{i.modulo}</span> : null}
              </TableCell>
              <TableCell className="text-muted">{i.seccion}</TableCell>
              <TableCell>{i.gancho}</TableCell>
              <TableCell>
                <Badge tone="brand">{ideas.disenos[i.diseno] ?? i.diseno}</Badge>
              </TableCell>
              <TableCell>
                <Badge tone={i.estado === "listo" ? "success" : i.estado === "guion" ? "warn" : "neutral"}>
                  {i.video ? `${i.video} · ${i.estado}` : i.estado}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DisenosTab({ ideas }: { ideas: Ideas }) {
  const usos: Record<string, number> = {};
  for (const m of Object.values(ideas.modulos)) for (const i of m.ideas) usos[i.diseno] = (usos[i.diseno] ?? 0) + 1;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">Reparto provisional de las ideas entre diseños. Mismo estilo de marca, distinta estructura y movimiento.</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Diseño</TableHead>
            <TableHead>Ideas</TableHead>
            <TableHead>Producción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(ideas.disenos).map(([k, nombre]) => (
            <TableRow key={k}>
              <TableCell className="font-medium">{nombre}</TableCell>
              <TableCell className="tabular-nums">{usos[k] ?? 0}</TableCell>
              <TableCell className="text-muted">{DISENO_ESTADO[k] ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VideoCalendar() {
  const { data, error, isLoading } = useCachedQuery<Payload>("/v1/admin/video-calendar");
  const [tab, setTab] = useState("calendario");
  const cal = data && data.available ? data.calendario : null;
  const ideas = data && data.available ? data.ideas : null;
  const videos = useMemo(() => new Map((data && data.available ? data.catalogo?.videos ?? [] : []).map((v) => [v.id, v])), [data]);
  const plan = useMemo(() => new Map((data && data.available ? data.plan ?? [] : []).map((p) => [p.id, p])), [data]);

  const stats = useMemo(() => {
    const c = { listo: 0, guion: 0, "por-crear": 0 };
    for (const d of cal?.dias ?? []) for (const s of d.slots) c[s.estado] += 1;
    return c;
  }, [cal]);

  if (isLoading) return <LoadingBlock label="Cargando el calendario…" />;
  if (error) return <Banner tone="danger">{`No se pudo cargar el calendario: ${error}`}</Banner>;
  if (!data?.available || !cal)
    return (
      <Banner tone="warn">
        Los vídeos y su calendario están en la carpeta <strong>video/contenido</strong> del repositorio y solo se ven cuando la API corre en local.
      </Banner>
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">{`${stats.listo} listos`}</Badge>
        <Badge tone="warn">{`${stats.guion} con guion`}</Badge>
        <Badge tone="neutral">{`${stats["por-crear"]} por crear`}</Badge>
        <Badge tone="brand">{`${cal.dias.length} días · ${cal.dias.length * (cal.dias[0]?.slots.length ?? 0)} huecos`}</Badge>
        {ideas ? <Badge tone="neutral">{`${Object.values(ideas.modulos).reduce((a, m) => a + m.ideas.length, 0)} ideas en el banco`}</Badge> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Instagram · 4 nov – 3 dic</CardTitle>
          <CardDescription>6 vídeos al día. Cierre fijo: «Tu propia línea. No hay competición.»</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "calendario", label: "Calendario" },
              { value: "ideas", label: "Banco de ideas" },
              { value: "disenos", label: "Diseños" },
            ]}
            panels={{
              calendario: <div className="pt-4"><CalendarTab cal={cal} videos={videos} plan={plan} /></div>,
              ideas: <div className="pt-4">{ideas ? <IdeasTab ideas={ideas} /> : <Banner tone="info">Aún no hay banco de ideas.</Banner>}</div>,
              disenos: <div className="pt-4">{ideas ? <DisenosTab ideas={ideas} /> : null}</div>,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminVideoCalendarPage() {
  return <PlatformAdminShell title="Calendario de vídeos">{() => <VideoCalendar />}</PlatformAdminShell>;
}
