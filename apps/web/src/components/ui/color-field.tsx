"use client";

// Wrapper propio sobre el ColorPicker de HeroUI v3 (patrón "with sliders":
// selector de espacio de color + un slider por canal). Expone una API de hex
// string para el resto de la app: <ColorField label value onChange />.
// Estilos base vía @heroui/styles/css.

import type { ColorChannel, ColorSpace } from "@heroui/react";

import {
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  ListBox,
  Select,
} from "@heroui/react";
import { useState } from "react";

const colorChannelsByColorSpace: Record<ColorSpace, ColorChannel[]> = {
  hsb: ["hue", "saturation", "brightness", "alpha"],
  hsl: ["hue", "saturation", "lightness", "alpha"],
  rgb: ["red", "green", "blue", "alpha"],
};

type RacColor = { toString: (format: "hex") => string };

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [colorSpace, setColorSpace] = useState<ColorSpace>("hsl");

  return (
    <ColorPicker
      value={value}
      onChange={(color) => {
        // Fuerza 6 dígitos: si el canal alpha baja de 1, toString("hex")
        // devuelve #RRGGBBAA y el render del email solo acepta #RRGGBB.
        onChange((color as RacColor).toString("hex").slice(0, 7).toLowerCase());
      }}
    >
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>{label}</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="max-w-62 gap-2 px-2 py-3">
        <Select
          aria-label="Espacio de color"
          value={colorSpace}
          variant="secondary"
          onChange={(space) => setColorSpace(space as ColorSpace)}
        >
          <Select.Trigger>
            <Select.Value className="uppercase" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.keys(colorChannelsByColorSpace).map((space) => (
                <ListBox.Item
                  key={space}
                  className="uppercase"
                  id={space}
                  textValue={space}
                >
                  {space}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <div className="flex flex-col gap-2">
          {colorChannelsByColorSpace[colorSpace].map((channel: ColorChannel) => (
            // @ts-expect-error - TypeScript can't correlate dynamic colorSpace with channel type
            <ColorSlider
              key={channel}
              aria-label={channel}
              channel={channel}
              className="gap-1 px-1"
              colorSpace={colorSpace}
            >
              <Label className="capitalize">{channel}</Label>
              <ColorSlider.Output className="text-muted" />
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
          ))}
        </div>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}
