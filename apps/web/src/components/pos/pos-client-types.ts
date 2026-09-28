/** UI-only shapes for the till. The wire contract is lib/pos-types.ts - nothing here
 *  is sent to or read from the server as-is. */
import type { PickerProduct } from "@/components/product/OptionPicker";

export type PosProduct = PickerProduct & { minPrice: number; categoryKey: string };
export type PosCategory = { key: string; name: string; products: PosProduct[] };

export type PosDealOption = PickerProduct & { extra: number };
export type PosDealSlot = { name: string; qty: number; sizeKeys: string[]; options: PosDealOption[] };
export type PosDeal = { slug: string; name: string; price: number; description: string; slots: PosDealSlot[] };

/** A single size, no modifier groups: nothing to build, so tapping the tile
 *  should add it straight to the basket instead of opening a builder screen. */
export function isSimpleProduct(p: PosProduct): boolean {
  return p.sizes.length <= 1 && p.groups.length === 0;
}

export type OrderTypeTab = "collection" | "delivery" | "phone";

export type MiddleView =
  | { kind: "grid" }
  | { kind: "product"; product: PosProduct }
  | { kind: "deal"; deal: PosDeal }
  | { kind: "pay" };
