---
id: order-never-arrived
title: A customer says their food never arrived
summary: Find the order, work out whether it ever left the shop, then decide — there is no tracking and no history.
kind: runbook
screens: []
roles: [manager, shift_lead, front_of_house]
keywords: [never arrived, didnt get food, did not get their food, no food, missing order, order not delivered, food not delivered, where is my order, lost order, late order, never turned up, driver never came, wrong address, not received]
requires: []
updated: 2026-09-05
---

## You will know because

Somebody rings — often an hour later, often cross — saying the food never came. Or they say it went to the wrong house, or that they were charged and got nothing.

## Do this now

1. **Find the order.** Go to **Orders**. Type into the **Search** box — it matches customer name, phone number and delivery postcode — and press **Filter**. The search does not tidy up phone formatting, so `07700 900201` and `+447700900201` will not find each other. Try it with spaces, without spaces, and then try the postcode instead.
2. **If it is not there, widen the search.** The **Status** dropdown starts on **All except unpaid**, so an order the customer never finished paying for is hidden. Choose **Awaiting payment** to see it. Use **From** and **To** if the order was not today — the list shows 50 at a time, newest first.
3. **Read the Status tag on the row.** This is the whole answer to "did it leave":
   - **Ready** — the food is sitting on the pass. It never went out.
   - **Out for delivery** — somebody took it. Ring the driver.
   - **Completed** — a member of staff pressed **Delivered** or **Collected** on the kitchen board.
   - **Rejected** — you turned it down before it was made. If they paid by card, rejecting refunded them in full, automatically.
   - **Cancelled** — somebody stopped it, and that can happen at any point, even after it went out. **Cancelling never refunds anybody**, so if they paid by card the money is still with you.
4. **Check the address that was typed.** Tap the order number and the **customer's own tracking page** opens — the same page they are looking at. It shows the first line of the address, the town and the postcode, the items, and what they paid. It does **not** show the second address line, so a flat or house number typed on that line is invisible here — read the full address off the kitchen ticket instead. Addresses are typed free-hand with no postcode lookup, so a wrong house number goes straight through. **That page needs no login. Anyone with the link can see the order and the address, so do not forward it to anybody else.**
5. **If a driver has it,** ring them from your own phone — their number is not on any screen — and read *A driver has gone off-radar*.
6. **Decide with the customer.** Remake it, or put the money back. There is no partial refund and no refund button; read *A customer wants their money back* before you promise anything.

## What the system does and does not do

There is **no proof of delivery** — no photo, no signature, no driver location, no time-stamped drop.

**There is no order detail page in the back office at all.** Orders is a list and nothing more. The only "detail" view that exists is the customer's public tracking page.

Every status change **is** written to an event log in the database, but **no screen anywhere shows it** — not the back office, not the tracking page. Even if it did, it records only a rough actor (kitchen, admin, system) and never which member of staff pressed the button. You work this out from the current status, the address that was typed, and asking whoever was on.

The search covers name, phone and postcode only. It does not search the street address, the items, or the order total.

## If it is still wrong

Ring LaunchFlow only if the order is not in the list at all and the customer has a payment showing on their statement. Give them the phone number the order was placed with, the time, and the amount.

## Afterwards

If you remade it, press **Delivered** (or **Collected**) on the kitchen board when it goes, or the customer's page will sit on "On its way" all night.

If you put the remake through as a fresh order, tonight's takings on the dashboard count both of them, unless you rejected or cancelled the first one. Nothing nets it off.

Nothing records what you agreed with the customer — not a note, not a reason. Write it in your own book.
