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
