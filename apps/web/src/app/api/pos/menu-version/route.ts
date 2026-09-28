import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getMenu } from "@/lib/menu";
import { posGuard } from "@/lib/pos";

/**
 * A fingerprint of the live menu, so a till left open all shift notices when the
 * back office changes a price, a product or a sold-out flag. ordersCount is left
 * out because every order bumps it, which would reload the till after each sale.
 */
export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const menu = await getMenu();
  const version = createHash("sha1").update(JSON.stringify(menu, (k, v) => (k === "ordersCount" ? undefined : v))).digest("base64url");
  return NextResponse.json({ version });
}
