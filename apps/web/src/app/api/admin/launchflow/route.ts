import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { COOKIE, verifyToken } from "@/lib/auth";
import { CLIENT_TAG, MENU_TAG } from "@/lib/menu";
import { getConfig, reloadConfig } from "@/lib/config";
import { sendReviewRequests } from "@/lib/orders";
import { postPrinter, sendEmail, sendSms } from "@/lib/notify";

export async function POST(req: NextRequest) {
  if (!(await verifyToken(req.cookies.get(COOKIE.agency)?.value, "agency"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    switch (action) {
      case "reseed": {
        const cfg = reloadConfig();
        const { seedClient } = await import("@launchflow/db/seed");
        const r = await seedClient(cfg.slug);
        revalidateTag(MENU_TAG); revalidateTag(CLIENT_TAG);
        return NextResponse.json({ ok: true, ...r });
      }
      case "revalidate":
        reloadConfig(); revalidateTag(MENU_TAG); revalidateTag(CLIENT_TAG);
        return NextResponse.json({ ok: true });
      case "test-notify": {
        const cfg = getConfig();
        const results = {
          sms: cfg.notifications.kitchenSms ? await sendSms(cfg.notifications.kitchenSms, `${cfg.name}: test message from LaunchFlow ordering.`) : "skipped",
          email: cfg.notifications.kitchenEmail ? await sendEmail(cfg.notifications.kitchenEmail, "Test order notification", "<p>This is a test from LaunchFlow ordering.</p>") : "skipped",
          printer: cfg.notifications.printerWebhook ? await postPrinter(cfg.notifications.printerWebhook, { test: true, text: "TEST PRINT" }) : "skipped",
        };
        return NextResponse.json({ ok: true, results });
      }
      case "review-requests":
        return NextResponse.json({ ok: true, sent: await sendReviewRequests() });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
