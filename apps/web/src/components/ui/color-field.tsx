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
  parseColor,
  Select,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { sameHex, toEmailHex } from "./color-hex";

const colorChannelsByColorSpace: Record<ColorSpace, ColorChannel[]> = {
  hsb: ["hue", "saturation", "brightness", "alpha"],
  hsl: ["hue", "saturation", "lightness", "alpha"],
  rgb: ["red", "green", "blue", "alpha"],
};

type RacColor = ReturnType<typeof parseColor>;

/** El hex de la app puede venir vacío o corrupto; el selector no puede reventar. */
function parseOrBlack(value: string): RacColor {
  try {
    return parseColor(toEmailHex(value)).toFormat("hsl");
  } catch {
    return parseColor("#000000").toFormat("hsl");
  }
}

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
  /**
   * El color vive AQUI, no en el hex del padre.
   *
   * Antes el picker se controlaba con el hex, y el hex no sabe de tono: en
   * blanco (#ffffff) o en el gris casi negro del texto (#171717), mover el
   * tirador de tono producía el mismo hex, el padre devolvía ese hex sin
   * cambios y el tirador saltaba atrás. Es decir: en los dos colores por
   * defecto de la plantilla, el selector no hacía absolutamente nada.
   *
   * Guardando el Color en HSL, el tono y la saturación sobreviven aunque el
   * hex no cambie, y subir la saturación desde blanco ya da color.
   */
  const [color, setColor] = useState<RacColor>(() => parseOrBlack(value));

  useEffect(() => {
    // Solo re-sincroniza cuando de verdad llega otro color de fuera (cargar
    // otra plantilla, cambiar de tienda), no en el eco del propio arrastre.
    setColor((current) =>
      sameHex(current.toString("hex"), value) ? current : parseOrBlack(value),
    );
  }, [value]);

  return (
    <ColorPicker
      value={color}
      onChange={(next) => {
        setColor(next as RacColor);
        onChange(toEmailHex((next as RacColor).toString("hex")));
      }}
    >
      {/* El trigger es un <button>: la etiqueta va en un <span>. Un <label>
          aquí dentro es contenido interactivo anidado (WCAG 4.1.2) y puede
          quedarse el clic que debía abrir el desplegable. */}
      <ColorPicker.Trigger aria-label={label}>
        <ColorSwatch size="lg" />
        <span>{label}</span>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="max-w-62 gap-2 px-2 py-3">
        {/* HeroUI Select es el de react-aria: `value`/`onChange` no existen en
            su contrato, se colaban como atributos de div y se ignoraban, así
            que cambiar de espacio de color no hacía nada. */}
        <Select
          aria-label="Espacio de color"
          selectedKey={colorSpace}
          variant="secondary"
          onSelectionChange={(space) => setColorSpace(space as ColorSpace)}
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
