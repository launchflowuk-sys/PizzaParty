import { test } from "node:test";
import assert from "node:assert/strict";
import { planRefundHeal, STALE_PENDING_MS, stripeRefundOutcome } from "../../apps/web/src/lib/refund-heal";

const now = new Date("2026-09-28T12:00:00Z");
const old = new Date(now.getTime() - STALE_PENDING_MS - 1);
const fresh = new Date(now.getTime() - 1000);

test("only a 4xx answer from Stripe means the refund was not made", () => {
  assert.equal(stripeRefundOutcome({ type: "StripeInvalidRequestError", statusCode: 400 }), "refused");
  assert.equal(stripeRefundOutcome({ type: "StripeRateLimitError", statusCode: 429 }), "refused");
  // No answer, a timeout, a 5xx, or a key still in use: Stripe may have refunded.
  assert.equal(stripeRefundOutcome({ type: "StripeConnectionError" }), "unknown");
  assert.equal(stripeRefundOutcome({ type: "StripeAPIError", statusCode: 500 }), "unknown");
  assert.equal(stripeRefundOutcome({ type: "StripeIdempotencyError", statusCode: 409 }), "unknown");
  assert.equal(stripeRefundOutcome(new Error("socket hang up")), "unknown");
});

test("a refund the till marked failed but Stripe made is revived, not left failed (order #24)", () => {
  const plan = planRefundHeal(
    [{ id: "r_till", status: "failed", stripeRefundId: "re_1", createdAt: old }],
    [{ id: "re_1", status: "succeeded", amount: 300, metadata: { refundId: "r_till" } }],
    now,
  );
  assert.deepEqual(plan.mark, [{ id: "r_till", stripeRefundId: "re_1", status: "succeeded", revive: true }]);
  assert.deepEqual(plan.fresh, []);
  assert.deepEqual(plan.release, []);
});

test("a failed row with no Stripe id is found by metadata.refundId", () => {
  const plan = planRefundHeal(
    [{ id: "r_till", status: "failed", stripeRefundId: "", createdAt: fresh }],
    [{ id: "re_1", status: "succeeded", amount: 300, metadata: { refundId: "r_till" } }],
    now,
  );
  assert.deepEqual(plan.mark, [{ id: "r_till", stripeRefundId: "re_1", status: "succeeded", revive: true }]);
});

test("a Stripe refund with no row is recorded; a failed till row Stripe never saw stays failed (order #23)", () => {
  const plan = planRefundHeal(
    [{ id: "r_till", status: "failed", stripeRefundId: "", createdAt: old }],
    [{ id: "re_dash", status: "succeeded", amount: 200, metadata: {} }],
    now,
  );
  assert.deepEqual(plan.fresh.map((r) => r.id), ["re_dash"]);
  assert.deepEqual(plan.mark, []);
  assert.deepEqual(plan.release, []);
});

test("pending rows settle when Stripe says succeeded, release when Stripe failed them", () => {
  const plan = planRefundHeal(
    [
      { id: "a", status: "pending", stripeRefundId: "", createdAt: fresh },
      { id: "b", status: "succeeded", stripeRefundId: "re_b", createdAt: fresh },
      { id: "c", status: "failed", stripeRefundId: "re_c", createdAt: fresh },
    ],
    [
      { id: "re_a", status: "succeeded", amount: 100, metadata: { refundId: "a" } },
      { id: "re_b", status: "failed", amount: 100, failure_reason: "expired_or_canceled_card" },
      { id: "re_c", status: "failed", amount: 100 },
    ],
    now,
  );
  assert.deepEqual(plan.mark, [{ id: "a", stripeRefundId: "re_a", status: "succeeded", revive: false }]);
  assert.deepEqual(plan.release, [{ id: "b", why: "expired_or_canceled_card" }]);
  assert.deepEqual(plan.fresh, [], "failed Stripe refunds are never recorded as new");
});

test("a pending row Stripe has no record of is released only once it is stale", () => {
  const rows = [
    { id: "young", status: "pending", stripeRefundId: "", createdAt: fresh },
    { id: "stale", status: "pending", stripeRefundId: "", createdAt: old },
  ];
  const plan = planRefundHeal(rows, [], now);
  assert.deepEqual(plan.release.map((r) => r.id), ["stale"]);
  assert.deepEqual(plan.mark, []);
});

test("an already healed payment plans nothing (replays are no-ops)", () => {
  const plan = planRefundHeal(
    [{ id: "r", status: "succeeded", stripeRefundId: "re_1", createdAt: old }],
    [{ id: "re_1", status: "succeeded", amount: 300, metadata: { refundId: "r" } }],
    now,
  );
  assert.deepEqual(plan, { fresh: [], mark: [], release: [] });
});
