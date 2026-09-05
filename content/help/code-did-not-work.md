---
id: code-did-not-work
title: A customer says their code did not work
summary: The message on their screen is nearly always the answer. Here is what each one means and what you can do.
kind: runbook
screens: []
roles: [manager, shift_lead, front_of_house]
keywords: [code, promo code, discount code, voucher, offer code, code not working, code rejected, code expired, wont apply, money off, first order only, minimum spend, referral code, thank you code, discount]
requires: []
updated: 2026-09-05
---

## You will know because

Somebody rings, or stands at the counter, saying the code they were sent will not go on.

## Do this now

1. **Ask exactly what the screen said.** The wording is specific and it is almost always the whole answer:
   - *"Spend £15.00 to use this code."* — their basket is under the code's minimum. Sell them something else, or the code cannot be used.
   - *"This code has expired."* — past its end date.
   - *"This code is for first orders only."* — they have ordered before.
   - *"This code has been fully redeemed."* — it hit its maximum uses.
   - *"This code is no longer active."* — somebody disabled it.
   - *"This code is for delivery only."* (or collection) — they are ordering the other way.
   - *"That code was issued to someone else."* — see step 4.
   - *"Unknown promo code."* — it is not a code on this system. Check the spelling, and check they are not reading a code from another takeaway.
2. **Check the code on Promotions.** The table gives you everything: **Code**, **Type**, the **Rules** column (minimum spend, first order, delivery or collection, end date) and **Uses**. Uses reads *"12/50"* when the code has a maximum and just *"12"* when it has none. A faded row is switched off — the button on the right of it says **Enable**.
3. **If they have ordered from you before and the code is first-order-only, it was never going to work.** The basket does not know who the customer is, so the code looks like it is applying right up until they press Pay. That is not a fault and there is nothing to fix.
4. **If it is their own referral thank-you code** and they saw *"That code was issued to someone else"*, tell them to carry on and place the order — it works when the order is submitted. That message is a display fault, not a refusal.
5. **Be careful about editing.** The form at the top is the only way to change a code, and it saves whatever is in the boxes over the existing code. **Re-saving also switches a disabled code back on.** If you only wanted to check the rules, read them off the table and leave the form alone.

## What the system does and does not do

**One code per order.** Codes do not stack, and a code cannot be combined with another code.

**A percentage code never comes off the delivery fee.** Even 100% off leaves delivery payable. Free delivery is its own separate type of code.

Codes are checked on the server on every single order, so nothing gets past them — and equally, **there is no override anywhere**. You cannot force a code through for one customer, from any screen.

**There is no start date.** A code is live the moment you press **Create / update**, so it cannot be set up in advance for next week.

**There is no delete**, only **Disable**.

Personal referral thank-you codes appear in this same list and build up over time. They belong to one customer each — never put one in a campaign.

## If it is still wrong

Ring LaunchFlow with the code, the customer's phone number, and the exact wording they saw. If a code they should have been able to use was refused, that wording is what tells LaunchFlow why.

## Afterwards

If you honoured a discount the system refused, you have to take it off at the till — there is no way to record it against the order, and nothing on **Marketing** will credit that send with the sale.

If you edited the code to fix it, look at its row afterwards and check it says what you meant, and check it is not switched back on when you wanted it off.

If the code is one LaunchFlow set up for you rather than one you typed yourself, your edit will not last: it is rewritten from your shop's setup file on the next update, and switched back on with it. Ring LaunchFlow so the change goes in the file. Read *I changed something and it has come back*.
