import type { FullOrder } from "@/lib/orders";
import type { ChangeData, ChangeLine } from "@/lib/pos-edit";

/**
 * The kitchen's copy of an edit: only what was added and what was voided, so
 * nobody cooks the whole order a second time. Same paper and classes as the
 * kitchen copy of Receipt.
 */
export function ChangeTicket({ order, changes, at, by }: { order: FullOrder; changes: ChangeData; at: Date; by: string }) {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: order.location.timezone }).format(at);
  return (
    <article className="rc" data-copy="kitchen">
      <div className="rc-title">ORDER CHANGED</div>
      <div className="rc-number">
        <span className="n">#{order.number}</span>
        <span className="t">{order.fulfilment === "delivery" ? "DELIVERY" : "COLLECTION"}</span>
      </div>
      <div className="rc-when">{time}<span>by {by}</span></div>
      <hr className="rc-rule" />
      <Lines title="ADD" lines={changes.added} />
      <Lines title="VOID - do not make" lines={changes.removed} />
    </article>
  );
}

function Lines({ title, lines }: { title: string; lines: ChangeLine[] }) {
  if (!lines.length) return null;
  return (
    <>
      <div className="rc-title">{title}</div>
      <table className="rc-items">
        <tbody>
          {lines.map((l, n) => (
            <tr key={n}>
              <td className="q">{l.qty}</td>
              <td className="d">
                <strong>{l.name}{l.size ? ` (${l.size})` : ""}</strong>
                {l.modifiers.length ? <span className="m">+ {l.modifiers.join(", ")}</span> : null}
                {l.components.map((c) => <span key={c} className="c">{c}</span>)}
                {l.notes ? <span className="note">NOTE: {l.notes}</span> : null}
                {l.reason ? <span className="note">WHY: {l.reason}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="rc-rule" />
    </>
  );
}
