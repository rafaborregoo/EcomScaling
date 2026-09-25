"use client";

import type { ReactNode } from "react";
import { Tabs as HeroTabs } from "@heroui/react";

export type TabItem = { value: string; label: string; icon?: ReactNode };

export function Tabs({
  items,
  value,
  onChange,
  className,
  panels,
  hideNavigation = false,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  panels?: Record<string, ReactNode>;
  hideNavigation?: boolean;
}) {
  return (
    <HeroTabs
      variant="secondary"
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      className={className}
    >
      <HeroTabs.ListContainer className={hideNavigation ? "hidden" : undefined}>
        <HeroTabs.List
          aria-label="Navegacion por pestañas"
          data-scrollbar="none"
          className="max-w-full overflow-x-auto"
        >
          {items.map((item) => (
            <HeroTabs.Tab key={item.value} id={item.value}>
              {item.icon}
              {item.label}
              <HeroTabs.Indicator />
            </HeroTabs.Tab>
          ))}
        </HeroTabs.List>
      </HeroTabs.ListContainer>
      {items.map((item) => (
        <HeroTabs.Panel key={item.value} id={item.value}>
          {panels?.[item.value] ?? null}
        </HeroTabs.Panel>
      ))}
    </HeroTabs>
  );
}
