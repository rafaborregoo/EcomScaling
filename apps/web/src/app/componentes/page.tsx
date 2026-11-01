"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { BellIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, FileIcon, FolderIcon, MaximizeIcon, MinimizeIcon, ClockIcon, CopyIcon, MailIcon, MinusIcon, MoreHorizontalIcon, PlusIcon, FileTextIcon, FileWarningIcon, RefreshCwIcon, TableIcon, XIcon } from "lucide-react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ArchiveIcon, ArrowUpIcon, ArrowUpRightIcon, BadgeCheck, BookmarkIcon, GitBranchIcon, GitForkIcon, SparklesIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { ChannelBadge } from "@/components/marketing-channel";
import { PortalShell } from "@/components/portal-shell";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  ScrollArea,
  List,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Marker,
  MarkerContent,
  MarkerIcon,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Progress,
  ProgressLabel,
  ProgressValue,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  FieldGroup,
  FieldSeparator,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyState,
  EmptyTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  cn,
  toast,
  type DrawerSwipeDirection,
} from "@/components/ui";
import {
  Accordion,
  Collapsible,
  CollapsibleContent,
  CollapsibleMore,
  CollapsibleTrigger,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Banner,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  ErrorBlock,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  AgentRuntimeStatusBadge,
  Badge,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  ToggleGroup,
  ToggleGroupItem,
  RadioCard,
  RadioGroup,
  RadioGroupItem,
  ProviderIcon,
  Button,
  ButtonLink,
  Calendar,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  TimeInput,
  IntegrationStatusBadge,
  NotificationBadge,
  Spinner,
  type BadgeVariant,
  type ButtonSize,
  type ButtonVariant,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  avatarInitials,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardKicker,
  CardTitle,
  Checkbox,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  MultiSearchableSelect,
  SearchableSelect,
  TimezoneCombobox,
  DataTable,
  Field,
  Input,
  Metric,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";


/**
 * Catálogo vivo de componentes: se pintan los componentes reales con el CSS
 * real, así lo que se ve aquí es lo que se ve en el producto.
 */

const VARIANTS: Array<{ variant: ButtonVariant; use: string }> = [
  { variant: "default", use: "Primario: la acción principal de la pantalla (morado E-NORA)" },
  { variant: "secondary", use: "Secundario: morado suave" },
  { variant: "outline", use: "Acción secundaria con borde" },
  { variant: "ghost", use: "Acciones de fila, barras de herramientas" },
  { variant: "destructive", use: "Borrar, desconectar, descartar" },
  { variant: "link", use: "Acción con aspecto de enlace" },
];
const SIZES: Array<{ size: ButtonSize; icon: ButtonSize; label: string }> = [
  { size: "xs", icon: "icon-xs", label: "xs · 24 px" },
  { size: "sm", icon: "icon-sm", label: "sm · 32 px" },
  { size: "default", icon: "icon", label: "default · 36 px" },
  { size: "lg", icon: "icon-lg", label: "lg · 40 px" },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">{children}</div>
      </CardContent>
    </Card>
  );
}

const CARD_SPACINGS = [
  { value: "4", label: "16 px", className: "[--card-spacing:--spacing(4)]" },
  { value: "5", label: "20 px", className: "[--card-spacing:--spacing(5)]" },
  { value: "6", label: "24 px", className: "[--card-spacing:--spacing(6)]" },
  { value: "8", label: "32 px", className: "[--card-spacing:--spacing(8)]" },
];

