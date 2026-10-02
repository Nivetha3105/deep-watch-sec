import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
export function Button({ className, variant = "outline", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/85",
    outline: "border-border bg-secondary/45 text-foreground hover:border-primary/50 hover:bg-accent",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
    danger: "border-severity-high/35 bg-severity-high/10 text-severity-high hover:bg-severity-high/20",
  };
  return <button className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", variants[variant], className)} {...props} />;
}
