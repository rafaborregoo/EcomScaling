"use client";

import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbCrumbItem,
  BreadcrumbLink as BreadcrumbCrumbLink,
  BreadcrumbList,
  BreadcrumbPage as BreadcrumbCurrentPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

export type BreadcrumbEntry = { label: string; href?: string };

/** Array-based adapter retained for simple, route-driven breadcrumb trails. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbEntry[]; className?: string }) {
  if (!items.length) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            <BreadcrumbCrumbItem>
              {index === items.length - 1 || !item.href ? (
                <BreadcrumbCurrentPage>{item.label}</BreadcrumbCurrentPage>
              ) : (
                <BreadcrumbCrumbLink href={item.href}>{item.label}</BreadcrumbCrumbLink>
              )}
            </BreadcrumbCrumbItem>
            {index < items.length - 1 ? <BreadcrumbSeparator /> : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
