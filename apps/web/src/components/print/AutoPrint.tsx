"use client";
import { useEffect } from "react";

/**
 * Print as soon as the page is ready.
 *
 * Waits for images rather than firing on mount: `window.print()` snapshots the
 * page as it stands, so printing before the logo has loaded produces a receipt
 * with a gap where the logo should be — and on a thermal printer that is a
 * blank strip of wasted paper nobody can explain.
 *
 * Whether this puts up a dialog or prints silently is the browser's decision,
 * not ours. Chrome started with `--kiosk-printing` prints straight to the
 * default printer with no dialog, which is how a kitchen tablet should be set
 * up. Without that flag the print dialog opens, which is still useful — it is
 * just one tap rather than none.
 */
export function AutoPrint() {
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.print();
    };

    const images = Array.from(document.images);
    const pending = images.filter((i) => !i.complete);

    if (pending.length === 0) {
      // A frame first, so layout has settled before the snapshot.
      requestAnimationFrame(() => requestAnimationFrame(go));
      return;
    }

    let left = pending.length;
    const tick = () => { if (--left <= 0) go(); };
    for (const img of pending) {
      img.addEventListener("load", tick, { once: true });
      // A missing logo must not stop the docket printing. The order matters
      // more than the picture.
      img.addEventListener("error", tick, { once: true });
    }

    // Backstop: a hung image request cannot be allowed to swallow the ticket.
    const timer = setTimeout(go, 2500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
