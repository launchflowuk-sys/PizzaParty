/** Shared between the client basket store and the server pricing engine. No server imports here. */
export type BasketModifier = { group: string; modifier: string };
export type BasketComponent = { slot: number; product: string; size: string; modifiers: BasketModifier[] };

export type BasketLine = {
  key: string;
  kind: "product" | "deal";
  product?: string;
  size?: string;
  modifiers?: BasketModifier[];
  deal?: string;
  components?: BasketComponent[];
  qty: number;
  notes?: string;
  /** Display cache written by the client; the server never trusts these. */
  name?: string;
  detail?: string;
  unitPrice?: number;
  lineTotal?: number;
};

export type Fulfilment = "delivery" | "collection";

export type PricedLine = {
  key: string;
  kind: "product" | "deal";
  name: string;
  detail: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  productId?: string;
  dealId?: string;
  sizeKey: string;
  sizeName: string;
  modifiers: { groupName: string; name: string; price: number }[];
  components: { productId: string; name: string; sizeKey: string; sizeName: string; modifiers: { groupName: string; name: string; price: number }[] }[];
  notes: string;
};

export type PricedBasket = {
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promoCode: string;
  promoMessage: string;
  errors: string[];
  removedKeys: string[];
};
