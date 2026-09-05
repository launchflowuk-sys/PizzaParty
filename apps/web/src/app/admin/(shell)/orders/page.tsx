import Link from "next/link";
import { prisma, type OrderStatus } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE, STATUS_ROW } from "@/lib/orders";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";

export const dynamic = "force-dynamic";
const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
const PER_PAGE = 50;

/**
 * The order book.
 *
 * Colour is doing real work here rather than decorating: a rejected order is
 * red, one waiting to be accepted is blue, one in the oven is purple, and each
 * carries a bar down the left of its row. Staff read this all shift, and the
 * previous version was one weight of black on one grey, which meant scanning it
 * with a finger.
 */
export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string; page?: string }> }) {
  await requireScreen("orders");
  const sp = await searchParams;
  const client = await getClientRow();
  const page = Math.max(1, Number(sp.page ?? 1));

  const where = {
    clientId: client.id,
    ...(sp.status && STATUSES.includes(sp.status as OrderStatus)
      ? { status: sp.status as OrderStatus }
      : { status: { not: "pending_payment" as const } }),
    ...(sp.from ? { createdAt: { gte: new Date(sp.from), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}) } } : {}),
    ...(sp.q
      ? { OR: [
          { customerName: { contains: sp.q, mode: "insensitive" as const } },
          { customerPhone: { contains: sp.q } },
          { deliveryPostcode: { contains: sp.q.toUpperCase() } },
        ] }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE, include: { location: true } }),
    prisma.order.count({ where }),
  ]);

  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const needsAction = orders.filter((o) => o.status === "placed" || o.status === "pending_payment").length;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            Back office &middot; {total} order{total === 1 ? "" : "s"}
            {needsAction > 0 ? (
              <> &middot; <span className="fp-num-warn">{needsAction} waiting on you</span>
                <HelpSpot title="Waiting on me for what?" article="orders-history" anchor="finding-an-order">
                  Orders that have been placed and not yet accepted, so they are sitting on the kitchen board.
                  It only counts the fifty rows on this page, not the whole book, so it starts again on page two.
                </HelpSpot>
              </>
            ) : null}
          </span>
          <h1>Orders</h1>
        </div>
        <span style={{ display: "flex", alignItems: "center" }}>
          <a href={`/api/admin/orders.csv?${qs}`} className="btn btn-secondary">Export CSV</a>
          <HelpSpot title="Does this export what I am looking at?" article="orders-history" anchor="the-csv-export">
            Only the Status and the From / To dates carry over — the Search box does not, so a search for one
            customer still exports every order in the date range. It also stops at the newest 5,000 rows without
            saying so, so take a long period a month at a time.
          </HelpSpot>
        </span>
      </header>

      <div className="fp-panel">
        <header>Filter</header>
        <div className="body">
          <form style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
            <div className="field" style={{ flex: "1 1 170px", minWidth: 0 }}>
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
                <option value="">All except unpaid</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="from">From</label>
              <input id="from" name="from" type="date" defaultValue={sp.from} className="input" />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" name="to" type="date" defaultValue={sp.to} className="input" />
            </div>
            <div className="field" style={{ flex: "2 1 220px", minWidth: 0 }}>
              <label htmlFor="q">Search
                <HelpSpot title="Why does a phone number find nothing?" article="orders-history" anchor="phone-search-gotcha">
                  It matches the number exactly as it was saved, and website orders are saved in the
                  international form &mdash; <code>+447700900201</code>, no spaces. Drop the leading zero and the
                  spaces, or just search the last six digits.
                </HelpSpot>
              </label>
              <input id="q" name="q" placeholder="Name, phone or postcode" defaultValue={sp.q} className="input" />
            </div>
            <button className="btn btn-primary">Filter</button>
            {qs ? <Link href="/admin/orders" className="btn btn-secondary">Clear</Link> : null}
          </form>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>#<HelpSpot title="Where does an order number go?" article="orders-history" anchor="the-order-link-is-public">
                To the customer’s own tracking page, not an order screen. It needs no login — anyone with the
                link can see the order and the delivery address — so open it yourself, but do not forward it.
              </HelpSpot></th><th>When</th><th>Customer</th><th>Type</th><th>Where</th><th>Status<HelpSpot title="Can I change an order from here?" article="orders-history" anchor="this-screen-is-read-only">
                No. Nothing on this screen changes an order — there is no edit, no note, no resend and no refund
                button anywhere in the back office. Orders are worked on the kitchen screen, and card money goes
                back through Stripe.
              </HelpSpot></th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={7} style={{ color: "var(--color-neutral-700)" }}>No orders match.</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} data-row={STATUS_ROW[o.status]}>
                <td style={{ fontWeight: 700 }}><Link href={`/order/${o.id}`}>#{o.number}</Link></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {o.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  <br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{o.createdAt.toLocaleDateString("en-GB")}</span>
                </td>
                <td>
                  {o.customerName}
                  <br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{o.customerPhone}</span>
                </td>
                <td>
                  <span className={o.fulfilment === "delivery" ? "tag tag-info" : "tag tag-busy"}>{o.fulfilment}</span>
                  <br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{o.paymentMethod}</span>
                </td>
                <td>
                  {o.deliveryPostcode || o.location.name}
                  {o.deliveryPostcode ? <><br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{o.deliveryCity}</span></> : null}
                </td>
                <td><span className={`tag tag-${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{gbp(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PER_PAGE ? (
        <p style={{ marginTop: 16, fontSize: 14, display: "flex", gap: 16 }}>
          {page > 1 ? <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}>&larr; Previous</Link> : null}
          <span style={{ color: "var(--color-neutral-700)" }}>
            {(page - 1) * PER_PAGE + 1}&ndash;{Math.min(page * PER_PAGE, total)} of {total}
          </span>
          {page * PER_PAGE < total ? <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>Next &rarr;</Link> : null}
        </p>
      ) : null}
    </>
  );
}
