"use client";

import type { ComponentProps } from "react";
import { Switch as HeroSwitch } from "@heroui/react";

/**
 * En HeroUI 3.2 el Switch es un Field: el elemento pulsable (con el input
 * oculto) es `Switch.Content`. Sin el, el interruptor se pinta pero no
 * responde. Este wrapper lo pone siempre, asi las paginas siguen escribiendo
 * `<Switch><Switch.Control><Switch.Thumb /></Switch.Control></Switch>`.
 */
function SwitchRoot({ children, ...props }: ComponentProps<typeof HeroSwitch>) {
  return (
    <HeroSwitch {...props}>
      {(state) => <HeroSwitch.Content>{typeof children === "function" ? children(state) : children}</HeroSwitch.Content>}
    </HeroSwitch>
  );
}

export const Switch = Object.assign(SwitchRoot, {
  Control: HeroSwitch.Control,
  Thumb: HeroSwitch.Thumb,
  Icon: HeroSwitch.Icon,
});
