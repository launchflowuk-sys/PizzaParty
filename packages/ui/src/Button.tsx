import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  block?: boolean;
};

export function Button({ variant = "primary", block, className = "", ...rest }: Props) {
  const cls = ["lf-btn", `lf-btn-${variant}`, block ? "lf-btn-block" : "", className].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}
