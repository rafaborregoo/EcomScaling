import { cn } from "@/components/ui/cn";

/**
 * Identidad visual del canal.
 *
 * En una rejilla de borradores el canal es lo primero que se busca ("¿esto es
 * un email o un anuncio?") y era justo lo que no se veia: las tarjetas de email
 * mostraban una miniatura blanca y las de Meta/Instagram una linea de texto
 * gris, asi que la rejilla entera se leia igual.
 *
 * El canal no es una severidad, asi que no reusa success/warn/danger: tiene sus
 * propios tokens en `globals.css`.
 */
export type MarketingChannel =
  | "email_klaviyo"
  | "meta_ads"
  | "instagram_organic";

type ChannelStyle = {
  label: string;
  /** Texto sobre fondo claro. */
  text: string;
  /** Fondo solido (franja, pastilla). */
  fill: string;
  /** Fondo suave del bloque. */
  soft: string;
};

export const CHANNEL_STYLE: Record<MarketingChannel, ChannelStyle> = {
  email_klaviyo: {
    label: "Email · Klaviyo",
    text: "text-channel-email",
    fill: "bg-channel-email",
    soft: "bg-channel-email-soft",
  },
  meta_ads: {
    label: "Meta Ads",
    text: "text-channel-meta",
    fill: "bg-channel-meta",
    soft: "bg-channel-meta-soft",
  },
  instagram_organic: {
    label: "Instagram",
    text: "text-channel-instagram",
    fill: "bg-channel-instagram",
    soft: "bg-channel-instagram-soft",
  },
};

/**
 * Acepta los dos vocabularios que conviven en el modulo: el del generador
 * (`meta_ads`) y el del contrato de A05 (`Meta`). Sin esto, la misma campaña
 * sale violeta en el plan y gris en el contenido, y deja de leerse como la
 * misma cosa. Un borrador sin canal declarado es de email, el canal por
 * defecto del generador.
 */
export function toChannel(value: string | null | undefined): MarketingChannel {
  switch (value) {
    case "meta_ads":
    case "Meta":
      return "meta_ads";
    case "instagram_organic":
    case "Instagram":
      return "instagram_organic";
    default:
      return "email_klaviyo";
  }
}

export function channelStyle(value: string | null | undefined) {
  return CHANNEL_STYLE[toChannel(value)];
}

export function ChannelBadge({
  channel,
  className,
}: {
  channel: string | null | undefined;
  className?: string;
}) {
  const style = channelStyle(channel);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 text-[0.7rem] font-medium uppercase tracking-[0.08em]",
        style.soft,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
