import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";
import { gbp } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { prettyPhone } from "@/lib/phone";
import { LoginForm } from "@/components/account/LoginForm";
import { ReorderButton } from "@/components/order/ReorderButton";
import { LogoutButton } from "@/components/account/LogoutButton";
import { ReferralCard } from "@/components/account/ReferralCard";
import { ensureReferralCode } from "@/lib/referral";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

/** Account and order history, following the prototype's ruled-row treatment. */
export default async function AccountPage() {
  const customer = await currentCustomer();

  if (!customer) {
    return (
      <section className="fp-wrap" style={{ padding: "40px 32px 64px", maxWidth: 640 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Account</span>
        <h1 className="fp-h1" style={{ marginBottom: 12 }}>Log in</h1>
        <p style={{ fontSize: 15, color: "var(--color-neutral-800)", margin: "0 0 24px" }}>
          We&apos;ll text you a one-time code. No password needed.
        </p>
        <LoginForm />
      </section>
    );
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id, status: { not: "pending_payment" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { items: { where: { parentId: null }, select: { qty: true, name: true } } },
  });

  // Referral panel. The code is minted the first time they look at this page,
  // so nobody carries one who never asked for it.
  const cfg = getConfig();
  const referral = cfg.referral.enabled
    ? await (async () => {
        const code = await ensureReferralCode(customer.id);
        const [referred, earned] = await Promise.all([
          prisma.customer.count({ where: { referredById: customer.id, ordersCount: { gt: 0 } } }),
          prisma.marketingSend.count({ where: { customerId: customer.id, kind: "referral_reward", status: "sent" } }),
        ]);
        const money = (n: number) => `£${n.toFixed(2)}`;
        return {
          code,
          link: `${env.siteUrl}/r/${encodeURIComponent(code)}`,
          refereeDiscount: money(cfg.referral.refereeDiscount),
          referrerReward: money(cfg.referral.referrerReward),
          minOrder: money(cfg.referral.minOrder),
          referred, earned,
        };
      })()
    : null;

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Account</span>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
        <div>
          <h1 className="fp-h1">Hi {customer.name?.split(" ")[0] || "there"}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--color-neutral-700)" }}>
            {prettyPhone(customer.phone)}{customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="fp-split-checkout">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Past orders</span>
          {orders.length === 0 ? (
            <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>
              No orders yet. <Link href="/menu">Start one</Link>.
            </p>
          ) : (
            <div style={{ borderTop: "2px solid var(--color-divider)" }}>
              {orders.map((o) => (
                <div key={o.id} className="fp-orderrow">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      #{o.number} &middot; {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(o.createdAt)}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 2 }}>
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </div>
                  </div>
                  <span className="tag tag-neutral">{STATUS_LABEL[o.status]}</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{gbp(o.total)}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/order/${o.id}`} className="btn btn-secondary">Details</Link>
                    <ReorderButton orderId={o.id} label="Reorder" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside style={{ display: "grid", gap: 24, alignContent: "start" }}>
          {referral ? (
            <ReferralCard
              code={referral.code}
              link={referral.link}
              refereeDiscount={referral.refereeDiscount}
              referrerReward={referral.referrerReward}
              minOrder={referral.minOrder}
              referred={referral.referred}
              earned={referral.earned}
            />
          ) : null}
          <div style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>Crust Club</span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 1, letterSpacing: "-.03em", color: "var(--color-accent)" }}>
              {customer.loyaltyPoints}
            </span>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-800)" }}>
              points earned so far. Points accrue on paid orders.
            </p>
          </div>

          <div>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>Saved addresses</span>
            {customer.addresses.length ? (
              <div style={{ borderTop: "2px solid var(--color-divider)" }}>
                {customer.addresses.map((a) => (
                  <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 14 }}>
                    {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ")}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: "var(--color-neutral-700)", margin: 0 }}>
                Addresses are saved automatically when you order.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
