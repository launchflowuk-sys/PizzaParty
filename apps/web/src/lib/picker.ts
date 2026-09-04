import type { MenuProduct } from "./menu";
import type { PickerProduct } from "@/components/product/OptionPicker";

export function toPicker(p: MenuProduct): PickerProduct {
  return {
    slug: p.slug, name: p.name, soldOut: p.soldOut,
    sizes: p.sizes.map((s) => ({ key: s.key, name: s.name, price: s.price, soldOut: s.soldOut })),
    groups: p.modifierGroups.map(({ group }) => ({ key: group.key, name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, modifiers: group.modifiers.map((m) => ({ key: m.key, name: m.name, price: m.price, soldOut: m.soldOut })) })),
  };
}
