"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PosCall } from "@/lib/pos-phase4-types";
import { parseCallerIdLine } from "./callerid-parser";

export type LiveCall = PosCall & { id: string };

const AUTO_HIDE_MS = 45_000;
const SSE_RETRY_MS = 5000;
/** Bellcore/BT FSK caller-ID boxes are conventionally 1200 baud, 8N1. */
const SERIAL_BAUD = 1200;

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Could not open the caller ID box.";
}

/**
 * Caller ID (POS-PLAN item 28). `useLiveEvents` (lib/use-live-events.ts) only
 * understands order/menu/resync - it is owned by the backend agent's
 * concurrent work, not this one - so this opens its own EventSource against
 * the same `/api/pos/stream` for just the `call` event, per the plan's own
 * fallback ("open a second EventSource listener for call"). The Web Serial
 * path (a USB caller-ID box) raises the identical local PosCall.
 * ponytail: a second SSE connection to one endpoint, simple fixed-interval
 * retry - not the full backoff/visibility machinery of use-live-events.ts,
 * because a missed call banner is not lost data the way a missed order is.
 */
export function useCallerId() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialError, setSerialError] = useState("");

  const push = useCallback((call: PosCall) => {
    const id = `${call.phone}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCalls((prev) => [...prev, { ...call, id }]);
    window.setTimeout(() => setCalls((prev) => prev.filter((c) => c.id !== id)), AUTO_HIDE_MS);
  }, []);

  const dismiss = useCallback((id: string) => setCalls((prev) => prev.filter((c) => c.id !== id)), []);

  /** The VoIP/SIP webhook path already fills customerName in server-side; the Web Serial path has to look it up itself. */
  const raiseCall = useCallback(async (call: PosCall) => {
    if (call.customerName) { push(call); return; }
    try {
      const r = await fetch(`/api/pos/customers?phone=${encodeURIComponent(call.phone)}`);
      const d = (await r.json()) as { customer: { name: string; ordersCount: number } | null };
      push(d.customer ? { ...call, customerName: d.customer.name, ordersCount: d.customer.ordersCount } : call);
    } catch {
      push(call); // a failed lookup still shows the number - better than no banner.
    }
  }, [push]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const open = () => {
      const s = new EventSource("/api/pos/stream");
      es = s;
      s.addEventListener("call", (m) => {
        try { void raiseCall(JSON.parse((m as MessageEvent).data as string) as PosCall); } catch { /* malformed event - ignore */ }
      });
      s.onerror = () => {
        s.close();
        if (es !== s || stopped) return;
        es = null;
        timer = setTimeout(open, SSE_RETRY_MS);
      };
    };
    open();
    return () => { stopped = true; clearTimeout(timer); es?.close(); };
  }, [raiseCall]);

  const readLoop = useCallback(async (port: SerialPort) => {
    if (!port.readable) return;
    // Not pipeThrough(new TextDecoderStream()) - its DOM types don't line up
    // with SerialPort's Uint8Array stream across TS versions. Decoding by hand
    // is a few lines and sidesteps it entirely.
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.search(/[\r\n]/);
        while (idx !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          const phone = parseCallerIdLine(line);
          if (phone) void raiseCall({ phone, at: new Date().toISOString(), line: line.trim() });
          idx = buf.search(/[\r\n]/);
        }
      }
    } catch {
      setSerialError("Caller ID box disconnected.");
    } finally {
      reader.releaseLock();
      setSerialConnected(false);
    }
  }, [raiseCall]);

  const openPort = useCallback(async (port: SerialPort) => {
    try {
      await port.open({ baudRate: SERIAL_BAUD });
      setSerialConnected(true);
      setSerialError("");
      void readLoop(port);
    } catch (e) {
      setSerialError(getErrorMessage(e));
    }
  }, [readLoop]);

  const connectSerial = useCallback(async () => {
    if (!navigator.serial) { setSerialError("This browser cannot use a caller ID box - Chrome desktop only."); return; }
    try {
      const port = await navigator.serial.requestPort();
      await openPort(port);
    } catch {
      // The picker was cancelled - not worth showing as an error.
    }
  }, [openPort]);

  // Remembers the port permission: reconnect without asking again.
  const reconnectedRef = useRef(false);
  useEffect(() => {
    if (reconnectedRef.current || !navigator.serial) return;
    reconnectedRef.current = true;
    navigator.serial.getPorts().then((ports) => { if (ports[0]) void openPort(ports[0]); }).catch(() => {});
  }, [openPort]);

  return {
    calls, dismiss, raiseCall,
    serialSupported: typeof navigator !== "undefined" && !!navigator.serial,
    serialConnected, serialError, connectSerial,
  };
}
