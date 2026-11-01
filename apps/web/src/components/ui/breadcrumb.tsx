"use client";

import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "./cn";

export function Breadcrumb({
  className,
  ...props
}: ComponentProps<"nav">) {
  return (
    <nav aria-label="breadcrumb" data-slot="breadcrumb" className={className} {...props} />
  );
}

export function BreadcrumbList({
  className,
  ...props
}: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1.5 break-words text-sm text-muted sm:gap-2.5", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      {...props}
    />
  );
}

type BreadcrumbLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href?: string;
  render?: ReactElement;
};

export function BreadcrumbLink({
  href,
  render,
  className,
  children,
  ...props
}: BreadcrumbLinkProps) {
  const linkClass = cn("transition-colors hover:text-foreground", className);

  if (render) {
    const renderedClass = (render.props as { className?: string }).className;
    const renderedChildren = (render.props as { children?: ReactNode }).children;
    return cloneElement(render, {
      ...props,
      ...(href ? { href } : {}),
      "data-slot": "breadcrumb-link",
      className: cn(linkClass, renderedClass),
      children: children ?? renderedChildren,
    } as ComponentProps<"a">);
  }

  return (
    <a
      data-slot="breadcrumb-link"
      href={href}
      className={linkClass}
      {...props}
    >
      {children}
    </a>
  );
}

export function BreadcrumbPage({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-8 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Más</span>
    </span>
  );
}
