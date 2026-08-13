"use client";

import type { ReactNode } from "react";
import { Checkbox as HeroCheckbox } from "@heroui/react";

export function Checkbox({
  checked,
  onChange,
  children,
  className,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <HeroCheckbox
      isSelected={checked}
      isDisabled={disabled}
      onChange={onChange}
      className={className}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}
