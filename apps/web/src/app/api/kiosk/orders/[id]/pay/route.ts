import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { stripeServerEnabled } from "@/lib/stripe";
import { getConfig } from "@/lib/config";
import { paymentView, ReaderError, startReaderPayment } from "@/lib/pos";
import { kioskGuard, kioskLimit, kioskOrder, reserveKioskReader } from "@/lib/kiosk";

/** Send the whole of a kiosk order to the reader a manager assigned this kiosk (its signed cookie, never the request). Same server-driven Stripe Terminal flow as the till; the webhook or the poll places it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const limited = kioskLimit(req, staff, "pay");
  if (limited) return limited;
  if (!staff.reader) return NextResponse.json({ error: "This kiosk has no card reader. Please pay at the counter." }, { status: 409 });
  if (!stripeServerEnabled() || !getConfig().pos.kiosk.card) return NextResponse.json({ error: "Card payments are not set up." }, { status: 503 });
  const { id } = await params;
  const order = await kioskOrder((await getClientRow()).id, id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const reserved = await reserveKioskReader(order.id);
  if (!("payment" in reserved) || !reserved.payment) return NextResponse.json(reserved, { status: 409 });
  try {
    const p = await startReaderPayment(order, reserved.payment, staff.reader, staff.name);
    return NextResponse.json(await paymentView(p.id, staff.name));
  } catch (e) {
    if (!(e instanceof ReaderError)) throw e;
    return NextResponse.json({ ...(await paymentView(e.paymentId, staff.name)), status: "failed", message: "The card reader is not responding. Please pay at the counter." });
  }
}
