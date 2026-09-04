import type { Metadata } from "next";
import { BasketView } from "@/components/basket/BasketView";

export const metadata: Metadata = { title: "Your basket", robots: { index: false } };

/** The screen's heading and container live inside BasketView, because the empty
 *  state and the filled state have different headings in the prototype. */
export default function BasketPage() {
  return <BasketView />;
}
