"use client";

import type { ReactNode } from "react";
import { Accordion as HeroAccordion } from "@heroui/react";

export type AccordionItem = { id: string; title: ReactNode; content: ReactNode };

export function Accordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  return (
    <HeroAccordion className={className}>
      {items.map((item) => (
        <HeroAccordion.Item key={item.id} id={item.id}>
          <HeroAccordion.Heading>
            <HeroAccordion.Trigger>
              {item.title}
              <HeroAccordion.Indicator />
            </HeroAccordion.Trigger>
          </HeroAccordion.Heading>
          <HeroAccordion.Panel>
            <HeroAccordion.Body>{item.content}</HeroAccordion.Body>
          </HeroAccordion.Panel>
        </HeroAccordion.Item>
      ))}
    </HeroAccordion>
  );
}
