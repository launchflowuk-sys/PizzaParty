import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "@/lib/auth";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
const canonicalHost = siteUrl ? new URL(siteUrl).host : "";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // 301 legacy / www hosts → canonical. Legacy domains always land on "/".
  if (canonicalHost && host && host !== canonicalHost && !host.startsWith("localhost") && !host.startsWith("127.")) {
    const isWww = host === `www.${canonicalHost}`;
    const dest = new URL(isWww ? pathname + search : "/", siteUrl);
    return NextResponse.redirect(dest, 301);
  }

  // Ops auth gates (pages only; API routes check their own cookies)
  if (pathname.startsWith("/kitchen") && pathname !== "/kitchen/login") {
    if (!(await verifyToken(req.cookies.get(COOKIE.kitchen)?.value, "kitchen"))) return NextResponse.redirect(new URL("/kitchen/login", req.url));
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const admin = await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin");
    const agency = pathname.startsWith("/admin/launchflow") ? await verifyToken(req.cookies.get(COOKIE.agency)?.value, "agency") : null;
    if (!admin && !agency) return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|api/stripe/webhook).*)"],
};
