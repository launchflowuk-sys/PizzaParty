"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";
import { useSelection, type PickerProduct } from "@/components/product/OptionPicker";
import { firstMissingLabel } from "@/components/pos/ProductChips";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { CategoryIcon } from "@/components/FoodIcon";
import { KIOSK_MAX_QTY } from "@/lib/kiosk-rules";
import type { PosProduct } from "@/components/pos/pos-client-types";
import type { KioskLine, KioskUpsell } from "./kiosk-types";
import { productLine } from "./kiosk-lines";
import { ScriptHeadline } from "./KioskAttract";

type SelState = ReturnType<typeof useSelection>;

/** The builder's frame: big photo on one side (on top in portrait), choices, and the add bar. Shared with the deal builder. */
export function BuilderShell({ title, description, image, fallbackSlug, priceNote, onClose, children, footer }: {
  title: string; description?: string; image?: string; fallbackSlug?: string; priceNote?: string;
  onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="kx-modal-back kx-builder-back" onClick={onClose}>
      <div className="kx-builder" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="kx-b-photo" style={image ? { backgroundImage: `url(${image})` } : undefined}>
          {!image && fallbackSlug ? <span className="kx-b-noimg"><CategoryIcon slug={fallbackSlug} size={140} /></span> : null}
          <div className="kx-b-title">
            <span className="kx-b-name">{title}</span>
            {description ? <span className="kx-b-desc">{description}</span> : null}
            {priceNote ? <span className="kx-b-from">{priceNote}</span> : null}
          </div>
        </div>
        <button type="button" className="kx-b-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        <div className="kx-b-body">{children}</div>
        <div className="kx-b-foot">{footer}</div>
      </div>
    </div>
  );
}

/** Sizes as big cards: a pizza-circle that grows with the size, the name and the price. */
export function SizeCards({ state }: { state: SelState }) {
  if (state.sizes.length <= 1) return null;
  const n = state.sizes.length;
  return (
    <fieldset className="kx-group">
      <legend className="kx-legend">Choose your size</legend>
      <div className="kx-sizes" data-n={Math.min(n, 4)}>
        {state.sizes.map((s, i) => (
          <button key={s.key} type="button" className="kx-size" data-on={state.size === s.key ? "1" : "0"} disabled={s.soldOut} onClick={() => state.setSize(s.key)} aria-pressed={state.size === s.key}>
            <span className="kx-size-disc" style={{ "--s": 0.55 + (0.45 * (i + 1)) / n } as React.CSSProperties} aria-hidden="true" />
            <span className="kx-size-name">{s.name}</span>
            <span className="kx-size-price">{s.soldOut ? "Sold out" : gbp(s.price)}</span>
            {state.size === s.key ? <span className="kx-size-tick" aria-hidden="true"><Icon name="check" /></span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Every option group as photo-less chips. Whole toppings only on the kiosk - no halves, simpler for customers. */
export function GroupChips({ groups, state }: { groups: PickerProduct["groups"]; state: SelState }) {
  return (
    <>
      {groups.map((g) => {
        const chosen = state.mods.filter((m) => m.group === g.key).length;
        const full = g.maxSelect > 1 && chosen >= g.maxSelect;
        return (
          <fieldset key={g.key} className="kx-group">
            <legend className="kx-legend">
              {g.name}
              <small>{g.maxSelect === 1 ? (g.minSelect ? "Choose one" : "Optional") : `Choose up to ${g.maxSelect}${chosen ? ` · ${chosen} chosen` : ""}`}</small>
            </legend>
            <div className="kx-chips">
              {g.modifiers.map((m) => {
                const on = state.mods.some((x) => x.group === g.key && x.modifier === m.key);
                return (
                  <button key={m.key} type="button" className="kx-chip" data-on={on ? "1" : "0"} disabled={m.soldOut || (full && !on)} aria-pressed={on} onClick={() => state.toggle(g, m.key)}>
                    <span className="kx-chip-tick" aria-hidden="true">{on ? <Icon name="check" /> : <Icon name="plus" />}</span>
                    <span className="kx-chip-name">{m.name}</span>
                    {m.soldOut ? <span className="kx-chip-price">Sold out</span> : m.price ? <span className="kx-chip-price">+{gbp(m.price)}</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </>
  );
}

export function QtyStepper({ qty, setQty, label }: { qty: number; setQty: (n: number) => void; label: string }) {
  return (
    <div className="kx-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => setQty(qty - 1)} disabled={qty <= 1} aria-label="One fewer"><Icon name="minus" /></button>
      <span aria-live="polite">{qty}</span>
      <button type="button" onClick={() => setQty(qty + 1)} disabled={qty >= KIOSK_MAX_QTY} aria-label="One more"><Icon name="plus" /></button>
    </div>
  );
}

/** Item builder: sizes as big cards, options as chips (useSelection, same as the till and the website), qty, "Add to order £X". */
export function KioskBuilder({ product, onAdd, onClose }: { product: PosProduct; onAdd: (l: KioskLine) => void; onClose: () => void }) {
  const state = useSelection(product);
  const [qty, setQty] = useState(1);
  const missing = firstMissingLabel(product, state);
  const total = state.sel.unitPrice * qty;
  return (
    <BuilderShell
      title={product.name} description={product.description} image={product.image} fallbackSlug={product.categoryKey}
      priceNote={product.sizes.length > 1 ? `from ${gbp(product.minPrice)}` : gbp(product.minPrice)} onClose={onClose}
      footer={
        <>
          <QtyStepper qty={qty} setQty={setQty} label="How many" />
          <button type="button" className="kx-go kx-add" disabled={!state.sel.valid} onClick={() => onAdd(productLine(product, state.sel, qty))}>
            <span>{missing ? `Choose ${missing.toLowerCase()}` : "Add to order"}</span>
            <b>{gbp(total)}</b>
          </button>
        </>
      }
    >
      <SizeCards state={state} />
      <GroupChips groups={product.groups} state={state} />
    </BuilderShell>
  );
}

/** After a main: "Make it a meal?" with three photo cards from other categories. Skippable. */
export function KioskUpsellSheet({ items, onPick, onSkip }: { items: KioskUpsell[]; onPick: (slug: string) => void; onSkip: () => void }) {
  if (!items.length) return null;
  return (
    <div className="kx-modal-back kx-sheet-back" onClick={onSkip}>
      <div className="kx-sheet" role="dialog" aria-modal="true" aria-label="Make it a meal?" onClick={(e) => e.stopPropagation()}>
        <div className="kx-sheet-head">
          <ScriptHeadline text="Make it a meal?" className="kx-sheet-title" />
          <p className="kx-sheet-sub">Add a side, a drink or something sweet</p>
        </div>
        <div className="kx-sheet-cards">
          {items.map((u) => (
            <button key={u.slug} type="button" className="kx-up" onClick={() => onPick(u.slug)}>
              <img src={u.image} alt="" />
              <span className="kx-up-name">{u.name}</span>
              <span className="kx-up-foot"><span className="cd-price-red">{gbp(u.price)}</span><span className="kx-up-add"><Icon name="plus" />Add</span></span>
            </button>
          ))}
        </div>
        <button type="button" className="kx-ghost kx-sheet-skip" onClick={onSkip}>No thanks, continue</button>
      </div>
    </div>
  );
}
