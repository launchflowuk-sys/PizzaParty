import type { Metadata } from "next";
import { requireScreen } from "@/lib/session";
import { PosDisplayClient } from "@/components/pos/PosDisplayClient";

export const metadata: Metadata = { title: "Customer display", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Second-screen customer display (POS-PLAN item 29). Staff open it from the
 * till's TopBar ("Open customer display") and drag it to the customer-facing
 * monitor; it needs no data of its own beyond the shop name, everything else
 * arrives over BroadcastChannel from whichever till window is open.
 */
export default async function PosDisplayPage() {
  await requireScreen("pos");
  return <PosDisplayClient />;
}
