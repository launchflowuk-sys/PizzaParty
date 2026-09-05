"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gbp } from "@/lib/money";

export type PickRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrder: string;
  optIn: boolean;
  points: number;
};

/**
 * The customer list, with the ability to tick people.
 *
 * Every other audience on the campaign screen is a rule - ordered in the last
 * thirty days, spent over two hundred pounds. This is the one that is not: the
 * shop knows things about particular customers that no query does. The office
 * that orders every Friday. The road that had a bad delivery last month.
 *
 * The picked ids travel to the campaign composer in the URL rather than in a
 * store, so the selection survives a refresh and can be handed to somebody else
 * as a link.
 *
 * Ticking somebody is not consent. The send still intersects with opted-in, so
 * a hand-picked list cannot reach anybody who has said no - which is why the
 * opted-out rows are shown but cannot be ticked.
 */
export function PickCustomers({
  rows,
  loyalty,
  adjustPoints,
}: {
  rows: PickRow[];
  loyalty: boolean;
  /** Passed in from the server so the points box can still write, even though
   *  this list has to be a client component to hold the ticks. */
  adjustPoints: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);

  // Only people who could actually be sent to are selectable.
  const selectable = rows.filter((r) => r.optIn).map((r) => r.id);
  const allPicked = selectable.length > 0 && selectable.every((id) => picked.includes(id));

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <div className="fp-pickbar">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={allPicked}
            onChange={() => setPicked(allPicked ? [] : selectable)}
            disabled={selectable.length === 0}
          />
          Tick everyone shown who is opted in ({selectable.length})
        </label>

        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {picked.length === 0 ? "Or tick them one at a time." : `${picked.length} picked`}
        </span>

        <button
          type="button"
          className="btn btn-primary"
          disabled={picked.length === 0}
          onClick={() => router.push(`/admin/campaigns?segment=custom&ids=${picked.join(",")}`)}
        >
          Message these{picked.length > 0 ? ` ${picked.length}` : ""}
        </button>

        {picked.length > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setPicked([])}>Clear</button>
        ) : null}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}><span className="fp-visually-hidden">Pick</span></th>
              <th>Name</th><th>Phone</th>
              <th style={{ textAlign: "right" }}>Orders</th>
              <th style={{ textAlign: "right" }}>Spent</th>
              {loyalty ? <th style={{ textAlign: "right" }}>Points</th> : null}
              <th>Last order</th>
              <th>Marketing</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={loyalty ? 8 : 7} style={{ color: "var(--color-neutral-700)" }}>Nobody matches.</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} data-row={picked.includes(c.id) ? "ok" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={picked.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    disabled={!c.optIn}
                    aria-label={`Pick ${c.name || c.phone}`}
                    title={c.optIn ? undefined : "Opted out of marketing — cannot be messaged"}
                  />
                </td>
                <td style={{ fontWeight: 600 }}>
                  <Link href={`/admin/customers/${c.id}`}>
                    {c.name || c.phone}
                  </Link>
                  {c.email ? <><br /><span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-neutral-700)" }}>{c.email}</span></> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{c.phone}</td>
                <td style={{ textAlign: "right" }}>
                  {c.ordersCount === 0
                    ? <span className="tag tag-warn">Never ordered</span>
                    : c.ordersCount}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{gbp(c.totalSpent)}</td>
                {loyalty ? (
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 700 }}>{c.points}</span>
                    <form action={adjustPoints} style={{ display: "inline-flex", gap: 4, marginLeft: 8, verticalAlign: "middle" }}>
                      <input type="hidden" name="back" value="/admin/customers" />
                      <input type="hidden" name="customerId" value={c.id} />
                      <input name="delta" className="input" inputMode="numeric" placeholder="+/-" aria-label={`Adjust points for ${c.name || c.phone}`} style={{ width: 56 }} />
                      <input name="reason" className="input" placeholder="Reason" aria-label={`Reason for ${c.name || c.phone}`} style={{ width: 120 }} />
                      <button className="btn btn-secondary">Save</button>
                    </form>
                  </td>
                ) : null}
                <td style={{ whiteSpace: "nowrap" }}>{c.lastOrder || "—"}</td>
                <td>
                  {c.optIn
                    ? <span className="tag tag-ok">Opted in</span>
                    : <span className="tag tag-neutral">No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
