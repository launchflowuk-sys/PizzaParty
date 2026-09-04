import type { Metadata } from "next";
import { KitchenScreen } from "@/components/kitchen/KitchenScreen";

export const metadata: Metadata = { title: "Kitchen", robots: { index: false } };

export default function KitchenPage() {
  return <KitchenScreen />;
}
