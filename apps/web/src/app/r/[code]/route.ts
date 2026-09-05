import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { referrerFor } from "@/lib/referral";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The short link a customer shares: /r/DAVE-7K2Q
 *
 * Remembers the code in a cookie and drops the friend on the menu, so they can
 * order the way they normally would and the discount is already waiting at the
 * checkout. A wrong or expired code just sends them to the menu - a stranger
 * following a link should never land on an error page.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = decodeURIComponent(code ?? "").trim().toUpperCase().slice(0, 24);

  const client = await getClientRow();
  const referrer = clean ? await referrerFor(client.id, clean) : null;

  // Built from the site's public address rather than the incoming request:
  // behind a proxy or a tunnel the request URL is the container's own, and
  // sending a customer to http://0.0.0.0:3000 is a dead end.
  const res = NextResponse.redirect(`${env.siteUrl}${referrer ? "/menu?ref=1" : "/menu"}`);
  if (referrer) {
    res.cookies.set("lf_ref", clean, {
      httpOnly: false, // the checkout form reads it to prefill the code box
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  return res;
}
