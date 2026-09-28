"use client";
import { gbp } from "@/lib/money";
import type { QueueOrder } from "@/lib/pos-queue-types";
import { PAID_LABEL, PAID_TAG, SOURCE_LABEL, SOURCE_TAG, ageTone, fmtTime, minutesBetween } from "./queue-ui";

export function QueueCard({ order, now, flash, onOpen }: { order: QueueOrder; now: string; flash: boolean; onOpen: () => void }) {
  const tone = ageTone(order, now);
  const ageMin = Math.max(0, Math.round(minutesBetween(order.placedAt, now)));

  return (
    <button type="button" className="pos-q-card" data-tone={tone || undefined} data-flash={flash ? "1" : undefined} onClick={onOpen}>
      <div className="pos-q-card-top">
        <span className="pos-q-card-no">#{order.number}</span>
        <span className={`tag ${SOURCE_TAG[order.source]}`}>{SOURCE_LABEL[order.source]}</span>
      </div>

      <div className="pos-q-card-row">
        <span className="tag tag-neutral">{order.fulfilment === "delivery" ? "Delivery" : "Collection"}</span>
        <span className={`tag ${PAID_TAG[order.paidState]}`}>{PAID_LABEL[order.paidState]}</span>
        {order.amendedAt ? <span className="tag tag-warn">Amended</span> : null}
      </div>

      <span className="pos-q-card-name">{order.customerName}</span>
      {order.address ? <span className="pos-q-card-addr">{order.address}</span> : null}
      <span className="pos-q-card-summary">{order.summary}</span>
      {order.driver ? <span className="pos-q-card-driver">Driver: {order.driver.name}</span> : null}

      <div className="pos-q-card-bottom">
        <span className="pos-q-card-age" data-tone={tone || undefined}>
          {order.dueAt ? `${order.scheduled ? "For" : "Due"} ${fmtTime(order.dueAt)}` : "ASAP"} · {ageMin}m
        </span>
        <span className="pos-q-card-total">{gbp(order.total)}</span>
      </div>
    </button>
  );
}
