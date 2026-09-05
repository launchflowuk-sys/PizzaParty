"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Suggestion = { id: string; main: string; secondary: string };
export type PickedAddress = { line1: string; line2: string; city: string; postcode: string };

/**
 * Finding the customer's actual door.
 *
 * A takeaway is not delivering to a postcode, it is delivering to a flat above a
 * shop with the bell that does not work. Typed addresses turn up misspelt,
 * abbreviated, or missing the flat number, and the driver discovers it on the
 * pavement at eleven at night with the food going cold.
 *
 * Typing stays possible throughout. This suggests; it never traps somebody who
 * lives somewhere Google has not heard of - a new build, an annexe, a caravan -
 * and if the lookup is switched off or fails, the ordinary fields are still
 * there and the order still goes through. An address box that will not accept
 * an address is worse than no address box.
 */
export function AddressAutocomplete({
  value,
  onPick,
  onType,
}: {
  value: string;
  /** A chosen address, already split into lines by the server. */
  onPick: (a: PickedAddress) => void;
  /** Every keystroke, so the customer can still type it themselves. */
  onType: (v: string) => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /**
   * One token for the whole lookup.
   *
   * Google bills the keystrokes and the final details call as a single session
   * when they share a token, and separately when they do not. It is replaced
   * once an address is chosen, so the next lookup starts a new session.
   */
  const session = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A request per keystroke would be a request per keystroke, and Google charges
  // for those. Waits for a pause, and abandons anything already in flight.
  useEffect(() => {
    if (value.trim().length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/address?q=${encodeURIComponent(value)}&session=${session.current}`, { signal: ctrl.signal });
        const d = (await r.json()) as { suggestions?: Suggestion[] };
        setItems(d.suggestions ?? []);
      } catch { /* aborted or offline - the typed address still stands */ }
      finally { setBusy(false); }
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const choose = useCallback(async (s: Suggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      const r = await fetch(`/api/address?id=${encodeURIComponent(s.id)}&session=${session.current}`);
      const d = (await r.json()) as { address?: PickedAddress | null };
      if (d.address) onPick(d.address);
      else onType([s.main, s.secondary].filter(Boolean).join(", "));
    } catch {
      // Could not resolve it - keep what they picked as text rather than
      // clearing the box and making them start again.
      onType([s.main, s.secondary].filter(Boolean).join(", "));
    } finally {
      setBusy(false);
      session.current = crypto.randomUUID();
    }
  }, [onPick, onType]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); void choose(items[active]!); }
  }

  const show = open && value.trim().length >= 3 && (items.length > 0 || busy);

  return (
    <div className="fp-addr" ref={wrap}>
      <input
        id="line1"
        className="input"
        required
        autoComplete="address-line1"
        placeholder="Start typing your address or postcode"
        value={value}
        onChange={(e) => { onType(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={show}
        aria-controls="fp-addr-list"
        aria-autocomplete="list"
      />

      {show ? (
        <div className="fp-addr-drop" id="fp-addr-list" role="listbox">
          {items.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className="fp-addr-row"
              data-active={i === active ? "1" : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => void choose(s)}
            >
              <span className="fp-addr-pin" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.6" />
                </svg>
              </span>
              <span className="fp-addr-text">
                <span className="fp-addr-main">{s.main}</span>
                {s.secondary ? <span className="fp-addr-sec">{s.secondary}</span> : null}
              </span>
            </button>
          ))}
          {busy && items.length === 0 ? <p className="fp-addr-busy">Looking…</p> : null}
          <p className="fp-addr-foot">Cannot see it? Keep typing — you can write the address yourself.</p>
        </div>
      ) : null}
    </div>
  );
}
