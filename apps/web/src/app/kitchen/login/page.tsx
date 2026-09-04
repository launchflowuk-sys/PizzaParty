import type { Metadata } from "next";
import { PinForm } from "@/components/kitchen/PinForm";

export const metadata: Metadata = { title: "Kitchen login", robots: { index: false } };

export default function KitchenLogin() {
  return (
    <div className="lf-container max-w-sm">
      <h1 className="lf-h1 pt-10">Kitchen</h1>
      <p className="text-muted mt-1">Enter the kitchen PIN.</p>
      <PinForm />
    </div>
  );
}
