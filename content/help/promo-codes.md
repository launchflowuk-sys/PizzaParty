---
id: promo-codes
title: Discount codes
summary: Set a code up, why re-saving switches it back on, and what a code will never do.
kind: guide
screens: [promos]
roles: []
keywords: [promo, promo code, discount code, voucher, coupon, code, code not working, 10 percent off, free delivery, minimum spend, first order, expired, disable a code, delete a code, thanks code, referral code]
requires: []
updated: 2026-09-05
---

The Promotions screen is where discount codes are made and switched off. There is a form at
the top for making one and a table underneath listing every code the shop has.

One code per order. They never stack.

## Creating a code

Fill in the form at the top and press **Create / update**. Left to right, top to bottom:

- **CODE** — what the customer types. It is forced to capitals, so `friday10` and `FRIDAY10`
  are the same code. Keep it short and easy to say over the phone.
- **The type dropdown** — **% off**, **£ off**, or **Free delivery**.
- **Value (10 = 10% or £10)** — a whole number of percent for a % code, or pounds for a £
  code. Leave it blank on a % or £ code and you have made a code that takes nothing off but
  still looks fine in the list. Free delivery ignores this box.
- **Min order £** — the customer has to spend this much on food before the code will work.
  Blank means no minimum.
- **Max uses (blank = unlimited)** — how many times it can be used in total, across all
  customers. Not per customer.
- **The date box** — the last day it works. See [no start date](#no-start-date).
- **The fulfilment dropdown** — **Delivery & collection**, **Delivery only** or **Collection
  only**.
- **First order only** — see [why a code can look valid then fail](#why-a-code-can-look-valid-then-fail).

The code is live the moment you press the button.

**In the table underneath,** each row shows the code, what it does, its rules in short
(`min £15.00 · first order · delivery · until 01/12/2026`), and its uses — `3/100`, or just
`3` when there is no maximum. The button on the right is **Disable** or **Enable**. A
disabled row is faded out.

The table is in **alphabetical order**, not newest first, so a code you have just made
appears wherever its name falls rather than at the top.

## Editing re-enables a code

**This is the one that catches people out.** Saving anything through that form switches the
code **on**, every time. There is no "active" tick to leave alone — it is set for you.

So if you disabled `TUESDAY20` last month and later retype it to change the minimum spend,
you have just turned it back on as well. Check the row afterwards: if it is faded, it is
off; if it is not, it is live.

**There is also no delete.** The only way to stop a code is **Disable**, and the row stays
in the table for good. Over a couple of years that table gets long.

## No start date

The date box is an **end** date only — the last day the code works. There is nowhere on this
form to say when a code should begin. (Underneath, the system can hold a start date, but only
LaunchFlow can set one. If a customer is ever told *"This code is not active yet"*, that is
what they have hit.)

A code goes live the second you press **Create / update**. You cannot set next Friday's
offer up on Wednesday and leave it. If it must not work before a certain day, either make it
on the day, or make it now and press **Disable** straight away, then **Enable** it when you
want it running.

## Retyping every field

The rows in the table do not fill the form in. There is no Edit button.

To change one thing about an existing code, you retype the code into the form along with
**every other rule you want it to keep**, because whatever you leave blank is saved as
blank:

- blank minimum becomes **no minimum**
- blank max uses becomes **unlimited**
- blank date **removes the expiry**

And there is no warning when you do it. Typing a code that already exists overwrites its
rules silently — no "this code already exists", no confirmation. Read the code's row in the
table first and copy the rules across before you press the button.

## Percent never touches delivery

A **% off** or **£ off** code comes off the food only. The delivery fee is added afterwards
and is never discounted, so even a 100% code still leaves the delivery charge to pay.

If you want to give the delivery away, that is what the **Free delivery** type is for — and
that one takes off the whole delivery fee, whatever band the customer is in.

You cannot do both in one code, and codes do not stack, so a customer cannot have a
percentage off and free delivery together.

## Why a code can look valid then fail

Customers ring about this, so it helps to know what they saw. The website's messages are
specific and are usually the whole answer:

- *"Spend £15.00 to use this code"* — under the minimum.
- *"This code has expired"* — past the end date.
- *"This code has been fully redeemed"* — hit its maximum uses.
- *"This code is for delivery only"* (or collection) — wrong fulfilment.
- *"This code is no longer active"* — somebody disabled it.
- *"Unknown promo code"* — mistyped, or it was never created.

**The awkward one is First order only.** The basket does not know who the customer is until
they identify themselves at the pay step. So a returning customer types a first-order code,
the basket accepts it, the total drops, and only when they go to pay do they read *"This
code is for first orders only"*. It is working exactly as intended, but it looks like a
fault and it makes people cross. If you advertise a first-order code, say "new customers
only" wherever you advertise it.

If you agree to honour a discount the system refused, you have to take it off in cash at the
counter. **There is no override anywhere.**

## Every live code is on your website

**There is no such thing as a private code here.** The website's **Deals** page ends with a
list headed **Codes**, and it shows *every* code that is switched on — the code itself, what
it takes off, its conditions, and a button that puts it straight into the customer's basket.

So a code is a public offer the moment you create it. Two things follow:

- You cannot make a code "for the people who ring up" or "for the ones on the leaflet".
  Anybody on the website can read it and use it.
- A code you only meant for one campaign is being offered to everyone who visits until you
  press **Disable**.

That list is also why a code with a low **Max uses** runs out faster than you expect.

## Thanks codes in the list

While referrals are switched on, every reward the system hands out is created as an ordinary
promo row and lands in this table alongside your own codes. They look like
`THANKS-` followed by five characters.

- Each one belongs to **one named customer**. Anyone else who tries it is told *"That code
  was issued to someone else."*
- They expire on their own.
- **Never put one in a campaign or read one out to another customer.** It will not work for
  them, and it will look like your marketing is broken.
- Do not tidy them away with **Disable** either — that is somebody's reward for bringing you
  a customer.
- They are on the website's **Codes** list too, like any other live code. A stranger who
  tries one is turned away, so no money is at risk, but it is worth knowing they are visible
  before a customer rings up asking what `THANKS-` is.

If the table is getting cluttered with them, that is the system working. Ignore them and
look for your own codes by name.
