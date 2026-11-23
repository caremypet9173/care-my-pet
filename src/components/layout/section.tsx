import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Section({
  className,
  spacing = "normal",
  ...props
}: ComponentProps<"section"> & { spacing?: "normal" | "hero" | "compact" }) {
  return (
    <section
      {...props}
      className={cn("section", `section--${spacing}`, className)}
    />
  );
}
