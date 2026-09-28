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
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  CircleCheck,
  Clock,
  Compass,
  Grip,
  Home,
  Info,
  LineChart,
  ListChecks,
  Megaphone,
  MessageSquare,
  PanelLeft,
  Phone,
  Plug,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
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
// FontAwesome: casa con la direccion minimalista del shell.
export function BellIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Bell {...props} />;
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

// --- Iconos de navegacion. Reexportan lucide-react tal cual: los mismos
// nombres de siempre (HomeIcon, CompassIcon...) para no tocar cada call site,
// pero el SVG real de la libreria en vez de trazos copiados a mano -- una
// copia a mano se desajusto (PlugIcon, MegaphoneIcon) y salia deforme. ---
export function HomeIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Home {...props} />;
}

export function UsersIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Users {...props} />;
}

export function TasksIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <ListChecks {...props} />;
}

export function PhoneIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Phone {...props} />;
}

export function CompassIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Compass {...props} />;
}

export function DotGridIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Grip {...props} />;
}

export function ChartIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <LineChart {...props} />;
}

export function MegaphoneIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Megaphone {...props} />;
}

export function MessageSquareIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <MessageSquare {...props} />;
}

export function PlugIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Plug {...props} />;
}

export function BookOpenIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <BookOpen {...props} />;
}

export function SlidersIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <SlidersHorizontal {...props} />;
}

export function ActivityIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Activity {...props} />;
}

export function WalletIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Wallet {...props} />;
}

export function StoreIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Store {...props} />;
}

export function PanelLeftIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <PanelLeft {...props} />;
}

export function GearIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Settings {...props} />;
}

export function AlertTriangleIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <AlertTriangle {...props} />;
}

export function CircleCheckIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <CircleCheck {...props} />;
}

export function InfoIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Info {...props} />;
}

export function ClockIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Clock {...props} />;
}

// Marca de "esto lo dice la IA". Un solo icono para todas las cards y para la
// zona del nav: si cada metrica eligiera el suyo, habria que aprender cual es
// cual.
export function SparklesIcon(props: ComponentPropsWithoutRef<"svg">) {
  return <Sparkles {...props} />;
}
