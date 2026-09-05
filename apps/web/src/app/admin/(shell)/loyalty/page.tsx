import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { requireScreen } from "@/lib/session";
import { rewardValue } from "@/lib/loyalty";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { saveReward, deleteReward } from "../loyalty-actions";

export const dynamic = "force-dynamic";

const BACK = "/admin/loyalty";

type RewardRow = {
  id?: string;
  name: string;
  points: number;
  type: string;
  value: number;
  minOrder: number;
  expiryDays: number;
  active: boolean;
};

/**
 * The rewards club.
 *
 * Points have been landing on completed orders since the beginning; there was
 * nothing to spend them on, which is why the club stayed switched off - a scheme
 * that only ever accrues is worse than no scheme. This is the other half:
 * a list of what points buy, which the shop sets.
 *
 * Claiming a reward mints a single-use code owned by the person who claimed it,
 * so the discount runs through the same checkout, minimum-order and
 * not-your-code checks as every other promotion.
 */
export default async function AdminLoyalty({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("loyalty");
  const client = await getClientRow();
  const cfg = getConfig();
  const { m, e } = await searchParams;

  const [rewards, claimed, members] = await Promise.all([
    prisma.loyaltyReward.findMany({ where: { clientId: client.id }, orderBy: [{ sortOrder: "asc" }, { points: "asc" }] }),
    prisma.promo.count({ where: { clientId: client.id, issuedToCustomerId: { not: "" }, uses: 0, active: true } }),
    prisma.customer.count({ where: { clientId: client.id, loyaltyPoints: { gt: 0 } } }),
  ]);

  const pointsOut = await prisma.customer.aggregate({
    where: { clientId: client.id },
    _sum: { loyaltyPoints: true },
  });

  const rewardForm = (r: RewardRow) => (
    <form action={saveReward} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", padding: "14px 16px", borderBottom: "1px solid var(--color-divider)" }}>
      <input type="hidden" name="back" value={BACK} />
      {r.id ? <input type="hidden" name="id" value={r.id} /> : null}

      <label style={{ flex: "0 1 220px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        What the customer sees
        <input name="name" defaultValue={r.name} className="input" placeholder="£5 off your next order" style={{ display: "block", width: "100%", marginTop: 4, fontWeight: 700 }} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        Costs
        <input name="points" defaultValue={r.points || ""} className="input" inputMode="numeric" placeholder="100" style={{ display: "block", marginTop: 4, width: 80, fontWeight: 700 }} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        Kind
        <select name="type" defaultValue={r.type} className="input" style={{ display: "block", marginTop: 4, width: 130 }}>
          <option value="fixed">Money off</option>
          <option value="percent">Percent off</option>
          <option value="free_delivery">Free delivery</option>
        </select>
      </label>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        Worth
        <input
          name="value"
          defaultValue={r.type === "percent" ? (r.value || "") : r.value ? (r.value / 100).toFixed(2) : ""}
          className="input" inputMode="decimal" placeholder="5.00"
          style={{ display: "block", marginTop: 4, width: 90, fontWeight: 700 }}
        />
      </label>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        Min order £
        <input name="minOrder" defaultValue={r.minOrder ? (r.minOrder / 100).toFixed(2) : ""} className="input" inputMode="decimal" placeholder="0.00" style={{ display: "block", marginTop: 4, width: 90 }} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
        Use within
        <input name="expiryDays" defaultValue={r.expiryDays} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 80 }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, paddingBottom: 8 }}>
        <input type="checkbox" name="active" defaultChecked={r.active} />
        Offered
      </label>
      <button className={r.id ? "btn btn-secondary" : "btn btn-ok"}>{r.id ? "Save" : "Add reward"}</button>
      {r.id ? (
        <button formAction={deleteReward} name="id" value={r.id} className="btn btn-secondary">Remove</button>
      ) : null}
    </form>
  );

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            Back office &middot; {members} member{members === 1 ? "" : "s"} with points
            {claimed > 0 ? <> &middot; <span className="fp-num-warn">{claimed} code{claimed === 1 ? "" : "s"} claimed, unspent</span></> : null}
          </span>
          <h1>
            Rewards club
            <HelpSpot title="How do points turn into money off?" article="rewards-club" anchor="what-actually-happens-when-someone-claims-one">
              A customer picks a reward on their rewards page. The points come off there and then, and they
              get a one-use code in exchange, tied to them — nobody else can spend it even if they hear it.
              It goes in at checkout like any other code, and the minimum order you set here is enforced.
            </HelpSpot>
          </h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={BACK} />

      {!cfg.loyalty.enabled ? (
        <div className="fp-panel" data-tone="warn" style={{ marginBottom: 16 }}>
          <header><span>The club is switched off</span></header>
          <div className="body">
            <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0, maxWidth: "72ch" }}>
              Points are not being awarded and the rewards page is hidden from customers. You can set the
              rewards up here first; ask LaunchFlow to switch the club on when you are happy with them.
            </p>
          </div>
        </div>
      ) : null}

      <div className="fp-panel">
        <header>
          <span>How it earns</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{cfg.loyalty.pointsPerPound} point per £1</span>
        </header>
        <div className="body">
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0, maxWidth: "72ch" }}>
            Points land when an order is marked completed, on the food total before delivery — so a refunded
            or cancelled order never earns any. Customers are holding{" "}
            <strong>{(pointsOut._sum.loyaltyPoints ?? 0).toLocaleString("en-GB")} points</strong> between
            them at the moment.
          </p>
        </div>
      </div>

      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header>
          <span>What points buy</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{rewards.filter((r) => r.active).length} offered</span>
        </header>
        <div className="body" style={{ padding: 0 }}>
          {rewards.map((r) => (
            <div key={r.id} style={{ opacity: r.active ? 1 : .62 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)", margin: 0, padding: "10px 16px 0" }}>
                {r.points} points &rarr; {rewardValue(r)}
                {!r.active ? " · not offered" : ""}
              </p>
              {rewardForm(r)}
            </div>
          ))}

          <div style={{ background: "var(--ok-bg)" }}>
            {rewardForm({ name: "", points: 0, type: "fixed", value: 0, minOrder: 0, expiryDays: 60, active: true })}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "16px 0 0", maxWidth: "78ch" }}>
        <strong>Use within</strong> is how many days the code lives once it is claimed. The points are gone
        the moment the customer claims it, so this is the window they have to actually spend it — keep it
        generous enough that nobody feels robbed. Removing a reward from this list does not cancel codes
        somebody has already claimed.
      </p>
    </>
  );
}
