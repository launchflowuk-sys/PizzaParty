/** Builds kiosk basket lines (with what the order card shows) from a product choice or a finished deal. */
import type { Selection } from "@/components/product/OptionPicker";
import type { BasketComponent } from "@/lib/basket-types";
import type { PosDeal, PosProduct } from "@/components/pos/pos-client-types";
import type { KioskLine } from "./kiosk-types";

/** Line keys are 32 chars at most (the basket schema). */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random()}`.replace(/\D/g, "")).slice(0, 24);

export function productLine(p: PosProduct, sel: Selection, qty: number): KioskLine {
  const extras = p.groups.flatMap((g) => sel.modifiers.filter((m) => m.group === g.key).map((m) => g.modifiers.find((x) => x.key === m.modifier)).filter((m) => !!m).map((m) => ({ name: m.name, price: m.price })));
  return {
    key: newKey(), kind: "product", product: p.slug, size: sel.size, modifiers: sel.modifiers, qty,
    name: p.name, detail: sel.detail, unitPrice: sel.unitPrice, lineTotal: sel.unitPrice * qty, category: p.categoryKey,
    view: { name: p.name, detail: sel.detail, qty, lineTotal: sel.unitPrice * qty, image: p.image, slug: p.slug, size: p.sizes.length > 1 ? sel.sizeName : undefined, unitPrice: sel.unitPrice, modifiers: extras },
  };
}

/** A product with one size and nothing to choose. */
export function simpleLine(p: PosProduct): KioskLine {
  const s = p.sizes.find((x) => !x.soldOut) ?? p.sizes[0]!;
  return productLine(p, { size: s.key, modifiers: [], unitPrice: s.price, valid: true, detail: "", sizeName: s.name }, 1);
}

export type DealPick = { product: PosProduct | (PosDeal["slots"][number]["options"][number]); size: string; modifiers: BasketComponent["modifiers"]; extra: number; label: string };

export function dealLine(deal: PosDeal, picks: { slot: number; pick: DealPick }[], mainsCategory: string): KioskLine {
  const total = deal.price + picks.reduce((a, x) => a + x.pick.extra, 0);
  const components: BasketComponent[] = picks.map((x) => ({ slot: x.slot, product: x.pick.product.slug, size: x.pick.size, modifiers: x.pick.modifiers }));
  const detail = picks.map((x) => x.pick.label).join(", ");
  const image = deal.image ?? picks.map((x) => ("image" in x.pick.product ? x.pick.product.image : undefined)).find(Boolean);
  return {
    key: newKey(), kind: "deal", deal: deal.slug, components, qty: 1, name: deal.name, detail, unitPrice: total, lineTotal: total, category: mainsCategory,
    view: { name: deal.name, detail, qty: 1, lineTotal: total, image, unitPrice: total },
  };
}

/** The card's view follows the qty and the server's price. */
export const viewOf = (l: KioskLine) => ({ ...l.view, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal });
