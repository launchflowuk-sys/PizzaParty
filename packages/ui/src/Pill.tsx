import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: "success" | "warning" | "danger" | "neutral" | "brand" };

const tones: Record<NonNullable<Props["tone"]>, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/25 text-ink",
  danger: "bg-danger/15 text-danger",
  neutral: "bg-line text-ink-soft",
  brand: "bg-brand-soft text-brand",
};

export function Pill({ tone = "neutral", className = "", ...rest }: Props) {
  return <span className={`lf-pill ${tones[tone]} ${className}`} {...rest} />;
}
