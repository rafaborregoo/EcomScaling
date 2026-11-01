"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { useMessageAlign } from "./message";

export type BubbleVariant =
  | "default"
  | "muted"
  | "secondary"
  | "accent"
  | "outline"
  | "destructive"
  | "ghost";
export type BubbleAlign = "start" | "end";

const BubbleContext = createContext<BubbleVariant>("default");

const contentVariants: Record<BubbleVariant, string> = {
  default: "border border-accent bg-accent text-accent-foreground",
  muted: "border border-separator bg-surface text-foreground",
  secondary: "border border-separator bg-foreground/5 text-foreground",
  accent: "border border-accent/20 bg-accent-soft text-accent",
  outline: "border border-separator bg-transparent text-foreground",
  destructive: "border border-danger/20 bg-danger/10 text-danger",
  ghost: "border border-transparent bg-transparent text-foreground",
};

export function Bubble({
  align: ownAlign,
  variant = "default",
  className,
  render,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: BubbleAlign;
  variant?: BubbleVariant;
  render?: ReactElement;
  children?: ReactNode;
}) {
  // Dentro de un Message toma su lado y su ancho (el límite lo pone el Message).
  const messageAlign = useMessageAlign();
  const align = ownAlign ?? messageAlign ?? "start";
  const classes = cn(
    "relative flex w-fit min-w-0",
    messageAlign ? "max-w-full" : "max-w-[80%]",
    align === "end" ? "self-end" : "self-start",
    className,
  );
  const elementProps = {
    ...props,
    "data-slot": "bubble",
    "data-align": align,
    "data-variant": variant,
    className: classes,
  };

  return (
    <BubbleContext.Provider value={variant}>
      {render && isValidElement(render)
        ? cloneElement(render as ReactElement<Record<string, unknown>>, {
            ...elementProps,
            className: cn(classes, (render.props as { className?: string }).className),
            children,
          })
        : <div {...elementProps}>{children}</div>}
    </BubbleContext.Provider>
  );
}

export function BubbleGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    />
  );
}

export function BubbleContent({
  className,
  render,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { render?: ReactElement; children?: ReactNode }) {
  const variant = useContext(BubbleContext);
  const elementProps = {
    ...props,
    "data-slot": "bubble-content",
    className: cn(
      "min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6",
      contentVariants[variant],
      className,
    ),
  };

  return render && isValidElement(render)
    ? cloneElement(render as ReactElement<Record<string, unknown>>, {
        ...elementProps,
        className: cn(elementProps.className, (render.props as { className?: string }).className),
        children,
      })
    : <div {...elementProps}>{children}</div>;
}

export function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "start" | "end";
  align?: BubbleAlign | "center";
}) {
  const sideClasses = {
    top: "bottom-full mb-1.5",
    bottom: "top-full mt-1.5",
    start: "right-full mr-1.5",
    end: "left-full ml-1.5",
  };
  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };
  const verticalAlignClasses = {
    start: "top-0",
    center: "top-1/2 -translate-y-1/2",
    end: "bottom-0",
  };

  return (
    <div
      data-slot="bubble-reactions"
      data-side={side}
      data-align={align}
      className={cn(
        "absolute z-10 inline-flex w-max max-w-[min(80vw,20rem)] items-center gap-1 rounded-full border border-separator bg-white px-2 py-1 text-xs shadow-sm",
        sideClasses[side],
        side === "top" || side === "bottom" ? alignClasses[align] : verticalAlignClasses[align],
        className,
      )}
      {...props}
    />
  );
}
