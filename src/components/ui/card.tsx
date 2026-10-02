import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  surface = "raised",
  padding = "md",
  ...props
}: ComponentProps<"div"> & {
  surface?: "raised" | "sand" | "subtle";
  padding?: "sm" | "md" | "lg";
}) {
  return (
    <div
      {...props}
      className={cn("card", `card--${surface}`, `card--${padding}`, className)}
    />
  );
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("card-header", className)} />;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("card-content", className)} />;
}
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("card-footer", className)} />;
}
