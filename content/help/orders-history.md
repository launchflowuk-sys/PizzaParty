---
id: orders-history
title: Orders — finding one, and the CSV
summary: Search by name, phone or postcode, export the figures, and know that nothing on this screen can be changed.
kind: guide
screens: [orders]
roles: []
keywords: [orders, order history, find an order, search, look up, phone number, postcode, customer name, missing order, never arrived, export, csv, spreadsheet, accounts, vat, receipt, refund, change an order, amend]
requires: []
updated: 2026-09-05
---

Orders is the book. Every order the shop has taken is on it, newest first, and you can filter it and take a copy out. What you cannot do is change anything.

## Finding an order

The **Filter** panel at the top has four things:

- **Status** — starts on *All except unpaid*, which hides baskets that were never paid for. Pick a single status to narrow it down.
- **From** and **To** — dates.
- **Search** — one box, "Name, phone or postcode".

Fill in what you have and press **Filter**. **Clear** puts it back.

The search box looks in three places at once: the customer's **name** (capital letters do not matter), their **phone number**, and the **delivery postcode**. Anything that matches any of the three comes back.

Fifty orders show at a time. If there are more, **Previous** and **Next** appear underneath with a count — *51–100 of 340*.

The line above the heading tells you the total and, in amber, how many are **waiting on you** — orders that have been placed and not yet accepted. If that number is not zero, something is sitting on the kitchen board.

It only counts the fifty rows you are looking at, not the whole book, so on page two it starts again.

## Phone search gotcha

**The search matches the number exactly as it was saved, character for character.** It does no tidying up at all.

Orders taken through the website save the number in the international form — `07700 900 201` is stored as **+447700900201**, with no spaces. So typing it the way the customer says it will not find it.

If a number does not come back, do this:

1. **Drop the leading zero and the spaces.** `7700900201` finds `+447700900201`.
2. **Or just use the last six digits** — `900201`. Short, and it is inside the number however it was written.
3. **Or search their name or postcode instead.** Those are usually quicker anyway.

You can see the format for yourself: the phone number is printed under the customer's name in the table.

## The CSV export

**Export CSV** at the top right downloads a spreadsheet: 17 columns, newest first — order number, when, status, delivery or collection, payment method and whether it went through, shop, customer name, phone, email, postcode, the items as one line of text, subtotal, delivery fee, discount, promo code and total. Money is in pounds and pence, ready for the accountant.

Two things to watch:

- **The Search box is not carried over.** Only the **Status** and the **From / To** dates go into the export. If you searched for a name and then pressed Export CSV, you get every order in that date range, not the ones on screen. Filter by date, not by search, when you are exporting.
- **It stops at 5,000 rows and does not tell you.** A wide date range is quietly cut off at the newest 5,000 orders. If you need a whole year, export it a month at a time.

## This screen is read-only

There is no order detail page. Clicking an order number does not open it in the back office — it opens the customer's tracking page (see below).

From this screen you **cannot**:

- change an order, its items, its address or its total;
- add a note to it;
- refund it, in part or in full — there is no refund button anywhere in the back office;
- resend a receipt or a confirmation;
- delete it.

Orders are worked on the **kitchen screen** and nowhere else. Money that has to go back goes back in Stripe, by whoever holds the Stripe login. See *A customer wants a refund* for the whole of it.

## The order link is public

The order number in the first column is a link to the customer's own tracking page.

**That page needs no login.** Anyone holding the link can open it and see the order and the delivery address. It is there so a customer can watch their food without an account.

Open it yourself to check a status — that is fine. Do not forward it, do not paste it into a group chat, and do not put it in an email to anyone but that customer.
