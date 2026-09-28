"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useLiveEvents } from "@/lib/use-live-events";

/** Re-renders a server page when an order changes. A burst of events (placed, print_sent...) is one refresh. */
export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = () => { clearTimeout(timer.current); timer.current = setTimeout(() => router.refresh(), 150); };
  // The kitchen stream, not the till one: drivers work dispatch and cannot pass the till guard.
  useLiveEvents("/api/kitchen/stream", { order: refresh, resync: refresh });
  return null;
}
