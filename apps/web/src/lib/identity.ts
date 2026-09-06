import "server-only";
import { prisma } from "@launchflow/db";
import { toE164 } from "@/lib/phone";

/**
 * Who is asking to log in.
 *
 * One box on the form, because making somebody choose "email or mobile?"
 * before they have typed anything is a decision they should not have to make.
 * What they typed decides the channel.
 *
 * Logging in by email is **recognition, not registration**. Every order
 * already captures a phone number and, if they gave one, an email address - so
 * anybody who has ordered can come back with either. Nobody is asked to create
 * an account, which is the whole point: they order, and later they log in.
 *
 * The reason this matters commercially: a text costs around 4p and an email
 * costs nothing. Sending every login code by SMS, on a shop doing a few
 * hundred logins a month, is a bill for something that could be free.
 */

export type Identifier =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string }
  | { kind: "invalid" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Work out what somebody typed. An "@" is the only signal needed. */
export function readIdentifier(raw: string): Identifier {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "invalid" };

  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.test(email) ? { kind: "email", email } : { kind: "invalid" };
  }

  const phone = toE164(value);
  return phone ? { kind: "phone", phone } : { kind: "invalid" };
}

/**
 * Find the customer behind an identifier.
 *
 * A phone number creates a record if there is not one, because that is the
 * shop's primary key for a person and a first-time visitor logging in before
 * ordering is normal.
 *
 * An email address never creates one. Email is not unique in this table -
 * a household can share an address, and a typo would otherwise mint an
 * unreachable account - so it can only ever match somebody who has already
 * ordered. Where two records share an address, the one that ordered most
 * recently is the one being asked for.
 */
export async function findCustomer(clientId: string, id: Identifier) {
  if (id.kind === "phone") {
    return prisma.customer.upsert({
      where: { clientId_phone: { clientId, phone: id.phone } },
      create: { clientId, phone: id.phone, guest: true },
      update: {},
    });
  }

  if (id.kind === "email") {
    return prisma.customer.findFirst({
      where: { clientId, email: { equals: id.email, mode: "insensitive" } },
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
    });
  }

  return null;
}
