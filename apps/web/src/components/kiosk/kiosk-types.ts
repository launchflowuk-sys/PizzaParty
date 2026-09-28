/** UI shapes for the self-service kiosk (POS-PLAN item 35). The wire contract is lib/kiosk-rules.ts. */
import type { BasketLine } from "@/lib/basket-types";
import type { PosDisplayLine } from "@/lib/pos-phase4-types";

export type KioskBrand = { shopName: string; logoUrl: string; tagline: string };
/** One attract-loop slide. `from`: the price is the smallest size ("from £9"). */
export type KioskSlide = { kicker: string; headline: string; subline: string; price: number | null; image: string; from?: boolean };
export type KioskUpsell = { slug: string; category: string; name: string; detail: string; price: number; image: string };

/** A basket line plus what the order card shows (photo, size, priced extras). */
export type KioskLine = BasketLine & { key: string; name: string; unitPrice: number; lineTotal: number; view: PosDisplayLine; category?: string };

export type KioskStage = "attract" | "type" | "menu" | "basket" | "pay" | "card" | "done";
