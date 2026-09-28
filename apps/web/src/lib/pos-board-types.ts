/**
 * Order status board contract (POS-PLAN item 36). GET /api/pos/board. No server imports.
 * "Preparing" covers placed/accepted/preparing; "ready" is ready-to-collect. A completed
 * order simply stops being returned; a ready order drops off after 30 minutes even if
 * nobody marks it collected (see READY_TTL_MS in the route).
 */
export type BoardOrderState = "preparing" | "ready";

export type BoardOrder = {
  id: string;
  number: number;
  /** First name only, or null when the shop has turned names off (config `pos.boardShowNames`). */
  name: string | null;
  /** Raw Order.source ("web" | "app" | "pos" | "phone" | "kiosk" | a marketplace slug...) - the board maps it to an icon itself. */
  source: string;
  state: BoardOrderState;
};

export type BoardResponse = { orders: BoardOrder[] };
