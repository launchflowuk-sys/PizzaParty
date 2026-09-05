---
id: changes-reverting
title: I changed something and it has come back
summary: Prices, hours and delivery bands are rebuilt from your shop's setup file on every update. Ring LaunchFlow.
kind: runbook
screens: []
roles: [manager, shift_lead]
keywords: [price went back, changed it back, prices wrong again, reverted, reset, came back, overwritten, undone, lost my changes, hours changed back, band disappeared, sold out came back, staff role reset, keeps changing]
requires: []
updated: 2026-09-05
---

## You will know because

A price you put up on Tuesday is back to the old one. An opening time you fixed has reset. A delivery band you added has vanished. An item you marked sold out is on sale again. Usually it happens all at once, and usually just after the software has been updated.

## Do this now

1. **Make the change again**, on the screen it belongs to. It will stick until the next update.
2. **Ring LaunchFlow and tell them exactly what you changed** — the item, the old price, the new price; the day and the times; the band name, districts and fee. They have to write it into your shop's setup file, and until they do it will revert again next time.
3. **If more than one thing has moved, assume everything below has.** Go down the list before your next service rather than finding out one item at a time.

## What the system does and does not do

Your shop's menu, prices, hours and delivery settings are **rebuilt from a setup file every time the software restarts**. Anything you changed in the back office that also lives in that file is written straight over.

**Comes back, every update:**

- product names, descriptions, prices, sold-out flags and featured stars
- **hidden items, which come back on sale.** Anything you took off with **Hide** is visible to customers again
- category names and the order of things
- toppings and options, and what each one adds
- deal prices
- opening times
- delivery districts, the standard fee, the minimum order, collection and delivery minutes, the shop's address and phone number
- **charge bands**, which are not merged but wiped and rewritten wholesale — a band you added simply disappears
- everything on **Inventory** — on-hand figures, par levels, and any line you pressed **Reorder** against
- driver names, vehicles and statuses
- staff roles and on-shift flags. **A role change made on the Staff screen is undone silently** — nothing tells you, and somebody turns up on Friday unable to open the screen they need.
- **the discount codes LaunchFlow set up for you.** Codes that came with the shop are rewritten from the file, rules and all — **and switched back on**. A code you disabled on **Promotions** is live again, and a code you edited is back to what LaunchFlow wrote.

**Is never touched:** orders, customers, a discount code you created yourself on **Promotions**, a pause you put on, and anything a customer did.

There is no warning before it happens, no list afterwards of what changed, and nothing in the back office that shows you when the last update ran.

## If it is still wrong

If it reverts again after LaunchFlow have told you it is in the file, ring back the same day with the date and time you noticed and exactly what came back. That means it went into the wrong place.

## Afterwards

Treat the back office as **safe for tonight** — tonight's sold-out items, tonight's pause, a price you are trying out this week. Anything you want permanently, ring LaunchFlow so it goes in the file once.

**After any update, check three things before service:** the *"N sold out"* and *"N hidden"* counts above the heading on **Menu & pricing** (an update can put items back on sale that you had taken off), the roles on **Staff**, and any discount code you had switched off on **Promotions**.
