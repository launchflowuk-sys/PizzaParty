"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, NOTIFY_AUDIENCES, NOTIFY_CHANNELS, NOTIFY_EVENTS } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { requireScreen } from "@/lib/session";

/**
 * Saving the switchboard.
 *
 * The whole grid posts at once rather than each switch firing on change. Two
 * reasons: turning several things off is one decision and should be one save,
 * and a per-switch endpoint on a page with sixty switches is sixty chances to
 * half-apply a change over a bad connection.
 */

// Declared, not assigned to a const: TypeScript only narrows past a `never`
// return for a function declaration, and these are used as guards.
function back(message: string, key: "m" | "e" = "m"): never {
  redirect(`/admin/notifications?${key}=${encodeURIComponent(message)}`);
}

/** Guard against a hand-crafted form naming an event that does not exist. */
function valid(event: string, audience: string, channel: string): boolean {
  return (NOTIFY_EVENTS as readonly string[]).includes(event)
    && (NOTIFY_AUDIENCES as readonly string[]).includes(audience)
    && (NOTIFY_CHANNELS as readonly string[]).includes(channel);
}

export async function saveRules(fd: FormData) {
  await requireScreen("notifications");
  const client = await getClientRow();

  // An unticked checkbox posts nothing at all, so the set of switches on the
  // page is sent as hidden fields and the ticks are checked against it. Without
  // that, "off" is indistinguishable from "not on the page".
  const present = fd.getAll("rule").map(String);
  const on = new Set(fd.getAll("on").map(String));

  const writes = present
    .map((k) => k.split("|"))
    .flatMap(([event, audience, channel]) =>
      event && audience && channel && valid(event, audience, channel) ? [[event, audience, channel] as const] : [])
    .map(([event, audience, channel]) =>
      prisma.notificationRule.upsert({
        where: { clientId_event_audience_channel: { clientId: client.id, event, audience, channel } },
        create: { clientId: client.id, event, audience, channel, enabled: on.has(`${event}|${audience}|${channel}`) },
        update: { enabled: on.has(`${event}|${audience}|${channel}`) },
      }));

  if (writes.length === 0) back("Nothing to save.", "e");
  await prisma.$transaction(writes);

  revalidatePath("/admin/notifications");
  back(`Saved. ${on.size} of ${present.length} switched on.`);
}

export async function saveRecipients(fd: FormData) {
  await requireScreen("notifications");
  const client = await getClientRow();

  const clean = (k: string) => String(fd.get(k) ?? "").trim().slice(0, 200);
  const email = (v: string) => (v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null);

  const ownerEmail = email(clean("ownerEmail"));
  const kitchenEmail = email(clean("kitchenEmail"));
  if (ownerEmail === null) back("That owner email address does not look right.", "e");
  if (kitchenEmail === null) back("That kitchen email address does not look right.", "e");

  await prisma.client.update({
    where: { id: client.id },
    data: {
      ownerEmail,
      ownerSms: clean("ownerSms"),
      kitchenEmail,
      kitchenSms: clean("kitchenSms"),
    },
  });

  revalidatePath("/admin/notifications");
  back("Contact details saved.");
}

/**
 * The master switch.
 *
 * Silences everything without touching the individual settings, so a shop
 * having a bad night can go quiet and come back later to exactly the setup they
 * had. Turning it off does not clear a single toggle.
 */
export async function toggleAll(fd: FormData) {
  await requireScreen("notifications");
  const client = await getClientRow();
  const on = String(fd.get("to")) === "on";
  await prisma.client.update({ where: { id: client.id }, data: { notificationsOn: on } });
  revalidatePath("/admin/notifications");
  back(on ? "Notifications switched back on." : "All notifications paused. Nothing will be sent until you switch this back on.");
}
