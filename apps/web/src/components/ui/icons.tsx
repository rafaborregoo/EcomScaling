import {
  faAlignCenter,
  faAlignLeft,
  faAlignRight,
  faArchive,
  faBars,
  faCheckDouble,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCheck,
  faCommentDots,
  faDownload,
  faEllipsis,
  faGear,
  faGripVertical,
  faPencil,
  faPlus,
  faRotate,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ComponentPropsWithoutRef } from "react";

type IconProps = Omit<ComponentPropsWithoutRef<typeof FontAwesomeIcon>, "icon">;

export function MessageIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faCommentDots} {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faXmark} {...props} />;
}

export function AlignLeftIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faAlignLeft} {...props} />;
}

export function AlignCenterIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faAlignCenter} {...props} />;
}

export function AlignRightIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faAlignRight} {...props} />;
}

export function GripVerticalIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faGripVertical} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faGear} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faCheck} {...props} />;
}

export function PencilIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faPencil} {...props} />;
}

export function PlusIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faPlus} {...props} />;
}

export function IconChevronDown(props: IconProps) {
  return <FontAwesomeIcon icon={faChevronDown} {...props} />;
}

export function IconChevronLeft(props: IconProps) {
  return <FontAwesomeIcon icon={faChevronLeft} {...props} />;
}

export function IconChevronRight(props: IconProps) {
  return <FontAwesomeIcon icon={faChevronRight} {...props} />;
}

export function IconChevronUp(props: IconProps) {
  return <FontAwesomeIcon icon={faChevronUp} {...props} />;
}

export function MenuIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faBars} {...props} />;
}

export function MoreIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faEllipsis} {...props} />;
}

// Campana de Lucide (outline, trazo fino) en vez del faBell macizo de
// FontAwesome: casa con la direccion minimalista del shell. Inline para no
// añadir `lucide-react` como dependencia por un solo icono.
export function BellIcon({
  className,
  ...props
}: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.41 5.956-2.738 7.326" />
    </svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faArchive} {...props} />;
}

export function CheckAllIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faCheckDouble} {...props} />;
}

export function RetryIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faRotate} {...props} />;
}

export function DownloadIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faDownload} {...props} />;
}

export function TrashIcon(props: IconProps) {
  return <FontAwesomeIcon icon={faTrashCan} {...props} />;
}

// --- Iconos de navegacion (barra inferior movil). Trazos de Lucide, inline
// para no depender de `lucide-react`. Todos comparten el mismo lienzo/estilo. ---
function LucideIcon({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </LucideIcon>
  );
}

export function UsersIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </LucideIcon>
  );
}

export function TasksIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </LucideIcon>
  );
}

export function PhoneIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </LucideIcon>
  );
}

export function CompassIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
      <circle cx="12" cy="12" r="10" />
    </LucideIcon>
  );
}

export function DotGridIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
    </LucideIcon>
  );
}

export function ChartIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 4 3 5-7" />
    </LucideIcon>
  );
}

export function MegaphoneIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.1 13 21H7l-1.5-6" />
    </LucideIcon>
  );
}

export function MessageSquareIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </LucideIcon>
  );
}

export function PlugIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v3a6 6 0 0 1-12 0V8h12Z" />
    </LucideIcon>
  );
}

export function BookOpenIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z" />
    </LucideIcon>
  );
}

export function SlidersIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M1 14h6" />
      <path d="M9 8h6" />
      <path d="M17 16h6" />
    </LucideIcon>
  );
}

export function ActivityIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </LucideIcon>
  );
}

export function WalletIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6" />
      <path d="M16 14h.01" />
    </LucideIcon>
  );
}

export function PanelLeftIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </LucideIcon>
  );
}

export function GearIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20h-3v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.4 15a1.65 1.65 0 0 0-1.51-1H5.8v-3h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L7 8.12l2-2 .06.06a1.65 1.65 0 0 0 1.82.33h.02a1.65 1.65 0 0 0 1-1.51V4.9h3V5a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 10v.02a1.65 1.65 0 0 0 1.51 1h.09v3h-.09a1.65 1.65 0 0 0-1.51.98Z" />
    </LucideIcon>
  );
}

export function AlertTriangleIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </LucideIcon>
  );
}

export function CircleCheckIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </LucideIcon>
  );
}

export function InfoIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </LucideIcon>
  );
}

export function ClockIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </LucideIcon>
  );
}

// Marca de "esto lo dice la IA". Un solo icono para todas las cards y para la
// zona del nav: si cada metrica eligiera el suyo, habria que aprender cual es
// cual. `sparkles` de lucide, del mismo trazo que el resto del nav.
export function SparklesIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <LucideIcon {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </LucideIcon>
  );
}
