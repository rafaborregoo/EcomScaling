import type { SVGProps } from "react";
import {
  CloseIcon,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from "@heroui/react";

export { CloseIcon, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp };

// HeroUI no trae estos glifos en su set interno (icons.js solo cubre chevrons,
// busqueda, calendario, cerrar, +/-, info/warning/danger/success y link
// externo) -- se anaden aqui siguiendo su mismo estilo (fill=currentColor,
// aria-hidden, role=presentation) en vez de usar emoji como icono.

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" role="presentation" viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.5 3.75A.75.75 0 0 1 2.25 3h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75Zm0 4.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H2.25A.75.75 0 0 1 1.5 8Zm.75 3.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H2.25Z" />
    </svg>
  );
}

export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" role="presentation" viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" {...props}>
      <path d="M4 8a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0Zm5.5 0a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0Zm5.5 0a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0Z" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" role="presentation" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z"
      />
    </svg>
  );
}
