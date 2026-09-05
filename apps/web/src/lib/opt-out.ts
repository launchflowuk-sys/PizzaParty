import "server-only";
import { prisma } from "@launchflow/db";
import { toE164 } from "./phone";

/**
 * Acting on "STOP".
 *
 * Every message this system sends carries "Reply STOP to opt out". That promise
 * is only worth something if a reply is received and acted on, which is what
 * this does. Under PECR the shop has to honour the request and be able to show
 * it did, so the flag is cleared *and* the reply is kept.
 *
 * The keyword list is the one the UK networks and Twilio already recognise, so
 * a customer who has learnt "STOP" from any other sender is understood here.
 */
const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "opt-out", "remove"];
const START_WORDS = ["start", "unstop", "yes", "subscribe", "optin", "opt-in"];

export type Keyword = "stop" | "start" | "";

/**
 * Read the keyword out of a reply.
 *
 * Matched on the first word only, and only when the message is short. "Stop
 * putting olives on it" is a complaint about olives, not an opt-out, and
 * treating it as one would lose the shop a customer it could have kept.
 */
export function keywordOf(body: string): Keyword {
  const cleaned = body.trim().toLowerCase().replace(/[^a-z\s-]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 2) return "";
  const first = words[0]!;
  if (STOP_WORDS.includes(first)) return "stop";
  if (START_WORDS.includes(first)) return "start";
  return "";
}

export type InboundResult = {
  keyword: Keyword;
  matched: boolean;
  /** What to text back, or "" to stay silent. */
  reply: string;
};

/**
 * Record one inbound message and act on it.
 *
 * Unknown numbers are still stored: someone can text the shop from a phone that
 * has never ordered, and their opt-out request counts just the same - it simply
 * has no customer row to clear yet.
 */
export async function handleInbound(args: {
  clientId: string;
  clientName: string;
  from: string;
  body: string;
  providerId?: string;
}): Promise<InboundResult> {
  const phone = toE164(args.from) || args.from.trim();
  const keyword = keywordOf(args.body);

  const customer = await prisma.customer.findUnique({
    where: { clientId_phone: { clientId: args.clientId, phone } },
    select: { id: true, marketingOptIn: true },
  });

  await prisma.smsInbound.create({
    data: {
      clientId: args.clientId,
      customerId: customer?.id ?? null,
      fromPhone: phone,
      body: args.body.slice(0, 500),
      keyword,
      providerId: (args.providerId ?? "").slice(0, 64),
    },
  });

  if (keyword === "stop") {
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { marketingOptIn: false, optOutAt: new Date(), optOutSource: "sms" },
      });
    }
    // Confirmed even for an unknown number, so the person is not left wondering
    // whether it worked.
    return { keyword, matched: !!customer, reply: `${args.clientName}: you will not get any more marketing texts from us. Reply START to opt back in.` };
  }

  if (keyword === "start") {
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { marketingOptIn: true, optOutAt: null, optOutSource: "" },
      });
      return { keyword, matched: true, reply: `${args.clientName}: you're back on the list. Reply STOP any time.` };
    }
    // Nothing to opt in to yet, and silently claiming otherwise would be a lie.
    return { keyword, matched: false, reply: `${args.clientName}: we don't have this number on file. Opt in at the checkout next time you order.` };
  }

  // Anything else is a real message for the shop, not a command. Stored, not
  // answered - an automatic reply to "where is my order" is worse than none.
  return { keyword: "", matched: !!customer, reply: "" };
}
