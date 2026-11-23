import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Container({
  width = "page",
  className,
  ...props
}: ComponentProps<"div"> & { width?: "page" | "demo" | "prose" }) {
  return (
    <div
      {...props}
      className={cn("container", `container--${width}`, className)}
    />
  );
}
