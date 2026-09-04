import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`lf-input ${className}`} {...rest} />;
}

export function Label({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`lf-label ${className}`} {...rest} />;
}