function CardShowcase() {
  const [spacing, setSpacing] = useState("4");
  const spacingClass = CARD_SPACINGS.find((option) => option.value === spacing)?.className;
  return (
    <div className="grid gap-6">
      <Block title="Card: cabecera, contenido y pie">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Entra en tu cuenta</CardTitle>
              <CardDescription>Escribe tu email para entrar en E-NORA.</CardDescription>
              <CardAction>
                <Button variant="link">Crear cuenta</Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Email">
                <Input type="email" placeholder="tu@tienda.com" />
              </Field>
              <Field label="Contraseña">
                <Input type="password" />
              </Field>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button className="w-full">Entrar</Button>
              <Button variant="outline" className="w-full">Entrar con Google</Button>
            </CardFooter>
          </Card>
          <Card size="sm" className="max-w-xs">
            <CardHeader>
              <CardTitle>Informes programados</CardTitle>
              <CardDescription>Una foto semanal, sin exportar a mano.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {["Elige cada cuánto: diario o semanal.", "Envíalo al cliente o a tu equipo.", "Con gráficas, tablas y cifras clave."].map((item) => (
                  <li key={item} className="flex gap-2">
                    <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button size="sm" className="w-full">Programar informes</Button>
              <Button variant="outline" size="sm" className="w-full">Ver novedades</Button>
            </CardFooter>
          </Card>
        </div>
      </Block>

      <Block title="Espaciado (--card-spacing) y contenido de borde a borde">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="grid max-w-sm gap-4">
            <ToggleGroup aria-label="Espaciado de la tarjeta" value={spacing} onValueChange={setSpacing}>
              {CARD_SPACINGS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Card className={spacingClass}>
              <CardHeader>
                <CardKicker>Ventas</CardKicker>
                <CardTitle>Ingresos de octubre</CardTitle>
                <CardDescription>Pedidos pagados en Shopify.</CardDescription>
                <CardAction>
                  <Badge tone="success">+12 %</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">48.210 €</p>
              </CardContent>
            </Card>
          </div>
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Condiciones del servicio</CardTitle>
              <CardDescription>Léelas antes de aceptar el acuerdo.</CardDescription>
            </CardHeader>
            <CardContent className="-mb-(--card-spacing)">
              <ScrollArea className="-mx-(--card-spacing) grid max-h-48 gap-4 border-t border-separator bg-[var(--nora-gray-50)] px-(--card-spacing) py-4 text-sm leading-relaxed">
                <p>Estas condiciones regulan el uso del espacio de trabajo, incluidos los documentos compartidos, los archivos de cada tienda y las herramientas de colaboración.</p>
                <p>Eres responsable del contenido que subes y de que tu equipo tenga los permisos adecuados para verlo o editarlo.</p>
                <p>Podemos cambiar funciones o límites a medida que evoluciona el servicio. Cuando el cambio afecte a tu forma de trabajar, avisaremos a los administradores.</p>
              </ScrollArea>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline">Rechazar</Button>
              <Button>Aceptar</Button>
            </CardFooter>
          </Card>
        </div>
      </Block>

      <Block title="Con imagen, KPI y tarjetas anidadas (size sm)">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card className="max-w-sm">
            <img src={SAMPLE_IMAGE} alt="" className="aspect-video w-full object-cover" />
            <CardHeader>
              <CardAction>
                <Badge variant="secondary">Destacado</Badge>
              </CardAction>
              <CardTitle>Campaña de otoño</CardTitle>
              <CardDescription>Lookbook, email y anuncios con la misma creatividad.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full">Ver campaña</Button>
            </CardFooter>
          </Card>
          <div className="grid gap-3">
            <Metric card label="Conversión" value="2,4 %" hint="Últimos 30 días" trend={[1.8, 2, 2.1, 1.9, 2.3, 2.4]} />
            <Metric card tone="warn" label="Stock en riesgo" value="7 productos" hint="Se agotan antes de 14 días" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Hipótesis abiertas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {["El abandono en móvil sube tras el cambio de checkout", "El email de bienvenida no llega a la mitad de altas"].map((item) => (
                <Card key={item} size="sm">
                  <CardContent className="text-sm">{item}</CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </Block>
    </div>
  );
}

const FRAMEWORKS = ["Shopify", "WooCommerce", "PrestaShop", "Magento", "Wix"];
const CLIENTS = [
  { value: "padel", label: "Pádel España", hint: "padelespana.myshopify.com" },
  { value: "lino", label: "Lino & Co", hint: "linoyco.myshopify.com" },
  { value: "norte", label: "Café del Norte", hint: "cafedelnorte.com" },
  { value: "olivo", label: "Olivo Cosmética", hint: "olivocosmetica.es" },
];
const AUDIENCES = [
  { value: "vip", label: "Clientes VIP", section: "Listas", hint: "1.240 perfiles" },
  { value: "news", label: "Newsletter", section: "Listas", hint: "18.902 perfiles" },
  { value: "cart", label: "Carrito abandonado 7 días", section: "Segmentos", hint: "312 perfiles" },
  { value: "dormidos", label: "Sin compra en 90 días", section: "Segmentos", hint: "4.087 perfiles" },
];

function ComboboxShowcase() {
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [client, setClient] = useState("lino");
  const [audiences, setAudiences] = useState<string[]>(["vip"]);
  const [emails, setEmails] = useState<string[]>(["rafa@e-nora.com"]);
  const [popup, setPopup] = useState<(typeof CLIENTS)[number] | null>(CLIENTS[0]);
  return (
    <div className="grid gap-6">
      <Block title="Combobox: cuándo usarlo">
        <p className="text-sm text-muted">
          Select para hasta unas 10 opciones fijas. Combobox cuando la lista es larga, crece con los datos o se eligen varias.
          Con grupos si las opciones tienen categoría (continente, fase, canal); con segunda línea si hace falta un dato para distinguirlas.
        </p>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Básico</p>
            <Combobox<string> items={FRAMEWORKS} autoHighlight>
              <ComboboxInput placeholder="Elige una plataforma" aria-label="Plataforma" />
              <ComboboxContent>
                <ComboboxEmpty>No hay ninguna con ese nombre.</ComboboxEmpty>
                <ComboboxList<string>>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <Field label="Con grupos e icono (zona horaria)">
            <TimezoneCombobox value={timezone} onChange={setTimezone} />
          </Field>
          <Field label="Segunda línea y botón de borrar">
            <SearchableSelect placeholder="Busca un cliente o su dominio" showClear value={client} onChange={setClient} options={CLIENTS} />
          </Field>
        </div>
      </Block>
      <Block title="Varias a la vez (etiquetas) y texto libre">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Field label="Audiencias de un envío">
            <MultiSearchableSelect placeholder="Busca una lista o un segmento" values={audiences} onChange={setAudiences} options={AUDIENCES} />
          </Field>
          <Field label="Destinatarios" hint="Intro, coma o pegar varios.">
            <MultiSearchableSelect placeholder="Escribe un email y pulsa Intro" emptyText="Escribe un email y pulsa Intro." allowsCustomValue options={[]} values={emails} onChange={setEmails} />
          </Field>
        </div>
      </Block>
      <Block title="Desde un botón, con error y deshabilitado">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Desplegable desde un botón</p>
            <Combobox<(typeof CLIENTS)[number]> items={CLIENTS} value={popup} onValueChange={setPopup} autoHighlight>
              <ComboboxTrigger render={<Button variant="outline" className="w-64 justify-between font-normal" />}>
                <ComboboxValue placeholder="Elegir cliente" />
                <ChevronsUpDownIcon aria-hidden />
              </ComboboxTrigger>
              <ComboboxContent className="w-64">
                <ComboboxInput placeholder="Busca un cliente" aria-label="Buscar cliente" />
                <ComboboxEmpty>No hay ningún cliente con ese nombre.</ComboboxEmpty>
                <ComboboxList<(typeof CLIENTS)[number]>>{(item) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <Field label="Con error" error="Elige el cliente del envío.">
            <SearchableSelect placeholder="Elige un cliente" value="" onChange={() => undefined} options={CLIENTS} />
          </Field>
          <Field label="Deshabilitado">
            <SearchableSelect disabled value="padel" onChange={() => undefined} options={CLIENTS} />
          </Field>
        </div>
      </Block>
    </div>
  );
}

const CHECKBOX_ROWS = [
  { id: "1", name: "Lucía Pérez", email: "lucia@tienda.com", role: "Cliente" },
  { id: "2", name: "Iván Sanz", email: "ivan@tienda.com", role: "Consultor" },
  { id: "3", name: "Eva Gil", email: "eva@tienda.com", role: "Cliente" },
];

function CheckboxShowcase() {
  const [rows, setRows] = useState<Set<string>>(new Set(["1"]));
  const all = rows.size === CHECKBOX_ROWS.length;
  return (
    <Block title="Checkbox: sola, con texto, estados y en una tabla">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="grid gap-4">
          <Checkbox>Acepto los términos y condiciones</Checkbox>
          <Checkbox defaultChecked>
            <span className="grid gap-0.5">
              <span className="font-medium">Avisarme por email</span>
              <span className="text-muted">Te escribimos cuando una tienda necesite tu atención.</span>
            </span>
          </Checkbox>
          <Checkbox disabled>Notificaciones push (no disponible)</Checkbox>
          <Checkbox aria-invalid>Confirmo que tengo derechos sobre estas imágenes</Checkbox>
          <FieldSet className="gap-3">
            <FieldLegend variant="label">Canales del informe</FieldLegend>
            <Checkbox defaultChecked>Shopify</Checkbox>
            <Checkbox defaultChecked>Meta Ads</Checkbox>
            <Checkbox>Klaviyo</Checkbox>
          </FieldSet>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  aria-label="Seleccionar todas las filas"
                  checked={all}
                  indeterminate={rows.size > 0 && !all}
                  onCheckedChange={(checked) => setRows(checked ? new Set(CHECKBOX_ROWS.map((row) => row.id)) : new Set())}
                />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CHECKBOX_ROWS.map((row) => (
              <TableRow key={row.id} data-state={rows.has(row.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Seleccionar a ${row.name}`}
                    checked={rows.has(row.id)}
                    onCheckedChange={(checked) =>
                      setRows((current) => {
                        const next = new Set(current);
                        if (checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      })
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Block>
  );
}

const INVOICES = [
  { id: "F-0101", status: "Pagada", method: "Tarjeta", amount: 250 },
  { id: "F-0102", status: "Pendiente", method: "Transferencia", amount: 150 },
  { id: "F-0103", status: "Pagada", method: "Domiciliación", amount: 350 },
  { id: "F-0104", status: "Vencida", method: "Tarjeta", amount: 450 },
];

type Payment = { id: string; status: "pendiente" | "procesando" | "cobrado" | "fallido"; email: string; amount: number };

const PAYMENT_STATUS: Record<Payment["status"], { label: string; tone: "neutral" | "warn" | "success" | "danger" }> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  procesando: { label: "Procesando", tone: "warn" },
  cobrado: { label: "Cobrado", tone: "success" },
  fallido: { label: "Fallido", tone: "danger" },
};

const PAYMENTS: Payment[] = Array.from({ length: 28 }, (_, index) => ({
  id: `pago-${String(index + 1).padStart(3, "0")}`,
  status: (["cobrado", "procesando", "cobrado", "fallido", "pendiente"] as const)[index % 5],
  email: `${["lucia", "ivan", "eva", "marta", "pablo", "sara", "diego"][index % 7]}${index + 1}@tienda.com`,
  amount: 40 + ((index * 137) % 900),
}));

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function TableShowcase() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="grid gap-6">
      <Block title="Table: tabla simple (cabecera, pie y leyenda)">
        <Table className="max-w-2xl">
          <TableCaption>Últimas facturas emitidas.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Método</TableHead>
              <TableHead data-align="end">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INVOICES.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.id}</TableCell>
                <TableCell>{invoice.status}</TableCell>
                <TableCell>{invoice.method}</TableCell>
                <TableCell data-align="end">{euros.format(invoice.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell data-align="end">{euros.format(INVOICES.reduce((sum, invoice) => sum + invoice.amount, 0))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Block>

      <Block title="Data Table: ordenar, buscar, paginar, ocultar columnas y seleccionar">
        <DataTable
          ariaLabel="Pagos recientes"
          rows={PAYMENTS}
          pageSize={10}
          searchPlaceholder="Buscar pago…"
          columnToggle
          selected={selected}
          onSelectedChange={setSelected}
          toolbar={
            <Button variant="outline" size="sm" disabled={!selected.length} onClick={() => setSelected([])}>
              <ArchiveIcon data-icon="inline-start" />
              Archivar {selected.length || ""}
            </Button>
          }
          columns={[
            { key: "email", label: "Email" },
            {
              key: "status",
              label: "Estado",
              value: (payment) => PAYMENT_STATUS[payment.status].label,
              render: (payment) => <Badge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</Badge>,
            },
            { key: "amount", label: "Importe", align: "end", render: (payment) => <span className="font-medium">{euros.format(payment.amount)}</span> },
            {
              key: "actions",
              label: "",
              render: (payment) => (
                <Button variant="ghost" size="icon-sm" aria-label={`Copiar el id de ${payment.id}`} onClick={() => void navigator.clipboard.writeText(payment.id)}>
                  <CopyIcon />
                </Button>
              ),
            },
          ]}
        />
      </Block>
    </div>
  );
}

function BreadcrumbShowcase() {
  return (
    <Block title="Breadcrumb: navegación de contexto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Inicio</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<a href="/shopify" />}>Shopify</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/shopify/productos">Productos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Producto actual</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Inicio</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Detalle de campaña</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </Block>
  );
}

function BubbleShowcase() {
  return (
    <Block title="Bubble: mensajes y reacciones">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-3">
        <Bubble align="end">
          <BubbleContent>Hola, ¿puedes revisar el rendimiento de la tienda?</BubbleContent>
        </Bubble>
        <BubbleGroup>
          <Bubble variant="muted">
            <BubbleContent>Claro. He revisado los datos del último periodo.</BubbleContent>
          </Bubble>
          <Bubble variant="muted">
            <BubbleContent>
              La conversión mejoró, aunque el abandono en móvil sigue siendo la principal oportunidad.
            </BubbleContent>
            <BubbleReactions role="img" aria-label="Reacción: pulgar arriba">
              <span>👍</span>
            </BubbleReactions>
          </Bubble>
        </BubbleGroup>
        <Bubble align="end">
          <BubbleContent>Perfecto, prepara una recomendación.</BubbleContent>
        </Bubble>
      </div>
    </Block>
  );
}

function ButtonGroupShowcase() {
  const [device, setDevice] = useState("desktop");
  return (
    <Block title="Button Group: acciones hermanas, pegadas">
      <div className="flex flex-wrap items-start gap-6">
        <ButtonGroup aria-label="Navegar por semanas">
          <Button variant="outline" size="icon" aria-label="Semana anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline">Hoy</Button>
          <Button variant="outline" size="icon" aria-label="Semana siguiente"><ChevronRightIcon /></Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Acciones de un elemento">
          <ButtonGroup>
            <Button variant="outline"><ArchiveIcon data-icon="inline-start" />Archivar</Button>
            <Button variant="outline">Marcar como leído</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline" size="icon" aria-label="Más opciones"><MoreHorizontalIcon /></Button>
          </ButtonGroup>
        </ButtonGroup>
        <ButtonGroup aria-label="Vista del calendario">
          <ButtonGroupText>Vista</ButtonGroupText>
          <Button variant="outline">Semana</Button>
          <Button variant="outline">Mes</Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Portapapeles">
          <Button variant="secondary"><CopyIcon data-icon="inline-start" />Copiar</Button>
          <ButtonGroupSeparator />
          <Button variant="secondary">Pegar</Button>
        </ButtonGroup>
        <ButtonGroup orientation="vertical" aria-label="Controles de zoom">
          <Button variant="outline" size="icon" aria-label="Acercar"><PlusIcon /></Button>
          <Button variant="outline" size="icon" aria-label="Alejar"><MinusIcon /></Button>
        </ButtonGroup>
        <ToggleGroup aria-label="Ancho de la vista" value={device} onValueChange={setDevice}>
          <ToggleGroupItem value="mobile">Móvil</ToggleGroupItem>
          <ToggleGroupItem value="tablet">Tablet</ToggleGroupItem>
          <ToggleGroupItem value="desktop">Escritorio</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </Block>
  );
}

function RadioGroupShowcase() {
  const [density, setDensity] = useState("comfortable");
  const [plan, setPlan] = useState("plus");
  const [channel, setChannel] = useState("email");
  return (
    <div className="grid gap-6">
      <Block title="Lista: el texto al lado del radio">
        <RadioGroup aria-label="Densidad" value={density} onValueChange={setDensity} className="w-fit">
          <RadioGroupItem value="default">Normal</RadioGroupItem>
          <RadioGroupItem value="comfortable">Cómoda</RadioGroupItem>
          <RadioGroupItem value="compact">Compacta</RadioGroupItem>
        </RadioGroup>
      </Block>
      <Block title="Con descripción (Field horizontal)">
        <RadioGroup aria-label="Densidad con descripción" value={density} onValueChange={setDensity} className="max-w-sm">
          {(
            [
              ["default", "Normal", "El espacio de casi toda la app."],
              ["comfortable", "Cómoda", "Más aire entre los elementos."],
              ["compact", "Compacta", "Lo justo, para tablas densas."],
            ] as const
          ).map(([value, label, description]) => (
            <Field key={value} orientation="horizontal">
              <RadioGroupItem value={value} />
              <FieldContent>
                <FieldLabel>{label}</FieldLabel>
                <FieldDescription>{description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </RadioGroup>
      </Block>
      <Block title="Tarjetas de elección (RadioCard), con logo y deshabilitada">
        <RadioGroup aria-label="Plan" value={plan} onValueChange={setPlan} className="max-w-xl gap-2 sm:grid-cols-2">
          <RadioCard value="plus" title="Plus" description="Para una tienda y su consultor." />
          <RadioCard value="pro" title="Pro" description="Varias tiendas en la misma cuenta." />
          <RadioCard value="partner" media={<ProviderIcon provider="shopify" />} title="Partner de Shopify" description="Con la app pública ya instalada." />
          <RadioCard value="enterprise" disabled title="Enterprise" description="Disponible más adelante." />
        </RadioGroup>
      </Block>
      <Block title="Fieldset, en fila y con error">
        <FieldSet className="max-w-md">
          <FieldLegend variant="label">Canal de la campaña</FieldLegend>
          <RadioGroup orientation="horizontal" value={channel} onValueChange={setChannel}>
            <RadioGroupItem value="email">Email</RadioGroupItem>
            <RadioGroupItem value="meta">Meta Ads</RadioGroupItem>
            <RadioGroupItem value="sms" aria-invalid>SMS</RadioGroupItem>
          </RadioGroup>
          <FieldDescription>El SMS no está conectado en esta tienda.</FieldDescription>
        </FieldSet>
      </Block>
    </div>
  );
}

function ToggleGroupShowcase() {
  const [period, setPeriod] = useState(30);
  const [view, setView] = useState("grid");
  const [filter, setFilter] = useState("open");
  const [align, setAlign] = useState("left");
  return (
    <div className="grid gap-6">
      <Block title="Pegado: periodo y vista (2-4 opciones)">
        <div className="flex flex-wrap items-center gap-4">
          <ToggleGroup aria-label="Periodo" value={period} onValueChange={setPeriod}>
            {[7, 30, 90, 365].map((days) => (
              <ToggleGroupItem key={days} value={days}>{days === 365 ? "1 año" : `${days} días`}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup aria-label="Vista" value={view} onValueChange={setView}>
            <ToggleGroupItem value="grid">Tarjetas</ToggleGroupItem>
            <ToggleGroupItem value="table">Tabla</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup aria-label="Alineación" value={align} onValueChange={setAlign}>
            <ToggleGroupItem value="left" size="icon-sm" aria-label="Alinear a la izquierda"><AlignLeftIcon /></ToggleGroupItem>
            <ToggleGroupItem value="center" size="icon-sm" aria-label="Alinear al centro"><AlignCenterIcon /></ToggleGroupItem>
            <ToggleGroupItem value="right" size="icon-sm" aria-label="Alinear a la derecha"><AlignRightIcon /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Block>
      <Block title="Suelto (spacing): filtros con cifra, saltan de línea">
        <ToggleGroup aria-label="Estado" spacing={1.5} value={filter} onValueChange={setFilter}>
          {(
            [
              ["open", "Abiertas", 12],
              ["in_progress", "En curso", 4],
              ["completed", "Completadas", 31],
              ["ignored", "Ignoradas", 2],
              ["all", "Todas", 49],
            ] as const
          ).map(([value, label, total]) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
              <span className="text-xs text-muted tabular-nums">{total}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Block>
    </div>
  );
}

function CalendarShowcase() {
  const [date, setDate] = useState("");
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [dateTime, setDateTime] = useState("");
  const [time, setTime] = useState("10:30");
  const [inlineDate, setInlineDate] = useState<Date | undefined>(new Date());
  const [inlineRange, setInlineRange] = useState<DateRange | undefined>();

  return (
    <Block title="Calendario: fecha y periodo">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fecha individual" hint="Selector de mes y año con fechas en español.">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Rango de fechas" hint="Dos meses visibles para elegir el inicio y el final.">
          <DateRangePicker value={range} onChange={setRange} />
        </Field>
        <Field label="Fecha y hora" hint="Sustituye a datetime-local: valor yyyy-MM-ddTHH:mm.">
          <DateTimePicker value={dateTime} onChange={setDateTime} />
        </Field>
        <Field label="Hora">
          <TimeInput className="w-28" value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-8 border-t border-separator pt-5">
        <div className="grid content-start gap-2">
          <p className="text-sm font-medium">Calendario individual · mes y año</p>
          <Calendar mode="single" selected={inlineDate} onSelect={setInlineDate} captionLayout="dropdown" className="w-fit rounded-md border border-separator p-3" />
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-medium">Rango · dos meses</p>
          <Calendar mode="range" selected={inlineRange} onSelect={setInlineRange} numberOfMonths={2} captionLayout="dropdown" className="w-fit rounded-md border border-separator p-3" />
        </div>
      </div>
    </Block>
  );
}

const BADGE_VARIANTS: Array<{ variant: BadgeVariant; use: string }> = [
  { variant: "default", use: "Etiqueta destacada o categoría principal" },
  { variant: "secondary", use: "Información secundaria y valores de ranking" },
  { variant: "destructive", use: "Error o estado que requiere atención inmediata" },
  { variant: "outline", use: "Categoría neutral con énfasis bajo" },
  { variant: "ghost", use: "Etiqueta integrada sobre superficies de color" },
  { variant: "link", use: "Badge que comunica navegación" },
];

function BadgesShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Badge: variantes y cuándo usarlas">
        {BADGE_VARIANTS.map(({ variant, use }) => (
          <div key={variant} className="grid items-center gap-3 sm:grid-cols-[8rem_12rem_1fr]">
            <code className="text-sm">{variant}</code>
            <Badge variant={variant}>{variant === "default" ? "Badge" : variant}</Badge>
            <p className="text-sm text-muted">{use}</p>
          </div>
        ))}
      </Block>

      <Block title="Con icono, spinner y enlace">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary"><BadgeCheck data-icon="inline-start" /> Verificado</Badge>
          <Badge variant="outline">Guardado <BookmarkIcon data-icon="inline-end" /></Badge>
          <Badge variant="destructive"><Spinner size="sm" data-icon="inline-start" /> Eliminando</Badge>
          <Badge variant="secondary">Generando <Spinner size="sm" data-icon="inline-end" /></Badge>
          <Badge variant="link" render={<a href="#badge-link">Abrir enlace <ArrowUpRightIcon data-icon="inline-end" /></a>} />
        </div>
      </Block>

      <Block title="Tonos semánticos usados por la aplicación">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Pendiente</Badge>
          <Badge tone="brand">Sincronizando</Badge>
          <Badge tone="success">Conectado</Badge>
          <Badge tone="warn">Credenciales pendientes</Badge>
          <Badge tone="danger">Conexión con errores</Badge>
          <Badge tone="success" variant="solid">Publicado</Badge>
        </div>
      </Block>

      <Block title="Badges actuales: integraciones, runtime y canales">
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="connected" healthStatus="healthy" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="syncing" />
          <IntegrationStatusBadge available={false} configurationStatus="not_implemented" />
          <IntegrationStatusBadge available configurationStatus="credentials_missing" />
          <IntegrationStatusBadge available configurationStatus="feature_disabled" />
          <IntegrationStatusBadge available configurationStatus="configured" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="connected" healthStatus="stale" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="connected" healthStatus="degraded" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="connected" healthStatus="reauthorization_required" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="error" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="revoked" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="pending" />
          <IntegrationStatusBadge available configurationStatus="configured" connectionStatus="disconnected" />
          <AgentRuntimeStatusBadge orchestrationMode="langgraph" langsmithTracing />
          <AgentRuntimeStatusBadge orchestrationMode="direct" langsmithTracing={false} />
          <ChannelBadge channel="email_klaviyo" />
          <ChannelBadge channel="meta_ads" />
          <ChannelBadge channel="instagram_organic" />
          <Badge tone="success">Por encima de la media</Badge>
          <Badge tone="neutral">En la media</Badge>
          <Badge tone="warn">En el 35% peor</Badge>
          <Badge tone="warn">En el 20% peor</Badge>
          <Badge tone="danger">En el 10% peor</Badge>
          <Badge tone="neutral">Sin volumen para juzgar</Badge>
          <Badge tone="neutral">Meta no se ha pronunciado</Badge>
          <Badge tone="neutral">Imagen · En cola</Badge>
          <Badge tone="brand">Imagen · Analizando</Badge>
          <Badge tone="success">Imagen · Analizada</Badge>
          <Badge tone="danger">Imagen · Error</Badge>
          <Badge tone="success">Al día</Badge>
          <Badge tone="neutral">Vigilar</Badge>
          <Badge tone="warn">Revisar</Badge>
          <Badge tone="danger">Urgente</Badge>
        </div>
      </Block>

      <Block title="Contador de notificaciones">
        <div className="flex flex-wrap items-center gap-8 p-2">
          <NotificationBadge count={3}>
            <Button variant="outline" size="icon" aria-label="Notificaciones (3)"><BellIcon /></Button>
          </NotificationBadge>
          <NotificationBadge count={128} variant="secondary">
            <Button variant="outline" size="icon" aria-label="Mensajes (128)"><MailIcon /></Button>
          </NotificationBadge>
          <NotificationBadge count={12} variant="destructive" size="sm">
            <Button variant="outline" size="sm">Alertas</Button>
          </NotificationBadge>
          <NotificationBadge>
            <Button variant="outline" size="icon" aria-label="Novedades"><SparklesIcon /></Button>
          </NotificationBadge>
        </div>
      </Block>

      <Block title="Colores personalizados por canal">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="ghost" className="border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Email</Badge>
          <Badge variant="ghost" className="border-transparent bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">Verde</Badge>
          <Badge variant="ghost" className="border-transparent bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">Sky</Badge>
          <Badge variant="ghost" className="border-transparent bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Purple</Badge>
          <Badge variant="ghost" className="border-transparent bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">Red</Badge>
        </div>
      </Block>
    </div>
  );
}

function ButtonsShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Variantes">
        {VARIANTS.map(({ variant, use }) => (
          <div key={variant} className="grid items-center gap-3 sm:grid-cols-[10rem_14rem_1fr]">
            <code className="text-sm">{variant}</code>
            <div className="flex items-center gap-2">
              <Button variant={variant}>Botón</Button>
              <Button variant={variant} size="icon" aria-label="Enviar">
                <ArrowUpIcon />
              </Button>
            </div>
            <p className="text-sm text-muted">{use}</p>
          </div>
        ))}
      </Block>

      <Block title="Tamaños">
        <div className="flex flex-wrap items-start gap-8">
          {SIZES.map(({ size, icon, label }) => (
            <div key={size} className="grid gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size={size}>Botón</Button>
                <Button variant="outline" size={icon} aria-label="Abrir">
                  <ArrowUpRightIcon />
                </Button>
              </div>
              <code className="text-xs text-muted">{label}</code>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Con icono, redondo, cargando y deshabilitado">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <GitBranchIcon data-icon="inline-start" /> Nueva rama
          </Button>
          <Button variant="outline">
            Fork <GitForkIcon data-icon="inline-end" />
          </Button>
          <Button className="rounded-full">Empezar</Button>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Subir">
            <ArrowUpIcon />
          </Button>
          <Button variant="outline" disabled>
            <Spinner size="sm" /> Generando
          </Button>
          <Button variant="secondary" disabled>
            Descargando <Spinner size="sm" />
          </Button>
          <Button variant="secondary">
            <SparklesIcon data-icon="inline-start" /> Preguntar por qué
          </Button>
          <Button variant="destructive">
            <Trash2Icon data-icon="inline-start" /> Eliminar
          </Button>
          <Button disabled>Deshabilitado</Button>
        </div>
      </Block>

      <Block title="Enlace con forma de botón (ButtonLink)">
        <div className="flex flex-wrap items-center gap-2">
          {(["default", "secondary", "outline", "ghost", "link"] as const).map((variant) => (
            <ButtonLink key={variant} href="/componentes" variant={variant}>
              {variant}
            </ButtonLink>
          ))}
        </div>
      </Block>

      <Block title="En un diálogo">
        <div className="grid items-center gap-3 sm:grid-cols-[14rem_1fr]" data-slot="modal-dialog">
          <p className="text-sm font-medium">Dentro de un diálogo</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm">Cancelar</Button>
            <Button variant="secondary" size="sm">Guardar borrador</Button>
            <Button size="sm">Guardar</Button>
          </div>
        </div>
      </Block>
    </div>
  );
}

const FAQ = [
  { value: "datos", trigger: "¿De dónde salen las cifras?", content: "De las integraciones conectadas (Shopify, Meta, Klaviyo), sincronizadas cada día." },
  { value: "ia", trigger: "¿La IA cambia algo sola?", content: "No. Lee y propone; lo que escribe en la tienda pasa antes por el consultor." },
  { value: "plan", trigger: "Función del plan superior", content: "Solo disponible en el plan superior.", disabled: true },
];

type FileTreeItem = { name: string } | { name: string; items: FileTreeItem[] };

const FILE_TREE: FileTreeItem[] = [
  { name: "Campañas", items: [{ name: "Black Friday", items: [{ name: "brief.pdf" }, { name: "asuntos.docx" }] }, { name: "plan-noviembre.xlsx" }] },
  { name: "Marca", items: [{ name: "logo.svg" }, { name: "guía-de-estilo.pdf" }] },
  { name: "informe-octubre.pdf" },
];

function FileTreeNode({ item }: { item: FileTreeItem }) {
  if (!("items" in item)) {
    return <Button variant="ghost" size="sm" className="w-full justify-start font-normal"><FileIcon className="text-muted" />{item.name}</Button>;
  }
  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="group w-full justify-start" />}>
        <ChevronRightIcon className="text-muted transition-transform group-data-[state=open]:rotate-90" />
        <FolderIcon className="text-muted" />
        {item.name}
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-5 mt-1 grid gap-1">
        {item.items.map((child) => <FileTreeNode key={child.name} item={child} />)}
      </CollapsibleContent>
    </Collapsible>
  );
}

const ORDER_LINES = ["2 × Champú sólido", "1 × Acondicionador", "1 × Neceser de algodón", "3 × Muestras de sérum"];

function CollapsibleShowcase() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <Block title="Collapsible: un bloque que se abre y se cierra">
      <div className="flex flex-wrap items-start gap-8">
        <Collapsible className="grid w-[22rem] max-w-full gap-2">
          <div className="flex items-center justify-between gap-4 px-4">
            <h4 className="text-sm font-semibold">Pedido #4189</h4>
            <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ver detalles del pedido" />}>
              <ChevronsUpDownIcon />
            </CollapsibleTrigger>
          </div>
          <div className="flex items-center justify-between rounded-md border border-separator px-4 py-2 text-sm">
            <span className="text-muted">Estado</span>
            <span className="font-medium">Enviado</span>
          </div>
          <CollapsibleContent className="grid gap-2">
            <div className="rounded-md border border-separator px-4 py-2 text-sm">
              <p className="font-medium">Dirección de envío</p>
              <p className="text-muted">Calle Mayor 12, Madrid</p>
            </div>
            <div className="rounded-md border border-separator px-4 py-2 text-sm">
              <p className="font-medium">Artículos</p>
              <p className="text-muted">2 × Auriculares de estudio</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="flex w-[18rem] max-w-full items-start gap-2 rounded-md border border-separator p-4">
          <FieldSet className="grid flex-1 grid-cols-2 gap-2">
            <FieldLegend variant="label" className="mb-2">Margen interior (px)</FieldLegend>
            <Input aria-label="Arriba" placeholder="Arriba" defaultValue="16" />
            <Input aria-label="Abajo" placeholder="Abajo" defaultValue="16" />
            <CollapsibleContent className="col-span-2 grid grid-cols-2 gap-2 pt-0.5">
              <Input aria-label="Izquierda" placeholder="Izquierda" defaultValue="24" />
              <Input aria-label="Derecha" placeholder="Derecha" defaultValue="24" />
            </CollapsibleContent>
          </FieldSet>
          <CollapsibleTrigger render={<Button variant="outline" size="icon" aria-label={settingsOpen ? "Menos lados" : "Todos los lados"} />} className="mt-7">
            {settingsOpen ? <MinimizeIcon /> : <MaximizeIcon />}
          </CollapsibleTrigger>
        </Collapsible>

        <div className="grid w-[16rem] max-w-full gap-1 rounded-md border border-separator p-2">
          {FILE_TREE.map((item) => <FileTreeNode key={item.name} item={item} />)}
        </div>

        <Collapsible className="w-[18rem] max-w-full text-sm">
          <p className="mb-2 font-medium">Lista recortada</p>
          <ul className="grid gap-1">{ORDER_LINES.slice(0, 2).map((line) => <li key={line}>{line}</li>)}</ul>
          <CollapsibleContent>
            <ul className="grid gap-1 pt-1">{ORDER_LINES.slice(2).map((line) => <li key={line}>{line}</li>)}</ul>
          </CollapsibleContent>
          <CollapsibleMore count={ORDER_LINES.length - 2} className="-ml-3 mt-1" />
        </Collapsible>
      </div>
    </Block>
  );
}

function AccordionShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Acordeón: uno abierto a la vez (por defecto)">
        <Accordion defaultValue={["datos"]} className="max-w-lg">
          {FAQ.map((item) => (
            <AccordionItem key={item.value} value={item.value} disabled={item.disabled}>
              <AccordionTrigger>{item.trigger}</AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Block>
      <Block title="Varios abiertos (multiple) y con borde">
        <Accordion multiple defaultValue={["datos", "ia"]} className="max-w-lg rounded-lg border border-separator">
          {FAQ.slice(0, 2).map((item) => (
            <AccordionItem key={item.value} value={item.value} className="px-4">
              <AccordionTrigger>{item.trigger}</AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Block>
    </div>
  );
}

/** Miniatura neutra para el catálogo: no depende de imágenes externas. */
const SAMPLE_IMAGE = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0eefc"/><stop offset="1" stop-color="#6256c9"/></linearGradient></defs><rect width="4" height="3" fill="url(#g)"/></svg>',
);

function AttachmentShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Adjunto: estados de la subida">
        <div className="grid max-w-sm gap-2">
          <Attachment state="idle">
            <AttachmentMedia><ClockIcon /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>archivo-elegido.pdf</AttachmentTitle>
              <AttachmentDescription>Listo para subir</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions><AttachmentAction aria-label="Quitar archivo-elegido.pdf"><XIcon /></AttachmentAction></AttachmentActions>
          </Attachment>
          <Attachment state="uploading">
            <AttachmentMedia><Spinner size="sm" /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>catalogo-otono.zip</AttachmentTitle>
              <AttachmentDescription>Subiendo · 64 %</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions><AttachmentAction aria-label="Cancelar la subida"><XIcon /></AttachmentAction></AttachmentActions>
          </Attachment>
          <Attachment state="processing">
            <AttachmentMedia><FileTextIcon /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>estudio-de-mercado.pdf</AttachmentTitle>
              <AttachmentDescription>Analizando el documento</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment state="error">
            <AttachmentMedia><FileWarningIcon /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>modelo-financiero.xlsx</AttachmentTitle>
              <AttachmentDescription>No se ha podido subir. Reinténtalo.</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label="Reintentar la subida"><RefreshCwIcon /></AttachmentAction>
              <AttachmentAction aria-label="Quitar modelo-financiero.xlsx"><XIcon /></AttachmentAction>
            </AttachmentActions>
          </Attachment>
          <Attachment state="done">
            <AttachmentMedia><CheckIcon /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>informe-octubre.pdf</AttachmentTitle>
              <AttachmentDescription>Subido · 1,8 MB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      </Block>
      <Block title="Tamaños: default, sm y xs">
        <div className="grid max-w-sm gap-2">
          {(["default", "sm", "xs"] as const).map((size) => (
            <Attachment key={size} size={size}>
              <AttachmentMedia><FileTextIcon /></AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Adjunto {size}</AttachmentTitle>
                <AttachmentDescription>PDF · 2,4 MB</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          ))}
        </div>
      </Block>
      <Block title="Imágenes en fila (AttachmentGroup, vertical, con trigger)">
        <AttachmentGroup className="max-w-xl">
          {["portada-otono.png", "producto-estrella.jpg", "banner-rebajas.webp", "lookbook.png"].map((name) => (
            <Attachment key={name} orientation="vertical">
              <AttachmentMedia variant="image"><img src={SAMPLE_IMAGE} alt="" /></AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{name}</AttachmentTitle>
                <AttachmentDescription>PNG · 820 KB</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions><AttachmentAction aria-label={`Quitar ${name}`}><XIcon /></AttachmentAction></AttachmentActions>
              <AttachmentTrigger aria-label={`Abrir ${name}`} />
            </Attachment>
          ))}
          <Attachment className="w-64">
            <AttachmentMedia><TableIcon /></AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>clientes.csv</AttachmentTitle>
              <AttachmentDescription>CSV · 18 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </AttachmentGroup>
      </Block>
    </div>
  );
}

function AlertShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Aviso: un tono por uso (Banner)">
        <Banner tone="info" title="Tienes cambios sin guardar de otra sesión">
          Se quedaron en este navegador el 24 de octubre a las 18:10.
        </Banner>
        <Banner tone="success" title="Pago recibido">
          Tu plan se activa en unos segundos.
        </Banner>
        <Banner tone="warn" title="Esta conexión lee, pero no puede publicar plantillas">
          Para enviar a Klaviyo las piezas aprobadas, vuelve a conectarla aceptando todos los permisos.
        </Banner>
        <Banner tone="danger" title="Falta el permiso para leer eventos">
          Sin él la sincronización seguirá fallando. Vuelve a conectar Klaviyo y acepta el permiso de eventos.
        </Banner>
      </Block>
      <Block title="Con acción y error de carga (ErrorBlock con onRetry)">
        <Banner tone="warn" title="Tu plan está en pausa" action={<Button size="sm" variant="secondary">Ver mi plan</Button>}>
          Mientras no esté activo, las funciones del plan se quedan paradas.
        </Banner>
        <ErrorBlock onRetry={() => undefined}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock>
      </Block>
      <Block title="Piezas sueltas (Alert, AlertTitle, AlertDescription, AlertAction)">
        <Alert>
          <SparklesIcon />
          <AlertTitle>La IA dejó una pieza a medias</AlertTitle>
          <AlertDescription>Se cortó antes de terminar. Puedes recuperar lo que llegó a hacer.</AlertDescription>
          <AlertAction>
            <Button size="sm">Recuperarla</Button>
          </AlertAction>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Sin icono también vale</AlertTitle>
          <AlertDescription>El texto ocupa todo el ancho.</AlertDescription>
        </Alert>
      </Block>
    </div>
  );
}

function AlertDialogShowcase() {
  return (
    <Block title="Diálogo de alerta: normal, pequeño y destructivo con frase">
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline">Normal con icono</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <ArchiveIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Archivar el camino actual?</AlertDialogTitle>
              <AlertDialogDescription>Sus tareas siguen disponibles en Tareas. Después podrás crear uno nuevo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction>Archivar camino</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline">Pequeño (sm)</Button>} />
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Undo2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
              <AlertDialogDescription>Se pierden las ediciones sin guardar.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <AlertDialogAction variant="destructive">Descartar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Destructivo con frase</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-danger/10 text-danger">
                <Trash2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Eliminar la tienda de prueba?</AlertDialogTitle>
              <AlertDialogDescription>Borra todo al instante. No hay vuelta atrás.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogConfirmPhrase phrase="tienda de prueba" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}>
                Eliminar definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Block>
  );
}

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

function DialogShowcase() {
  const [name, setName] = useState("Pedro Duarte");
  const [busy, setBusy] = useState(false);
  return (
    <Block title="Diálogo: formulario, cerrar propio, sin X, pie fijo, contenido con scroll y cambios sin guardar">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Formulario</Button>} />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar perfil</DialogTitle>
              <DialogDescription>Cambia tus datos y pulsa guardar cuando acabes.</DialogDescription>
            </DialogHeader>
            <form id="dialog-demo-form" className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
              <Field label="Nombre">
                <Input name="name" defaultValue="Pedro Duarte" />
              </Field>
              <Field label="Usuario">
                <Input name="username" defaultValue="@peduarte" />
              </Field>
            </form>
            <DialogFooter>
              <DialogClose>Cancelar</DialogClose>
              <Button type="submit" form="dialog-demo-form">Guardar cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Compartir</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Compartir enlace</DialogTitle>
              <DialogDescription>Quien tenga este enlace podrá verlo.</DialogDescription>
            </DialogHeader>
            <Input aria-label="Enlace" defaultValue="https://app.e-nora.com/informes/abc123" readOnly />
            <DialogFooter className="sm:justify-start">
              <DialogClose render={<Button />}>Cerrar</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Sin botón de cerrar</Button>} />
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Sin botón de cerrar</DialogTitle>
              <DialogDescription>Este diálogo no lleva la X de la esquina. Se cierra con Escape o pulsando fuera.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Pie fijo</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pie fijo</DialogTitle>
              <DialogDescription>Las acciones quedan visibles mientras el contenido se desplaza.</DialogDescription>
            </DialogHeader>
            <div className="no-scrollbar -mx-4 max-h-[50vh] overflow-y-auto px-4 sm:-mx-6 sm:px-6">
              {Array.from({ length: 10 }).map((_, index) => (
                <p key={index} className="mb-4 leading-normal">{LOREM}</p>
              ))}
            </div>
            <DialogFooter>
              <DialogClose>Cerrar</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Contenido con scroll</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contenido con scroll</DialogTitle>
              <DialogDescription>El texto largo se desplaza y la cabecera queda a la vista.</DialogDescription>
            </DialogHeader>
            <div className="no-scrollbar -mx-4 max-h-[50vh] overflow-y-auto px-4 sm:-mx-6 sm:px-6">
              {Array.from({ length: 10 }).map((_, index) => (
                <p key={index} className="mb-4 leading-normal">{LOREM}</p>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog busy={busy} dirty={name !== "Pedro Duarte"} onOpenChange={(open) => !open && setName("Pedro Duarte")}>
          <DialogTrigger render={<Button variant="outline">Cambios sin guardar</Button>} />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Renombrar</DialogTitle>
              <DialogDescription>Cambia el nombre y cierra sin guardar: pregunta antes de descartar. Guardando no se puede cerrar.</DialogDescription>
            </DialogHeader>
            <Field label="Nombre">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <DialogFooter>
              <DialogClose>Cancelar</DialogClose>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setTimeout(() => setBusy(false), 1200);
                }}
              >
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Block>
  );
}

function AvatarShowcase() {
  return (
    <Block title="Avatar: tamaños, insignia y grupo">
      <div className="flex flex-wrap items-center gap-6">
        <Avatar size="sm">
          <AvatarFallback>{avatarInitials("Ana García")}</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg" alt="" />
          <AvatarFallback>{avatarInitials("Rafa Borrego")}</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarImage src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg" alt="" />
          <AvatarFallback>{avatarInitials("Lucía Pérez")}</AvatarFallback>
          <AvatarBadge />
        </Avatar>
        <Avatar size="lg">
          <AvatarImage src="https://example.invalid/rota.jpg" alt="" />
          <AvatarFallback>{avatarInitials("Foto que no carga")}</AvatarFallback>
        </Avatar>
        <AvatarGroup>
          {["purple", "red", "orange"].map((color, index) => (
            <Avatar key={color}>
              <AvatarImage src={`https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${color}.jpg`} alt="" />
              <AvatarFallback>{avatarInitials(["Marta Ruiz", "Iván Sanz", "Eva Gil"][index])}</AvatarFallback>
            </Avatar>
          ))}
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
      </div>
    </Block>
  );
}

const SEND_SLOTS = [
  { value: "asap", label: "Ahora mismo", description: "Sale en cuanto lo apruebes", badge: "Más rápido" },
  { value: "09-00", label: "Mañana · 09:00", description: "Antes de que abran el correo del trabajo" },
  { value: "13-30", label: "Mañana · 13:30", description: "Pausa de la comida" },
  { value: "20-00", label: "Mañana · 20:00", description: "La franja con más aperturas de la tienda" },
  { value: "sat", label: "Sábado · 10:00", description: "Último envío antes del fin de semana" },
];

function DrawerSlab({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-surface group-data-[swipe-axis=x]/drawer-popup:size-full group-data-[swipe-axis=y]/drawer-popup:w-full",
        tall ? "group-data-[swipe-axis=y]/drawer-popup:h-80" : "group-data-[swipe-axis=y]/drawer-popup:aspect-video",
      )}
    />
  );
}

function NestedDrawer({ level, direction, isDesktop }: { level: number; direction: DrawerSwipeDirection; isDesktop: boolean }) {
  return (
    <Drawer showSwipeHandle={!isDesktop} swipeDirection={direction}>
      <DrawerTrigger render={<Button variant={level === 1 ? "secondary" : "outline"}>{level === 1 ? "Anidados" : `Abrir el ${level}.º`}</Button>} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{level === 1 ? "Cajón" : `Cajón ${level}`}</DrawerTitle>
          <DrawerDescription>
            {level < 4 ? "Abre otro desde el mismo lado: este se queda detrás." : "El de delante del todo; tres detrás."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 p-4">
          <DrawerSlab />
        </div>
        <DrawerFooter>
          {level < 4 ? <NestedDrawer level={level + 1} direction={direction} isDesktop={isDesktop} /> : null}
          <DrawerClose render={<Button variant="outline">Cerrar</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function DrawerShowcase() {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState("asap");
  const [profileOpen, setProfileOpen] = useState(false);
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const responsive = { swipeDirection: (isDesktop ? "right" : "down") as DrawerSwipeDirection, showSwipeHandle: !isDesktop };

  const profileForm = (
    <form className="grid items-start gap-6" onSubmit={(event) => { event.preventDefault(); setProfileOpen(false); }}>
      <Field label="Email">
        <Input type="email" defaultValue="rafa@ecomscaling.com" />
      </Field>
      <Field label="Nombre">
        <Input defaultValue="Rafa Borrego" />
      </Field>
      <Button type="submit">Guardar cambios</Button>
    </form>
  );

  return (
    <Block title="Cajón: ejemplo, lados, asa, anidados, no modal, snap points, responsive y cambios sin guardar">
      <div className="flex flex-wrap items-center gap-2">
        <Drawer open={open} onOpenChange={setOpen} {...responsive}>
          <DrawerTrigger render={<Button variant="secondary">Abrir cajón</Button>} />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Elige cuándo sale la campaña</DrawerTitle>
              <DrawerDescription>La programamos en Klaviyo en cuanto confirmes.</DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="flex-1 p-4"><FieldSet className="content-start gap-2">
              <FieldLegend className="sr-only">Franja de envío</FieldLegend>
              <RadioGroup value={slot} onValueChange={setSlot} className="gap-2">
                {SEND_SLOTS.map((option) => (
                  <RadioCard
                    key={option.value}
                    value={option.value}
                    title={
                      <>
                        {option.label}
                        {option.badge ? <Badge>{option.badge}</Badge> : null}
                      </>
                    }
                    description={option.description}
                  />
                ))}
              </RadioGroup>
            </FieldSet></ScrollArea>
            <DrawerFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  toast.success(`Envío programado: ${SEND_SLOTS.find((option) => option.value === slot)?.label}`);
                }}
              >
                Confirmar franja
              </Button>
              <DrawerClose render={<Button variant="outline">Cancelar</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {(["up", "right", "down", "left"] as const).map((direction) => (
          <Drawer key={direction} swipeDirection={direction}>
            <DrawerTrigger render={<Button variant="outline">{{ up: "Arriba", right: "Derecha", down: "Abajo", left: "Izquierda" }[direction]}</Button>} />
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Sale por {{ up: "arriba", right: "la derecha", down: "abajo", left: "la izquierda" }[direction]}</DrawerTitle>
                <DrawerDescription>Arrástralo hacia su borde para cerrarlo.</DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 p-4">
                <DrawerSlab tall />
              </div>
              <DrawerFooter>
                <DrawerClose render={<Button variant="outline">Cerrar</Button>} />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ))}

        <Drawer showSwipeHandle>
          <DrawerTrigger render={<Button variant="outline">Con asa</Button>} />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Cajón con asa</DrawerTitle>
              <DrawerDescription>Tira del asa o de la cabecera hacia abajo.</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 p-4">
              <DrawerSlab tall />
            </div>
            <DrawerFooter>
              <DrawerClose render={<Button>Cerrar</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <NestedDrawer level={1} direction={responsive.swipeDirection} isDesktop={isDesktop} />

        <Drawer modal={false} disablePointerDismissal swipeDirection="right">
          <DrawerTrigger render={<Button variant="outline">No modal</Button>} />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Cajón no modal</DrawerTitle>
              <DrawerDescription>La página sigue usable detrás; pulsar fuera no lo cierra.</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 p-4">
              <DrawerSlab tall />
            </div>
            <DrawerFooter>
              <DrawerClose render={<Button>Cerrar</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer snapPoints={DRAWER_SNAP_POINTS} showSwipeHandle>
          <DrawerTrigger render={<Button variant="outline">Snap points</Button>} />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Snap points</DrawerTitle>
              <DrawerDescription>Arrástralo entre un vistazo y casi toda la pantalla.</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 p-4">
              <DrawerSlab tall />
            </div>
            <DrawerFooter>
              <DrawerClose render={<Button>Cerrar</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {isDesktop ? (
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogTrigger render={<Button variant="outline">Responsive (diálogo)</Button>} />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar perfil</DialogTitle>
                <DialogDescription>En escritorio es un diálogo; en el móvil, un cajón.</DialogDescription>
              </DialogHeader>
              {profileForm}
            </DialogContent>
          </Dialog>
        ) : (
          <Drawer open={profileOpen} onOpenChange={setProfileOpen}>
            <DrawerTrigger render={<Button variant="outline">Responsive (cajón)</Button>} />
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Editar perfil</DrawerTitle>
                <DrawerDescription>En escritorio es un diálogo; en el móvil, un cajón.</DrawerDescription>
              </DrawerHeader>
              <div className="p-4">{profileForm}</div>
            </DrawerContent>
          </Drawer>
        )}

        <Drawer busy={busy} dirty={Boolean(note.trim())} {...responsive}>
          <DrawerTrigger render={<Button variant="outline">Cambios sin guardar</Button>} />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Nota para el cliente</DrawerTitle>
              <DrawerDescription>Escribe algo y cierra: pregunta antes de descartar. Al guardar, no se puede cerrar.</DrawerDescription>
            </DrawerHeader>
            <div className="grid flex-1 content-start gap-4 p-4">
              <Field label="Nota">
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Revisa el flow de carrito" />
              </Field>
              <Field label="Prioridad">
                <Select
                  aria-label="Prioridad"
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: "baja", label: "Baja" },
                    { value: "normal", label: "Normal" },
                    { value: "alta", label: "Alta" },
                  ]}
                />
              </Field>
            </div>
            <DrawerFooter>
              <Button
                disabled={busy || !note.trim()}
                onClick={() => {
                  setBusy(true);
                  setTimeout(() => {
                    setBusy(false);
                    setNote("");
                    toast.success("Nota guardada");
                  }, 1200);
                }}
              >
                {busy ? "Guardando…" : "Guardar"}
              </Button>
              <DrawerClose render={<Button variant="outline">Cancelar</Button>} />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </Block>
  );
}

const DRAWER_SNAP_POINTS = ["31rem", 1];

// Índice lateral: un enlace por componente, en orden alfabético.
const PLANS = [
  { value: "mensual", label: "Mensual", description: "Pagas cada mes y lo dejas cuando quieras." },
  { value: "anual", label: "Anual", description: "Dos meses gratis frente al mensual." },
];

function FieldShowcase() {
  const [channel, setChannel] = useState("email");
  const [plan, setPlan] = useState("anual");
  return (
    <div className="grid gap-6">
      <Block title="Atajo con ayuda y error (Field label, hint, error)">
        <FieldGroup className="max-w-md">
          <Field label="Nombre de la tienda" hint="Sale en los informes y en los emails.">
            <Input placeholder="Pádel España" />
          </Field>
          <Field label="Email de facturación" error="Escribe un email completo, con dominio.">
            <Input type="email" defaultValue="facturas@" />
          </Field>
          <Field label="Canal del aviso">
            <Select value={channel} onChange={setChannel} options={[{ value: "email", label: "Email" }, { value: "push", label: "Notificación push" }]} />
          </Field>
        </FieldGroup>
      </Block>
      <Block title="FieldSet, FieldLegend, FieldSeparator y casillas">
        <FieldGroup className="max-w-md">
          <FieldSet>
            <FieldLegend>Dirección de facturación</FieldLegend>
            <FieldDescription>La que aparece en tus facturas.</FieldDescription>
            <FieldGroup>
              <Field label="Calle">
                <Input placeholder="Calle Mayor, 1" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ciudad">
                  <Input placeholder="Madrid" />
                </Field>
                <Field label="Código postal">
                  <Input placeholder="28013" />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend variant="label">Avisos por email</FieldLegend>
            <FieldDescription>Elige qué te llega además de lo urgente.</FieldDescription>
            <FieldGroup className="gap-3">
              <Field orientation="horizontal">
                <Checkbox defaultChecked />
                <FieldLabel className="font-normal">Resumen semanal</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox />
                <FieldContent>
                  <FieldLabel>Campañas listas para revisar</FieldLabel>
                  <FieldDescription>Cuando tu consultor deja una campaña esperando tu visto bueno.</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </Block>
      <Block title="Tarjetas de elección (FieldLabel que envuelve un Field)">
        <FieldSet className="max-w-md gap-3">
          <FieldLegend variant="label">Facturación</FieldLegend>
          <RadioGroup value={plan} onValueChange={setPlan} className="gap-3">
            {PLANS.map((option) => (
              <RadioCard key={option.value} value={option.value} title={option.label} description={option.description} />
            ))}
          </RadioGroup>
        </FieldSet>
      </Block>
      <Block title="Responsive: apilado en estrecho, en fila desde 28rem">
        <FieldGroup className="max-w-xl">
          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel>Objetivo de ventas</FieldLabel>
              <FieldDescription>Lo que quieres facturar este mes.</FieldDescription>
            </FieldContent>
            <Input className="sm:max-w-40" inputMode="decimal" placeholder="12.000 €" />
          </Field>
        </FieldGroup>
      </Block>
    </div>
  );
}

function EmptyShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Sección vacía con icono y acciones (EmptyState)">
        <EmptyState
          icon={<FolderIcon />}
          title="Todavía no hay campañas"
          hint="Crea la primera o importa las que ya tienes en Klaviyo."
          action={<><Button>Crear campaña</Button><Button variant="secondary">Importar de Klaviyo</Button></>}
        />
      </Block>
      <Block title="Con contorno (className=&quot;border border-dashed&quot;)">
        <EmptyState
          className="border border-dashed"
          icon={<FileIcon />}
          title="Sin archivos en el banco"
          hint="Sube imágenes o PDF para usarlos en tus emails."
          action={<Button size="sm" variant="secondary">Subir archivos</Button>}
        />
      </Block>
      <Block title="Lista vacía dentro de una tarjeta (size=&quot;sm&quot;)">
        <EmptyState size="sm" title="Sin miembros asignados" />
        <EmptyState size="sm" icon={<BellIcon />} title="Sin actividad por ahora" />
      </Block>
      <Block title="Piezas sueltas con Avatar (Empty, EmptyMedia, EmptyTitle…)">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Avatar size="lg">
                <AvatarFallback>{avatarInitials("Ana García")}</AvatarFallback>
              </Avatar>
            </EmptyMedia>
            <EmptyTitle>Tu consultora no está conectada</EmptyTitle>
            <EmptyDescription>Déjale un mensaje y lo verá en cuanto entre.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Dejar mensaje</Button>
          </EmptyContent>
        </Empty>
      </Block>
    </div>
  );
}

const HOVER_CARD_SIDES = ["left", "top", "bottom", "right"] as const;
const HOVER_CARD_SIDE_LABEL = { left: "Izquierda", top: "Arriba", bottom: "Abajo", right: "Derecha" };

function ProgressShowcase() {
  const [value, setValue] = useState(13);
  useEffect(() => {
    const timer = setTimeout(() => setValue(66), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="grid gap-6">
      <Block title="Sola: <Progress value>">
        <Progress value={value} aria-label="Progreso de ejemplo" className="w-[60%]" />
      </Block>
      <Block title="Con etiqueta y valor (ProgressLabel, ProgressValue)">
        <div className="grid max-w-sm gap-6">
          <Progress value={56}>
            <ProgressLabel>Importación de pedidos</ProgressLabel>
            <ProgressValue />
          </Progress>
          <Progress value={3} max={8}>
            <ProgressLabel>Hitos de la fase</ProgressLabel>
            <ProgressValue>{() => "3 de 8"}</ProgressValue>
          </Progress>
        </div>
      </Block>
    </div>
  );
}

const SCROLL_TAGS = Array.from({ length: 50 }, (_, index) => `v1.2.0-beta.${50 - index}`);
const SCROLL_WORKS = ["Primavera", "Rebajas", "Black Friday", "Navidad", "Reyes", "San Valentín"];

function ScrollAreaShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Vertical: <ScrollArea className=&quot;h-72&quot;>">
        <ScrollArea className="h-72 w-48 rounded-md border border-separator">
          <div className="p-4">
            <h4 className="mb-4 text-sm font-medium leading-none">Etiquetas</h4>
            {SCROLL_TAGS.map((tag) => (
              <div key={tag} className="border-b border-separator py-2 text-sm last:border-0">{tag}</div>
            ))}
          </div>
        </ScrollArea>
      </Block>
      <Block title="Horizontal: el contenido más ancho desliza solo">
        <ScrollArea className="w-full max-w-96 whitespace-nowrap rounded-md border border-separator">
          <div className="flex w-max gap-4 p-4">
            {SCROLL_WORKS.map((work) => (
              <figure key={work} className="shrink-0">
                <div className="flex aspect-[3/4] w-36 items-end rounded-md bg-[var(--nora-gray-100)] p-3 text-sm font-semibold">{work}</div>
                <figcaption className="pt-2 text-xs text-muted">Campaña <span className="font-semibold text-foreground">{work}</span></figcaption>
              </figure>
            ))}
          </div>
        </ScrollArea>
      </Block>
    </div>
  );
}

const FRUITS = [
  { label: "Manzana", value: "apple" },
  { label: "Plátano", value: "banana" },
  { label: "Arándano", value: "blueberry" },
];
const VEGETABLES = [
  { label: "Zanahoria", value: "carrot" },
  { label: "Brócoli", value: "broccoli" },
  { label: "Espinaca", value: "spinach" },
];
const FOOD = [{ label: "Elige un alimento", value: null }, ...FRUITS, ...VEGETABLES];

function SelectShowcase() {
  const [period, setPeriod] = useState("30");
  const [food, setFood] = useState<string | null>(null);
  const [sort, setSort] = useState("revenue");
  return (
    <div className="grid gap-6">
      <Block title="Atajo: <Select value onChange options />">
        <div className="grid max-w-xs gap-4">
          <Field label="Periodo">
            <Select value={period} onChange={setPeriod} options={[{ value: "7", label: "Últimos 7 días" }, { value: "30", label: "Últimos 30 días" }, { value: "90", label: "Últimos 90 días" }, { value: "365", label: "Último año" }]} />
          </Field>
          <Field label="Con secciones (section)">
            <Select value="" onChange={() => undefined} placeholder="Elige una audiencia" options={[{ value: "vip", label: "Clientes VIP", section: "Listas" }, { value: "news", label: "Newsletter", section: "Listas" }, { value: "lapsed", label: "Sin comprar 90 días", section: "Segmentos" }]} />
          </Field>
        </div>
      </Block>
      <Block title="Piezas con grupos (SelectGroup, SelectLabel, SelectSeparator)">
        <Select items={FOOD} value={food} onValueChange={setFood}>
          <SelectTrigger className="max-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Frutas</SelectLabel>
              {FRUITS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Verduras</SelectLabel>
              {VEGETABLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Block>
      <Block title="Estados: desactivado, inválido, pequeño y sin caja (bare)">
        <div className="grid max-w-xs gap-4">
          <Select disabled value="apple" onChange={() => undefined} aria-label="Desactivado" options={FRUITS.map((item) => ({ value: item.value, label: item.label }))} />
          <Field label="Fruta" error="Elige una fruta.">
            <Select value="" onChange={() => undefined} placeholder="Elige una fruta" options={FRUITS.map((item) => ({ value: item.value, label: item.label }))} />
          </Field>
          <Select size="sm" value={sort} onChange={setSort} aria-label="Ordenar" options={[{ value: "revenue", label: "Más ventas" }, { value: "recent", label: "Más recientes" }]} />
          <Select bare className="w-auto" value={sort} onChange={setSort} aria-label="Ordenar sin caja" options={[{ value: "revenue", label: "Más ventas" }, { value: "recent", label: "Más recientes" }]} />
        </div>
      </Block>
    </div>
  );
}

function SeparatorShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Horizontal: <Separator />">
        <div className="flex max-w-sm flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <div className="font-medium leading-none">E-NORA</div>
            <div className="text-muted">El copiloto de tu tienda</div>
          </div>
          <Separator />
          <div>Ventas, campañas y clientes en un solo sitio, con tu consultor al lado.</div>
        </div>
      </Block>
      <Block title="Vertical: <Separator orientation=&quot;vertical&quot; />">
        <div className="flex h-5 items-center gap-4 text-sm">
          <div>Shopify</div>
          <Separator orientation="vertical" />
          <div>Meta</div>
          <Separator orientation="vertical" />
          <div>Klaviyo</div>
        </div>
      </Block>
      <Block title="Lista">
        <div className="flex w-full max-w-sm flex-col gap-2 text-sm">
          {[["Pedidos", "128"], ["Ticket medio", "54,20 €"], ["Recompra", "23 %"]].map(([term, value], index) => (
            <div key={term} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <dl className="flex items-center justify-between">
                <dt>{term}</dt>
                <dd className="text-muted tabular-nums">{value}</dd>
              </dl>
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}

function ResizableShowcase() {
  const pane = "flex h-full items-center justify-center p-6 text-sm font-semibold";
  return (
    <div className="grid gap-6">
      <Block title="Anidados con asa (ResizablePanelGroup, ResizablePanel, ResizableHandle withHandle)">
        <ResizablePanelGroup orientation="horizontal" className="max-w-sm rounded-lg border border-separator">
          <ResizablePanel defaultSize="50%">
            <div className="flex h-[200px] items-center justify-center p-6 text-sm font-semibold">Uno</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="50%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="25%">
                <div className={pane}>Dos</div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="75%">
                <div className={pane}>Tres</div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Block>
      <Block title='Vertical: orientation="vertical"'>
        <ResizablePanelGroup orientation="vertical" className="min-h-[200px] max-w-sm rounded-lg border border-separator">
          <ResizablePanel defaultSize="25%">
            <div className={pane}>Cabecera</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="75%">
            <div className={pane}>Contenido</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Block>
      <Block title='Como el Consultor IA: ancho en rem, mínimo y máximo, recordado (autoSaveId). Doble clic en la línea: vuelve a 26rem'>
        <ResizablePanelGroup autoSaveId="componentes-demo" className="min-h-[220px] rounded-lg border border-separator">
          <ResizablePanel>
            <div className={pane}>Pantalla</div>
          </ResizablePanel>
          <ResizableHandle aria-label="Cambiar el ancho del panel" />
          <ResizablePanel defaultSize="16rem" minSize="12rem" maxSize="60%">
            <div className={cn(pane, "bg-surface")}>Consultor IA</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Block>
    </div>
  );
}

function PopoverShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Cabecera y texto (Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription)">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Ver detalle</PopoverTrigger>
          <PopoverContent align="start">
            <PopoverHeader>
              <PopoverTitle>Tasa de apertura</PopoverTitle>
              <PopoverDescription>Aperturas únicas entre envíos entregados, sin contar las de Apple Mail Privacy.</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </Block>
      <Block title="Con campos: ajustes rápidos que se aplican al momento">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Botón del email</PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <PopoverHeader>
              <PopoverTitle>Botón</PopoverTitle>
              <PopoverDescription>Texto y enlace del botón principal.</PopoverDescription>
            </PopoverHeader>
            <FieldGroup className="gap-4">
              <Field label="Texto"><Input defaultValue="Comprar ahora" /></Field>
              <Field label="Enlace"><Input defaultValue="https://tienda.com/otono" /></Field>
            </FieldGroup>
          </PopoverContent>
        </Popover>
      </Block>
      <Block title="Lado y alineación (side, align)">
        <div className="flex flex-wrap gap-3">
          {(["start", "center", "end"] as const).map((align) => (
            <Popover key={align}>
              <PopoverTrigger render={<Button variant="outline" size="sm" />}>{align}</PopoverTrigger>
              <PopoverContent align={align} className="w-40">Alineado a {align}</PopoverContent>
            </Popover>
          ))}
        </div>
      </Block>
    </div>
  );
}

function HoverCardShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Básico: un enlace con adelanto (HoverCard, HoverCardTrigger, HoverCardContent)">
        <div>
          <HoverCard>
            <HoverCardTrigger delay={10} closeDelay={100} render={<Button variant="link">Iván Sanz</Button>} />
            <HoverCardContent className="w-72">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarImage src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg" alt="" />
                  <AvatarFallback>{avatarInitials("Iván Sanz")}</AvatarFallback>
                </Avatar>
                <div className="grid gap-0.5">
                  <p className="font-medium">Iván Sanz</p>
                  <p>Consultor de 12 tiendas de moda y deporte.</p>
                  <p className="mt-1 text-muted">En E-NORA desde marzo de 2026</p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </Block>
      <Block title="Lados (side) y esperas (delay, closeDelay)">
        <div className="flex flex-wrap justify-center gap-2">
          {HOVER_CARD_SIDES.map((side) => (
            <HoverCard key={side}>
              <HoverCardTrigger delay={100} closeDelay={100} render={<Button variant="outline">{HOVER_CARD_SIDE_LABEL[side]}</Button>} />
              <HoverCardContent side={side}>
                <p className="font-medium">Tarjeta al pasar</p>
                <p className="text-muted">Sale por el lado «{HOVER_CARD_SIDE_LABEL[side].toLowerCase()}» y, si no cabe, por el contrario.</p>
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>
      </Block>
      <Block title="En la app: chips del calendario y fuentes de un análisis">
        <div className="flex flex-wrap items-center gap-6">
          <HoverCard>
            <HoverCardTrigger
              render={
                <a href="#hover-card" className="inline-flex items-center gap-2 rounded-md border border-accent bg-background px-2 py-1 text-xs font-medium no-underline">
                  <span className="tabular-nums text-accent">10:00</span> Revisión mensual
                </a>
              }
            />
            <HoverCardContent side="right" align="start">
              <p className="font-medium">Revisión mensual</p>
              <p className="text-muted">Martes 4 de noviembre · <span className="whitespace-nowrap">10:00–10:45</span></p>
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">Pendiente</Badge>
                <span className="text-muted">Videollamada</span>
              </p>
            </HoverCardContent>
          </HoverCard>
          <HoverCard>
            <HoverCardTrigger
              render={
                <button type="button" className="text-xs text-muted underline decoration-dotted underline-offset-2">
                  3 fuentes
                </button>
              }
            />
            <HoverCardContent side="top" align="start">
              <p className="font-medium">Fuentes del análisis</p>
              <ul className="list-disc space-y-1 pl-4 text-muted">
                <li>Pedidos de Shopify · 30 días</li>
                <li>Campañas de Meta Ads</li>
                <li>Flujos de Klaviyo</li>
              </ul>
            </HoverCardContent>
          </HoverCard>
        </div>
      </Block>
    </div>
  );
}

function OtpSlots({ count, from = 0, invalid }: { count: number; from?: number; invalid?: boolean }) {
  return (
    <InputOTPGroup>
      {Array.from({ length: count }, (_, i) => (
        <InputOTPSlot key={from + i} index={from + i} aria-invalid={invalid || undefined} />
      ))}
    </InputOTPGroup>
  );
}

function InputOTPShowcase() {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState("000000");
  return (
    <div className="grid gap-6">
      <Block title="Verificación en dos pasos: 3 + 3 con separador (InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator)">
        <Field label="Código de tu app de autenticación" hint="Pegar «123 456» también vale: se quitan los espacios.">
          <InputOTP maxLength={6}>
            <OtpSlots count={3} />
            <InputOTPSeparator />
            <OtpSlots count={3} from={3} />
          </InputOTP>
        </Field>
      </Block>
      <Block title="Controlado (value, onChange, onComplete)">
        <div className="grid gap-2">
          <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Código de un solo uso">
            <OtpSlots count={6} />
          </InputOTP>
          <p className="text-sm text-muted">{code === "" ? "Escribe el código de un solo uso." : `Has escrito: ${code}`}</p>
        </div>
      </Block>
      <Block title="Letras y cifras (pattern) y de dos en dos">
        <Field label="Código de invitación">
          <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS_AND_CHARS}>
            <OtpSlots count={2} />
            <InputOTPSeparator />
            <OtpSlots count={2} from={2} />
            <InputOTPSeparator />
            <OtpSlots count={2} from={4} />
          </InputOTP>
        </Field>
      </Block>
      <Block title="Desactivado y con error">
        <div className="flex flex-wrap gap-8">
          <InputOTP maxLength={6} value="123456" disabled aria-label="Código desactivado">
            <OtpSlots count={6} />
          </InputOTP>
          <Field label="Código" error="El código no es correcto o ya ha caducado.">
            <InputOTP maxLength={6} value={wrong} onChange={setWrong}>
              <OtpSlots count={3} />
              <InputOTPSeparator />
              <OtpSlots count={3} from={3} />
            </InputOTP>
          </Field>
        </div>
      </Block>
    </div>
  );
}

const ITEM_PEOPLE = [
  { name: "Lucía Pérez", email: "lucia@tienda.com", color: "blue" },
  { name: "Iván Sanz", email: "ivan@tienda.com", color: "green" },
  { name: "Eva Gil", email: "eva@tienda.com", color: "purple" },
];

function ItemShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Básico: título, descripción y acción (Item, ItemContent, ItemTitle, ItemDescription, ItemActions)">
        <div className="grid max-w-lg gap-4">
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Factura de octubre</ItemTitle>
              <ItemDescription>F-0104 · vence el 5 de noviembre</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm">Descargar</Button>
            </ItemActions>
          </Item>
          <Item variant="outline" size="sm" render={<a href="#item" />}>
            <ItemMedia>
              <BadgeCheck className="size-5" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Tu tienda está conectada y al día</ItemTitle>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon className="size-4" />
            </ItemActions>
          </Item>
        </div>
      </Block>
      <Block title="Variantes (variant) y tamaños (size)">
        <div className="grid max-w-lg gap-4">
          {(["default", "outline", "muted"] as const).map((variant) => (
            <Item key={variant} variant={variant}>
              <ItemMedia variant="icon"><MailIcon /></ItemMedia>
              <ItemContent>
                <ItemTitle>{variant === "default" ? "Sin borde" : variant === "outline" ? "Con borde" : "Fondo gris"}</ItemTitle>
                <ItemDescription>variant=&quot;{variant}&quot;</ItemDescription>
              </ItemContent>
            </Item>
          ))}
          {(["default", "sm", "xs"] as const).map((size) => (
            <Item key={size} variant="outline" size={size}>
              <ItemMedia variant="icon"><MailIcon /></ItemMedia>
              <ItemContent>
                <ItemTitle>Tamaño {size}</ItemTitle>
                <ItemDescription>La descripción nunca baja de 14 px.</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </div>
      </Block>
      <Block title="Dentro de una List: a ras, con la línea entre filas (como en la app)">
        <List as="ul" className="max-w-lg">
          {ITEM_PEOPLE.map((person) => (
            <Item key={person.email} render={<li />}>
              <ItemMedia>
                <Avatar>
                  <AvatarImage src={`https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${person.color}.jpg`} alt="" />
                  <AvatarFallback>{avatarInitials(person.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{person.name}<Badge tone="success">Activo</Badge></ItemTitle>
                <ItemDescription>{person.email}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="sm">Quitar</Button>
              </ItemActions>
            </Item>
          ))}
        </List>
      </Block>
      <Block title="Agrupados (ItemGroup, ItemSeparator) y como enlace (render)">
        <ItemGroup className="max-w-lg gap-0">
          <Item render={<a href="#item" />}>
            <ItemMedia variant="icon"><FileTextIcon /></ItemMedia>
            <ItemContent>
              <ItemTitle>Informe mensual</ItemTitle>
              <ItemDescription>Ventas, publicidad y email de octubre.</ItemDescription>
            </ItemContent>
            <ItemActions><ChevronRightIcon className="size-4" /></ItemActions>
          </Item>
          <ItemSeparator />
          <Item render={<a href="#item" />}>
            <ItemMedia variant="icon"><TableIcon /></ItemMedia>
            <ItemContent>
              <ItemTitle>Rentabilidad por tienda</ItemTitle>
              <ItemDescription>Margen, costes fijos y punto de equilibrio.</ItemDescription>
            </ItemContent>
            <ItemActions><ChevronRightIcon className="size-4" /></ItemActions>
          </Item>
        </ItemGroup>
      </Block>
      <Block title="Cabecera y pie (ItemHeader, ItemFooter)">
        <ItemGroup className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {["Campaña de otoño", "Black Friday", "Navidad"].map((name, index) => (
            <Item key={name} variant="outline" className="items-start">
              <ItemHeader>
                <div className="aspect-[4/3] w-full rounded-md bg-default" />
              </ItemHeader>
              <ItemContent>
                <ItemTitle>{name}</ItemTitle>
                <ItemDescription>{["Email · 3 envíos", "Email + Meta", "Email · borrador"][index]}</ItemDescription>
              </ItemContent>
              <ItemFooter>
                <Badge tone={index === 2 ? "warn" : "success"}>{index === 2 ? "Por revisar" : "Programada"}</Badge>
              </ItemFooter>
            </Item>
          ))}
        </ItemGroup>
      </Block>
    </div>
  );
}

function MarkerShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Variantes: nota, con línea debajo y separador (Marker, MarkerIcon, MarkerContent)">
        <div className="grid max-w-sm gap-6">
          <Marker>
            <MarkerIcon><GitBranchIcon /></MarkerIcon>
            <MarkerContent>Tienda cambiada a Pádel España</MarkerContent>
          </Marker>
          <Marker variant="border">
            <MarkerIcon><CheckIcon /></MarkerIcon>
            <MarkerContent>Ventas de los últimos 30 días</MarkerContent>
          </Marker>
          <Marker variant="separator">
            <MarkerContent>Hoy</MarkerContent>
          </Marker>
        </div>
      </Block>
      <Block title="En curso: role=&quot;status&quot; para que se anuncie">
        <Marker role="status" className="max-w-sm">
          <MarkerIcon><Spinner size="sm" /></MarkerIcon>
          <MarkerContent>Consultando datos…</MarkerContent>
        </Marker>
      </Block>
      <Block title="Como botón o enlace (render)">
        <Marker render={<button type="button" />}>
          <MarkerIcon><Undo2Icon /></MarkerIcon>
          <MarkerContent>Volver a esta respuesta</MarkerContent>
        </Marker>
      </Block>
    </div>
  );
}

function PaginationShowcase() {
  const [page, setPage] = useState(5);
  return (
    <div className="grid gap-6">
      <Block title="Atajo: <Pagination page pageCount onChange> pinta el rango con elipsis">
        <Pagination page={page} pageCount={12} onChange={setPage} />
      </Block>
      <Block title="Por piezas (Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis)">
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#pagination" /></PaginationItem>
            <PaginationItem><PaginationLink href="#pagination">1</PaginationLink></PaginationItem>
            <PaginationItem><PaginationLink href="#pagination" isActive>2</PaginationLink></PaginationItem>
            <PaginationItem><PaginationLink href="#pagination">3</PaginationLink></PaginationItem>
            <PaginationItem><PaginationEllipsis /></PaginationItem>
            <PaginationItem><PaginationNext href="#pagination" /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </Block>
    </div>
  );
}

function MessageShowcase() {
  return (
    <div className="grid gap-6">
      <Block title="Conversación: avatar, grupo del mismo autor, cabecera y pie (Message, MessageGroup, MessageAvatar, MessageContent, MessageHeader, MessageFooter)">
        <div className="flex w-full max-w-md flex-col gap-4">
          <MessageGroup>
            <Message>
              <MessageAvatar />
              <MessageContent>
                <MessageHeader>Lucía · consultora</MessageHeader>
                <Bubble variant="muted"><BubbleContent>He revisado el embudo de octubre.</BubbleContent></Bubble>
              </MessageContent>
            </Message>
            <Message>
              <MessageAvatar><Avatar size="sm"><AvatarFallback>LP</AvatarFallback></Avatar></MessageAvatar>
              <MessageContent>
                <Bubble variant="muted"><BubbleContent>El abandono en móvil sigue alto.</BubbleContent></Bubble>
                <MessageFooter>10:42</MessageFooter>
              </MessageContent>
            </Message>
          </MessageGroup>
          <Message align="end">
            <MessageContent>
              <Bubble><BubbleContent>¿Lo vemos el jueves?</BubbleContent></Bubble>
              <MessageFooter>10:45 · Visto</MessageFooter>
            </MessageContent>
          </Message>
          <Message align="end">
            <MessageContent>
              <Bubble><BubbleContent>Te paso el informe.</BubbleContent></Bubble>
              <MessageFooter>
                <span className="text-danger">No se envió</span>
                <Button variant="ghost" size="icon-sm" aria-label="Reintentar" title="Reintentar"><RefreshCwIcon /></Button>
              </MessageFooter>
            </MessageContent>
          </Message>
        </div>
      </Block>
    </div>
  );
}

const SECTIONS: Array<{ id: string; name: string; Showcase: () => ReactNode }> = [
  { id: "accordion", name: "Acordeón", Showcase: AccordionShowcase },
  { id: "alert", name: "Aviso (Alert, Banner)", Showcase: AlertShowcase },
  { id: "alert-dialog", name: "Diálogo de alerta", Showcase: AlertDialogShowcase },
  { id: "attachment", name: "Adjunto", Showcase: AttachmentShowcase },
  { id: "avatar", name: "Avatar", Showcase: AvatarShowcase },
  { id: "badge", name: "Badge", Showcase: BadgesShowcase },
  { id: "breadcrumb", name: "Breadcrumb", Showcase: BreadcrumbShowcase },
  { id: "bubble", name: "Bubble", Showcase: BubbleShowcase },
  { id: "button", name: "Botón", Showcase: ButtonsShowcase },
  { id: "button-group", name: "Button Group", Showcase: ButtonGroupShowcase },
  { id: "calendar", name: "Calendario", Showcase: CalendarShowcase },
  { id: "card", name: "Card", Showcase: CardShowcase },
  { id: "checkbox", name: "Checkbox", Showcase: CheckboxShowcase },
  { id: "collapsible", name: "Collapsible", Showcase: CollapsibleShowcase },
  { id: "combobox", name: "Combobox", Showcase: ComboboxShowcase },
  { id: "dialog", name: "Diálogo", Showcase: DialogShowcase },
  { id: "drawer", name: "Cajón (Drawer)", Showcase: DrawerShowcase },
  { id: "empty", name: "Vacío (Empty)", Showcase: EmptyShowcase },
  { id: "field", name: "Campo (Field)", Showcase: FieldShowcase },
  { id: "hover-card", name: "Tarjeta al pasar (Hover Card)", Showcase: HoverCardShowcase },
  { id: "input-otp", name: "Código de un solo uso (Input OTP)", Showcase: InputOTPShowcase },
  { id: "item", name: "Fila (Item)", Showcase: ItemShowcase },
  { id: "marker", name: "Marca de conversación (Marker)", Showcase: MarkerShowcase },
  { id: "message", name: "Mensaje (Message)", Showcase: MessageShowcase },
  { id: "pagination", name: "Paginación", Showcase: PaginationShowcase },
  { id: "popover", name: "Popover", Showcase: PopoverShowcase },
  { id: "progress", name: "Progreso (Progress)", Showcase: ProgressShowcase },
  { id: "radio-group", name: "Radio Group", Showcase: RadioGroupShowcase },
  { id: "resizable", name: "Paneles redimensionables (Resizable)", Showcase: ResizableShowcase },
  { id: "select", name: "Select", Showcase: SelectShowcase },
  { id: "separator", name: "Separador (Separator)", Showcase: SeparatorShowcase },
  { id: "scroll-area", name: "Zona desplazable (Scroll Area)", Showcase: ScrollAreaShowcase },
  { id: "table", name: "Table y Data Table", Showcase: TableShowcase },
  { id: "toggle-group", name: "Toggle Group", Showcase: ToggleGroupShowcase },
];

function ComponentsIndex() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const { id } of SECTIONS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Componentes" className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <ul className="flex gap-1 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0">
          {SECTIONS.map(({ id, name }) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                aria-current={active === id ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  history.replaceState(null, "", `#${id}`);
                  setActive(id);
                }}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active === id ? "bg-[color-mix(in_srgb,var(--nora-purple)_10%,white)] font-medium text-[var(--nora-purple)]" : "text-muted hover:bg-surface hover:text-ink",
                )}
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid min-w-0 gap-10">
        {SECTIONS.map(({ id, Showcase }) => (
          <section key={id} id={id} className="scroll-mt-20">
            <Showcase />
          </section>
        ))}
      </div>
    </div>
  );
}

export default function ComponentesPage() {
  return <PortalShell title="Componentes">{() => <div className="portal-page"><ComponentsIndex /></div>}</PortalShell>;
}
