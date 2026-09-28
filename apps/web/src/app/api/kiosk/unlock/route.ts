import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientRow } from "@/lib/menu";
import { listReaders, managerForPin, readJson } from "@/lib/pos";
import { kioskGuard, setKioskReader } from "@/lib/kiosk";

/** `readerId` present: assign that reader to this kiosk ("" for none). Absent: just unlock. */
const Body = z.object({ pin: z.string().min(1).max(64), readerId: z.string().max(80).optional() });

/**
 * The hidden staff corner: a manager PIN (or the shop password) opens the kiosk's
 * settings - which reader it uses, and leaving kiosk mode. Five wrong PINs lock it
 * for fifteen minutes (managerForPin, keyed to this kiosk's sign-in).
 */
export async function POST(req: NextRequest) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const manager = await managerForPin((await getClientRow()).id, body.pin, `kiosk:${staff.id}`);
  if (!manager) return NextResponse.json({ error: "That manager PIN was not recognised." }, { status: 403 });
  const readers = await listReaders();
  if (body.readerId === undefined) return NextResponse.json({ manager, readers, reader: staff.reader });
  // Only a reader on this shop's own Stripe account; stored in the kiosk's signed cookie.
  if (body.readerId && !readers.some((r) => r.id === body.readerId)) return NextResponse.json({ error: "That card reader was not found." }, { status: 400 });
  const res = NextResponse.json({ manager, readers, reader: body.readerId });
  await setKioskReader(res, staff, body.readerId);
  return res;
}
