import type { Metadata } from "next";
import { BasketView } from "@/components/basket/BasketView";

export const metadata: Metadata = { title: "Your basket", robots: { index: false } };

export default function BasketPage() {
  return (
    <div className="lf-container max-w-2xl">
      <h1 className="lf-h1 pt-6">Your basket</h1>
      <BasketView />
    </div>
  );
}
