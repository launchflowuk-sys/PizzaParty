"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import { useSelection } from "@/components/product/OptionPicker";
import { firstMissingLabel } from "@/components/pos/ProductChips";
import { Icon } from "@/components/pos/PosDisplayIcons";
import type { PosDeal, PosDealOption } from "@/components/pos/pos-client-types";
import type { KioskLine } from "./kiosk-types";
import { dealLine, type DealPick } from "./kiosk-lines";
import { BuilderShell, GroupChips, SizeCards } from "./KioskBuilder";

/**
 * Deal builder, slot by slot - the same picks-per-slot idea as the till's DealPanel,
 * with photo cards for each choice and the kiosk's size cards and chips. A choice
 * with nothing to pick (one size, no options) is taken straight away.
 */
export function KioskDealBuilder({ deal, mainsCategory, onAdd, onClose }: { deal: PosDeal; mainsCategory: string; onAdd: (l: KioskLine) => void; onClose: () => void }) {
  const [picks, setPicks] = useState<(DealPick | null)[][]>(deal.slots.map((s) => Array<DealPick | null>(s.qty).fill(null)));
  const [editing, setEditing] = useState<{ slot: number; n: number } | null>(null);
  const flat = useMemo(() => picks.flatMap((arr, slot) => arr.map((p, n) => ({ slot, n, p }))), [picks]);
  const next = editing ?? flat.find((x) => !x.p) ?? null;
  const total = deal.price + flat.reduce((a, x) => a + (x.p?.extra ?? 0), 0);
  const done = flat.every((x) => x.p);

  const set = (slot: number, n: number, p: DealPick | null) => setPicks((prev) => prev.map((arr, s) => (s === slot ? arr.map((v, i) => (i === n ? p : v)) : arr)));

  return (
    <BuilderShell
      title={deal.name} description={deal.description} image={deal.image ?? deal.slots.flatMap((s) => s.options).find((o) => o.image)?.image}
      priceNote={gbp(deal.price)} onClose={onClose}
      footer={
        <button type="button" className="kx-go kx-add" disabled={!done || !!editing} onClick={() => onAdd(dealLine(deal, flat.map((x) => ({ slot: x.slot, pick: x.p! })), mainsCategory))}>
          <span>{done ? "Add deal to order" : `Choose ${deal.slots[next?.slot ?? 0]!.name.toLowerCase()}`}</span>
          <b>{gbp(total)}</b>
        </button>
      }
    >
      <ol className="kx-steps">
        {flat.map((x, i) => {
          const slot = deal.slots[x.slot]!;
          const current = next?.slot === x.slot && next.n === x.n;
          return (
            <li key={`${x.slot}-${x.n}`} className="kx-step" data-state={current ? "now" : x.p ? "done" : "todo"}>
              <span className="kx-step-num">{x.p && !current ? <Icon name="check" /> : i + 1}</span>
              <span className="kx-step-text">
                <b>{slot.name}{slot.qty > 1 ? ` ${x.n + 1}` : ""}</b>
                <span>{x.p ? x.p.label : current ? "Choose below" : "To choose"}</span>
              </span>
              {x.p && !current ? <button type="button" className="kx-step-change" onClick={() => { set(x.slot, x.n, null); setEditing({ slot: x.slot, n: x.n }); }}>Change</button> : null}
            </li>
          );
        })}
      </ol>
      {next ? (
        <SlotChooser
          key={`${next.slot}-${next.n}`} deal={deal} slotIndex={next.slot}
          onPick={(p) => { set(next.slot, next.n, p); setEditing(null); }}
        />
      ) : null}
    </BuilderShell>
  );
}

function SlotChooser({ deal, slotIndex, onPick }: { deal: PosDeal; slotIndex: number; onPick: (p: DealPick) => void }) {
  const slot = deal.slots[slotIndex]!;
  const [chosen, setChosen] = useState<PosDealOption | null>(slot.options.length === 1 ? slot.options[0]! : null);
  if (chosen) return <SlotOptions option={chosen} sizeKeys={slot.sizeKeys} onBack={slot.options.length > 1 ? () => setChosen(null) : undefined} onPick={onPick} />;
  return (
    <fieldset className="kx-group">
      <legend className="kx-legend">Choose your {slot.name.toLowerCase()}</legend>
      <div className="kx-opts">
        {slot.options.map((o) => (
          <button key={o.slug} type="button" className="kx-opt" disabled={o.soldOut} onClick={() => setChosen(o)}>
            {o.image ? <img src={o.image} alt="" loading="lazy" /> : <span className="kx-opt-noimg" aria-hidden="true">{o.name.slice(0, 1)}</span>}
            <span className="kx-opt-name">{o.name}</span>
            <span className="kx-opt-price" data-free={!o.soldOut && !o.extra ? "1" : "0"}>{o.soldOut ? "Sold out" : o.extra ? `+${gbp(o.extra)}` : "Included"}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SlotOptions({ option, sizeKeys, onBack, onPick }: { option: PosDealOption; sizeKeys: string[]; onBack?: () => void; onPick: (p: DealPick) => void }) {
  const state = useSelection(option, sizeKeys);
  const missing = firstMissingLabel(option, state);
  const base = state.sizes.find((s) => s.key === state.sel.size)?.price ?? 0;
  const extra = state.sel.unitPrice - base + option.extra;
  const pick = (): DealPick => ({ product: option, size: state.sel.size, modifiers: state.sel.modifiers, extra, label: `${option.name}${state.sel.detail ? ` (${state.sel.detail})` : ""}` });
  const nothingToChoose = state.sizes.length <= 1 && option.groups.length === 0;
  return (
    <div className="kx-slotopts">
      <div className="kx-slotopts-head">
        {option.image ? <img src={option.image} alt="" /> : null}
        <b>{option.name}</b>
        {onBack ? <button type="button" className="kx-step-change" onClick={onBack}>Change</button> : null}
      </div>
      {nothingToChoose ? null : (
        <>
          <SizeCards state={state} />
          <GroupChips groups={option.groups} state={state} />
        </>
      )}
      <button type="button" className="kx-go kx-slot-ok" disabled={!state.sel.valid} onClick={() => onPick(pick())}>
        <span>{missing ? `Choose ${missing.toLowerCase()}` : "Confirm"}</span>
        <b>{extra ? `+${gbp(extra)}` : "Included"}</b>
      </button>
    </div>
  );
}
