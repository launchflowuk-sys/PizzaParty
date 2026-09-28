import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { env } from "@/lib/env";
import { requireScreen } from "@/lib/session";
import { liveSlots } from "@/lib/promo-slots";
import { SEGMENTS, segmentWhere } from "@/lib/segments";
import { pushCustomerWhere, MAX_PICKED } from "@/lib/push-offers";
import { PushComposer } from "@/components/admin/PushComposer";
import { sendPushOffer } from "../../push-actions";

export const dynamic = "force-dynamic";

/** An offer, straight to the phones of the people who have the app. */
export default async function PushCampaign({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireScreen("campaigns");
  const client = await getClientRow();
  const sp = await searchParams;
  const base = pushCustomerWhere(client.id);
  const now = new Date();

  const [live, all, segments, people, deals, promos, slots] = await Promise.all([
    prisma.client.findUnique({ where: { id: client.id }, select: { notificationsOn: true } }),
    prisma.customer.count({ where: base }),
    Promise.all(SEGMENTS.filter((s) => s.key !== "custom" && s.key !== "all_optin").map(async (s) => ({
      key: s.key, label: s.label, group: s.group,
      n: await prisma.customer.count({ where: { ...base, ...segmentWhere(s.key) } }),
    }))),
    prisma.customer.findMany({ where: base, select: { id: true, name: true, phone: true }, orderBy: { lastOrderAt: { sort: "desc", nulls: "last" } }, take: MAX_PICKED }),
    prisma.deal.findMany({ where: { clientId: client.id, active: true }, select: { id: true, name: true, price: true }, orderBy: { sortOrder: "asc" } }),
    prisma.promo.findMany({
      where: {
        clientId: client.id, active: true, issuedToCustomerId: "",
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
      },
      select: { code: true, type: true, value: true, minOrder: true, maxUses: true, uses: true, firstOrderOnly: true },
      orderBy: { code: "asc" },
    }),
    liveSlots(),
  ]);

  const picked = (sp.ids ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const eligible = new Set(people.map((p) => p.id));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            <Link href="/admin/campaigns" style={{ color: "inherit" }}>Campaigns</Link> &middot; App
          </span>
          <h1>Push an offer</h1>
        </div>
      </header>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 24px", maxWidth: "78ch" }}>
        Goes to customers who have the app, allowed notifications and opted in to marketing &mdash;
        nobody else, however they are picked. Free to send, and tapping it opens the offer in the app.
        It lands in the <Link href="/admin/campaigns">Sent</Link> list and is measured like any other campaign.
      </p>

      {env.pushDryRun ? (
        <p style={{ border: "2px solid var(--color-accent-700)", padding: 12, fontSize: 13, margin: "0 0 24px" }}>
          <strong>Dry run.</strong> This server does not send push (PUSH_DRY_RUN, on by default outside production).
          Everything else happens for real: the campaign is recorded and any codes are created.
        </p>
      ) : null}
      {!live?.notificationsOn ? (
        <p style={{ border: "2px solid var(--color-danger)", padding: 12, fontSize: 13, margin: "0 0 24px" }}>
          Notifications are switched off for the shop, so nothing can be sent. Turn them on under{" "}
          <Link href="/admin/notifications">Notifications</Link>.
        </p>
      ) : null}

      <PushComposer
        action={sendPushOffer}
        shopName={client.name}
        allCount={all}
        segments={segments}
        people={people.map((p) => ({ id: p.id, name: p.name, phone: p.phone }))}
        initialPicked={picked.filter((id) => eligible.has(id))}
        skippedPicked={picked.filter((id) => !eligible.has(id)).length}
        deals={deals}
        promos={promos
          .filter((p) => p.maxUses === null || p.uses < p.maxUses)
          .map((p) => ({ code: p.code, type: p.type, value: p.value, minOrder: p.minOrder, firstOrderOnly: p.firstOrderOnly }))}
        slots={slots.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle }))}
        disabled={!live?.notificationsOn}
      />
    </>
  );
}
