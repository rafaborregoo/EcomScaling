"use client";

import { Breadcrumbs as HeroBreadcrumbs } from "@heroui/react";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <HeroBreadcrumbs className={className}>
      {items.map((item, index) => (
        <HeroBreadcrumbs.Item key={`${item.label}-${index}`} href={item.href}>
          {item.label}
        </HeroBreadcrumbs.Item>
      ))}
    </HeroBreadcrumbs>
  );
}
