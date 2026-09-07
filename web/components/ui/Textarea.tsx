import type { ComponentProps } from "react";

export function Textarea({
  className = "",
  ref,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      ref={ref}
      /* nodrag/nowheel stop xyflow from panning the canvas while typing or scrolling here. */
      className={`nodrag nowheel w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted focus:border-accent ${className}`}
    />
  );
}
