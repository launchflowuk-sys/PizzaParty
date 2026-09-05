---
id: refund-a-customer
title: A customer wants their money back
summary: There is no refund button. The only automatic refund is rejecting a card order before you accept it.
kind: runbook
screens: []
roles: [manager, shift_lead, kitchen, front_of_house]
keywords: [refund, money back, give them their money, part refund, partial refund, overcharged, charged twice, cancel and refund, refund a card, compensation, credit]
requires: []
updated: 2026-09-05
---

## You will know because

A customer wants money back — the order was wrong, it never turned up, or they have changed their mind before you started cooking.

## Do this now

1. **Did they pay by card, and is the ticket still in the New column?** Open the **Reject…** dropdown on that ticket, choose a reason and confirm the *"Reject #…?"* box. That refunds them in full, automatically, and texts them to say so. **This is the only refund the back office can do by itself.**
2. **Did they pay cash?** Refund from the till. There is nothing to do in the system.
3. **Anything else — card, food already made, or only part of an order:** it has to be done in Stripe by whoever holds the Stripe login. Give them three things: the order number, the amount, and the reason. The order number is on the ticket, and on **Orders** if the ticket has gone. **Orders** opens for a manager, a shift lead or front of house — a kitchen sign-in does not get it, so read the number off the ticket before you push it through.

## What the system does and does not do

There is **no refund button anywhere** in the back office, and **no partial refunds at all**. Not on Orders, not on the kitchen board, not on the dashboard.

The automatic refund only fires when the order was actually paid for by card and you reject it before accepting. Once you have pressed **Accept**, the reject dropdown is gone and so is the automatic refund.

Cancelling an order never refunds it, however the cancellation happened.

If that automatic refund fails at Stripe's end, **no screen tells you**. The order still shows as **Rejected** either way, and nothing anywhere in the back office says "refunded". If a customer says the money has not come back, check with whoever holds the Stripe login rather than assuming it went through.

## If it is still wrong

Ring LaunchFlow if a rejected card order was never refunded, or if a refund you issued in Stripe is not showing on the Stripe side. Have the order number ready.

## Afterwards

The order stays on **Orders** as **Rejected**, carrying only the reason you picked from the dropdown. There is nowhere to record what you agreed with the customer or what you paid back, so write it in your own book.
